from datetime import datetime, timedelta
from src.repositories.user_repository import UserRepository

# Standard schedules: interval in days
VACCINE_INTERVALS = {
    "Foot & Mouth Disease (FMD)": 180,       # Every 6 months
    "Lumpy Skin Disease (LSD)": 365,         # Annual
    "Black Quarter (BQ)": 365,               # Annual
    "Hemorrhagic Septicemia (HS)": 365,      # Annual
    "Brucellosis (Calfhood)": 0,             # One-time
    "Deworming (Albendazole/Ivermectin)": 90 # Every 3 months
}

class VaccinationService:
    def __init__(self):
        self.repo = UserRepository()

    def log_vaccine(self, username: str, cattle_tag: str, vaccine_name: str, administered_date_str: str) -> tuple[bool, str]:
        if not cattle_tag or not administered_date_str: 
            return False, "⚠️ Please provide Cattle Tag / ID and Date."
        
        try: 
            admin_date = datetime.strptime(administered_date_str.strip(), "%Y-%m-%d")
        except ValueError: 
            return False, "⚠️ Invalid date format. Please use YYYY-MM-DD (e.g. 2026-03-15)."

        interval = VACCINE_INTERVALS.get(vaccine_name, 180)
        next_due = admin_date + timedelta(days=interval) if interval > 0 else admin_date
        next_due_str = next_due.strftime("%Y-%m-%d") if interval > 0 else "Lifelong (One-time)"

        success = self.repo.add_vaccination_log(username, cattle_tag, vaccine_name, administered_date_str.strip(), next_due_str)
        return (True, f"✅ Logged {vaccine_name}. Next Due: {next_due_str}") if success else (False, "❌ Failed to save.")

    def get_schedule_table(self, username: str, selected_tag: str | None = None) -> list:
        """Returns past administered vaccines. Adapts columns based on context."""
        raw_logs = self.repo.get_user_vaccination_logs(username)
        table_data = []
        today = datetime.now().date()
        
        for log in raw_logs:
            tag, vaccine, given_date, due_date_str = log[1], log[2], log[3], log[4]
            
            if selected_tag:
                if tag != selected_tag: continue
                # Specific cow view (4 columns)
                table_data.append([vaccine, given_date, due_date_str, "✅ Administered"])
            else:
                # General Herd View (5 columns)
                if due_date_str == "Lifelong (One-time)":
                    status = "🟢 Completed"
                else:
                    try:
                        due_date = datetime.strptime(due_date_str, "%Y-%m-%d").date()
                        days_remaining = (due_date - today).days
                        if days_remaining < 0: status = f"🔴 OVERDUE ({abs(days_remaining)} days ago)"
                        elif days_remaining <= 15: status = f"🟡 Due Soon (in {days_remaining} days)"
                        else: status = f"🟢 Up to Date ({days_remaining} days left)"
                    except Exception:
                        status = "⚪ Scheduled"
                table_data.append([tag, vaccine, given_date, due_date_str, status])
                
        return table_data

    # --- REAL-TIME PERSONALIZED ALERTS ENGINE ---
    def get_personalized_timeline(self, username: str, cattle_tag: str) -> list:
        """Calculates exact upcoming calendar dates based on the cow's actual DOB."""
        if not cattle_tag: return []
        
        # 1. Fetch Cow's real Date of Birth from Database
        profiles = self.repo.get_user_cattle_profiles(username)
        cow = next((c for c in profiles if c[0] == cattle_tag), None)
        if not cow: return []
        
        dob_str = cow[2] # Index 2 is date_of_birth
        try:
            dob = datetime.strptime(dob_str, "%Y-%m-%d").date()
            current_age_months = (datetime.now().date() - dob).days // 30
        except Exception:
            current_age_months = 12 # Fallback to 1 year if DOB is malformed
            
        # 2. Check Database for Past History
        logs = self.repo.get_user_vaccination_logs(username)
        cow_logs = [l for l in logs if l[1] == cattle_tag]
        history_status = "Up to Date" if cow_logs else "Unknown / None"
        
        # 3. Generate Timeline rules
        raw_timeline = self._generate_timeline_rules(current_age_months, history_status, "Female")
        
        # 4. Map 'Age in Months' to Exact Future Calendar Dates
        real_schedule = []
        today = datetime.now().date()
        
        for item in raw_timeline:
            target_age_months = item[0]
            months_from_now = target_age_months - current_age_months
            
            if months_from_now < 0: continue # Skip past events
            
            # Calculate target date
            target_date = today + timedelta(days=months_from_now * 30)
            date_str = target_date.strftime("%Y-%m-%d")
            
            # Create Alert Urgency Status
            if months_from_now == 0: status = "🔴 DUE NOW"
            elif months_from_now == 1: status = "🟡 Due Next Month"
            else: status = "⚪ Scheduled"
            
            real_schedule.append([date_str, item[2], status, item[3]])
            
        return real_schedule

    def _generate_timeline_rules(self, current_age_months: int, history_status: str, gender: str) -> list:
        """Core biological rules engine determining what a cow needs at any given age."""
        timeline = []
        is_female = gender.lower() == "female"
        end_age = current_age_months + 24 # Project next 2 years
        last_fmd, last_hsbq, last_deworm, brucellosis_given = -1, -1, -1, False
        
        if history_status == "Unknown / None" and current_age_months > 6:
            timeline.append([current_age_months, "Immediate", "Deworming", "Catch-up: Clear parasites before vax"])
            timeline.append([current_age_months, "Immediate", "Foot & Mouth Disease (FMD)", "Catch-up Primary dose"])
            timeline.append([current_age_months + 1, "In 1 Month", "Foot & Mouth Disease (FMD)", "Booster required 30 days after Primary"])
            last_deworm, last_fmd, brucellosis_given = current_age_months, current_age_months + 1, True 
        elif history_status == "Up to Date":
            last_deworm = current_age_months - (current_age_months % 3)
            if current_age_months >= 5: last_fmd = 5 + ((current_age_months - 5) // 6) * 6
            if current_age_months > 8: brucellosis_given = True

        for age in range(current_age_months, end_age + 1):
            if age == 0: continue
            time_label = "Immediate" if age == current_age_months else f"In {age - current_age_months} Month(s)"
            
            if age % 3 == 0 and age != last_deworm:
                timeline.append([age, time_label, "Deworming (Albendazole)", "Standard 3-month cycle"])
                last_deworm = age
                
            if is_female and 4 <= age <= 8 and not brucellosis_given:
                timeline.append([age, time_label, "Brucellosis (Calfhood)", "LIFETIME DOSE: Females only"])
                brucellosis_given = True
                
            if history_status != "Unknown / None" or current_age_months <= 6:
                if age == 4: timeline.append([age, time_label, "Foot & Mouth Disease (FMD)", "First primary dose"])
                elif age == 5: 
                    timeline.append([age, time_label, "Foot & Mouth Disease (FMD)", "Booster dose"])
                    last_fmd = age
                elif age > 5 and (age - 5) % 6 == 0 and age != last_fmd:
                    timeline.append([age, time_label, "Foot & Mouth Disease (FMD)", "Standard 6-month cycle"])
                    last_fmd = age
            else:
                if last_fmd != -1 and age > last_fmd and (age - last_fmd) % 6 == 0:
                    timeline.append([age, time_label, "Foot & Mouth Disease (FMD)", "Standard 6-month cycle"])
                    last_fmd = age
                    
        return timeline