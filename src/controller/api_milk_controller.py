from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from src.controller.milk_controller import MilkController
from src.repositories.user_repository import UserRepository

router = APIRouter(prefix="/api/milk", tags=["React Milk Analytics"])
user_repo = UserRepository()
milk_ctrl = MilkController()


class MilkLogPayload(BaseModel):
    username: str
    cattle_tag: str
    morning_litres: float
    evening_litres: float
    log_date: str
    notes: Optional[str] = ""


class DeleteMilkRecordPayload(BaseModel):
    username: str
    cattle_tag: str
    identifier: str


@router.get("/analytics/{username}")
async def get_yield_analytics(username: str, days: int = 7):
    try:
        clean_user = username.strip().lower()

        # 1. Fetch strictly filtered telemetry (Automatically triggers DB cleanup of deleted cows)
        analytics_data = milk_ctrl.get_frontend_analytics(clean_user)
        if not isinstance(analytics_data, dict) or "error" in analytics_data:
            raise HTTPException(status_code=400, detail="Failed to fetch analytics")

        # 2. Map chart_data -> trend key for Recharts Line Chart
        chart_data = analytics_data.get("chart_data", [])
        trend = [
            {
                "date": item.get("date") or item.get("day"),
                "yield": float(item.get("total", 0.0))
            }
            for item in chart_data
        ]

        # 3. Strictly use the active-only contributions and top performer from the controller
        contributions = analytics_data.get("contributions", [])
        top_performer = analytics_data.get("top_performer", {"tag": "N/A", "total": 0.0})

        return {
            "success": True,
            "weekly_total": analytics_data.get("weekly_total", 0.0),
            "avg_daily": analytics_data.get("avg_daily", 0.0),
            "trend": trend,
            "contributions": contributions,
            "top_performer": top_performer,
            "anomalies": analytics_data.get("anomalies", [])
        }
    except Exception as e:
        print(f"[ERROR] Milk Analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/log")
async def log_milk_yield(payload: MilkLogPayload):
    try:
        msg, table, summary = milk_ctrl.handle_log(
            {"username": payload.username},
            payload.cattle_tag,
            payload.morning_litres,
            payload.evening_litres,
            payload.log_date,
            payload.notes or "",
        )
        return {"success": True, "message": msg, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete")
async def delete_milk_record(payload: DeleteMilkRecordPayload):
    try:
        success = user_repo.delete_milk_log(
            payload.username, payload.cattle_tag, payload.identifier
        )
        if not success:
            raise HTTPException(status_code=400, detail="Failed to delete milk record.")
        return {"success": True, "message": "Milk record deleted successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/{username}/{tag}")
async def get_cattle_logs(username: str, tag: str):
    try:
        raw_rows = user_repo.get_user_milk_logs(username, cattle_tag=tag)
        formatted = [
            {
                "record_date": str(row[0]),
                "cattle_tag": str(row[1]),
                "morning_yield": float(row[2]),
                "evening_yield": float(row[3]),
                "total_yield": float(row[4]),
                "notes": str(row[5] or "")
            }
            for row in raw_rows
        ]
        return {"success": True, "content": formatted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))