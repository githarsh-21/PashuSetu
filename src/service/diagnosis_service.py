import json
import re
import traceback
from groq import Groq
from src.config.app_config import config
from src.security.validator import RequestValidator
from src.util.image_util import ImageUtil
from src.repositories.prompt_repository import PromptRepository
from src.payload.diagnosis_payload import DiagnosisRequest, DiagnosisResponse
from src.exceptions.custom_exceptions import PashuSetuException


LANGUAGE_MAP = {
    "mr": "Marathi (मराठी)",
    "hi": "Hindi (हिंदी)",
    "te": "Telugu (తెలుగు)",
    "en": "English",
}


def clean_think_tags(text: str) -> str:
    """Removes reasoning blocks, system artifacts, and markdown code fences."""
    if not text:
        return ""
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    if "<think>" in cleaned:
        cleaned = re.sub(r"<think>.*", "", cleaned, flags=re.DOTALL)
    cleaned = re.sub(r"^```(?:json)?", "", cleaned.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r"```$", "", cleaned.strip(), flags=re.MULTILINE)
    return cleaned.strip()


def extract_json_payload(raw_text: str, default_disease: str = "Suspected Condition") -> tuple[str, str]:
    """
    Safely extracts the 4-field JSON payload.
    Provides clean fallback parsing if JSON decode fails.
    """
    cleaned = clean_think_tags(raw_text)
    data = None

    # 1. Try direct JSON parsing
    try:
        data = json.loads(cleaned)
    except Exception:
        # 2. Search for the first { ... } block
        json_match = re.search(r"(\{[\s\S]*\})", cleaned)
        if json_match:
            try:
                data = json.loads(json_match.group(1))
            except Exception:
                pass

    # 3. Fallback: If no valid JSON, construct clean payload from raw text
    if not isinstance(data, dict):
        disease_match = re.search(
            r"(?:Disease Name|Condition|रोग|आजाराचे नाव|बीमारी का नाम|व्याधि)\s*[:\-–]\s*([^\n\*\-]+)",
            cleaned,
            re.I
        )
        severity_match = re.search(
            r"(?:Severity|गंभीरता|धोका पातळी|धोका)\s*[:\-–]\s*([^\n\*\-]+)",
            cleaned,
            re.I
        )

        data = {
            "disease": disease_match.group(1).strip() if disease_match else default_disease,
            "severity": severity_match.group(1).strip() if severity_match else "Warning",
            "symptoms": [
                line.strip("-*• \t")
                for line in cleaned.split("\n")
                if line.strip().startswith(("-", "*", "•"))
            ][:2] or ["Visible clinical abnormalities / बाह्य लक्षणे"],
            "advisory": [
                "Isolate animal immediately / पशु को अलग रखें",
                "Contact local veterinarian / पशु चिकित्सक से संपर्क करें"
            ]
        }

    # Normalize fields
    disease_title = str(data.get("disease") or default_disease).strip()
    severity = str(data.get("severity") or "Warning").strip()

    symptoms = data.get("symptoms", [])
    if isinstance(symptoms, str):
        symptoms = [symptoms]
    elif not isinstance(symptoms, list):
        symptoms = []

    advisory = data.get("advisory", [])
    if isinstance(advisory, str):
        advisory = [advisory]
    elif not isinstance(advisory, list):
        advisory = []

    normalized_payload = {
        "disease": disease_title,
        "severity": severity,
        "symptoms": symptoms[:2],
        "advisory": advisory[:3]
    }

    return json.dumps(normalized_payload, ensure_ascii=False), disease_title


