from src.repositories.user_repository import UserRepository
from datetime import datetime, timedelta
import random

def seed_milk_data():
    repo = UserRepository()
    
    # ⚠️ IMPORTANT: Change this to the actual login username you use to sign in!
    # (e.g., if you log in as 'tejas123', put that here)
    username = "tejas" 
    cattle_tag = "TAG-001" # Make sure this cow exists in his profile!
    
    print(f"Injecting 7 days of milk telemetry for {username}...")

    # Generate dates for the last 7 days
    today = datetime.now()
    
    added = 0
    for i in range(7):
        # Go backwards from 6 days ago up to today
        record_date = (today - timedelta(days=6 - i)).strftime("%Y-%m-%d")
        
        # Simulate realistic Holstein Friesian yield (fluctuating slightly)
        morning_yield = round(random.uniform(12.0, 15.5), 1)
        evening_yield = round(random.uniform(10.0, 13.5), 1)
        total_yield = round(morning_yield + evening_yield, 1)
        
        success = repo.save_milk_log(
            username=username,
            cattle_tag=cattle_tag,
            record_date=record_date,
            morning=morning_yield,
            evening=evening_yield,
            total=total_yield,
            notes="Regular milking"
        )
        
        if success:
            print(f"✅ Logged {total_yield}L on {record_date}")
            added += 1

    print(f"\n🎉 Successfully added {added} milk logs! Refresh your dashboard.")

if __name__ == "__main__":
    seed_milk_data()