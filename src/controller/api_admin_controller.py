from fastapi import APIRouter, HTTPException
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

# THE FIX: Added "/api" to the prefix so the React frontend can find it!
router = APIRouter(prefix="/api/admin", tags=["Admin Dashboard"])

# --- The "Two Worlds" Switch ---
DB_URL = os.environ.get("DATABASE_URL") or os.environ.get("DB_URL")

if DB_URL and "localhost" not in DB_URL:
    DB_URL = DB_URL.strip()
    print("✅ SUCCESS: Admin Controller connected to Cloud Database!")
else:
    DB_URL = "postgresql://postgres:Pass%40123@localhost:5432/pashusetu_db"
    print("⚠️ WARNING: Admin Controller found no cloud URL! Falling back to local DB.")

def get_db_connection():
    """Creates a standard connection for the Admin controller."""
    return psycopg2.connect(DB_URL)

# --- 1. EPIDEMIOLOGICAL OUTBREAK RADAR ---
@router.get("/outbreak-radar")
def get_outbreak_radar():
    """Aggregates disease cases by pincode for the last 30 days."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT pincode, disease_name, COUNT(*) as case_count
                    FROM diagnosis_history
                    WHERE disease_name != 'Healthy' 
                      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
                    GROUP BY pincode, disease_name
                    ORDER BY case_count DESC
                """)
                rows = cursor.fetchall()
                
                clusters = []
                for row in rows:
                    pincode, disease, count = row
                    severity = "critical" if count >= 5 else "warning"
                    action = "Immediate veterinary dispatch required." if severity == "critical" else "Monitor region."
                    clusters.append({
                        "location": f"Pincode: {pincode}",
                        "disease": disease,
                        "case_count": count,
                        "severity": severity,
                        "recommended_action": action
                    })
                
                return {"active_clusters": clusters}
    except Exception as e:
        print("Admin Outbreak Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


# --- 2. USER DETAILS DIRECTORY ---
@router.get("/users")
def get_all_users():
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT id, username, full_name, role, phone, pincode, license_no 
                    FROM users 
                    ORDER BY role, id DESC
                """)
                rows = cursor.fetchall()
                users = []
                for r in rows:
                    users.append({
                        "id": r[0], "username": r[1], "full_name": r[2], 
                        "role": r[3], "phone": r[4], "pincode": r[5], "license_no": r[6]
                    })
                return {"users": users}
    except Exception as e:
        print("Admin Users Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))