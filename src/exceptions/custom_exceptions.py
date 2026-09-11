class PashuSetuException(Exception):
    """Base exception for application errors."""
    pass

class MissingApiKeyException(PashuSetuException):
    """Raised when Groq API key is missing."""
    pass

class InvalidImageException(PashuSetuException):
    """Raised when uploaded image is invalid or empty."""
    pass

class InferenceException(PashuSetuException):
    """Raised when Groq Vision inference fails."""
    pass