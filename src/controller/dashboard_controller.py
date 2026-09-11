import gradio as gr
from src.service.dashboard_service import DashboardService

class DashboardController:
    def __init__(self):
        self.service = DashboardService()
        
    def refresh_dashboard(self, username: str):
        if not username:
            return "", "", ""
            
        stats = self.service.get_summary(username)
        
        # 1. Format Top KPI Cards
        kpi_html = f"""
        <div style="display: flex; gap: 20px; justify-content: space-between; text-align: center; margin-bottom: 20px;">
            <div style="background: #e0f2fe; padding: 20px; border-radius: 10px; width: 48%; border: 1px solid #bae6fd;">
                <h1 style="margin:0; font-size: 2.5rem; color: #0284c7;">🐄 {stats['total_cattle']}</h1>
                <p style="margin:0; font-weight: bold; color: #0c4a6e; font-size: 1.1rem;">Total Active Cattle</p>
            </div>
            <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; width: 48%; border: 1px solid #bbf7d0;">
                <h1 style="margin:0; font-size: 2.5rem; color: #16a34a;">🥛 {stats['today_milk']:.1f} L</h1>
                <p style="margin:0; font-weight: bold; color: #14532d; font-size: 1.1rem;">Total Milk Yield Today</p>
            </div>
        </div>
        """
        
        # 2. Format Vaccination Alerts
        if stats['upcoming_vaccines']:
            vac_list = "".join([f"<li style='padding:8px 0; border-bottom: 1px solid #eee;'><b>{v[0]}</b>: {v[1]} (Due: <span style='color:#ea580c; font-weight:bold;'>{v[2]}</span>)</li>" for v in stats['upcoming_vaccines']])
            vac_html = f"<ul style='list-style-type: none; padding: 0;'>{vac_list}</ul>"
        else:
            vac_html = "<div style='padding: 15px; background: #f8fafc; border-radius: 8px;'>✅ No upcoming vaccinations in the next 15 days.</div>"
        
        # 3. Format Breeding Alerts
        if stats['breeding_alerts']:
            breed_list = "".join([f"<li style='padding:8px 0; border-bottom: 1px solid #eee;'><b>{b[0]}</b>: Start Dry-Off on <span style='color:#dc2626; font-weight:bold;'>{b[2]}</span> (Calving: {b[1]})</li>" for b in stats['breeding_alerts']])
            breed_html = f"<ul style='list-style-type: none; padding: 0;'>{breed_list}</ul>"
        else:
            breed_html = "<div style='padding: 15px; background: #f8fafc; border-radius: 8px;'>✅ No urgent breeding actions required.</div>"
        
        return kpi_html, vac_html, breed_html
        
    def build_tab(self):
        with gr.TabItem("📊 Farm Dashboard"):
            gr.Markdown("### 👨‍🌾 Farm Overview & Urgent Actions")
            
            kpi_box = gr.HTML()
            
            with gr.Row():
                with gr.Column():
                    gr.Markdown("#### 💉 Upcoming Vaccinations (Next 15 Days)")
                    vac_box = gr.HTML()
                with gr.Column():
                    gr.Markdown("#### 🧬 Urgent Breeding Actions")
                    breed_box = gr.HTML()
                    
        return kpi_box, vac_box, breed_box