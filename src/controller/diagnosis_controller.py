import json
import urllib.request
import os
import tempfile
import pandas as pd
from datetime import datetime
import gradio as gr
# pyrefly: ignore [missing-module-attribute]
from google import genai
from src.controller.milk_controller import MilkController
from src.controller.schemes_controller import SchemesController
from src.controller.outbreak_controller import OutbreakController
from src.controller.breeding_controller import BreedingController
from src.controller.dashboard_controller import DashboardController
from src.controller.cattle_controller import CattleController
from src.payload.diagnosis_payload import DiagnosisRequest
from src.repositories.prompt_repository import PromptRepository
from src.repositories.user_repository import UserRepository
from src.service.auth_service import AuthService
from src.service.diagnosis_service import DiagnosisService
from src.service.vaccination_service import VACCINE_INTERVALS, VaccinationService
from src.util.pdf_util import PDFReportUtil


PWA_HEAD = """
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#1e3a8a">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="PashuSetu">
<link rel="apple-touch-icon" href="/static/icon-192.png">
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js');
    });
  }
</script>
"""

CUSTOM_CSS = """
.gradio-container { max-width: 1200px !important; margin: 20px auto !important; font-family: system-ui, -apple-system, sans-serif !important; }
#main-title h1 { font-weight: 800 !important; color: #1e3a8a !important; text-align: center !important; margin-bottom: 4px !important; }
#report-output { background-color: #f8fafc !important; border: 1px solid #e2e8f0 !important; border-radius: 10px !important; padding: 16px !important; min-height: 380px !important; }
.wizard-step { padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; }
.roadmap-badge { background: #fef08a; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; font-weight: bold; color: #854d0e; }
.vet-card { padding: 15px; background: #e0f2fe; border-left: 4px solid #0284c7; border-radius: 8px; margin-bottom: 15px; }
"""

