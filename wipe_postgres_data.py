import psycopg2
import os
from dotenv import load_dotenv

# Load your .env file to get any database passwords if you have them stored
load_dotenv()

def wipe_postgres_data():
    # List of tables to wipe (Notice we left out 'schemes_master')
    tables_to_clear = [
        "users",
        "cattle_profiles",
        "milk_production_logs",
        "vaccination_logs",
        "diagnosis_history",
        "vet_consultations"
    ]

    try:
        # Connect to your local PostgreSQL database
        # Update the password to whatever you set when you installed Postgres!
        conn = psycopg2.connect(
            dbname="pashusetu_db",
            user="postgres",
            password="Pass@123",  # <-- CHANGE THIS TO YOUR PASSWORD
            host="localhost",
            port="5432"
        )
        
        # Postgres requires us to commit transactions, or we can set autocommit
        conn.autocommit = True
        cursor = conn.cursor()
        
        for table in tables_to_clear:
            try:
                # TRUNCATE deletes all rows. 
                # RESTART IDENTITY resets the IDs back to 1.
                # CASCADE forces it to ignore foreign key blocks.
                cursor.execute(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE;")
                print(f"✅ Successfully wiped '{table}'.")
            except Exception as e:
                print(f"⚠️ Could not wipe '{table}'. It might not exist yet. Error: {e}")

        conn.close()
        print("\n🎉 Success! All dummy user data has been wiped from PostgreSQL.")
        print("🛡️ Your 'schemes_master' table is safe and untouched!")

    except Exception as e:
        print(f"❌ Failed to connect to PostgreSQL. Make sure the server is running and password is correct. Error: {e}")

if __name__ == "__main__":
    confirm = input("⚠️ Are you sure you want to TRUNCATE all user/cattle tables in Postgres? (yes/no): ")
    if confirm.lower() == 'yes':
        wipe_postgres_data()
    else:
        print("Operation cancelled.")