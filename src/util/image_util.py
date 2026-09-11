import io
import base64
from PIL import Image

class ImageUtil:
    @staticmethod
    def encode_to_base64(image: Image.Image) -> str:
        """Converts PIL image to Base64 JPEG data URL format."""
        if image.mode in ("RGBA", "P"):
            image = image.convert("RGB")
            
        # Resize high-resolution camera images down to prevent payload limit issues
        max_dimension = 1024
        if max(image.size) > max_dimension:
            image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=85)
        encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
        return f"data:image/jpeg;base64,{encoded}"