from datetime import datetime, timedelta
from collections import defaultdict
from typing import Optional
from src.repositories.user_repository import UserRepository

class MilkService:
    def __init__(self):
        self.repo = UserRepository()

    def record_yield(self, username: str, tag: str, morning: float, evening: float, date_str: str, notes: str) -> tuple[bool, str]:
        if not tag or not date_str:
            return False, "⚠️ Please provide Cattle Tag / ID and Date."

        try:
            # pyrefly: ignore [unnecessary-type-conversion]
            morning_val = float(morning) if morning else 0.0
            # pyrefly: ignore [unnecessary-type-conversion]
            evening_val = float(evening) if evening else 0.0
        except ValueError:
            return False, "⚠️ Yield amounts must be valid numbers."

        if morning_val < 0 or evening_val < 0:
            return False, "⚠️ Milk yield cannot be negative."

        total_yield = round(morning_val + evening_val, 2)
        if total_yield == 0:
            return False, "⚠️ Total yield must be greater than 0 Liters."

        try:
            datetime.strptime(date_str.strip(), "%Y-%m-%d")
        except ValueError:
            return False, "⚠️ Invalid date format. Please use YYYY-MM-DD."

        success = self.repo.save_milk_log(
            username=username,
            cattle_tag=tag,
            record_date=date_str.strip(),
            morning=morning_val,
            evening=evening_val,
            total=total_yield,
            notes=notes
        )

        if success:
            insight_msg = self.check_yield_drop_alert(username, tag, total_yield)
            return True, f"✅ Logged **{total_yield} L** for Tag #{tag.upper()} on {date_str}. {insight_msg}"
        return False, "❌ Failed to save milk record."

    def check_yield_drop_alert(self, username: str, tag: str, current_yield: float) -> str:
        """Compares current yield to the previous 7-day average to detect health drops."""
        logs = self.repo.get_user_milk_logs(username, tag)
        # Exclude the newly inserted log for baseline calculation
        past_yields = [row[4] for row in logs[1:8]]

        if len(past_yields) >= 2:
            avg_past = sum(past_yields) / len(past_yields)
            drop_percentage = ((avg_past - current_yield) / avg_past) * 100

            if drop_percentage >= 15.0:
                return (
                    f"\n\n🚨 **HEALTH ALERT**: Tag #{tag.upper()} shows a **{round(drop_percentage, 1)}% yield drop** "
                    f"compared to its 7-day average ({round(avg_past, 1)} L). "
                    f"Inspect for early **Mastitis**, fever, or post-vaccination reaction."
                )
        return ""

    def get_logs_table(self, username: str, tag_filter: Optional[str] = None) -> list:
        """Returns rows formatted for Gradio Dataframe: [Date, Tag, Morning (L), Evening (L), Total (L), Health Notes, Status Indicator]"""
        raw_logs = self.repo.get_user_milk_logs(username, tag_filter if tag_filter else None)
        table_data = []

        for row in raw_logs:
            r_date, tag, morning, evening, total, notes = row
            status_badge = "🟢 Normal"
            if notes and ("mastitis" in notes.lower() or "fever" in notes.lower() or "sick" in notes.lower()):
                status_badge = "🔴 Health Issue"
            elif notes and ("vaccine" in notes.lower() or "fmd" in notes.lower()):
                status_badge = "🟡 Post-Vaccine"

            table_data.append([
                r_date,
                tag,
                f"{morning:.1f} L",
                f"{evening:.1f} L",
                f"{total:.1f} L",
                notes if notes else "-",
                status_badge
            ])
        return table_data

    def get_summary_card(self, username: str) -> str:
        logs = self.repo.get_user_milk_logs(username)
        if not logs:
            return "📊 *No milk production logged yet. Add daily records to view yield analytics.*"

        total_production = sum(row[4] for row in logs)
        total_entries = len(logs)
        avg_per_milking = total_production / total_entries if total_entries > 0 else 0.0

        today_str = datetime.now().strftime("%Y-%m-%d")
        today_logs = [row[4] for row in logs if row[0] == today_str]
        today_total = sum(today_logs)

        return f"""
### 🥛 **Farm Production Summary**
- **Today's Total Herd Yield:** `{round(today_total, 1)} Liters`
- **Total Logged Milk Volume:** `{round(total_production, 1)} Liters` across `{total_entries}` records
- **Average Daily Yield / Animal:** `{round(avg_per_milking, 1)} Liters`
"""

    # --- NEW: Added for React Frontend Dashboard ---
    def get_yield_analytics(self, username: str, days: int = 7) -> dict:
        """Processes raw database logs into aggregated analytics for the React frontend charts."""
        logs = self.repo.get_user_milk_logs(username)
        if not logs:
            return {"trend": [], "contributions": [], "weekly_total": 0, "avg_daily": 0}

        # Filter logs for the exact timeframe required
        cutoff_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        recent_logs = [row for row in logs if row[0] >= cutoff_date]

        if not recent_logs:
            return {"trend": [], "contributions": [], "weekly_total": 0, "avg_daily": 0}

        daily_totals = defaultdict(float)
        tag_totals = defaultdict(float)

        # Aggregate data
        for row in recent_logs:
            r_date, tag, morning, evening, total, notes = row
            daily_totals[r_date] += total
            tag_totals[tag] += total

        # Format trend array (sorted chronologically for the Area chart)
        trend = [{"date": k, "yield": round(v, 1)} for k, v in sorted(daily_totals.items())]

        # Format contributions array (for the Pie chart & Leaderboard)
        contributions = [{"tag": k, "total": round(v, 1)} for k, v in tag_totals.items()]
        
        # Sort contributions from highest to lowest so the Top Performer is index 0
        contributions.sort(key=lambda x: x["total"], reverse=True)

        weekly_total = sum(tag_totals.values())
        avg_daily = weekly_total / len(daily_totals) if daily_totals else 0.0

        top_performer = contributions[0] if contributions else {"tag": "N/A", "total": 0}

        return {
            "trend": trend,
            "contributions": contributions,
            "weekly_total": round(weekly_total, 1),
            "avg_daily": round(avg_daily, 1),
            "top_performer": top_performer
        }