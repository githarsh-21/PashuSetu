import bcrypt
import random
from src.repositories.user_repository import UserRepository
from src.model.diagnosis_entity import User

class AuthService:
    def __init__(self):
        self.user_repo = UserRepository()
        self.otp_store = {} # Temporarily stores OTPs in memory

    def register(self, username: str, password: str, full_name: str, role: str, 
                 phone: str, address: str, pincode: str, license_no: str) -> tuple[bool, str]:
        
        # 1. Basic Validation
        if not username or not password or not full_name:
            return False, "⚠️ Username, password, and full name are required."

        if len(password) < 6:
            return False, "⚠️ Password must be at least 6 characters."
            
        # 2. Role-Specific Validation
        if role == "Veterinarian" and not license_no:
            return False, "⚠️ Veterinary License Number is required for veterinarians."

        # 3. Check for Existing User
        if self.user_repo.find_by_username(username):
            return False, "⚠️ Username already exists. Please choose another or login."

        # 4. Hash Password and Create User
        salt = bcrypt.gensalt()
        pw_hash = bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
        
        new_user = User(
            id=None, 
            username=username, 
            password_hash=pw_hash, 
            full_name=full_name, 
            role=role,
            phone=phone.strip(),
            address=address.strip(),
            pincode=pincode.strip(),
            license_no=license_no.strip() if role == "Veterinarian" else ""
        )

        # 5. Save to Database
        if self.user_repo.save_user(new_user):
            return True, "✅ Registration successful!"
        return False, "❌ Error saving user. Please try again."

    def login(self, username: str, password: str) -> tuple[bool, str, dict]:
        if not username or not password:
            return False, "⚠️ Please provide both username and password.", {}

        user = self.user_repo.find_by_username(username)
        if not user:
            return False, "❌ Invalid username or password.", {}

        if bcrypt.checkpw(password.encode("utf-8"), user.password_hash.encode("utf-8")):
            # Load all necessary user context into the session state
            user_data = {
                "username": user.username, 
                "full_name": user.full_name, 
                "role": user.role,
                "phone": user.phone,
                "address": user.address,
                "pincode": user.pincode,
                "license_no": user.license_no
            }
            return True, f"✅ Welcome back, {user.full_name}!", user_data

        return False, "❌ Invalid username or password.", {}

    # --- NEW OTP METHODS ---
    def send_otp(self, phone: str) -> tuple[bool, str]:
        if not phone:
            return False, "⚠️ Please enter a mobile number."
            
        user = self.user_repo.find_by_phone(phone)
        if not user:
            return False, "❌ No account found with this mobile number."
        
        # Generate 4-digit OTP
        otp = str(random.randint(1000, 9999))
        self.otp_store[phone] = otp
        
        # SIMULATE SMS BY PRINTING TO TERMINAL
        print(f"\n{'='*40}")
        print(f"📲 SIMULATED SMS to {phone}")
        print(f"Your PashuSetu login OTP is: {otp}")
        print(f"{'='*40}\n")
        
        return True, f"✅ OTP sent to {phone}. (Check your terminal/console for the code!)"

    def verify_otp_login(self, phone: str, otp: str) -> tuple[bool, str, dict]:
        if not phone or not otp:
            return False, "⚠️ Please enter both phone number and OTP.", {}
            
        stored_otp = self.otp_store.get(phone)
        if not stored_otp or stored_otp != otp:
            return False, "❌ Invalid or expired OTP.", {}
            
        user = self.user_repo.find_by_phone(phone)
        if not user:
            return False, "❌ User not found.", {}
            
        # Clear OTP after successful login
        del self.otp_store[phone]
        
        user_data = {
            "username": user.username, 
            "full_name": user.full_name, 
            "role": user.role,
            "phone": user.phone, 
            "address": user.address, 
            "pincode": user.pincode, 
            "license_no": user.license_no
        }
        return True, f"✅ Welcome back, {user.full_name}!", user_data