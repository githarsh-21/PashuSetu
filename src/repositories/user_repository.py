import os
import psycopg2
from psycopg2 import IntegrityError
from typing import List, Optional
from src.model.diagnosis_entity import User
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()

# --- The "Two Worlds" Switch ---
# Safely fetch the variable from Render's environment
DB_URL = os.environ.get("DATABASE_URL") or os.environ.get("DB_URL")

if DB_URL and "localhost" not in DB_URL:
    # We found the Render cloud variable! Strip hidden spaces just in case.
    DB_URL = DB_URL.strip()
    print("✅ SUCCESS: Found Cloud Database URL!")
else:
    # Fall back to local pgAdmin database for local laptop development.
    DB_URL = "postgresql://postgres:Pass%40123@localhost:5432/pashusetu_db"
    print("⚠️ WARNING: No cloud URL found or localhost detected! Falling back to local DB.")
    
@contextmanager
def get_db_connection():
    """Safely manages PostgreSQL connections to prevent leaks."""
    conn = psycopg2.connect(DB_URL)
    try:
        yield conn
    finally:
        conn.close()


class UserRepository:

    def __init__(self):
        self._init_db()

    def _init_db(self):
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Users table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        username TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        full_name TEXT NOT NULL,
                        role TEXT DEFAULT 'farmer',
                        phone TEXT,
                        address TEXT,
                        pincode TEXT,
                        license_no TEXT,
                        gender TEXT DEFAULT 'Not Specified',
                        social_category TEXT DEFAULT 'General'
                    )
                """)
                # 2. Vaccination Logs table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS vaccination_logs (
                        id SERIAL PRIMARY KEY,
                        username TEXT NOT NULL,
                        cattle_tag TEXT NOT NULL,
                        vaccine_name TEXT NOT NULL,
                        administered_date TEXT NOT NULL,
                        next_due_date TEXT NOT NULL
                    )
                """)
                # 3. Diagnosis History table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS diagnosis_history (
                        id SERIAL PRIMARY KEY,
                        username TEXT NOT NULL,
                        cattle_tag TEXT NOT NULL,
                        pincode TEXT NOT NULL,
                        disease_name TEXT NOT NULL,
                        language TEXT NOT NULL,
                        diagnosis_report TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                # 4. Milk Production Logs table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS milk_production_logs (
                        id SERIAL PRIMARY KEY,
                        username TEXT NOT NULL,
                        cattle_tag TEXT NOT NULL,
                        record_date TEXT NOT NULL,
                        morning_yield REAL NOT NULL,
                        evening_yield REAL NOT NULL,
                        total_yield REAL NOT NULL,
                        notes TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                # 5. Breeding & Reproduction Logs table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS breeding_logs (
                        id SERIAL PRIMARY KEY,
                        username TEXT NOT NULL,
                        cattle_tag TEXT NOT NULL,
                        event_type TEXT NOT NULL,
                        event_date TEXT NOT NULL,
                        expected_calving_date TEXT,
                        dry_off_date TEXT,
                        notes TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                # 6. Cattle Profiles table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS cattle_profiles (
                        id SERIAL PRIMARY KEY,
                        username TEXT NOT NULL,
                        cattle_tag TEXT NOT NULL,
                        breed TEXT NOT NULL,
                        gender TEXT DEFAULT 'Female',
                        date_of_birth TEXT NOT NULL,
                        status TEXT DEFAULT 'Active',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(username, cattle_tag)
                    )
                """)
                # Safely upgrade existing database tables to include gender
                cursor.execute("ALTER TABLE cattle_profiles ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'Female';")
                
                # 7. Vet Consultations table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS vet_consultations (
                        id SERIAL PRIMARY KEY,
                        vet_username TEXT NOT NULL,
                        farmer_username TEXT NOT NULL,
                        cattle_tag TEXT NOT NULL,
                        consultation_date TEXT NOT NULL,
                        treatment_notes TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                # 8. Schemes Master Table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS schemes_master (
                        id SERIAL PRIMARY KEY, 
                        name TEXT NOT NULL, 
                        agency TEXT NOT NULL,
                        description TEXT NOT NULL, 
                        min_cows INTEGER DEFAULT 0, 
                        target_breed TEXT DEFAULT 'Any',
                        target_gender TEXT DEFAULT 'Any', 
                        target_category TEXT DEFAULT 'Any',
                        target_state TEXT DEFAULT 'All',
                        benefit_text TEXT NOT NULL, 
                        suggestion_text TEXT NOT NULL
                    )
                """)
            conn.commit()

    # --- CMS SCHEMES METHODS ---
    def clear_all_schemes(self) -> bool:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("DROP TABLE IF EXISTS schemes_master")
                conn.commit()
            self._init_db()
            return True
        except Exception:
            return False

    def get_all_schemes(self) -> list:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id, name, agency, description, min_cows, target_breed, target_gender, target_category, target_state, benefit_text, suggestion_text FROM schemes_master")
                return cursor.fetchall()

    def add_scheme(self, name, agency, desc, min_cows, breed, gender, category, state, benefit, suggestion) -> bool:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        INSERT INTO schemes_master (name, agency, description, min_cows, target_breed, target_gender, target_category, target_state, benefit_text, suggestion_text) 
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (name, agency, desc, int(min_cows), breed, gender, category, state, benefit, suggestion))
                conn.commit()
                return True
        except Exception: 
            return False

    # Add this method to user_repository.py to prevent duplicate key errors
    def add_cattle_profile(self, username: str, cattle_tag: str, breed: str, gender: str, date_of_birth: str) -> bool:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        INSERT INTO cattle_profiles (username, cattle_tag, breed, gender, date_of_birth, status)
                        VALUES (LOWER(%s), %s, %s, %s, %s, 'Active')
                        ON CONFLICT (username, cattle_tag) 
                        DO UPDATE SET 
                            breed = EXCLUDED.breed,
                            gender = EXCLUDED.gender,
                            date_of_birth = EXCLUDED.date_of_birth,
                            status = 'Active'
                    """, (username.strip(), cattle_tag.strip().upper(), breed, gender, date_of_birth))
                conn.commit()
            return True
        except Exception as e:
            print(f"[ERROR] Cattle Registration Failed: {e}")
            return False

    # --- User Authentication Methods ---
    def find_by_username(self, username: str) -> Optional[User]:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """SELECT id, username, password_hash, full_name, role, 
                              phone, address, pincode, license_no, gender, social_category 
                       FROM users WHERE LOWER(username) = LOWER(%s)""",
                    (username.strip(),),
                )
                row = cursor.fetchone()
                if row:
                    user = User(
                        id=row[0],
                        username=row[1],
                        password_hash=row[2],
                        full_name=row[3],
                        role=row[4],
                        phone=row[5] or "",
                        address=row[6] or "",
                        pincode=row[7] or "",
                        license_no=row[8] or ""
                    )
                    # pyrefly: ignore [missing-attribute]
                    user.gender = row[9]
                    # pyrefly: ignore [missing-attribute]
                    user.social_category = row[10]
                    return user
                return None

    def find_by_phone(self, phone: str) -> Optional[User]:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """SELECT id, username, password_hash, full_name, role, 
                              phone, address, pincode, license_no, gender, social_category 
                       FROM users WHERE phone = %s""",
                    (phone.strip(),),
                )
                row = cursor.fetchone()
                if row:
                    user = User(
                        id=row[0],
                        username=row[1],
                        password_hash=row[2],
                        full_name=row[3],
                        role=row[4],
                        phone=row[5] or "",
                        address=row[6] or "",
                        pincode=row[7] or "",
                        license_no=row[8] or ""
                    )
                    # pyrefly: ignore [missing-attribute]
                    user.gender = row[9]
                    # pyrefly: ignore [missing-attribute]
                    user.social_category = row[10]
                    return user
                return None

    def save_user(self, user: User) -> bool:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """INSERT INTO users (username, password_hash, full_name, role, 
                                              phone, address, pincode, license_no)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                        (
                            user.username.strip().lower(),
                            user.password_hash,
                            user.full_name.strip(),
                            user.role,
                            user.phone,
                            user.address,
                            user.pincode,
                            user.license_no,
                        ),
                    )
                conn.commit()
                return True
        except IntegrityError:
            return False

    def update_user_demographics(self, username: str, gender: str, category: str):
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("UPDATE users SET gender = %s, social_category = %s WHERE LOWER(username) = LOWER(%s)", 
                               (gender, category, username.strip()))
            conn.commit()

    # --- VETERINARIAN PORTAL METHODS ---
    def search_farmer(self, query: str) -> Optional[dict]:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Upgraded to use LIKE for partial searches!
                search_term = f"%{query.strip()}%"
                cursor.execute(
                    """SELECT username, full_name, phone, address, pincode 
                       FROM users 
                       WHERE (LOWER(username) LIKE LOWER(%s) OR phone LIKE %s) AND LOWER(role) = 'farmer'""",
                    (search_term, search_term)
                )
                row = cursor.fetchone()
                if row:
                    return {
                        "username": row[0],
                        "full_name": row[1],
                        "phone": row[2],
                        "address": row[3],
                        "pincode": row[4]
                    }
                return None

    def log_vet_consultation(self, vet_username: str, farmer_username: str, cattle_tag: str, date: str, notes: str) -> bool:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """INSERT INTO vet_consultations 
                           (vet_username, farmer_username, cattle_tag, consultation_date, treatment_notes)
                           VALUES (%s, %s, %s, %s, %s)""",
                        (vet_username.strip().lower(), farmer_username.strip().lower(), cattle_tag.strip().upper(), date, notes.strip())
                    )
                conn.commit()
                return True
        except Exception:
            return False

    def get_farmer_consultations(self, farmer_username: str) -> list:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT consultation_date, vet_username, cattle_tag, treatment_notes
                    FROM vet_consultations
                    WHERE LOWER(farmer_username) = LOWER(%s)
                    ORDER BY id DESC
                """, (farmer_username.strip(),))
                return cursor.fetchall()

    def get_vet_vaccination_reports(self, vet_username: str, days: int) -> list:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(f"""
                    SELECT username as Farmer, cattle_tag, vaccine_name, administered_date, next_due_date
                    FROM vaccination_logs 
                    WHERE administered_date::date >= CURRENT_DATE - INTERVAL '{days} days'
                    ORDER BY administered_date DESC
                """)
                return cursor.fetchall()

    # --- Vaccination Records Methods ---
    def add_vaccination_log(self, username: str, cattle_tag: str, vaccine_name: str, administered_date: str, next_due_date: str) -> bool:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                            INSERT INTO vaccination_logs (username, cattle_tag, vaccine_name, administered_date, next_due_date)
                            VALUES (%s, %s, %s, %s, %s)
                        """,
                        (
                            username.strip().lower(),
                            cattle_tag.strip().upper(),
                            vaccine_name,
                            administered_date,
                            next_due_date,
                        ),
                    )
                conn.commit()
                return True
        except Exception:
            return False

    def get_user_vaccination_logs(self, username: str) -> list:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                        SELECT id, cattle_tag, vaccine_name, administered_date, next_due_date
                        FROM vaccination_logs
                        WHERE LOWER(username) = LOWER(%s)
                        ORDER BY next_due_date ASC
                    """,
                    (username.strip(),),
                )
                return cursor.fetchall()

    # --- Clinical Diagnosis History Methods ---
    def save_diagnosis_record(self, username: str, cattle_tag: str, pincode: str, disease_name: str, language: str, report: str) -> bool:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                            INSERT INTO diagnosis_history (username, cattle_tag, pincode, disease_name, language, diagnosis_report)
                            VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        (
                            username.strip().lower(),
                            cattle_tag.strip().upper(),
                            pincode.strip(),
                            disease_name.strip(),
                            language,
                            report,
                        ),
                    )
                conn.commit()
                return True
        except Exception:
            return False

    def get_user_diagnosis_history(self, username: str) -> list:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                        SELECT created_at, cattle_tag, language, diagnosis_report
                        FROM diagnosis_history
                        WHERE LOWER(username) = LOWER(%s)
                        ORDER BY id DESC
                    """,
                    (username.strip(),),
                )
                return cursor.fetchall()

    # --- Regional Outbreak Heatmap Methods ---
    def get_outbreak_data(self) -> list:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT pincode, disease_name, COUNT(*) as case_count
                    FROM diagnosis_history
                    WHERE disease_name != 'Healthy' 
                      AND created_at >= NOW() - INTERVAL '30 days'
                    GROUP BY pincode, disease_name
                    ORDER BY case_count DESC
                """)
                return cursor.fetchall()

    # --- Milk Production Methods ---
    def save_milk_log(self, username: str, cattle_tag: str, record_date: str, morning: float, evening: float, total: float, notes: str) -> bool:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                            INSERT INTO milk_production_logs (username, cattle_tag, record_date, morning_yield, evening_yield, total_yield, notes)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            username.strip().lower(),
                            cattle_tag.strip().upper(),
                            record_date,
                            morning,
                            evening,
                            total,
                            notes.strip() if notes else "",
                        ),
                    )
                conn.commit()
                return True
        except Exception:
            return False

    def get_user_milk_logs(self, username: str, cattle_tag: Optional[str] = None) -> list:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                if cattle_tag:
                    cursor.execute(
                        """
                            SELECT record_date, cattle_tag, morning_yield, evening_yield, total_yield, notes
                            FROM milk_production_logs
                            WHERE LOWER(username) = LOWER(%s) AND cattle_tag = %s
                            ORDER BY record_date DESC, id DESC
                        """,
                        (username.strip(), cattle_tag.strip().upper()),
                    )
                else:
                    cursor.execute(
                        """
                            SELECT record_date, cattle_tag, morning_yield, evening_yield, total_yield, notes
                            FROM milk_production_logs
                            WHERE LOWER(username) = LOWER(%s)
                            ORDER BY record_date DESC, id DESC
                        """,
                        (username.strip(),),
                    )
                return cursor.fetchall()

    # --- Breeding & Reproduction Methods ---
    def save_breeding_log(self, username: str, cattle_tag: str, event_type: str, event_date: str, expected_calving_date: str, dry_off_date: str, notes: str) -> bool:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        INSERT INTO breeding_logs 
                        (username, cattle_tag, event_type, event_date, expected_calving_date, dry_off_date, notes)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (username.strip().lower(), cattle_tag.strip().upper(), event_type, 
                          event_date, expected_calving_date, dry_off_date, notes.strip()))
                conn.commit()
                return True
        except Exception:
            return False

    def get_user_breeding_logs(self, username: str) -> list:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT cattle_tag, event_type, event_date, expected_calving_date, dry_off_date, notes
                    FROM breeding_logs
                    WHERE LOWER(username) = LOWER(%s)
                    ORDER BY event_date DESC
                """, (username.strip(),))
                return cursor.fetchall()

    # --- Cattle Profile Methods ---
    def save_cattle_profile(self, username: str, cattle_tag: str, breed: str, gender: str, dob: str, status: str) -> bool:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        INSERT INTO cattle_profiles 
                        (username, cattle_tag, breed, gender, date_of_birth, status)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (username, cattle_tag) 
                        DO UPDATE SET 
                            breed = EXCLUDED.breed, 
                            gender = EXCLUDED.gender,
                            date_of_birth = EXCLUDED.date_of_birth, 
                            status = EXCLUDED.status
                    """, (username.strip().lower(), cattle_tag.strip().upper(), breed, gender, dob, status))
                conn.commit()
                return True
        except Exception:
            return False


    def get_user_cattle_profiles(self, username: str) -> list:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT cattle_tag, breed, gender, date_of_birth, status
                    FROM cattle_profiles
                    WHERE LOWER(username) = LOWER(%s) 
                    AND status NOT IN ('Deleted', 'Sold', 'Deceased', 'Inactive')
                    ORDER BY cattle_tag ASC
                """, (username.strip(),))
                return cursor.fetchall()



    def get_farm_yield_trend(self, username: str, days: int = 30) -> list:
        from datetime import datetime, timedelta
        cutoff_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT record_date, SUM(total_yield) as total_yield 
                    FROM milk_production_logs
                    WHERE LOWER(username) = LOWER(%s)
                      AND record_date >= %s
                    GROUP BY record_date
                    ORDER BY record_date ASC
                """, (username.strip(), cutoff_date))
                return [{"date": str(row[0]), "yield": float(row[1])} for row in cursor.fetchall()]

   
    def get_cow_contributions(self, username: str, days: int = 30) -> list:
        from datetime import datetime, timedelta
        cutoff_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT m.cattle_tag, SUM(m.total_yield) as cow_total 
                    FROM milk_production_logs m
                    JOIN cattle_profiles c 
                      ON m.cattle_tag = c.cattle_tag 
                      AND LOWER(m.username) = LOWER(c.username)
                    WHERE LOWER(m.username) = LOWER(%s) 
                      AND c.status NOT IN ('Deleted', 'Sold', 'Deceased')
                      AND m.record_date >= %s
                    GROUP BY m.cattle_tag
                    ORDER BY cow_total DESC
                """, (username.strip(), cutoff_date))
                return [{"tag": row[0], "total": float(row[1])} for row in cursor.fetchall()]


    # --- DELETE RECORD METHODS ---
    def delete_milk_log(self, username: str, cattle_tag: str, record_date: str) -> bool:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        DELETE FROM milk_production_logs 
                        WHERE LOWER(username) = LOWER(%s) AND cattle_tag = %s AND record_date = %s
                    """, (username.strip(), cattle_tag.strip().upper(), record_date))
                    if cursor.rowcount == 0:
                        return False
                conn.commit()
                return True
        except Exception:
            return False

    def delete_diagnosis_record(self, username: str, cattle_tag: str, created_at: str) -> bool:
        try:
            # Extract ONLY the core date & time (first 19 characters) to safely ignore timezones/milliseconds
            db_timestamp = created_at[:19].replace("T", " ")
            
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        DELETE FROM diagnosis_history 
                        WHERE LOWER(username) = LOWER(%s) AND cattle_tag = %s AND created_at::text LIKE %s
                    """, (username.strip(), cattle_tag.strip().upper(), f"{db_timestamp}%"))
                    
                    if cursor.rowcount == 0:
                        return False
                conn.commit()
                return True
        except Exception:
            return False

    
    # --- DELETE BREEDING RECORD METHODS ---
    def delete_breeding_log(self, username: str, cattle_tag: str, event_date: str) -> bool:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        DELETE FROM breeding_logs 
                        WHERE LOWER(username) = LOWER(%s) AND cattle_tag = %s AND event_date = %s
                    """, (username.strip(), cattle_tag.strip().upper(), event_date))
                    if cursor.rowcount == 0:
                        return False
                conn.commit()
                return True
        except Exception:
            return False

    # --- DELETE VACCINATION RECORD METHODS ---
    def delete_vaccination_log(self, username: str, cattle_tag: str, administered_date: str) -> bool:
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        DELETE FROM vaccination_logs 
                        WHERE LOWER(username) = LOWER(%s) AND cattle_tag = %s AND administered_date = %s
                    """, (username.strip(), cattle_tag.strip().upper(), administered_date))
                    if cursor.rowcount == 0:
                        return False
                conn.commit()
                return True
        except Exception:
            return False


    # --- DELETE CATTLE PROFILE METHOD ---
    def delete_cattle_profile(self, username: str, cattle_tag: str) -> bool:
        """Permanently deletes a cow and all its historical records across all modules."""
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    u_name = username.strip()
                    c_tag = cattle_tag.strip().upper()

                    # 1. Erase Yield Analytics (Milk Logs)
                    cursor.execute("DELETE FROM milk_production_logs WHERE LOWER(username) = LOWER(%s) AND cattle_tag = %s", (u_name, c_tag))
                    
                    # 2. Erase AI Diagnosis Triage History
                    cursor.execute("DELETE FROM diagnosis_history WHERE LOWER(username) = LOWER(%s) AND cattle_tag = %s", (u_name, c_tag))
                    
                    # 3. Erase Breeding Records
                    cursor.execute("DELETE FROM breeding_logs WHERE LOWER(username) = LOWER(%s) AND cattle_tag = %s", (u_name, c_tag))
                    
                    # 4. Erase Vaccination Records
                    cursor.execute("DELETE FROM vaccination_logs WHERE LOWER(username) = LOWER(%s) AND cattle_tag = %s", (u_name, c_tag))
                    
                    # 5. Erase the Core Cattle Profile
                    cursor.execute("DELETE FROM cattle_profiles WHERE LOWER(username) = LOWER(%s) AND cattle_tag = %s", (u_name, c_tag))
                    
                conn.commit() # Commit all deletions simultaneously
                return True
        except Exception as e:
            print(f"[ERROR] Hard Delete Failed: {e}")
            return False