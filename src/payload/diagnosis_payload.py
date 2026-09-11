from dataclasses import dataclass
from typing import Optional
from PIL import Image

@dataclass
class DiagnosisRequest:
    image: Optional[Image.Image]
    language: str = "English"

@dataclass
class DiagnosisResponse:
    success: bool
    report: str
    error_message: Optional[str] = None