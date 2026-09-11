from src.repositories.user_repository import get_db_connection

class DashboardService:
    def get_summary(self, username: str):
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                
                # 1. Total Unique Cattle (Count distinct tags across all logs)
                cursor.execute("""
                    SELECT COUNT(DISTINCT cattle_tag) FROM (
                        SELECT cattle_tag FROM milk_production_logs WHERE username = %s
                        UNION
                        SELECT cattle_tag FROM vaccination_logs WHERE username = %s
                        UNION
                        SELECT cattle_tag FROM breeding_logs WHERE username = %s
                    ) AS combined_tags
                """, (username, username, username))
                # pyrefly: ignore [unsupported-operation]
                total_cattle = cursor.fetchone()[0] or 0

                # 2. Today's Total Milk Yield
                cursor.execute("""
                    SELECT SUM(total_yield) FROM milk_production_logs 
                    WHERE username = %s AND record_date::date = CURRENT_DATE
                """, (username,))
                # pyrefly: ignore [unsupported-operation]
                today_milk = cursor.fetchone()[0] or 0.0

                # 3. Upcoming Vaccinations (Next 15 days)
                cursor.execute("""
                    SELECT cattle_tag, vaccine_name, next_due_date FROM vaccination_logs 
                    WHERE username = %s 
                    AND next_due_date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '15 days'
                    ORDER BY next_due_date ASC LIMIT 5
                """, (username,))
                upcoming_vaccines = cursor.fetchall()

                # 4. Actionable Breeding Alerts (Cows that need to be dried off)
                cursor.execute("""
                    SELECT cattle_tag, expected_calving_date, dry_off_date FROM breeding_logs 
                    WHERE username = %s AND dry_off_date IS NOT NULL AND dry_off_date != ''
                    AND dry_off_date::date BETWEEN CURRENT_DATE - INTERVAL '5 days' AND CURRENT_DATE + INTERVAL '15 days'
                    ORDER BY dry_off_date ASC LIMIT 5
                """, (username,))
                breeding_alerts = cursor.fetchall()

        return {
            "total_cattle": total_cattle,
            "today_milk": today_milk,
            "upcoming_vaccines": upcoming_vaccines,
            "breeding_alerts": breeding_alerts
        }