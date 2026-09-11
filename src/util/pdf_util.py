import os
import re
import json
import urllib.request
from datetime import datetime
from fpdf import FPDF
from PIL import Image

# Multi-Language PDF Labels Mapping
PDF_LABELS = {
    "en": {
        "title": "PASHUSETU: CLINICAL AI TRIAGE DOSSIER",
        "subtitle": "Automated Bovine Clinical Screening & Veterinary Action Advisory",
        "farmer": "REGISTERED FARMER",
        "tag": "CATTLE EAR TAG",
        "date": "ANALYSIS DATE",
        "lang": "LANGUAGE / LOCALE",
        "assessment": "PRIMARY CLINICAL ASSESSMENT",
        "symptoms": "Observed Visual Symptoms:",
        "advisory": "Immediate Farmer Advisory & Action Steps:",
        "disclaimer": "Legal & Diagnostic Disclaimer: PashuSetu AI is an automated veterinary triage decision-support tool. It does not replace in-person laboratory evaluation, blood titers, or definitive prescription therapy by a licensed veterinary officer."
    },
    "hi": {
        "title": "पशुसेतु: नैदानिक एआई ट्राइएज रिपोर्ट",
        "subtitle": "स्वचालित गोवंशीय नैदानिक जांच एवं पशु चिकित्सा सलाह",
        "farmer": "पंजीकृत किसान",
        "tag": "मवेशी टैग",
        "date": "विश्लेषण तिथि",
        "lang": "भाषा",
        "assessment": "प्राथमिक नैदानिक मूल्यांकन",
        "symptoms": "देखे गए मुख्य लक्षण:",
        "advisory": "तत्काल किसान सलाह और कदम:",
        "disclaimer": "अस्वीकरण: पशुसेतु एआई एक स्वचालित पशु चिकित्सा ट्राइएज उपकरण है। यह एक प्रमाणित पशु चिकित्सक द्वारा व्यक्तिगत जांच और चिकित्सा का विकल्प नहीं है।"
    },
    "mr": {
        "title": "पशुसेतू: क्लिनिकल एआय ट्राइएज अहवाल",
        "subtitle": "स्वयंचलित गोवंशीय क्लिनिकल तपासणी आणि पशुवैद्यकीय सल्ला",
        "farmer": "नोंदणीकृत शेतकरी",
        "tag": "जनावराचा टॅग",
        "date": "विश्लेषणाची तारीख",
        "lang": "भाषा",
        "assessment": "प्राथमिक क्लिनिकल मूल्यांकन",
        "symptoms": "दिसून आलेली मुख्य लक्षणे:",
        "advisory": "तातडीचा शेतकरी सल्ला आणि उपाय:",
        "disclaimer": "अस्वीकरण: पशुसेतू एआय हे स्वयंचलित पशुवैद्यकीय ट्राइएज साधन आहे. हे प्रमाणित पशुवैद्यकीय अधिकाऱ्याच्या तपासणीचा किंवा वैद्यकीय उपचारांचा पर्याय नाही."
    },
    "te": {
        "title": "పశుసేతు: క్లినికల్ AI నిర్ధారణ నివేదిక",
        "subtitle": "ఆటోమేటెడ్ పశువుల స్క్రీనింగ్ మరియు సలహా",
        "farmer": "నమోదైన రైతు",
        "tag": "పశువు ట్యాగ్",
        "date": "విశ్లేషణ తేదీ",
        "lang": "భాష",
        "assessment": "ప్రాథమిక క్లినికల్ అంచనా",
        "symptoms": "గమనించిన ప్రధాన లక్షణాలు:",
        "advisory": "తక్షణ రైతు సలహా మరియు చర్యలు:",
        "disclaimer": "నిరాకరణ: పశుసేతు AI ఒక ఆటోమేటెడ్ సాధనం మాత్రమే. ఇది రిజిస్టర్డ్ పశువైద్యుని ప్రత్యక్ష వైద్య పరీక్షకు ప్రత్యామ్నాయం కాదు."
    }
}

