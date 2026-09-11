import gradio as gr
import pandas as pd
import plotly.graph_objects as go
from datetime import datetime
from src.repositories.user_repository import UserRepository

class CattleController:
    def __init__(self):
        self.user_repo = UserRepository()

    def fetch_360_profile(self, current_user, tag):
        """Fetches unified medical, productivity, and breeding data for a specific cow."""
        if not current_user or not tag:
            return [], [], [], []
        
        username = current_user["username"]
        
        # 1. AI Diagnosis History
        all_diag = self.user_repo.get_user_diagnosis_history(username)
        tag_diag = [row for row in all_diag if row[1] == tag]
        diag_data = [[r[0], r[2], r[3][:120].replace("\n", " ") + "..."] for r in tag_diag]

        # 2. Vaccination Timeline
        all_vac = self.user_repo.get_user_vaccination_logs(username)
        tag_vac = [row for row in all_vac if row[1] == tag]
        vac_data = [[r[2], r[3], r[4]] for r in tag_vac]

        # 3. Milk Production
        all_milk = self.user_repo.get_user_milk_logs(username, tag)
        milk_data = [[r[0], r[2], r[3], r[4], r[5]] for r in all_milk]

        # 4. Breeding
        all_breed = self.user_repo.get_user_breeding_logs(username)
        tag_breed = [row for row in all_breed if row[0] == tag]
        breed_data = [[r[1], r[2], r[3], r[4], r[5]] for r in tag_breed]

        return diag_data, vac_data, milk_data, breed_data

    def handle_register(self, current_user, tag, breed, age_years, age_months, status):
        if not current_user:
            return "⚠️ Please log in first.", []
            
        # UX Trick: Auto-calculate Approximate DOB from Age
        try:
            y = int(age_years) if age_years else 0
            m = int(age_months) if age_months else 0
            approx_dob = (datetime.now() - pd.DateOffset(years=y, months=m)).strftime("%Y-%m-%d")
        except Exception:
            approx_dob = datetime.now().strftime("%Y-%m-%d")
            
        # pyrefly: ignore [missing-argument]
        success = self.user_repo.save_cattle_profile(current_user["username"], tag, breed, approx_dob, status)
        msg = f"✅ Cattle {tag} registered successfully!" if success else "❌ Failed to register."
        table = self.user_repo.get_user_cattle_profiles(current_user["username"])
        return msg, table

    def build_tab(self):
        with gr.TabItem("🐄 My Herd & 360° Profiles"):
            # Top Half: Registration & Inventory
            with gr.Row():
                with gr.Column(scale=1, variant="panel"):
                    gr.Markdown("### ➕ Register New Cattle")
                    herd_tag = gr.Textbox(label="🏷️ Cattle Tag / Ear ID")
                    
                    # --- UPDATED: Comprehensive Breed List ---
                    herd_breed = gr.Dropdown(
                        choices=[
                            "Gir", "Sahiwal", "Red Sindhi", "Tharparkar", "Kankrej", "Hariana", "Rathi", "Deoni",
                            "Holstein Friesian (HF)", "Jersey", "HF-Cross", "Jersey-Cross", "Crossbreed (Generic)",
                            "Murrah (Buffalo)", "Surti (Buffalo)", "Jaffarabadi (Buffalo)", "Mehsana (Buffalo)", "Nili-Ravi (Buffalo)",
                            "Other"
                        ], 
                        value="Crossbreed (Generic)", 
                        label="🧬 Breed"
                    )
                    
                    # --- FIXED: Replaced DOB string with intuitive Age Spinners ---
                    with gr.Row():
                        herd_age_years = gr.Number(label="🎂 Age (Years)", value=3, minimum=0, precision=0)
                        herd_age_months = gr.Number(label="Age (Months)", value=0, minimum=0, maximum=11, precision=0)
                        
                    herd_status = gr.Dropdown(choices=["Active (Milking)", "Dry", "Heifer", "Calf", "Sold/Deceased"], value="Active (Milking)", label="Status")
                    herd_submit = gr.Button("💾 Register / Update Profile", variant="primary")
                    herd_msg = gr.Markdown()
                    
                with gr.Column(scale=2):
                    gr.Markdown("### 📋 Herd Inventory Overview")
                    herd_table = gr.Dataframe(headers=["Tag ID", "Breed", "Approx. DOB", "Status"], interactive=False)

            gr.Markdown("---")
            
            # Bottom Half: The 360 Digital Twin 
            gr.Markdown("### 🔍 360° Digital Cattle Twin (Unified Health & Productivity Record)")
            gr.Markdown("Select a cattle tag to instantly pull its complete medical, AI diagnostic, and productivity history into a single dashboard.")
            
            profile_selector = gr.Dropdown(label="🎯 Select Cattle Tag to View Full Profile", choices=[])
            
            with gr.Tabs():
                with gr.TabItem("🩺 AI Diagnostics & Medical"):
                    diag_table_360 = gr.Dataframe(headers=["Date", "Language", "Report Summary"], interactive=False)
                with gr.TabItem("💉 Vaccination Schedule"):
                    vac_table_360 = gr.Dataframe(headers=["Vaccine", "Administered Date", "Next Due Date"], interactive=False)
                
                # --- NEW FINTECH ANALYTICS TAB ---
                with gr.TabItem("🥛 Milk Yield & FinTech Analytics"):
                    with gr.Row():
                        with gr.Column(scale=1):
                            milk_table_360 = gr.Dataframe(headers=["Date", "Morning (L)", "Evening (L)", "Total (L)", "Notes"], interactive=False)
                        with gr.Column(scale=1):
                            gr.Markdown("#### 📈 Dairy Profit/Loss Calculator")
                            with gr.Row():
                                price_per_liter = gr.Number(value=50, label="Selling Price per Liter (₹)")
                                daily_feed_cost = gr.Number(value=150, label="Daily Feed Cost (₹)")
                            profit_chart = gr.Plot(label="30-Day Revenue vs Profit")
                            
                with gr.TabItem("🧬 Breeding & Reproduction"):
                    breed_table_360 = gr.Dataframe(headers=["Event Type", "Event Date", "Expected Calving", "Dry Off Date", "Notes"], interactive=False)

        # --- DYNAMIC PLOTLY CHART LOGIC ---
        def update_chart(df_or_list, price, cost):
            if df_or_list is None or len(df_or_list) == 0:
                fig = go.Figure()
                fig.update_layout(title="No Milk Data Available", template="plotly_white")
                return fig
                
            # Safely handle data from Gradio Dataframe
            if isinstance(df_or_list, pd.DataFrame):
                df = df_or_list.copy()
            else:
                df = pd.DataFrame(df_or_list, columns=["Date", "Morning (L)", "Evening (L)", "Total (L)", "Notes"])
                
            if df.empty:
                fig = go.Figure()
                fig.update_layout(title="No Milk Data Available", template="plotly_white")
                return fig

            try:
                # Clean up date and total columns
                df['Date'] = pd.to_datetime(df['Date'])
                # pyrefly: ignore [missing-attribute]
                df['Total (L)'] = pd.to_numeric(df['Total (L)'], errors='coerce').fillna(0)
                df = df.sort_values('Date').tail(30) # Look at the last 30 entries
                
                # Financial logic
                revenue = df['Total (L)'] * price
                profit = revenue - cost
                
                fig = go.Figure()
                # Revenue Bar
                fig.add_trace(go.Bar(x=df['Date'], y=revenue, name="Gross Revenue (₹)", marker_color="#22c55e"))
                # Profit Line
                fig.add_trace(go.Scatter(x=df['Date'], y=profit, name="Net Profit (₹)", mode="lines+markers", line=dict(color="#3b82f6", width=3)))
                
                # Add horizontal line for Break-Even (Zero Profit)
                fig.add_hline(y=0, line_dash="dash", line_color="red", annotation_text="Breakeven Point")
                
                fig.update_layout(
                    title="Financial Performance for Selected Cattle", 
                    template="plotly_white", 
                    barmode='group',
                    yaxis_title="Amount (₹)",
                    xaxis_title="Date",
                    margin=dict(l=20, r=20, t=40, b=20)
                )
                return fig
            except Exception:
                return go.Figure()

        # Bind the chart updates to the table and the number inputs
        milk_table_360.change(fn=update_chart, inputs=[milk_table_360, price_per_liter, daily_feed_cost], outputs=profit_chart)
        price_per_liter.change(fn=update_chart, inputs=[milk_table_360, price_per_liter, daily_feed_cost], outputs=profit_chart)
        daily_feed_cost.change(fn=update_chart, inputs=[milk_table_360, price_per_liter, daily_feed_cost], outputs=profit_chart)

        # Returns the 13 required variables perfectly matching diagnosis_controller.py
        return herd_tag, herd_breed, herd_age_years, herd_age_months, herd_status, herd_submit, herd_msg, herd_table, profile_selector, diag_table_360, vac_table_360, milk_table_360, breed_table_360