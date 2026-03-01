from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
import requests

from app.db.session import get_db
from app.core.security import get_current_user
from app.services.receipt_service import save_receipt

router = APIRouter(prefix="/receipts", tags=["Receipts"])

OCR_SERVICE_URL = "http://localhost:8003/ocr/classify"


@router.post("/upload")
async def upload_receipt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        # 🔥 OCR 서비스 호출
        response = requests.post(
            OCR_SERVICE_URL,
            files={"file": (file.filename, await file.read(), file.content_type)}
        )

        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="OCR 서비스 오류")

        result = response.json()

        # 🔥 현재 로그인한 유저 ID 전달
        saved = save_receipt(
            db=db,
            user_id=current_user["user_id"],
            classification=result["classification"],
            raw_text=result["ocr_text"]  # 🔥 이름 통일
        )

        return saved

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"업로드 실패: {str(e)}")