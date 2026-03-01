from fastapi import APIRouter, UploadFile, File
import requests
from app.services.receipt_service import save_receipt

router = APIRouter(prefix="/receipts", tags=["Receipts"])

OCR_SERVICE_URL = "http://localhost:8003/ocr/classify"


@router.post("/upload")
async def upload_receipt(file: UploadFile = File(...)):

    # 🔥 OCR 서비스 호출
    response = requests.post(
        OCR_SERVICE_URL,
        files={"file": (file.filename, await file.read(), file.content_type)}
    )

    result = response.json()

    # 🔥 DB 저장
    saved = save_receipt(
        result["classification"],
        result["ocr_text"]
    )

    return saved