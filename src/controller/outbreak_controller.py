import gradio as gr
from fastapi import APIRouter, HTTPException
# pyrefly: ignore [missing-import]
import plotly.express as px

from src.service.outbreak_service import OutbreakService

# =====================================================================
# 1. FASTAPI ROUTER (Powers the React 'Epidemiological Radar' Dashboard)
# =====================================================================

router = APIRouter(prefix="/api/vet", tags=["Outbreak Radar"])
outbreak_service = OutbreakService()


@router.get("/outbreak-surveillance")
async def get_outbreak_surveillance(days: int = 21):
    """
    Analyzes AI diagnoses over the last X days, deduplicates cases by Cattle Tag,
    and clusters them geographically to detect epidemiological outbreaks.
    """
    try:
        telemetry = outbreak_service.get_surveillance_telemetry(days=days)
        return telemetry
    except Exception as e:
        print(f"[ERROR] Outbreak Radar Calculation Failed: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to calculate outbreak telemetry"
        )


# =====================================================================
# 2. GRADIO CONTROLLER (Powers the Python UI / Admin Dashboard)
# =====================================================================

class OutbreakController:
    def __init__(self):
        self.service = outbreak_service

    def refresh_data(self):
        alerts, df = self.service.generate_outbreak_summary()

        # Create a Bar chart (Acts as a visual heatmap of cases per region)
        if not df.empty:
            fig = px.bar(
                df,
                x="Pincode",
                y="Case Count",
                color="Suspected Disease",
                title="Regional Disease Hotspots (Last 30 Days)",
                barmode="group",
            )
        else:
            fig = None

        return alerts, df, fig

    def build_tab(self):
        with gr.TabItem("🗺️ Regional Outbreak Alerts"):
            gr.Markdown("### Community Health & Disease Tracking")
            gr.Markdown(
                "Monitor localized clusters of highly contagious conditions like "
                "FMD or Lumpy Skin Disease based on community diagnostics."
            )

            with gr.Row():
                refresh_btn = gr.Button("🔄 Refresh Live Data", variant="primary")

            with gr.Row():
                with gr.Column(scale=1):
                    gr.Markdown("#### Active Area Alerts")
                    alert_box = gr.Markdown("Loading data...")

                with gr.Column(scale=2):
                    gr.Markdown("#### Outbreak Visualization")
                    outbreak_plot = gr.Plot()

            with gr.Row():
                gr.Markdown("#### Raw Case Data")
                outbreak_table = gr.Dataframe(interactive=False)

            # Wire up the refresh button
            refresh_btn.click(
                fn=self.refresh_data,
                inputs=None,
                outputs=[alert_box, outbreak_table, outbreak_plot],
            )

        return refresh_btn, alert_box, outbreak_table, outbreak_plot