class DiagnosisController:

  def __init__(self):
    self.service = DiagnosisService()
    self.auth_service = AuthService()
    self.vac_service = VaccinationService()
    self.user_repo = UserRepository()
    self.schemes_controller = SchemesController()
    self.milk_controller = MilkController()
    self.outbreak_controller = OutbreakController()
    self.breeding_controller = BreedingController()
    self.dashboard_controller = DashboardController()
    self.cattle_controller = CattleController()

  def _build_login_payload(self, user_data):
      role = user_data.get("role", "farmer").lower()
      
      if role == "veterinarian":
          outbreak_alerts, outbreak_df, outbreak_plot = self.outbreak_controller.refresh_data()
          vet_history_table = self.get_history_table(user_data["username"])
          clear_dropdown = gr.update(choices=[], value=None)
          return (
              # 1-5
              gr.update(visible=False), gr.update(visible=True), user_data, f"### 🩺 Logged in as Dr. {user_data['full_name']} (Veterinarian / Admin)", "",
              # 6-18
              gr.update(visible=False), "", "", "", [], [], "", [], "", "", [], None, [],
              # 19-24
              clear_dropdown, clear_dropdown, clear_dropdown, clear_dropdown, clear_dropdown, clear_dropdown,
              # 25-28
              [], [], [], [],
              # 29-33
              gr.update(visible=True), outbreak_alerts, outbreak_df, outbreak_plot, vet_history_table
          )
      else:
          schemes_md = self.schemes_controller.get_initial_content(user_data.get("username"))
          vac_table = self.vac_service.get_schedule_table(user_data["username"])
          milk_table_data, milk_summary = self.milk_controller.get_initial_data(user_data["username"])
          outbreak_alerts_f, outbreak_df_f, outbreak_plot_f = self.outbreak_controller.refresh_data()
          breeding_table_data = self.breeding_controller.service.get_schedule_table(user_data["username"])
          dash_kpi, dash_vac, dash_breed = self.dashboard_controller.refresh_dashboard(user_data["username"])
          
          herd_table_data = self.user_repo.get_user_cattle_profiles(user_data["username"])
          
          user_tags = [row[0] for row in herd_table_data] if herd_table_data else []
          dropdown_update = gr.update(choices=user_tags, value=user_tags[0] if user_tags else None)

          diag_360, vac_360, milk_360, breed_360 = self.cattle_controller.fetch_360_profile(user_data, user_tags[0] if user_tags else None)

          return (
              # 1-5
              gr.update(visible=False), gr.update(visible=True), user_data, f"### 👤 Logged in as: **{user_data['full_name']}** (Farmer)", "",
              # 6-18
              gr.update(visible=True), dash_kpi, dash_vac, dash_breed, herd_table_data, vac_table, schemes_md, milk_table_data, milk_summary, outbreak_alerts_f, outbreak_df_f, outbreak_plot_f, breeding_table_data,
              # 19-24
              dropdown_update, dropdown_update, dropdown_update, dropdown_update, dropdown_update, dropdown_update,
              # 25-28
              diag_360, vac_360, milk_360, breed_360,
              # 29-33
              gr.update(visible=False), "", [], None, []
          )

  def _build_auth_failure(self, msg):
      clear_dropdown = gr.update(choices=[], value=None)
      return (
          gr.update(visible=True), gr.update(visible=False), None, "", msg,
          gr.update(visible=False), "", "", "", [], [], "", [], "", "", [], None, [],
          clear_dropdown, clear_dropdown, clear_dropdown, clear_dropdown, clear_dropdown, clear_dropdown,
          [], [], [], [],
          gr.update(visible=False), "", [], None, []
      )

  def handle_login(self, username, password):
    success, msg, user_data = self.auth_service.login(username, password)
    if success: return self._build_login_payload(user_data)
    return self._build_auth_failure(msg)

  def handle_send_otp(self, phone):
      success, msg = self.auth_service.send_otp(phone)
      if success: return gr.update(visible=True), gr.update(visible=True), msg
      return gr.update(visible=False), gr.update(visible=False), msg

  def handle_verify_otp(self, phone, otp):
      success, msg, user_data = self.auth_service.verify_otp_login(phone, otp)
      if success: return self._build_login_payload(user_data)
      return self._build_auth_failure(msg)

  def handle_logout(self):
    clear_dropdown = gr.update(choices=[], value=None)
    return (
        gr.update(visible=True), gr.update(visible=False), None, "", "ℹ️ You have been logged out.", 
        gr.update(visible=False), "", "", "", [], [], "", [], "", "", [], None, [],
        clear_dropdown, clear_dropdown, clear_dropdown, clear_dropdown, clear_dropdown, clear_dropdown,
        [], [], [], [],
        gr.update(visible=False), "", [], None, []
    )

  def handle_register(self, full_name, username, password, role, gender, category, phone, address, pincode, license_no, add_cow, cow_tag, cow_breed, cow_age_years, cow_age_months, certificate_img):
    if role == "Veterinarian":
        if certificate_img is None:
            return "⚠️ Please upload your Veterinary Certificate or ID Card to proceed."
        
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return "⚠️ System Error: GEMINI_API_KEY is missing. Admin must configure AI for KYC."
            
        try:
            client = genai.Client(api_key=api_key)
            prompt = "You are an automated KYC verification system. Examine the provided image. Does it look like a legitimate doctor's ID, medical license, or Veterinary Council certificate? Respond EXACTLY with the word 'VALID' if it does, or 'INVALID' if it is a random picture (like an animal, selfie, landscape, or blank page)."
            
            response = client.models.generate_content(
                model='gemini-2.5-flash', 
                contents=[prompt, certificate_img]
            )
            
            # pyrefly: ignore [missing-attribute]
            resp_text = response.text or ""
            if "INVALID" in resp_text.upper():
                return "❌ KYC Rejected: The uploaded document does not appear to be a valid medical or veterinary license."
        except Exception as e:
            return f"⚠️ KYC System Error: {str(e)}"

    success, msg = self.auth_service.register(username, password, full_name, role, phone, address, pincode, license_no)
    if success:
        self.user_repo.update_user_demographics(username, gender, category)
        final_msg = msg + "\n\n👉 **Please click the '🔑 Login' tab above to access your dashboard!**"
        
        if role == "Farmer" and add_cow and cow_tag and cow_breed:
            try:
                y = int(cow_age_years) if cow_age_years else 0
                m = int(cow_age_months) if cow_age_months else 0
                approx_dob = (datetime.now() - pd.DateOffset(years=y, months=m)).strftime("%Y-%m-%d")
            except Exception:
                approx_dob = datetime.now().strftime("%Y-%m-%d")

            # pyrefly: ignore [missing-argument]
            cow_success = self.user_repo.save_cattle_profile(username, cow_tag, cow_breed, approx_dob, "Active (Milking)")
            if cow_success: final_msg += f"\n\n✅ First cow (**{cow_tag}**) successfully added to your herd inventory!"
        return final_msg
    return msg

  def handle_register_cow_and_sync(self, current_user, tag, breed, age_years, age_months, status):
    msg, table = self.cattle_controller.handle_register(current_user, tag, breed, age_years, age_months, status)
    user_tags = [row[0] for row in table] if table else []
    dropdown_update = gr.update(choices=user_tags, value=tag)
    new_schemes_md = self.schemes_controller.get_initial_content(current_user["username"] if current_user else None)
    
    diag_360, vac_360, milk_360, breed_360 = self.cattle_controller.fetch_360_profile(current_user, tag)
    return msg, table, dropdown_update, dropdown_update, dropdown_update, dropdown_update, dropdown_update, dropdown_update, new_schemes_md, diag_360, vac_360, milk_360, breed_360

  def handle_add_scheme(self, name, agency, desc, cows, breed, gender, category, benefit, suggestion):
      if not name or not agency: return "⚠️ Please provide at least a Scheme Name and Agency.", self.handle_refresh_schemes()
      # pyrefly: ignore [missing-argument]
      success = self.user_repo.add_scheme(name, agency, desc, cows, breed, gender, category, benefit, suggestion)
      msg = "✅ Scheme published to Database!" if success else "❌ Error saving scheme."
      return msg, self.handle_refresh_schemes()
      
  def handle_refresh_schemes(self):
      data = self.user_repo.get_all_schemes()
      return [[row[0], row[1], row[2], row[4], row[5], row[6], row[7]] for row in data]

  def handle_farmer_search(self, query):
      if not query or not query.strip(): return gr.update(visible=False), "⚠️ Please enter a Username or Phone Number", "", gr.update(choices=[], value=None), []
      farmer = self.user_repo.search_farmer(query.strip())
      if not farmer: return gr.update(visible=False), "❌ Farmer not found. Check the ID/Phone.", "", gr.update(choices=[], value=None), []
      
      details = f"**Name:** {farmer['full_name']} &nbsp;|&nbsp; **Phone:** {farmer['phone']} &nbsp;|&nbsp; **Address:** {farmer['address']}, {farmer['pincode']}"
      cattle = self.user_repo.get_user_cattle_profiles(farmer['username'])
      tags = [c[0] for c in cattle] if cattle else ["No cattle registered"]
      history = self.user_repo.get_farmer_consultations(farmer['username']) if hasattr(self.user_repo, 'get_farmer_consultations') else []
      return gr.update(visible=True), f"✅ Farmer Found: {farmer['username']}", details, gr.update(choices=tags, value=tags[0] if tags else None), history

  def handle_save_consultation(self, current_user, farmer_query, tag, ast_type, gen_symp, gen_meds, gen_notes, vac_name, vac_batch, vac_exp, vac_date, ai_bull, ai_notes):
      if not current_user: return "⚠️ You must be logged in.", []
      farmer = self.user_repo.search_farmer(farmer_query.strip())
      if not farmer or not tag: return "⚠️ Missing information. Please select a farmer and a cow.", []
          
      formatted_notes = ""
      if ast_type == "General Treatment": formatted_notes = f"**Symptoms:** {gen_symp}\n**Meds:** {gen_meds}\n**Notes:** {gen_notes}"
      elif ast_type == "Vaccination":
          formatted_notes = f"**Vaccine:** {vac_name} (Batch: {vac_batch}, Exp: {vac_exp})\n**Date:** {vac_date}"
          try:
              next_due = (datetime.strptime(vac_date, "%Y-%m-%d") + pd.DateOffset(days=180)).strftime("%Y-%m-%d")
              self.user_repo.add_vaccination_log(farmer["username"], tag, vac_name, vac_date, next_due)
          except Exception: pass
      elif ast_type == "Artificial Insemination (AI)": formatted_notes = f"**Procedure:** Artificial Insemination\n**Semen ID/Bull:** {ai_bull}\n**Notes:** {ai_notes}"

      success = self.user_repo.log_vet_consultation(current_user["username"], farmer["username"], tag, datetime.now().strftime("%Y-%m-%d"), formatted_notes)
      history = self.user_repo.get_farmer_consultations(farmer['username']) if hasattr(self.user_repo, 'get_farmer_consultations') else []
      return f"✅ {ast_type} record saved successfully!" if success else "❌ Failed to save record.", history

  def handle_generate_vet_report(self, current_user, time_filter):
      if not current_user: return [], None
      days = 7 if time_filter == "Last 7 Days" else 30 if time_filter == "Last 30 Days" else 365
      records = self.user_repo.get_vet_vaccination_reports(current_user["username"], days)
      if not records: return [], None
      df = pd.DataFrame(records, columns=["Farmer Username", "Cattle Tag", "Vaccine Name", "Administered Date", "Next Due Date"])
      temp_dir = tempfile.gettempdir()
      file_path = os.path.join(temp_dir, f"Vet_Report_{current_user['username']}_{datetime.now().strftime('%Y%m%d')}.csv")
      df.to_csv(file_path, index=False)
      return records, file_path

  def handle_cattle_selection(self, current_user, tag):
      if not current_user or not tag: return [], []
      past_history = self.vac_service.get_schedule_table(current_user["username"], tag)
      upcoming_alerts = self.vac_service.get_personalized_timeline(current_user["username"], tag)
      return past_history, upcoming_alerts

  def handle_log_vaccine(self, current_user, tag, vaccine, admin_date):
      if not current_user: return "⚠️ Please log in first.", [], []
      msg = self.vac_service.log_vaccine(current_user["username"], tag, vaccine, admin_date)[1]
      past, upcoming = self.handle_cattle_selection(current_user, tag)
      return msg, past, upcoming

  def get_history_table(self, username: str):
    records = self.user_repo.get_user_diagnosis_history(username)
    return [[r[0], r[1], r[2], r[3][:120].replace("\n", " ") + "..."] for r in records]

  def handle_diagnosis(self, current_user, tag, image, language: str):
    if image is None: return "⚠️ Please upload an image of the cattle first.", None, gr.update(value=[])
    cattle_tag = tag.strip().upper() if tag else "GENERAL-PATIENT"
    
    # Normalize language name to clean code (e.g., "Hindi (हिन्दी)" -> "hi")
    # pyrefly: ignore [unnecessary-type-conversion]
    lang_lower = str(language).lower()
    lang_code = "mr" if "marathi" in lang_lower else "hi" if "hindi" in lang_lower else "te" if "telugu" in lang_lower else "en"
    
    request = DiagnosisRequest(image=image, language=lang_code)
    response = self.service.diagnose_cattle(request)
    
    # Store clean report for user history
    display_report = response.report
    if current_user and response.success:
      self.user_repo.save_diagnosis_record(
          current_user["username"], 
          cattle_tag, 
          current_user.get("pincode", "000000"), 
          getattr(response, 'disease_prediction', 'Suspected Illness'), 
          language, 
          display_report
      )
    
    # Format for Gradio Markdown view if JSON
    try:
        data = json.loads(display_report)
        if isinstance(data, dict) and "disease" in data:
            display_report = f"""### 🩺 {data.get('disease')} `[{data.get('severity', 'Warning')}]`\n\n**Symptoms:**\n""" + "\n".join([f"- {s}" for s in data.get('symptoms', [])]) + "\n\n**Farmer Advisory:**\n" + "\n".join([f"✓ {a}" for a in data.get('advisory', [])])
    except Exception:
        pass

    return display_report, None, self.cattle_controller.fetch_360_profile(current_user, cattle_tag)[0] if current_user else []

  def handle_export_pdf(self, current_user, tag, language, report_text, image):
    if not report_text or "Diagnostic report will appear here" in report_text: 
        return None
    
    # Normalize language string
    lang_lower = str(language).lower()
    lang_code = "mr" if "marathi" in lang_lower else "hi" if "hindi" in lang_lower else "te" if "telugu" in lang_lower else "en"
    
    farmer_name = current_user["full_name"] if current_user else "Registered Farmer"
    cattle_tag = tag.strip().upper() if tag else "GENERAL"

    try:
        pdf_bytes = PDFReportUtil.generate_pdf(
            farmer_name=farmer_name,
            cattle_tag=cattle_tag,
            language=lang_code,
            report_text=report_text,
            image=image
        )
        
        # Save temporary PDF for Gradio gr.File download
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, f"PashuSetu_Report_{cattle_tag}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf")
        with open(file_path, "wb") as f:
            f.write(pdf_bytes)
        return file_path
    except Exception as e:
        print(f"[ERROR] Failed to export PDF in Gradio: {e}")
        return None

  def handle_language_change(self, selected_lang: str):
    # pyrefly: ignore [missing-attribute]
    t = PromptRepository.UI_TRANSLATIONS.get(selected_lang, PromptRepository.UI_TRANSLATIONS["English"])
    return (
        gr.update(value=t["title"]), 
        gr.update(value=t["description"]), 
        gr.update(label=t["img_label"]), 
        gr.update(label=t["lang_label"]), 
        gr.update(value=t["submit_btn"]), 
        gr.update(value=t["clear_btn"]), 
        gr.update(value=t["report_placeholder"])
    )

  def handle_pincode_autofill(self, pincode: str):
    if pincode and len(pincode) == 6 and pincode.isdigit():
        try:
            req = urllib.request.Request(f"https://api.postalpincode.in/pincode/{pincode}", headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=3) as response:
                data = json.loads(response.read().decode())
                if data and data[0].get("Status") == "Success":
                    post_office = data[0]["PostOffice"][0]
                    return gr.update(value=f"{post_office.get('District', '')}, {post_office.get('State', '')}")
        except Exception: pass
    return gr.update()

  def build_view(self) -> gr.Blocks:
    # pyrefly: ignore [missing-attribute]
    languages = list(PromptRepository.UI_TRANSLATIONS.keys())
    # pyrefly: ignore [missing-attribute]
    default_t = PromptRepository.UI_TRANSLATIONS["English"]
    vaccine_options = list(VACCINE_INTERVALS.keys())
    today_str = datetime.now().strftime("%Y-%m-%d")

    with gr.Blocks(title="PashuSetu - Cattle Healthcare & Management", head=PWA_HEAD, css=CUSTOM_CSS) as demo:
      current_user = gr.State(None)

      with gr.Column(visible=True) as auth_container:
        with gr.Row():
            gr.Markdown("# 🐄 Welcome to PashuSetu\n### Empowering Rural Livestock Management", elem_id="main-title", scale=3)
            global_lang = gr.Dropdown(choices=languages, value="English", label="🌐 App Language (UI)", scale=1)

        with gr.Tabs():
          with gr.TabItem("🔑 Login"):
            with gr.Tabs():
                with gr.TabItem("Password Login"):
                    login_user, login_pwd = gr.Textbox(label="Username", placeholder="Enter username"), gr.Textbox(label="Password", type="password", placeholder="Enter password")
                    login_btn, login_msg = gr.Button("Login", variant="primary"), gr.Markdown("")
                with gr.TabItem("📱 OTP Login"):
                    gr.Markdown("Passwordless login via mobile number.")
                    otp_phone = gr.Textbox(label="Registered Mobile Number", placeholder="e.g. 9876543210")
                    send_otp_btn = gr.Button("Send OTP", variant="secondary")
                    otp_code = gr.Textbox(label="Enter 4-Digit OTP", visible=False)
                    verify_otp_btn = gr.Button("Verify & Login", variant="primary", visible=False)
                    otp_msg = gr.Markdown("")

          with gr.TabItem("📝 Register"):
            gr.Markdown("Create your free account in 3 easy steps.")
            with gr.Column(visible=True, elem_classes="wizard-step") as reg_step_1:
                gr.Markdown("#### Step 1: Personal Information")
                reg_name = gr.Textbox(label="Full Name", placeholder="e.g. Ramesh Kumar")
                reg_role = gr.Dropdown(choices=["Farmer", "Veterinarian"], value="Farmer", label="Role")
                with gr.Row():
                    reg_gender = gr.Radio(choices=["Male", "Female", "Other"], value="Male", label="Gender")
                    reg_category = gr.Radio(choices=["General", "OBC", "SC/ST"], value="General", label="Social Category")
                
                reg_license = gr.Textbox(label="🩺 Veterinary License No.", visible=False)
                reg_certificate = gr.Image(type="pil", label="📷 Upload VCI Certificate / Vet ID (Required for AI Verification)", visible=False)
                
                btn_next_1 = gr.Button("Next ➡️", variant="primary")
            with gr.Column(visible=False, elem_classes="wizard-step") as reg_step_2:
                reg_phone = gr.Textbox(label="📱 Mobile Number")
                reg_pincode = gr.Textbox(label="📍 Pincode", placeholder="e.g. 440001")
                reg_address = gr.Textbox(label="🏠 Full Address")
                with gr.Row():
                    btn_back_2 = gr.Button("⬅️ Back")
                    btn_next_2 = gr.Button("Next ➡️", variant="primary")
            with gr.Column(visible=False, elem_classes="wizard-step") as reg_step_3:
                reg_user, reg_pwd = gr.Textbox(label="Choose Username"), gr.Textbox(label="Choose Password", type="password")
                add_cow_check = gr.Checkbox(label="🐄 Yes, I want to register my first cow right now!", value=False)
                with gr.Column(visible=False, variant="panel") as first_cow_col:
                    first_cow_tag = gr.Textbox(label="🏷️ Cattle Tag / Ear ID")
                    
                    first_cow_breed = gr.Dropdown(
                        choices=[
                            "Gir", "Sahiwal", "Red Sindhi", "Tharparkar", "Kankrej", "Hariana", "Rathi", "Deoni",
                            "Holstein Friesian (HF)", "Jersey", "HF-Cross", "Jersey-Cross", "Crossbreed (Generic)",
                            "Murrah (Buffalo)", "Surti (Buffalo)", "Jaffarabadi (Buffalo)", "Mehsana (Buffalo)", "Nili-Ravi (Buffalo)",
                            "Other"
                        ], 
                        value="Crossbreed (Generic)", 
                        label="🧬 Breed"
                    )
                    
                    with gr.Row():
                        first_cow_age_years = gr.Number(label="🎂 Age (Years)", value=3, minimum=0, precision=0)
                        first_cow_age_months = gr.Number(label="Age (Months)", value=0, minimum=0, maximum=11, precision=0)
                        
                with gr.Row():
                    btn_back_3 = gr.Button("⬅️ Back")
                    reg_btn = gr.Button("✅ Verify KYC & Create Account", variant="primary")
                reg_msg = gr.Markdown("")

      with gr.Column(visible=False) as app_container:
        with gr.Row():
          user_badge = gr.Markdown("")
          logout_btn = gr.Button("🚪 Logout", size="sm", variant="stop")

        # 1. FARMER VIEW CONTAINER
        with gr.Column(visible=False) as farmer_view:
            with gr.Tabs():
              dash_kpi, dash_vac, dash_breed = self.dashboard_controller.build_tab()
              
              (herd_tag, herd_breed, herd_age_years, herd_age_months, herd_status, herd_submit, herd_msg, herd_table, profile_selector, diag_table_360, vac_table_360, milk_table_360, breed_table_360) = self.cattle_controller.build_tab()
              
              with gr.TabItem("🔍 Cattle Disease Diagnosis"):
                title_md, desc_md = gr.Markdown(default_t["title"], elem_id="main-title"), gr.Markdown(default_t["description"])
                with gr.Row():
                  with gr.Column(scale=1):
                    cattle_tag_input = gr.Dropdown(label="🏷️ Select Cattle", choices=[], allow_custom_value=True)
                    lang_dropdown = gr.Dropdown(choices=languages, value="English", label=default_t["lang_label"], visible=False)
                    img_input = gr.Image(type="pil", label=default_t["img_label"], sources=["upload", "webcam", "clipboard"])
                    with gr.Row():
                      submit_btn, clear_btn = gr.Button(default_t["submit_btn"], variant="primary"), gr.Button(default_t["clear_btn"], variant="secondary")
                  with gr.Column(scale=1):
                    markdown_output = gr.Markdown(value=default_t["report_placeholder"], elem_id="report-output")
                    pdf_export_btn, pdf_file_out = gr.Button("📄 Generate PDF Summary", variant="secondary"), gr.File(label="📥 Download Clinical PDF Report", interactive=False)

              (milk_tag_in, milk_morn_in, milk_eve_in, milk_date_in, milk_notes_in, milk_submit_btn, milk_status_msg, milk_table, milk_summary_md, milk_filter_tag, milk_filter_btn) = self.milk_controller.build_tab()
              
              with gr.TabItem("📅 Vaccination & Deworming Alerts"):
                  gr.Markdown("### 💉 Personalized Herd Healthcare Tracker")
                  with gr.Row():
                      with gr.Column(scale=1):
                          vac_tag = gr.Dropdown(label="🏷️ Select Cattle", choices=[], allow_custom_value=True)
                          gr.Markdown("---")
                          gr.Markdown("#### ➕ Log New Dose")
                          vac_type = gr.Dropdown(choices=vaccine_options, value=vaccine_options[0], label="💉 Administered Vaccine")
                          vac_date = gr.Textbox(label="📆 Date Administered (YYYY-MM-DD)", value=today_str)
                          log_vac_btn = gr.Button("💾 Save Record", variant="primary")
                          vac_status_msg = gr.Markdown("")
                      with gr.Column(scale=2):
                          gr.Markdown("#### 🔴 Upcoming Auto-Alerts (Calculated from Age)")
                          upcoming_vac_table = gr.Dataframe(headers=["Target Date", "Vaccine / Treatment", "Urgency", "Medical Notes"], interactive=False)
                          gr.Markdown("#### ✅ Past Administered Doses")
                          vac_table = gr.Dataframe(headers=["Vaccine / Dose", "Administered Date", "Next Due Date", "Status"], interactive=False)
                
              (breed_tag, breed_event, breed_date, breed_notes, breed_submit, breed_status, breed_table) = self.breeding_controller.build_tab()
              
              _, _, schemes_display_md = self.schemes_controller.build_tab()
              outbreak_refresh_btn_f, outbreak_alert_box_f, outbreak_table_f, outbreak_plot_f = self.outbreak_controller.build_tab()

        # 2. VETERINARIAN VIEW CONTAINER
        with gr.Column(visible=False) as vet_view:
            with gr.Tabs():
                with gr.TabItem("🔍 AI Disease Diagnosis"):
                    gr.Markdown("### 🤖 Clinical AI Triage Tool")
                    with gr.Row():
                        with gr.Column(scale=1):
                            vet_diag_tag = gr.Textbox(label="🏷️ Patient Reference/Tag (Optional)", placeholder="e.g. Farmer X's Cow")
                            vet_diag_img = gr.Image(type="pil", label="Upload Clinical Image", sources=["upload", "webcam", "clipboard"])
                            with gr.Row():
                                vet_diag_submit = gr.Button("Run Diagnosis", variant="primary")
                                vet_diag_clear = gr.Button("Clear", variant="secondary")
                        with gr.Column(scale=1):
                            vet_diag_output = gr.Markdown(value="*AI diagnostic report will appear here...*", elem_id="report-output")
                            vet_diag_pdf_btn = gr.Button("📄 Generate PDF Summary", variant="secondary")
                            vet_diag_pdf_out = gr.File(label="📥 Download Clinical PDF Report", interactive=False)
                    gr.Markdown("#### 📜 My AI Diagnostic History")
                    vet_diag_history = gr.Dataframe(headers=["Timestamp", "Tag ID", "Language", "Report Summary"], interactive=False)

                with gr.TabItem("🧑‍🌾 Farmer Search & Assistance"):
                    gr.Markdown("### 🔍 Farmer ID Lookup & Clinical Assistance Logging")
                    with gr.Row():
                        vet_search_query = gr.Textbox(label="Search Farmer (Username or Phone)", placeholder="e.g. ramesh123 or 9876543210", scale=4)
                        vet_search_btn = gr.Button("Search Farmer", variant="primary", scale=1)
                    
                    vet_search_msg = gr.Markdown("")
                    
                    with gr.Column(visible=False, elem_classes="vet-card") as vet_action_panel:
                        vet_farmer_details = gr.Markdown("")
                        with gr.Row():
                            vet_cattle_select = gr.Dropdown(label="🏷️ Select Patient (Cattle Tag)", choices=[], allow_custom_value=True)
                            
                        vet_assistance_type = gr.Dropdown(choices=["General Treatment", "Vaccination", "Artificial Insemination (AI)"], value="General Treatment", label="Type of Assistance Provided")
                        with gr.Column(visible=True) as form_general:
                            vet_gen_symp = gr.Textbox(label="Observed Symptoms")
                            vet_gen_meds = gr.Textbox(label="Prescribed Medicines")
                            vet_gen_notes = gr.Textbox(label="Additional Notes", lines=2)
                        with gr.Column(visible=False) as form_vaccine:
                            with gr.Row():
                                vet_vac_name = gr.Dropdown(choices=vaccine_options, label="Vaccine / Dewormer Name")
                                vet_vac_date = gr.Textbox(label="Date Administered", value=today_str)
                            with gr.Row():
                                vet_vac_batch = gr.Textbox(label="Batch / Vial Number")
                                vet_vac_exp = gr.Textbox(label="Expiry Date")
                        with gr.Column(visible=False) as form_ai:
                            vet_ai_bull = gr.Textbox(label="Semen ID / Bull Breed")
                            vet_ai_notes = gr.Textbox(label="Procedure Notes", lines=2)

                        vet_save_btn = gr.Button("✅ Save Treatment Record", variant="primary")
                        vet_save_msg = gr.Markdown("")
                        vet_consultation_history = gr.Dataframe(headers=["Date", "Attending Veterinarian", "Cattle Tag", "Treatment Notes"], datatype=["str", "str", "str", "str"], interactive=False)

                with gr.TabItem("📊 Vaccination Reports & Analytics"):
                    gr.Markdown("### 💉 Automated Vaccination & Treatment Analytics")
                    with gr.Row():
                        vet_report_filter = gr.Dropdown(choices=["Last 7 Days", "Last 30 Days", "All Time"], value="Last 30 Days", label="Time Period Filter", scale=3)
                        vet_report_btn = gr.Button("Generate Analytics Report", variant="primary", scale=1)
                    vet_report_table = gr.Dataframe(headers=["Farmer Username", "Cattle Tag", "Vaccine Name", "Administered Date", "Next Due Date"], interactive=False)
                    vet_download_btn = gr.File(label="📥 Download Excel/CSV Report", interactive=False)

                outbreak_refresh_btn, outbreak_alert_box, outbreak_table, outbreak_plot = self.outbreak_controller.build_tab()

                with gr.TabItem("🏛️ Scheme Management (CMS)"):
                    gr.Markdown("### ⚙️ Government Scheme Content Management System")
                    gr.Markdown("Publish new schemes to the centralized database. They will instantly become available to all farmers nationwide based on the rules you set.")
                    with gr.Row():
                        with gr.Column():
                            admin_sch_name = gr.Textbox(label="Scheme Name")
                            admin_sch_agency = gr.Textbox(label="Agency/Provider")
                            admin_sch_desc = gr.Textbox(label="Description", lines=2)
                            admin_sch_benefit = gr.Textbox(label="Benefit Text (What they get)")
                            admin_sch_suggestion = gr.Textbox(label="Suggestion Text (How to unlock it)")
                        with gr.Column():
                            admin_sch_min_cows = gr.Slider(minimum=0, maximum=10, step=1, label="Minimum Cows Required")
                            admin_sch_breed = gr.Dropdown(choices=["Any", "Indigenous"], value="Any", label="Target Breed Rule")
                            admin_sch_gender = gr.Dropdown(choices=["Any", "Female", "Male"], value="Any", label="Target Gender Rule")
                            admin_sch_category = gr.Dropdown(choices=["Any", "General", "OBC", "SC/ST"], value="Any", label="Target Social Category Rule")
                            admin_sch_save = gr.Button("💾 Publish Scheme to Database", variant="primary")
                            admin_sch_msg = gr.Markdown()
                    
                    gr.Markdown("#### 📋 Currently Active Schemes Database")
                    admin_sch_refresh = gr.Button("🔄 Load / Refresh Database")
                    admin_sch_table = gr.Dataframe(headers=["ID", "Name", "Agency", "Min Cows", "Target Breed", "Target Gender", "Target Category"], interactive=False)


        # --- Event Bindings ---
        global_lang.change(fn=self.handle_language_change, inputs=[global_lang], outputs=[title_md, desc_md, img_input, lang_dropdown, submit_btn, clear_btn, markdown_output])
        submit_btn.click(fn=self.handle_diagnosis, inputs=[current_user, cattle_tag_input, img_input, global_lang], outputs=[markdown_output, pdf_file_out, diag_table_360])
        pdf_export_btn.click(fn=self.handle_export_pdf, inputs=[current_user, cattle_tag_input, global_lang, markdown_output, img_input], outputs=[pdf_file_out])
        # pyrefly: ignore [missing-attribute]
        clear_btn.click(fn=lambda lang: (None, PromptRepository.UI_TRANSLATIONS.get(lang, PromptRepository.UI_TRANSLATIONS["English"])["report_placeholder"], None), inputs=[global_lang], outputs=[img_input, markdown_output, pdf_file_out])
        milk_submit_btn.click(fn=self.milk_controller.handle_log, inputs=[current_user, milk_tag_in, milk_morn_in, milk_eve_in, milk_date_in, milk_notes_in], outputs=[milk_status_msg, milk_table, milk_summary_md])
        milk_filter_btn.click(fn=self.milk_controller.handle_filter, inputs=[current_user, milk_filter_tag], outputs=[milk_table])
        breed_submit.click(fn=self.breeding_controller.handle_log, inputs=[current_user, breed_tag, breed_event, breed_date, breed_notes], outputs=[breed_status, breed_table])
        
        profile_selector.change(
            fn=self.cattle_controller.fetch_360_profile,
            inputs=[current_user, profile_selector],
            outputs=[diag_table_360, vac_table_360, milk_table_360, breed_table_360]
        )
        
        herd_submit.click(
            fn=self.handle_register_cow_and_sync, 
            inputs=[current_user, herd_tag, herd_breed, herd_age_years, herd_age_months, herd_status], 
            outputs=[herd_msg, herd_table, cattle_tag_input, milk_tag_in, milk_filter_tag, vac_tag, breed_tag, profile_selector, schemes_display_md, diag_table_360, vac_table_360, milk_table_360, breed_table_360]
        )

        vac_tag.change(fn=self.handle_cattle_selection, inputs=[current_user, vac_tag], outputs=[vac_table, upcoming_vac_table])
        log_vac_btn.click(fn=self.handle_log_vaccine, inputs=[current_user, vac_tag, vac_type, vac_date], outputs=[vac_status_msg, vac_table, upcoming_vac_table])

        vet_diag_submit.click(fn=self.handle_diagnosis, inputs=[current_user, vet_diag_tag, vet_diag_img, global_lang], outputs=[vet_diag_output, vet_diag_pdf_out, vet_diag_history])
        vet_diag_pdf_btn.click(fn=self.handle_export_pdf, inputs=[current_user, vet_diag_tag, global_lang, vet_diag_output, vet_diag_img], outputs=[vet_diag_pdf_out])
        vet_diag_clear.click(fn=lambda: (None, "*AI diagnostic report will appear here...*", None), inputs=[], outputs=[vet_diag_img, vet_diag_output, vet_diag_pdf_out])

        btn_next_1.click(fn=lambda: (gr.update(visible=False), gr.update(visible=True)), inputs=None, outputs=[reg_step_1, reg_step_2])
        btn_back_2.click(fn=lambda: (gr.update(visible=True), gr.update(visible=False)), inputs=None, outputs=[reg_step_1, reg_step_2])
        btn_next_2.click(fn=lambda: (gr.update(visible=False), gr.update(visible=True)), inputs=None, outputs=[reg_step_2, reg_step_3])
        btn_back_3.click(fn=lambda: (gr.update(visible=True), gr.update(visible=False)), inputs=None, outputs=[reg_step_2, reg_step_3])
        reg_pincode.change(fn=self.handle_pincode_autofill, inputs=[reg_pincode], outputs=[reg_address])
        add_cow_check.change(fn=lambda is_checked: gr.update(visible=is_checked), inputs=[add_cow_check], outputs=[first_cow_col])
        
        def toggle_vet_fields(r):
            return gr.update(visible=r == "Veterinarian"), gr.update(visible=r == "Veterinarian")
        reg_role.change(fn=toggle_vet_fields, inputs=[reg_role], outputs=[reg_license, reg_certificate])
        
        reg_btn.click(fn=self.handle_register, inputs=[reg_name, reg_user, reg_pwd, reg_role, reg_gender, reg_category, reg_phone, reg_address, reg_pincode, reg_license, add_cow_check, first_cow_tag, first_cow_breed, first_cow_age_years, first_cow_age_months, reg_certificate], outputs=[reg_msg])

        auth_outputs = [
            auth_container, app_container, current_user, user_badge, login_msg, 
            farmer_view, dash_kpi, dash_vac, dash_breed, herd_table, vac_table, 
            schemes_display_md, milk_table, milk_summary_md, outbreak_alert_box_f, outbreak_table_f, outbreak_plot_f, breed_table,
            cattle_tag_input, milk_tag_in, milk_filter_tag, vac_tag, breed_tag, profile_selector,
            diag_table_360, vac_table_360, milk_table_360, breed_table_360,
            vet_view, outbreak_alert_box, outbreak_table, outbreak_plot, vet_diag_history
        ]
        
        login_btn.click(fn=self.handle_login, inputs=[login_user, login_pwd], outputs=auth_outputs)
        logout_btn.click(fn=self.handle_logout, inputs=None, outputs=auth_outputs)
        send_otp_btn.click(fn=self.handle_send_otp, inputs=[otp_phone], outputs=[otp_code, verify_otp_btn, otp_msg])
        verify_otp_btn.click(fn=self.handle_verify_otp, inputs=[otp_phone, otp_code], outputs=auth_outputs)

        vet_search_btn.click(fn=self.handle_farmer_search, inputs=[vet_search_query], outputs=[vet_action_panel, vet_search_msg, vet_farmer_details, vet_cattle_select, vet_consultation_history])
        def toggle_vet_forms(ast_type): return gr.update(visible=ast_type == "General Treatment"), gr.update(visible=ast_type == "Vaccination"), gr.update(visible=ast_type == "Artificial Insemination (AI)")
        vet_assistance_type.change(fn=toggle_vet_forms, inputs=[vet_assistance_type], outputs=[form_general, form_vaccine, form_ai])
        vet_save_btn.click(fn=self.handle_save_consultation, inputs=[current_user, vet_search_query, vet_cattle_select, vet_assistance_type, vet_gen_symp, vet_gen_meds, vet_gen_notes, vet_vac_name, vet_vac_batch, vet_vac_exp, vet_vac_date, vet_ai_bull, vet_ai_notes], outputs=[vet_save_msg, vet_consultation_history])
        vet_report_btn.click(fn=self.handle_generate_vet_report, inputs=[current_user, vet_report_filter], outputs=[vet_report_table, vet_download_btn])

        admin_sch_save.click(fn=self.handle_add_scheme, inputs=[admin_sch_name, admin_sch_agency, admin_sch_desc, admin_sch_min_cows, admin_sch_breed, admin_sch_gender, admin_sch_category, admin_sch_benefit, admin_sch_suggestion], outputs=[admin_sch_msg, admin_sch_table])
        admin_sch_refresh.click(fn=self.handle_refresh_schemes, inputs=[], outputs=[admin_sch_table])

    return demo