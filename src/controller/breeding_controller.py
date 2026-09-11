import gradio as gr
from datetime import datetime
from src.service.breeding_service import BreedingService

class BreedingController:
    def __init__(self):
        self.service = BreedingService()
        self.event_options = [
            "Heat Observed", 
            "Artificial Insemination (AI)", 
            "Pregnancy Confirmed", 
            "Calving (Birth)", 
            "Miscarriage/Abortion"
        ]

    def handle_log(self, current_user, tag, event_type, date_str, notes):
        if not current_user:
            return "⚠️ Please log in first.", []
            
        success, msg = self.service.log_event(current_user["username"], tag, event_type, date_str, notes)
        table_data = self.service.get_schedule_table(current_user["username"])
        return msg, table_data

    def build_tab(self) -> tuple[gr.Dropdown, gr.Dropdown, gr.Textbox, gr.Textbox, gr.Button, gr.Markdown, gr.Dataframe]:
        with gr.TabItem("🧬 Breeding & Reproduction"):
            gr.Markdown("### 🐄 AI, Gestation & Calving Tracker")
            gr.Markdown("Track heat cycles and Artificial Insemination. The system will automatically calculate the 283-day expected calving date and alert you when the 60-day dry period begins.")
            
            with gr.Row():
                with gr.Column(scale=1):
                    # CHANGED: Textbox to Dropdown for global herd synchronization
                    tag_in = gr.Dropdown(label="🏷️ Select Cattle", choices=[], allow_custom_value=True)
                    event_in = gr.Dropdown(choices=self.event_options, value=self.event_options[0], label="📋 Event Type")
                    date_in = gr.Textbox(label="📆 Event Date (YYYY-MM-DD)", value=datetime.now().strftime("%Y-%m-%d"))
                    notes_in = gr.Textbox(label="📝 Notes (Semen ID, Vet Name, etc.)", placeholder="Optional details...")
                    submit_btn = gr.Button("➕ Record Breeding Event", variant="primary")
                    status_msg = gr.Markdown("")

                with gr.Column(scale=2):
                    gr.Markdown("#### 📈 Reproductive History & Alerts")
                    breeding_table = gr.Dataframe(
                        headers=["Tag ID", "Event", "Event Date", "Expected Calving", "Dry-Off Date", "Notes", "Status Alert"],
                        datatype=["str", "str", "str", "str", "str", "str", "str"],
                        interactive=False,
                    )
                    
        # Note: The submit_btn.click event is wired centrally in diagnosis_controller.py 
        # to ensure the current_user state and global dropdown synchronization work perfectly.
        return tag_in, event_in, date_in, notes_in, submit_btn, status_msg, breeding_table