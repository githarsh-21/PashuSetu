from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Path
from src.repositories.user_repository import UserRepository

# Router prefix mounted at /api/cattle
router = APIRouter(prefix="/api/cattle", tags=["React Cattle Management"])
user_repo = UserRepository()


# --- Pydantic Schemas ---
class CattleRegisterPayload(BaseModel):
    username: str
    tag: str
    breed: str
    gender: str = "Female"
    age_years: int = Field(default=0, alias="ageYears")
    age_months: int = Field(default=0, alias="ageMonths")
    status: Optional[str] = "Active"

    class Config:
        populate_by_name = True


class CattleDeletePayload(BaseModel):
    username: str
    tag: str


# --- Endpoints ---
@router.post("/register")
async def register_cow(payload: CattleRegisterPayload):
    """Registers a new cow to the farmer's herd inventory using JSON data from React."""
    try:
        clean_tag = payload.tag.strip().upper()
        existing_profiles = user_repo.get_user_cattle_profiles(payload.username) or []

        # Prevent duplicate registrations for active tags
        for row in existing_profiles:
            if row[0].upper() == clean_tag:
                if len(row) > 4 and row[4] == "Active":
                    return {"success": False, "message": f"Cattle tag {clean_tag} already exists in your herd."}

        days_old = (payload.age_years * 365) + (payload.age_months * 30)
        calculated_dob = (datetime.now() - timedelta(days=days_old)).strftime("%Y-%m-%d")

        # Supports save_cattle_profile or add_cattle_profile from UserRepository
        if hasattr(user_repo, "save_cattle_profile"):
            success = user_repo.save_cattle_profile(
                payload.username, clean_tag, payload.breed, payload.gender, calculated_dob, payload.status or "Active"
            )
        else:
            success = user_repo.add_cattle_profile(
                payload.username, clean_tag, payload.breed, payload.gender, calculated_dob
            )

        if success:
            return {"success": True, "message": f"Successfully registered {clean_tag}."}
        return {"success": False, "message": "Failed to register cattle in the database."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete")
@router.post("/delete")
async def delete_cow(payload: CattleDeletePayload):
    """Permanently removes a cattle profile and its associated records."""
    try:
        success = user_repo.delete_cattle_profile(payload.username, payload.tag.strip().upper())
        if success:
            return {"success": True, "message": f"Cattle tag {payload.tag} and all records permanently deleted."}
        return {"success": False, "message": "Failed to delete cattle data. Tag may not exist."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list/{username}")
async def get_cattle_list(username: str = Path(...)):
    """Fetches the active herd roster for dropdown selectors and cards."""
    try:
        profiles = user_repo.get_user_cattle_profiles(username) or []
        formatted_profiles = [
            {
                "tag": row[0],
                "breed": row[1],
                "gender": row[2] if len(row) > 2 else "Female",
                "dob": str(row[3]) if len(row) > 3 else "",
                "status": row[4] if len(row) > 4 else "Active",
            }
            for row in profiles
        ]
        return {"success": True, "herd": formatted_profiles, "data": formatted_profiles}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))