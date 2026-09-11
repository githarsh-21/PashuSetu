from src.repositories.user_repository import UserRepository

class CattleService:
    def __init__(self):
        self.repo = UserRepository()

    def register_cow(self, username: str, tag: str, breed: str, dob: str, status: str):
        if not tag or not breed:
            return False, "⚠️ Cattle Tag and Breed are required."
            
        # pyrefly: ignore [missing-argument]
        success = self.repo.save_cattle_profile(username, tag, breed, dob, status)
        if success:
            return True, f"✅ Successfully registered/updated profile for {tag}."
        return False, "❌ Failed to save cattle profile."

    def get_herd_table(self, username: str):
        records = self.repo.get_user_cattle_profiles(username)
        formatted = []
        for r in records:
            formatted.append([r[0], r[1], r[2], r[3]])
        return formatted