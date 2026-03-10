from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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
        ocr_text = extract_text_from_s3(payload.s3_bucket, payload.s3_key)
        classification = classify_receipt(ocr_text)
        return {
            "ocr_text": ocr_text,
            "classification": classification,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
