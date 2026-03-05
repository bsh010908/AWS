from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
import requests

from app.db.session import get_db
from app.core.security import get_current_user
from app.services.receipt_service import save_receipt
from app.services.ocr_usage_service import check_ocr_limit, increment_ocr_usage

router = APIRouter(prefix="/receipts", tags=["Receipts"])

OCR_SERVICE_URL = "http://ocr-ai-service:8000/ocr/classify"




@router.post("/upload")
async def upload_receipt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        print("🔎 CURRENT USER:", current_user)

        # 1️⃣ FREE 한도 체크
        check_ocr_limit(db, current_user)

        # 2️⃣ OCR 호출
        response = requests.post(
            OCR_SERVICE_URL,
            files={"file": (file.filename, await file.read(), file.content_type)},
            timeout=30,
        )

        print("🔎 OCR STATUS:", response.status_code)

        if response.status_code != 200:
            print("❌ OCR RESPONSE:", response.text)
            raise HTTPException(status_code=500, detail="OCR 서비스 오류")

        result = response.json()
        print("🔎 OCR RESULT:", result)

        # 3️⃣ 저장
        saved = save_receipt(
            db=db,
            user_id=current_user["user_id"],
            classification=result.get("classification"),
            raw_text=result.get("ocr_text"),
        )

        # 4️⃣ 성공했을 때만 +1
        increment_ocr_usage(db, current_user)

        return saved

    except HTTPException:
        raise

    except Exception as e:
        print("🔥 실제 에러 발생:", repr(e))
        raise