class PDFReportUtil:
    @staticmethod
    def parse_report_data(report_text: str) -> dict:
        if not report_text:
            return {
                "disease": "Suspected Condition",
                "severity": "Warning",
                "symptoms": ["Clinical inspection required"],
                "advisory": ["Consult a local veterinarian immediately"]
            }
        try:
            cleaned_str = re.sub(r"^```(?:json)?|```$", "", report_text.strip(), flags=re.MULTILINE).strip()
            data = json.loads(cleaned_str)
            if isinstance(data, dict):
                return {
                    "disease": str(data.get("disease") or "Suspected Condition").strip(),
                    "severity": str(data.get("severity") or "Warning").strip(),
                    "symptoms": data.get("symptoms", []) if isinstance(data.get("symptoms"), list) else [str(data.get("symptoms"))],
                    "advisory": data.get("advisory", []) if isinstance(data.get("advisory"), list) else [str(data.get("advisory"))]
                }
        except Exception:
            pass

        disease_m = re.search(r"(?:Disease Name|Condition|आजाराचे नाव|बीमारी का नाम|रोग|వ్యాధి పేరు)\s*[:\-–]\s*([^\n\*\-]+)", report_text, re.I)
        severity_m = re.search(r"(?:Severity|धोका पातळी|गंभीरता|తీవ్రత)\s*[:\-–]\s*([^\n\*\-]+)", report_text, re.I)
        symptoms = [
            line.strip("-*• \t") for line in report_text.split("\n")
            if line.strip().startswith(("-", "*", "•"))
        ][:2] or ["Visible clinical signs observed"]

        return {
            "disease": disease_m.group(1).strip() if disease_m else "Suspected Condition",
            "severity": severity_m.group(1).strip() if severity_m else "Warning",
            "symptoms": symptoms,
            "advisory": ["Isolate animal from herd", "Contact local veterinarian"]
        }

    @classmethod
    def download_font_if_missing(cls, font_filename: str, url: str) -> str:
        os.makedirs("static", exist_ok=True)
        font_path = os.path.join("static", font_filename)
        if not os.path.exists(font_path):
            try:
                print(f"[PDF] Downloading {font_filename} for multi-language support...")
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=10) as response, open(font_path, 'wb') as out_file:
                    out_file.write(response.read())
            except Exception as e:
                print(f"[PDF] Failed to download font: {e}")
        return font_path

    @classmethod
    def resolve_font(cls, pdf: FPDF, language: str) -> str:
        # pyrefly: ignore [unnecessary-type-conversion]
        lang = str(language).lower().strip().split("-")[0]
        search_dirs = [os.path.join(os.getcwd(), "static"), "C:\\Windows\\Fonts", "/usr/share/fonts/truetype/noto"]
        
        if lang in ["hi", "mr", "hindi", "marathi"]:
            candidates = ["NotoSansDevanagari-Regular.ttf", "nirmala.ttf", "Nirmala.ttf", "mangal.ttf", "Mangal.ttf"]
            for s_dir in search_dirs:
                for cand in candidates:
                    p = os.path.join(s_dir, cand)
                    if os.path.exists(p):
                        try:
                            pdf.add_font("IndicFont", style="", fname=p)
                            return "IndicFont"
                        except Exception: pass
            
            font_path = cls.download_font_if_missing("NotoSansDevanagari-Regular.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansdevanagari/NotoSansDevanagari-Regular.ttf")
            if os.path.exists(font_path):
                try:
                    pdf.add_font("IndicFont", style="", fname=font_path)
                    return "IndicFont"
                except Exception: pass

        elif lang in ["te", "telugu"]:
            candidates = ["NotoSansTelugu-Regular.ttf", "nirmala.ttf", "Nirmala.ttf", "gautami.ttf", "Gautami.ttf"]
            for s_dir in search_dirs:
                for cand in candidates:
                    p = os.path.join(s_dir, cand)
                    if os.path.exists(p):
                        try:
                            pdf.add_font("IndicFont", style="", fname=p)
                            return "IndicFont"
                        except Exception: pass
            
            font_path = cls.download_font_if_missing("NotoSansTelugu-Regular.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanstelugu/NotoSansTelugu-Regular.ttf")
            if os.path.exists(font_path):
                try:
                    pdf.add_font("IndicFont", style="", fname=font_path)
                    return "IndicFont"
                except Exception: pass

        return "Helvetica"

    @staticmethod
    def safe_cell(pdf, w, h, text, ln=0, fill=False):
        t = re.sub(r'[^\u0000-\uFFFF]', '', str(text))
        try:
            pdf.cell(w, h, t, ln=ln, fill=fill)
        except Exception:
            pdf.cell(w, h, t.encode("ascii", "ignore").decode("ascii"), ln=ln, fill=fill)

    @staticmethod
    def safe_multi_cell(pdf, w, h, text):
        t = re.sub(r'[^\u0000-\uFFFF]', '', str(text))
        try:
            pdf.multi_cell(w, h, t)
        except Exception:
            pdf.multi_cell(w, h, t.encode("ascii", "ignore").decode("ascii"))

    @classmethod
    def generate_pdf(cls, farmer_name: str, cattle_tag: str, language: str, report_text: str, image: Image.Image | None = None) -> bytes:
        pdf = FPDF(orientation="P", unit="mm", format="A4")
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()

        # Extract Language & Get Proper Labels
        # pyrefly: ignore [unnecessary-type-conversion]
        lang_code = str(language).lower().strip().split("-")[0]
        labels = PDF_LABELS.get(lang_code, PDF_LABELS["en"])
        
        body_font = cls.resolve_font(pdf, language)
        is_indic = body_font != "Helvetica"
        
        # Only use style="B" or "I" if the font natively supports it (Helvetica does, downloaded Noto TTFs do not)
        font_b = "" if is_indic else "B"
        font_i = "" if is_indic else "I"

        data = cls.parse_report_data(report_text)
        disease, severity = data["disease"], data["severity"]
        symptoms, advisory = data["symptoms"], data["advisory"]

        # HEADER
        pdf.set_fill_color(15, 23, 42)
        pdf.rect(0, 0, 210, 26, 'F')
        
        pdf.set_text_color(16, 185, 129)
        pdf.set_font(body_font, font_b, 15)
        pdf.set_xy(10, 5)
        cls.safe_cell(pdf, 0, 8, labels["title"], ln=1)

        pdf.set_text_color(226, 232, 240)
        pdf.set_font(body_font, "", 9)
        pdf.set_x(10)
        cls.safe_cell(pdf, 0, 5, labels["subtitle"], ln=1)
        pdf.ln(8)

        # METADATA
        pdf.set_fill_color(248, 250, 252)
        pdf.set_draw_color(226, 232, 240)
        pdf.rect(10, 30, 190, 20, 'DF')
        
        pdf.set_xy(14, 33)
        pdf.set_text_color(100, 116, 139)
        pdf.set_font(body_font, font_b, 8)
        cls.safe_cell(pdf, 40, 4, labels["farmer"], ln=0)
        cls.safe_cell(pdf, 50, 4, labels["tag"], ln=0)
        cls.safe_cell(pdf, 50, 4, labels["date"], ln=0)
        cls.safe_cell(pdf, 40, 4, labels["lang"], ln=1)

        pdf.set_xy(14, 38)
        pdf.set_text_color(15, 23, 42)
        pdf.set_font(body_font, "", 10)
        cls.safe_cell(pdf, 40, 6, farmer_name or "Guest Farmer", ln=0)
        
        pdf.set_font(body_font, font_b, 10)
        # pyrefly: ignore [unnecessary-type-conversion]
        cls.safe_cell(pdf, 50, 6, f"#{str(cattle_tag).upper()}", ln=0)
        cls.safe_cell(pdf, 50, 6, datetime.now().strftime("%d %b %Y, %I:%M %p"), ln=0)
        # pyrefly: ignore [unnecessary-type-conversion]
        cls.safe_cell(pdf, 40, 6, str(language).upper(), ln=1)

        # IMAGE
        current_y = 55
        w_box, x_box = 190, 10
        if image is not None:
            temp_img_path = f"temp_diag_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}.jpg"
            try:
                img_to_embed = image.convert("RGB")
                img_to_embed.thumbnail((800, 800))
                img_to_embed.save(temp_img_path, format="JPEG", quality=85)
                pdf.set_draw_color(203, 213, 225)
                pdf.image(temp_img_path, x=10, y=current_y, w=60, h=42)
                x_box, w_box = 75, 125
            except Exception:
                pass
            finally:
                if os.path.exists(temp_img_path):
                    try: os.remove(temp_img_path)
                    except Exception: pass

        # CONDITION
        sev_str = str(severity).lower()
        if any(w in sev_str for w in ["crit", "गंभीर", "तीव्र", "తీవ్రమైన"]):
            badge_bg, badge_fg = (254, 226, 226), (185, 28, 28)
        elif any(w in sev_str for w in ["warn", "मध्यम", "सतर्कता", "హెచ్చరిక"]):
            badge_bg, badge_fg = (254, 243, 199), (180, 83, 9)
        else:
            badge_bg, badge_fg = (209, 250, 229), (4, 120, 87)

        pdf.set_fill_color(241, 245, 249)
        pdf.set_draw_color(203, 213, 225)
        pdf.rect(x_box, current_y, w_box, 42, 'DF')

        pdf.set_xy(x_box + 4, current_y + 4)
        pdf.set_text_color(71, 85, 105)
        pdf.set_font(body_font, font_b, 8)
        cls.safe_cell(pdf, w_box - 8, 4, labels["assessment"], ln=1)

        pdf.set_xy(x_box + 4, current_y + 9)
        pdf.set_text_color(15, 23, 42)
        pdf.set_font(body_font, "", 12)
        cls.safe_multi_cell(pdf, w_box - 8, 6, disease)

        pdf.set_xy(x_box + 4, current_y + 28)
        pdf.set_fill_color(*badge_bg)
        pdf.set_text_color(*badge_fg)
        pdf.set_font(body_font, "", 9)
        cls.safe_cell(pdf, 50, 8, f"  [ {severity.upper()} ]", fill=True, ln=1)

        # SYMPTOMS
        pdf.set_xy(10, 104)
        pdf.set_fill_color(248, 250, 252)
        pdf.set_draw_color(226, 232, 240)
        pdf.rect(10, 104, 190, 36, 'DF')

        pdf.set_xy(14, 107)
        pdf.set_text_color(30, 41, 59)
        pdf.set_font(body_font, font_b, 10)
        cls.safe_cell(pdf, 0, 5, labels["symptoms"], ln=1)

        pdf.set_font(body_font, "", 9)
        pdf.set_text_color(51, 65, 85)
        for sym in symptoms[:2]:
            pdf.set_x(18)
            cls.safe_multi_cell(pdf, 178, 5, f"-  {sym}")

        # ADVISORY
        pdf.set_xy(10, 144)
        pdf.set_fill_color(236, 253, 245)
        pdf.set_draw_color(167, 243, 208)
        pdf.rect(10, 144, 190, 42, 'DF')

        pdf.set_xy(14, 147)
        pdf.set_text_color(6, 95, 70)
        pdf.set_font(body_font, font_b, 10)
        cls.safe_cell(pdf, 0, 5, labels["advisory"], ln=1)

        pdf.set_font(body_font, "", 9)
        pdf.set_text_color(4, 120, 87)
        for adv in advisory[:3]:
            pdf.set_x(18)
            cls.safe_multi_cell(pdf, 178, 5, f">  {adv}")

        # DISCLAIMER
        pdf.set_xy(10, 192)
        pdf.set_font(body_font, font_i, 8)
        pdf.set_text_color(148, 163, 184)
        pdf.multi_cell(190, 4, labels["disclaimer"])

        # SAFE OUTPUT
        try:
            out = pdf.output(dest="S")
        except Exception:
            out = pdf.output()
            
        if isinstance(out, (bytearray, bytes)):
            return bytes(out)
        return str(out).encode("latin-1", errors="replace")