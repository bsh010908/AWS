from fastapi import APIRouter, UploadFile, File
from app.services.ocr_service import extract_text
from app.services.ai_service import classify_receipt

router = APIRouter(prefix="/ocr", tags=["OCR"])

@router.post("/classify")
async def classify(file: UploadFile = File(...)):

    # 🔥 파일을 디스크에 저장하지 않고 바로 OCR
    text = extract_text(file.file)

    result = classify_receipt(text)

    return {
        "ocr_text": text,
        "classification": result
    }