from dataclasses import dataclass
from typing import Optional

@dataclass
class DiagnosisRecord:
    language: str
    report_markdown: str
    is_successful: bool

@dataclass
class User:
    id: Optional[int]
    username: str
    password_hash: str
    full_name: str
    role: str = "farmer"  # "farmer" or "veterinarian"
    phone: str = ""
    address: str = ""
    pincode: str = ""
    license_no: str = ""
    gender: str = "Not Specified"
    social_category: str = "General"

@dataclass
class VaccinationRecord:
    id: Optional[int]
    user_id: int
    cattle_tag: str
    vaccine_name: str
    administered_date: str
    next_due_date: str
    status: str  # "Overdue", "Due Soon", "Up to Date"

@dataclass
class MilkRecord:
    id: Optional[int]
    username: str
    cattle_tag: str
    record_date: str
    morning_yield: float
    evening_yield: float
    total_yield: float
    notes: Optional[str] = None

@dataclass
class CattleProfile:
    id: Optional[int]
    username: str
    cattle_tag: str
    breed: str
    date_of_birth: str
    status: str