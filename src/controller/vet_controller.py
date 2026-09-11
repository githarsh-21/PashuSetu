from datetime import datetime, timedelta
import psycopg2

# Database connection safely copied from your user_repository
DB_URL = "postgresql://postgres:Pass%40123@localhost:5432/pashusetu_db"

def get_db_connection():
    """Creates a standard connection for the vet controller."""
    return psycopg2.connect(DB_URL)

class VetController:
    def __init__(self):
        pass

    def get_all_farmers_and_cattle(self):
        """Fetches all registered farmers and their active cattle tags for dropdown selection."""
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            # THE FIX: Added "AND c.status = 'Active'" to the LEFT JOIN
            cursor.execute("""
                SELECT u.username, u.full_name, u.phone, u.address, c.cattle_tag, c.breed
                FROM users u
                LEFT JOIN cattle_profiles c ON u.username = c.username AND c.status = 'Active'
                WHERE LOWER(u.role) = 'farmer' 
                   OR LOWER(u.role) = 'farmer (pashu palak)'
                   OR u.role IS NULL 
                   OR u.role = ''
                ORDER BY u.full_name, c.cattle_tag;
            """)
            rows = cursor.fetchall()
            
            farmers_dict = {}
            for r in rows:
                username, name, phone, address, tag, breed = r[0], r[1] or r[0], r[2], r[3], r[4], r[5]
                if username not in farmers_dict:
                    farmers_dict[username] = {
                        "username": username,
                        "name": name,
                        "phone": phone or "No Phone Provided",
                        "address": address or "No Address Provided",
                        "cattle": []
                    }
                if tag:
                    farmers_dict[username]["cattle"].append({"tag": tag, "breed": breed or "Mixed Dairy"})
            
            return list(farmers_dict.values())
        except Exception as e:
            print("Error fetching farmers:", e)
            return []
        finally:
            cursor.close()
            conn.close()

    def record_clinical_assistance(self, vet_username: str, data: dict):
        """Saves treatment and automatically syncs it to the Farmer's Cattle360 Record."""
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            farmer_username = data.get("farmer_username")
            cattle_tag = data.get("cattle_tag", "UNREGISTERED")
            visit_date = data.get("visit_date", datetime.now().strftime("%Y-%m-%d"))
            diagnosis = data.get("diagnosis", "General Checkup")
            treatment_notes = data.get("treatment_notes", "")
            medicines = data.get("medicines_prescribed", "")
            vaccine_name = data.get("vaccine_name", "")
            vaccine_batch = data.get("vaccine_batch_no", "")
            vaccine_mfg = data.get("vaccine_manufacturer", "")
            booster_date = data.get("next_booster_date") or None

            # 1. Insert into Vet's clinical_logs
            cursor.execute("""
                INSERT INTO clinical_logs (
                    vet_username, farmer_username, cattle_tag, visit_date, 
                    diagnosis, treatment_notes, medicines_prescribed, 
                    vaccine_name, vaccine_batch_no, vaccine_manufacturer, next_booster_date
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id;
            """, (
                vet_username, farmer_username, cattle_tag, visit_date,
                diagnosis, treatment_notes, medicines,
                vaccine_name, vaccine_batch, vaccine_mfg, booster_date
            ))

            if cattle_tag != "UNREGISTERED":
                # Create a savepoint so a sync failure doesn't ruin the main log!
                cursor.execute("SAVEPOINT sync_point")
                
                # 2. SYNC TO CATTLE 360: Fixed table name to 'diagnosis_history'
                try:
                    formatted_diagnosis = f"🩺 VET DIAGNOSIS: {diagnosis}"
                    vet_advice = f"Vet Notes: {treatment_notes} | Meds: {medicines}"
                    cursor.execute("""
                        INSERT INTO diagnosis_history (username, cattle_tag, symptoms, ai_diagnosis, confidence, recommended_action, severity, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                    """, (
                        farmer_username, cattle_tag, "Clinically assessed by Veterinarian",
                        formatted_diagnosis, 100.0, vet_advice, "warning", visit_date
                    ))
                except Exception as sync_diag_err:
                    print("Failed to sync to diagnosis_history table:", sync_diag_err)
                    cursor.execute("ROLLBACK TO SAVEPOINT sync_point")

                # 3. Sync Vaccine to 'vaccination_logs'
                if vaccine_name:
                    cursor.execute("SAVEPOINT vac_point")
                    try:
                        cursor.execute("""
                            INSERT INTO vaccination_logs (cattle_tag, vaccine_name, administered_date, batch_no)
                            VALUES (%s, %s, %s, %s)
                            ON CONFLICT DO NOTHING;
                        """, (cattle_tag, vaccine_name, visit_date, vaccine_batch))
                    except Exception as sync_vac_err:
                        print("Vaccination history sync bypassed:", sync_vac_err)
                        cursor.execute("ROLLBACK TO SAVEPOINT vac_point")

            conn.commit()
            return {"status": "success", "message": "Clinical record saved and synced!"}
        except Exception as e:
            conn.rollback()
            print("SAVE ERROR:", str(e)) # Print exact error to Python terminal
            return {"status": "error", "message": str(e)}
        finally:
            cursor.close()
            conn.close()
    
    def get_clinical_logs(self, vet_username: str, timeframe: str = "all", search_query: str = ""):
        """Fetches history of cases treated with time range and text search filters."""
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            today = datetime.now().date()
            date_filter = ""
            params = [vet_username]

            if timeframe == "7days":
                date_filter = "AND l.visit_date >= %s"
                # pyrefly: ignore [bad-argument-type]
                params.append(today - timedelta(days=7))
            elif timeframe == "30days":
                date_filter = "AND l.visit_date >= %s"
                # pyrefly: ignore [bad-argument-type]
                params.append(today - timedelta(days=30))
            elif timeframe == "1year":
                date_filter = "AND l.visit_date >= %s"
                # pyrefly: ignore [bad-argument-type]
                params.append(today - timedelta(days=365))

            search_clause = ""
            if search_query:
                search_clause = """
                    AND (l.farmer_username ILIKE %s OR l.cattle_tag ILIKE %s OR l.diagnosis ILIKE %s OR l.vaccine_name ILIKE %s OR u.full_name ILIKE %s)
                """
                like_term = f"%{search_query}%"
                params.extend([like_term, like_term, like_term, like_term, like_term])

            query = f"""
                SELECT l.id, l.farmer_username, l.cattle_tag, l.visit_date, l.diagnosis, 
                       l.treatment_notes, l.medicines_prescribed, l.vaccine_name, 
                       l.vaccine_batch_no, l.vaccine_manufacturer, l.next_booster_date,
                       u.full_name, u.address, u.phone
                FROM clinical_logs l
                LEFT JOIN users u ON l.farmer_username = u.username
                WHERE l.vet_username = %s {date_filter} {search_clause}
                ORDER BY l.visit_date DESC, l.id DESC;
            """
            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()

            logs = []
            for r in rows:
                logs.append({
                    "id": r[0],
                    "farmer_username": r[1],
                    "cattle_tag": r[2],
                    "visit_date": str(r[3]),
                    "diagnosis": r[4],
                    "treatment_notes": r[5],
                    "medicines_prescribed": r[6],
                    "vaccine_name": r[7],
                    "vaccine_batch_no": r[8],
                    "vaccine_manufacturer": r[9],
                    "next_booster_date": str(r[10]) if r[10] else None,
                    "farmer_name": r[11] or r[1],
                    "farmer_address": r[12] or "No Address Provided",
                    "farmer_phone": r[13] or "No Phone Provided" 
                })
            return logs
        except Exception as e:
            print("Error retrieving clinical logs:", e)
            return []
        finally:
            cursor.close()
            conn.close()
    
    def delete_clinical_log(self, log_id: int):
        """Deletes a clinical record from the database by its ID."""
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("DELETE FROM clinical_logs WHERE id = %s RETURNING id;", (log_id,))
            deleted_id = cursor.fetchone()
            
            if deleted_id:
                conn.commit()
                return {"status": "success", "message": "Record deleted successfully!"}
            else:
                conn.rollback()
                return {"status": "error", "message": "Record not found."}
        except Exception as e:
            conn.rollback()
            print("DELETE ERROR:", str(e))
            return {"status": "error", "message": str(e)}
        finally:
            cursor.close()
            conn.close()
    
    def get_outbreak_surveillance(self, window_days: int = 21):
        """Generates real-time disease clusters with geographical coordinates."""
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cutoff_date = datetime.now().date() - timedelta(days=window_days)
            
            # Fetch recent diagnoses and the farmer's address
            cursor.execute("""
                SELECT l.diagnosis, u.address 
                FROM clinical_logs l
                JOIN users u ON l.farmer_username = u.username
                WHERE l.visit_date >= %s AND l.diagnosis != 'General Checkup';
            """, (cutoff_date,))
            
            cases = cursor.fetchall()
            
            # Smart Coordinate Mapping (Vidarbha Region defaults)
            # You can add more districts here based on your target area!
            district_coords = {
                "bhandara": [21.1687, 79.6543],
                "gondia": [21.4624, 80.1961],
                "chandrapur": [19.9615, 79.2961],
                "nagpur": [21.1458, 79.0882],
                "akola": [20.7059, 77.0082]
            }

            # Group cases by disease and location
            clusters_dict = {}
            for diagnosis, address in cases:
                disease = diagnosis.strip().title()
                address_lower = (address or "").lower()
                
                # Find which district this address belongs to
                location_name = "Unknown Regional Zone"
                coords = [21.1458, 79.0882] # Default fallback (Nagpur)
                
                for dist, point in district_coords.items():
                    if dist in address_lower:
                        location_name = dist.title()
                        coords = point
                        break
                
                cluster_key = f"{disease}_{location_name}"
                if cluster_key not in clusters_dict:
                    clusters_dict[cluster_key] = {
                        "disease": disease,
                        "location": location_name,
                        "coordinates": coords,
                        "case_count": 0
                    }
                clusters_dict[cluster_key]["case_count"] += 1

            active_clusters = []
            for c in clusters_dict.values():
                count = c["case_count"]
                severity = "critical" if count >= 3 else "warning"
                action = "Initiate ring vaccination and strict quarantine protocols." if severity == "critical" else "Intensify clinical surveillance & biosecurity monitoring."
                
                c["severity"] = severity
                c["recommended_action"] = action
                active_clusters.append(c)

            # Sort so critical clusters appear first
            active_clusters.sort(key=lambda x: x["case_count"], reverse=True)

            return {
                "surveillance_window": f"{window_days} Days Rolling",
                "total_monitored_cases": len(cases),
                "active_clusters": active_clusters
            }
        except Exception as e:
            print("Outbreak Radar Error:", e)
            return {"active_clusters": [], "total_monitored_cases": 0}
        finally:
            cursor.close()
            conn.close()