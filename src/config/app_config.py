import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass(frozen=True)
class AppConfig:
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    # Use the active Groq Vision Model available to your account:
    VISION_MODEL: str = os.getenv("GROQ_VISION_MODEL", "qwen/qwen3.8-27b")
    SERVER_HOST: str = os.getenv("HOST", "127.0.0.1")
    SERVER_PORT: int = int(os.getenv("PORT", "7861"))

config = AppConfig()