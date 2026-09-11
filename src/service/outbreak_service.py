import json
import re
from collections import defaultdict
from datetime import datetime, timedelta
import pandas as pd

# Import the database connection manager directly
from src.repositories.user_repository import UserRepository, get_db_connection


class OutbreakService:
    def __init__(self):
        self.repo = UserRepository()
        self.geo_map = {
            "nagpur": [21.1458, 79.0882],
            "wardha": [20.7453, 78.6022],
            "bhandara": [21.1696, 79.6569],
            "amravati": [20.9320, 77.7523],
            "chandrapur": [19.9615, 79.2961],
            "yavatmal": [20.3888, 78.1204],
            "gondia": [21.4598, 80.1961]
        }

    # =========================================================================
    # 1. REACT VET COMMAND RADAR (Deduplication + Cluster Intelligence)
    # =========================================================================
    def get_surveillance_telemetry(self, days: int = 21) -> dict:
        query = f"""
            SELECT 
                d.created_at, 
                d.username, 
                d.cattle_tag, 
                d.disease_name, 
                d.diagnosis_report,
                COALESCE(u.address, 'Nagpur, Maharashtra') AS address,
                d.pincode
            FROM diagnosis_history d
            LEFT JOIN users u ON LOWER(d.username) = LOWER(u.username)
            WHERE d.created_at >= CURRENT_DATE - INTERVAL '{days} days'
            ORDER BY d.created_at DESC
        """

        raw_diagnoses = []
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(query)
                    raw_diagnoses = cursor.fetchall()
        except Exception as e:
            print(f"[OutbreakService] DB Query Error: {e}")
            return {
                "success": False,
                "surveillance_window": f"{days} Days",
                "total_monitored_cases": 0,
                "active_clusters": []
            }

        clusters = defaultdict(lambda: {
            "farms": set(), 
            "cattle": set(), 
            "dates": [],
            "recent_48h_cases": 0
        })

        now = datetime.now()
        forty_eight_hours_ago = now - timedelta(hours=48)
        total_valid_cases = 0

        for row in raw_diagnoses:
            created_at, username, cattle_tag, disease_name, report_text, address, pincode = row
            
            disease = self._normalize_disease(disease_name, report_text)
            if not disease or "healthy" in disease.lower():
                continue

            location = self._resolve_location(address, pincode)
            clean_tag = str(cattle_tag or "UNREGISTERED").strip().upper()
            clean_user = str(username or "anonymous").strip().lower()

            # FIX: Create a globally unique patient ID by combining Farmer Username + Cattle Tag
            # This prevents identical default tags (e.g. "GENERAL-PATIENT") across different farms from being merged.
            unique_patient_id = f"{clean_user}_{clean_tag}"

            key = (disease, location)
            
            is_new_cow = unique_patient_id not in clusters[key]["cattle"]
            
            clusters[key]["farms"].add(clean_user)
            clusters[key]["cattle"].add(unique_patient_id)
            clusters[key]["dates"].append(created_at)

            if is_new_cow and isinstance(created_at, datetime) and created_at >= forty_eight_hours_ago:
                clusters[key]["recent_48h_cases"] += 1

            total_valid_cases += 1

        active_clusters = []
        for (disease, location), data in clusters.items():
            case_count = len(data["cattle"])
            farm_count = len(data["farms"])

            # Lowered the cluster threshold slightly to make it easier to test outbreaks
            if case_count >= 1 or farm_count >= 1:
                is_critical = case_count >= 3 or farm_count >= 2
                severity = "critical" if is_critical else "warning"

                loc_key = location.split(",")[0].lower().strip()
                base_coords = self.geo_map.get(loc_key, [21.1458, 79.0882])

                min_date = min(data["dates"]) if data["dates"] else now
                first_detected = (
                    min_date.strftime("%d %b %Y") 
                    if hasattr(min_date, "strftime") 
                    else str(min_date)[:10]
                )

                recent_gain = data["recent_48h_cases"]
                velocity_str = f"+{recent_gain} in 48h" if recent_gain > 0 else "0 in 48h"

                active_clusters.append({
                    "id": f"CLUS-{abs(hash((disease, location))) % 10000:04d}",
                    "disease": disease,
                    "location": location,
                    "coordinates": base_coords,
                    "case_count": case_count,
                    "farm_count": farm_count,
                    "severity": severity,
                    "velocity": velocity_str,
                    "trend": "up" if recent_gain > 0 else "flat",
                    "recommended_action": self._get_protocol(disease, severity),
                    "first_detected": first_detected
                })

        active_clusters.sort(key=lambda x: (x["severity"] == "warning", -x["case_count"]))

        return {
            "success": True,
            "surveillance_window": f"{days} Days",
            "total_monitored_cases": total_valid_cases,
            "active_clusters": active_clusters
        }

    # =========================================================================
    # 2. GRADIO / ADMIN DASHBOARD COMPATIBILITY
    # =========================================================================
    def generate_outbreak_summary(self):
        data = []
        try:
            # FIX: Use SQL concatenation (username || '_' || cattle_tag) to ensure distinct counting across farms
            query = """
                SELECT pincode, disease_name, COUNT(DISTINCT username || '_' || cattle_tag) as case_count
                FROM diagnosis_history
                WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY pincode, disease_name
                HAVING COUNT(DISTINCT username || '_' || cattle_tag) >= 1
                ORDER BY case_count DESC
            """
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(query)
                    data = cursor.fetchall()
        except Exception:
            pass

        if not data:
            return "✅ **No major outbreaks detected in the last 30 days.**", pd.DataFrame()

        df = pd.DataFrame(data, columns=["Pincode", "Suspected Disease", "Case Count"])

        alerts = []
        for _, row in df.iterrows():
            if row["Case Count"] >= 3:
                alerts.append(
                    f"🚨 **HIGH ALERT:** {row['Case Count']} unique cases of "
                    f"**{row['Suspected Disease']}** in Pincode **{row['Pincode']}**."
                )

        alert_md = "\n\n".join(alerts) if alerts else "🟡 **Monitoring Active:** Minor cases reported, but no severe clusters detected."
        return alert_md, df

    # =========================================================================
    # 3. HELPER UTILITIES
    # =========================================================================
    def _normalize_disease(self, disease_col: str, report_text: str) -> str:
        val = (disease_col or "").strip()
        lower_val = val.lower()

        if lower_val in ["foot and mouth disease", "fmd", "foot and mouth disease (fmd)"]:
            return "Foot and Mouth Disease (FMD)"
        if lower_val in ["lumpy skin disease", "lsd", "lumpy skin disease (lsd)"]:
            return "Lumpy Skin Disease (LSD)"
        if "mastitis" in lower_val:
            return "Mastitis"

        report_lower = str(report_text or "").lower()
        if "foot and mouth" in report_lower or "fmd" in report_lower:
            return "Foot and Mouth Disease (FMD)"
        if "lumpy" in report_lower or "lsd" in report_lower:
            return "Lumpy Skin Disease (LSD)"
        
        return val if val and lower_val not in ["suspected illness", "unknown", "none"] else "Suspected Illness"

    def _resolve_location(self, address: str, pincode: str) -> str:
        addr_lower = str(address or "").lower()
        for city in ["bhandara", "wardha", "amravati", "chandrapur", "nagpur", "yavatmal", "gondia"]:
            if city in addr_lower:
                return f"{city.capitalize()}, Maharashtra"

        parts = [p.strip() for p in str(address).split(",") if p.strip()]
        if parts:
            return f"{parts[-1].title()}, Maharashtra"
        return f"Zone {pincode}" if pincode else "Nagpur, Maharashtra"

    def _get_protocol(self, disease_name: str, severity: str) -> str:
        d_lower = disease_name.lower()
        if "foot" in d_lower or "fmd" in d_lower:
            return (
                "Initiate Ring Vaccination within 5km radius. Inform APMC to halt trade."
                if severity == "critical"
                else "Isolate affected cattle & disinfect feeding troughs."
            )
        if "lumpy" in d_lower or "lsd" in d_lower:
            return (
                "Vector control (mosquito/tick). Administer goat pox vaccine in 5km radius."
                if severity == "critical"
                else "Quarantine sick animals. Apply anti-fly sprays."
            )
        return "Intensify clinical surveillance & biosecurity monitoring."