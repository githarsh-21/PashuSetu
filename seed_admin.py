from src.service.auth_service import AuthService

def create_admin():
    auth = AuthService()
    
    # We use your existing auth service so the password gets hashed securely!
    success, msg = auth.register(
        username="admin_master",
        password="Password123",
        full_name="System Administrator",
        role="Admin",
        phone="7774863225",
        address="Nagpur Maharashtra",
        pincode="440016",
        license_no="N/A"
    )
    
    if success:
        print("✅ Admin account created successfully!")
        print("Username: admin_master")
        print("Password: Password123")
    else:
        print(f"⚠️ Failed to create admin: {msg}")

if __name__ == "__main__":
    create_admin()