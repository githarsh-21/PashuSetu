from typing import Optional
from PIL import Image
from src.exceptions.custom_exceptions import MissingApiKeyException, InvalidImageException
from src.config.app_config import config

class RequestValidator:
    @staticmethod
    def validate_api_key():
        if not config.GROQ_API_KEY:
            raise MissingApiKeyException("GROQ_API_KEY is not configured in .env file.")

    @staticmethod
    def validate_image(image: Optional[Image.Image]):
        if image is None:
            raise InvalidImageException("Please upload or capture a photo of the cattle first.")