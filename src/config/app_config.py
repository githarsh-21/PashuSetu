import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass(frozen=True)
class AppConfig:
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    # Use an active Groq Vision Model:
    VISION_MODEL: str = os.getenv("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
    SERVER_HOST: str = os.getenv("HOST", "127.0.0.1")
    SERVER_PORT: int = int(os.getenv("PORT", "7861"))

config = AppConfig()