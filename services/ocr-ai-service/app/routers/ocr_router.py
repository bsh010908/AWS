from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import traceback

from ..services.ai_service import classify_receipt
from ..services.ocr_service import extract_text_from_s3

router = APIRouter(prefix="/ocr", tags=["OCR"])


class OCRClassifyRequest(BaseModel):
    s3_bucket: str
    s3_key: str


class OCRClassifyResponse(BaseModel):
    ocr_text: str
    classification: dict


@router.post("/classify", response_model=OCRClassifyResponse)
async def classify_from_s3(payload: OCRClassifyRequest):
    try:
        print("📥 OCR REQUEST:", payload)

        # Textract OCR
        ocr_text = extract_text_from_s3(payload.s3_bucket, payload.s3_key)
        print("📄 OCR TEXT:", ocr_text[:200])

        if not ocr_text:
            raise Exception("OCR text is empty")

        # AI 분류
        classification = classify_receipt(ocr_text)
        print("🤖 AI RESULT:", classification)

        return {
            "ocr_text": ocr_text,
            "classification": classification,
        }

    except Exception as exc:
        print("🔥 OCR SERVICE ERROR")
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=f"OCR pipeline failed: {str(exc)}"
        )