class DiagnosisService:
    def __init__(self):
        RequestValidator.validate_api_key()
        self.client = Groq(api_key=config.GROQ_API_KEY, timeout=90.0)

    def diagnose_cattle(self, request: DiagnosisRequest) -> DiagnosisResponse:
        # Normalize language to clean 2-letter ISO (e.g., 'hi-IN' -> 'hi')
        raw_lang = (request.language or "en").strip().lower().split("-")[0]
        target_language_name = LANGUAGE_MAP.get(raw_lang, "English")

        print(f"\n[INFO] 1. Starting diagnosis in language: {target_language_name} ({raw_lang})...")

        if request.image is None:
            return DiagnosisResponse(
                success=False,
                report=json.dumps({
                    "disease": "No Image Provided",
                    "severity": "Warning",
                    "symptoms": ["Image upload required"],
                    "advisory": ["Please upload a clear photo of the cattle."]
                }, ensure_ascii=False)
            )

        try:
            print("[INFO] 2. Ensuring RGB format & encoding image...")
            image_to_process = request.image
            if hasattr(image_to_process, "mode") and image_to_process.mode != "RGB":
                image_to_process = image_to_process.convert("RGB")

            if hasattr(image_to_process, "thumbnail"):
                image_to_process.thumbnail((1024, 1024))

            base64_url = ImageUtil.encode_to_base64(image_to_process)
            prompt = PromptRepository.get_diagnostic_prompt(raw_lang)

            print(f"[INFO] 3. Calling Groq model: {config.VISION_MODEL}...")

            # In-language system directives prevent English conversational leakage
            system_directives = {
                "hi": "आप पशुसेतु AI हैं। आपको केवल और केवल शुद्ध हिंदी में वैध JSON आउटपुट देना है। कोई भी अंग्रेजी शब्द न लिखें।",
                "mr": "तुम्ही पशुसेतू AI आहात. तुम्हाला केवळ आणि केवळ शुद्ध मराठी भाषेत वैध JSON आउटपुट द्यायचे आहे. कोणताही इंग्रजी शब्द वापरू नका.",
                "te": "మీరు పశుసేతు AI. మీరు కేవలం స్వచ్ఛమైన తెలుగులో చెల్లుబాటు అయ్యే JSON అవుట్‌పుట్ మాత్రమే ఇవ్వాలి. ఆంగ్ల పదాలు వాడవద్దు.",
                "en": "You are PashuSetu AI, an expert rural veterinary clinical diagnostic engine. Output strictly raw, valid JSON according to the schema in simple English."
            }
            system_directive = system_directives.get(raw_lang, system_directives["en"])

            extra_kwargs = {}
            if "qwen" in config.VISION_MODEL.lower():
                extra_kwargs["reasoning_effort"] = "none"

            response = self.client.chat.completions.create(
                model=config.VISION_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": system_directive,
                    },
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": base64_url}},
                        ],
                    },
                ],
                temperature=0.1,
                max_tokens=500,  # Fits safely inside Groq's 1000 OTPM rate limit
                **extra_kwargs
            )

            # pyrefly: ignore [missing-attribute]
            raw_content = getattr(response.choices[0].message, "content", None) or "{}"
            final_report_json, predicted_disease = extract_json_payload(raw_content)

            print("=" * 50)
            print(f"[TARGET LANGUAGE]: {target_language_name}")
            print(f"[PREDICTION]: {predicted_disease}")
            print(f"[JSON REPORT]: {final_report_json}")
            print("=" * 50)

            diag_resp = DiagnosisResponse(success=True, report=final_report_json)
            setattr(diag_resp, "disease_prediction", predicted_disease)
            return diag_resp

        except PashuSetuException as pe:
            print(f"[ERROR] Validation failed: {pe}")
            return DiagnosisResponse(success=False, report=f"⚠️ {str(pe)}", error_message=str(pe))
        except Exception as e:
            traceback.print_exc()
            error_details = traceback.format_exc()
            return DiagnosisResponse(
                success=False,
                report=json.dumps({
                    "disease": "Error during diagnosis",
                    "severity": "Warning",
                    "symptoms": ["Could not parse image details"],
                    "advisory": ["Please verify the image and try again."]
                }, ensure_ascii=False),
                error_message=str(e),
            )