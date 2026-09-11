import gradio as gr
from src.repositories.user_repository import UserRepository, get_db_connection

class SchemesController:
    def __init__(self):
        self.user_repo = UserRepository()

    def _get_state_from_pincode(self, pincode: str) -> str:
        if not pincode or len(str(pincode)) < 2: return "Maharashtra"
        try:
            prefix = int(str(pincode)[:2])
            if 40 <= prefix <= 44: return "Maharashtra"
            elif 51 <= prefix <= 53: return "Andhra Pradesh"
            elif prefix == 50: return "Telangana"
        except ValueError:
            pass
        return "Maharashtra"

    def get_initial_content(self, username=None) -> dict:
        if not username: return {"error": "Please log in."}

        # 1. AUTO-FIX DATABASE CORRUPTION
        # This guarantees that even if the API does a raw read, the database only hands it clean data.
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("UPDATE users SET gender = 'Male' WHERE UPPER(gender) IN ('N/A', 'NONE', 'NULL', '') AND LOWER(username) = LOWER(%s)", (username,))
                    cursor.execute("UPDATE users SET category = 'General' WHERE UPPER(category) IN ('N/A', 'NONE', 'NULL', '') AND LOWER(username) = LOWER(%s)", (username,))
                conn.commit()
        except Exception as e:
            print(f"DB Auto-fix error: {e}")

        user_name, user_gender, user_category, user_pincode = "Farmer", "Male", "General", ""

        # Fetch Cleaned Demographics
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(%s)", (username,))
                    row = cursor.fetchone()
                    if row:
                        columns = [desc[0] for desc in cursor.description]
                        user_dict = dict(zip(columns, row))
                        
                        user_name = user_dict.get('name') or user_dict.get('full_name') or username
                        user_gender = str(user_dict.get('gender', 'Male')).strip().capitalize()
                        user_category = str(user_dict.get('category') or user_dict.get('social_category', 'General')).strip().capitalize()
                        user_pincode = user_dict.get('pincode', '')
        except Exception as e:
            pass

        user_state = self._get_state_from_pincode(user_pincode)
        
        # Fetch Active Cattle
        num_cows, unique_breeds = 0, []
        try:
            cows = self.user_repo.get_user_cattle_profiles(username) or []
            active_cows = [c for c in cows if len(c) > 4 and str(c[4]).lower() == 'active']
            num_cows = len(active_cows)
            unique_breeds = list(set([str(c[1]) for c in active_cows if len(c) > 1]))
        except Exception as e:
            pass

        # Definitive Hardcoded Schemes Knowledge Base
        schemes = [
            {"name": "Pashu Kisan Credit Card (PKCC)", "provider": "Central Government", "overview": "Working capital loan for animal husbandry.", "min_cows": 1, "target_breed": "Any", "target_gender": "Any", "target_category": "Any", "target_state": "All", "benefit": "Up to ₹1.6 Lakh loan without collateral.", "reason": "Requires at least 1 active registered cattle."},
            {"name": "Rashtriya Gokul Mission (RGM)", "provider": "DAHD (Central)", "overview": "Promotes conservation of indigenous cattle breeds.", "min_cows": 1, "target_breed": "Indigenous", "target_gender": "Any", "target_category": "Any", "target_state": "All", "benefit": "50% capital subsidy on indigenous breed purchase.", "reason": "Requires an indigenous cattle breed (e.g., Gir, Sahiwal)."},
            {"name": "Dairy Entrepreneurship Development Scheme (DEDS)", "provider": "NABARD", "overview": "Support for setting up modern dairy farms.", "min_cows": 2, "target_breed": "Any", "target_gender": "Any", "target_category": "Any", "target_state": "All", "benefit": "25-33% subsidy on total project cost.", "reason": "Requires a minimum herd size of 2 cattle."},
            {"name": "National Livestock Mission (NLM)", "provider": "Central Government", "overview": "Entrepreneurship development in livestock.", "min_cows": 2, "target_breed": "Any", "target_gender": "Any", "target_category": "Any", "target_state": "All", "benefit": "50% capital subsidy up to ₹50 Lakhs.", "reason": "Requires a minimum herd size of 2 cattle."},
            {"name": "Navinyapurna Yojana", "provider": "Maha AHD", "overview": "State-level innovative dairy scheme.", "min_cows": 2, "target_breed": "Any", "target_gender": "Any", "target_category": "Any", "target_state": "Maharashtra", "benefit": "Subsidy for purchasing 2 to 6 milch animals.", "reason": "Requires at least 2 cattle and Maharashtra residency."},
            {"name": "Sharad Pawar Gramin Samridhi Yojana", "provider": "Maharashtra Gov", "overview": "Cow shed construction subsidy.", "min_cows": 2, "target_breed": "Any", "target_gender": "Any", "target_category": "Any", "target_state": "Maharashtra", "benefit": "Up to ₹77,000 for cow shed construction.", "reason": "Requires at least 2 cattle and Maharashtra residency."},
            {"name": "YSR Pasu Nashta Parihara Padhakam", "provider": "Andhra Pradesh Gov", "overview": "Livestock loss compensation scheme.", "min_cows": 1, "target_breed": "Any", "target_gender": "Any", "target_category": "Any", "target_state": "Andhra Pradesh", "benefit": "Compensation of ₹30,000 per deceased cattle.", "reason": "Requires at least 1 cattle and AP residency."},
            {"name": "YSR Cheyutha & Jagananna Pala Velluva", "provider": "Andhra Pradesh Gov", "overview": "Empowering women through dairy cooperatives.", "min_cows": 1, "target_breed": "Any", "target_gender": "Female", "target_category": "Any", "target_state": "Andhra Pradesh", "benefit": "Financial assistance of ₹75,000 over 4 years.", "reason": "Requires Female gender and AP residency."}
        ]

        eligible, future = [], []

        for s in schemes:
            is_eligible = True
            
            # If state doesn't match, push it to future opportunities so it isn't hidden completely
            if s["target_state"] != "All" and s["target_state"] != user_state:
                future.append({"name": s["name"], "reason": f"Available specifically to farmers in {s['target_state']}."})
                continue

            if num_cows < s["min_cows"]:
                is_eligible = False
            
            t_gen = s["target_gender"].lower()
            if t_gen not in ["any", "all"] and t_gen != user_gender.lower():
                is_eligible = False

            t_cat = s["target_category"].lower()
            if t_cat not in ["any", "all"] and t_cat != user_category.lower():
                is_eligible = False

            if s["target_breed"].lower() == "indigenous":
                ind_breeds = ["gir", "sahiwal", "red sindhi", "tharparkar", "khillari", "deoni"]
                if not any(ib in ub.lower() for ib in ind_breeds for ub in unique_breeds):
                    is_eligible = False

            if is_eligible:
                eligible.append({"name": s["name"], "provider": s["provider"], "overview": s["overview"], "benefit": s["benefit"]})
            else:
                future.append({"name": s["name"], "reason": s["reason"]})

        return {
            "profile": {
                "name": user_name, "category": user_category, "gender": user_gender, 
                "cows": num_cows, "breeds": unique_breeds, "state": user_state
            },
            "eligible": eligible, "future": future
        }

    def build_tab(self):
        with gr.TabItem("🏛️ Govt Schemes & Advisory"):
            gr.Markdown("### 🇮🇳 Central & State Cattle Healthcare Advisory")
        return gr.State(None), gr.State(None), gr.Markdown("Module active.")