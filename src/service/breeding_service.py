from datetime import datetime, timedelta
from src.repositories.user_repository import UserRepository

class BreedingService:
    def __init__(self):
        self.repo = UserRepository()
        self.gestation_days = 283
        self.dry_period_days = 60

    def log_event(self, username: str, tag: str, event_type: str, event_date_str: str, notes: str):
        if not tag:
            return False, "⚠️ Cattle Tag is required."
            
        try:
            event_date = datetime.strptime(event_date_str, "%Y-%m-%d")
        except ValueError:
            return False, "⚠️ Invalid date format. Use YYYY-MM-DD."

        expected_calving = ""
        dry_off = ""

        # If Artificial Insemination (AI) or Pregnancy is confirmed, calculate future dates
        if event_type in ["Artificial Insemination (AI)", "Pregnancy Confirmed"]:
            calving_date = event_date + timedelta(days=self.gestation_days)
            dry_date = calving_date - timedelta(days=self.dry_period_days)
            
            expected_calving = calving_date.strftime("%Y-%m-%d")
            dry_off = dry_date.strftime("%Y-%m-%d")

        # pyrefly: ignore [missing-attribute]
        success = self.repo.save_breeding_log(
            username, tag, event_type, event_date_str, expected_calving, dry_off, notes
        )
        
        if success:
            return True, f"✅ Successfully logged {event_type} for {tag}."
        return False, "❌ Failed to save record to the database."

    def get_schedule_table(self, username: str):
        # pyrefly: ignore [missing-attribute]
        records = self.repo.get_user_breeding_logs(username)
        formatted = []
        for r in records:
            # Check if a dry off alert is needed
            status = "🟢 Active"
            if r[4]: # If dry_off_date exists
                dry_date = datetime.strptime(r[4], "%Y-%m-%d")
                days_to_dry = (dry_date - datetime.now()).days
                if 0 <= days_to_dry <= 15:
                    status = f"🟡 Dry Off in {days_to_dry} days!"
                elif days_to_dry < 0:
                    status = "🛑 DRY PERIOD (Do not milk)"
                    
            formatted.append([r[0], r[1], r[2], r[3] or "-", r[4] or "-", r[5], status])
        return formatted