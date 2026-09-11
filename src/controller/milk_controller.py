from datetime import datetime, timedelta
import gradio as gr
from src.service.milk_service import MilkService
from src.repositories.user_repository import get_db_connection

class MilkController:
    def __init__(self):
        self.service = MilkService()

    def _cleanup_orphaned_logs(self, username: str):
        """
        Physically deletes milk data for cattle that have been removed, sold, or archived.
        This enforces the strict cascade-delete rule across the entire application.
        """
        if not username: return
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        DELETE FROM milk_logs 
                        WHERE LOWER(username) = LOWER(%s) 
                        AND LOWER(cattle_tag) NOT IN (
                            SELECT LOWER(cattle_tag) 
                            FROM cattle_profiles 
                            WHERE LOWER(username) = LOWER(%s) 
                            AND LOWER(status) = 'active'
                        )
                    """, (username, username))
                conn.commit()
        except Exception as e:
            pass

    def handle_log(self, current_user, tag, morning, evening, date_str, notes):
        if not current_user:
            return "⚠️ Please log in first.", [], ""
        
        username = current_user["username"]
        success, msg = self.service.record_yield(
            username=username, tag=tag, morning=morning, evening=evening, date_str=date_str, notes=notes
        )
        self._cleanup_orphaned_logs(username)
        
        updated_table = self.service.get_logs_table(username)
        summary_md = self.service.get_summary_card(username)
        return msg, updated_table, summary_md

    def handle_filter(self, current_user, tag_filter):
        if not current_user:
            return []
        username = current_user["username"]
        self._cleanup_orphaned_logs(username)
        return self.service.get_logs_table(username, tag_filter.strip() if tag_filter else None)

    def get_initial_data(self, username: str):
        self._cleanup_orphaned_logs(username)
        return (
            self.service.get_logs_table(username),
            self.service.get_summary_card(username)
        )

    def get_frontend_analytics(self, username: str) -> dict:
        if not username:
            return {"error": "User not authenticated"}
            
        # 1. Force hard deletion of removed cattle data BEFORE calculating analytics
        self._cleanup_orphaned_logs(username)
        
        logs = self.service.repo.get_user_milk_logs(username)
        cattle_profiles = self.service.repo.get_user_cattle_profiles(username)
        
        top_breed = "Mixed Dairy"
        active_tags = set()
        
        if cattle_profiles:
            top_breed = cattle_profiles[0][1]
            for c in cattle_profiles:
                if len(c) > 4:
                    c_tag = str(c[0]).strip().upper()
                    c_status = str(c[4]).strip().lower()
                    if c_status == 'active':
                        active_tags.add(c_tag)

        if not logs or not active_tags:
            today = datetime.now()
            last_7_days = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
            chart_data = [{"day": datetime.strptime(d, "%Y-%m-%d").strftime("%a"), "date": d, "morning": 0.0, "evening": 0.0, "total": 0.0} for d in last_7_days]
            trend = [{"date": d, "yield": 0.0} for d in last_7_days]
            
            return {
                "weekly_total": 0.0, "avg_daily": 0.0, "top_breed": top_breed, 
                "chart_data": chart_data, "trend": trend, "contributions": [], 
                "top_performer": {"tag": "N/A", "total": 0}, "anomalies": []
            }

        parsed_logs = []
        max_date_str = ""
        
        for row in logs:
            tag = str(row[1]).strip().upper()
            if tag not in active_tags:
                continue

            date_val = row[0]
            date_str = date_val.strftime("%Y-%m-%d") if hasattr(date_val, 'strftime') else str(date_val)[:10]
            
            morning = float(row[2] or 0.0)
            evening = float(row[3] or 0.0) 
            total = morning + evening 
            
            if not max_date_str or date_str > max_date_str:
                max_date_str = date_str
                
            parsed_logs.append({"date": date_str, "tag": tag, "morning": morning, "evening": evening, "total": total})

        anchor_date = datetime.strptime(max_date_str, "%Y-%m-%d") if max_date_str else datetime.now()
        last_7_days = [(anchor_date - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
        
        daily_map = {d: {"morning": 0.0, "evening": 0.0, "total": 0.0} for d in last_7_days}
        tag_history = {}
        tag_totals_7d = {} 

        for log in parsed_logs:
            d = log["date"]
            raw_tag = log["tag"]
            
            if d in daily_map:
                daily_map[d]["morning"] += log["morning"]
                daily_map[d]["evening"] += log["evening"]
                daily_map[d]["total"] += log["total"]
                
                if raw_tag not in tag_totals_7d:
                    tag_totals_7d[raw_tag] = 0.0
                tag_totals_7d[raw_tag] += log["total"]
                
            if raw_tag not in tag_history:
                tag_history[raw_tag] = []
            tag_history[raw_tag].append((d, log["total"]))

        chart_data = []
        trend = []
        total_volume_7d = 0.0
        
        for d in last_7_days:
            day_name = datetime.strptime(d, "%Y-%m-%d").strftime("%a")
            day_total = daily_map[d]["total"]
            
            chart_data.append({
                "day": day_name, "date": d,
                "morning": round(daily_map[d]["morning"], 1),
                "evening": round(daily_map[d]["evening"], 1),
                "total": round(day_total, 1)
            })
            
            trend.append({
                "date": d,
                "yield": round(day_total, 1)
            })
            
            total_volume_7d += day_total

        avg_daily = round(total_volume_7d / 7, 1) if total_volume_7d > 0 else 0.0

        contributions = [{"tag": tag, "total": round(total, 1)} for tag, total in tag_totals_7d.items()]
        contributions.sort(key=lambda x: x["total"], reverse=True) 
        top_performer = contributions[0] if contributions else {"tag": "N/A", "total": 0}

        anomalies = []
        for tag, records in tag_history.items():
            records.sort(key=lambda x: x[0]) 
            recent_logs = records[-7:] 
            
            if len(recent_logs) >= 2: 
                peak_yield = max([r[1] for r in recent_logs])
                latest_yield = recent_logs[-1][1]
                latest_date = recent_logs[-1][0]

                if peak_yield > 0 and latest_yield >= 0 and peak_yield != latest_yield:
                    drop_pct = ((peak_yield - latest_yield) / peak_yield) * 100
                    
                    if drop_pct >= 25.0:
                        anomalies.append({
                            "type": "critical", "tag": tag,
                            "message": f"CRITICAL DROP ({drop_pct:.1f}%): {tag} dropped from {peak_yield}L to {latest_yield}L. Immediate Mastitis or infection screening advised!",
                            "date": latest_date
                        })
                    elif drop_pct >= 15.0:
                        anomalies.append({
                            "type": "warning", "tag": tag,
                            "message": f"WARNING ({drop_pct:.1f}% drop): {tag} output declined to {latest_yield}L. Monitor closely.",
                            "date": latest_date
                        })

        return {
            "weekly_total": round(total_volume_7d, 1),
            "avg_daily": avg_daily,
            "top_breed": top_breed,
            "chart_data": chart_data,
            "trend": trend,
            "contributions": contributions,
            "top_performer": top_performer,
            "anomalies": anomalies
        }

    def build_tab(self) -> tuple[gr.Dropdown, gr.Number, gr.Number, gr.Textbox, gr.Textbox, gr.Button, gr.Markdown, gr.Dataframe, gr.Markdown, gr.Dropdown, gr.Button]:
        today_str = datetime.now().strftime("%Y-%m-%d")

        with gr.TabItem("🥛 Milk Production & Yield Tracker"):
            gr.Markdown("### 🥛 Daily Milk Yield & Health Correlation Dashboard")
            gr.Markdown("Track morning and evening yields per cow. PashuSetu automatically flags drops >15% to help identify early subclinical mastitis or fever.")

            summary_display = gr.Markdown("📊 *Log in to view farm milk production analytics.*")

            with gr.Row():
                with gr.Column(scale=1):
                    gr.Markdown("#### 📝 Record Daily Milking")
                    cattle_tag_in = gr.Dropdown(label="🏷️ Select Cattle", choices=[], allow_custom_value=True)
                    date_in = gr.Textbox(label="📆 Date (YYYY-MM-DD)", value=today_str)
                    
                    with gr.Row():
                        morning_in = gr.Number(label="🌅 Morning Yield (Liters)", value=0.0, minimum=0.0)
                        evening_in = gr.Number(label="🌇 Evening Yield (Liters)", value=0.0, minimum=0.0)
                    
                    notes_in = gr.Textbox(
                        label="📌 Observations / Events", 
                        placeholder="e.g., Normal, Received FMD Vaccine, Slight udder swelling..."
                    )
                    submit_milk_btn = gr.Button("➕ Save Milk Record", variant="primary")
                    status_msg = gr.Markdown("")

                with gr.Column(scale=2):
                    gr.Markdown("#### 📋 Yield History & Health Correlations")
                    with gr.Row():
                        filter_tag_in = gr.Dropdown(label="🔍 Filter by Tag", choices=[], allow_custom_value=True, scale=3)
                        filter_btn = gr.Button("Filter", scale=1)

                    milk_table = gr.Dataframe(
                        headers=["Date", "Tag ID", "Morning", "Evening", "Total Yield", "Notes / Events", "Health Status"],
                        datatype=["str", "str", "str", "str", "str", "str", "str"],
                        interactive=False
                    )

        return (
            cattle_tag_in, morning_in, evening_in, date_in, notes_in,
            submit_milk_btn, status_msg, milk_table, summary_display,
            filter_tag_in, filter_btn
        )