from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
import requests

from app.db.session import get_db
from app.core.security import get_current_user
from app.services.receipt_service import save_receipt
from app.services.ocr_usage_service import check_ocr_limit, increment_ocr_usage
from app.services.s3_service import upload_receipt_to_s3   

router = APIRouter(prefix="/ledger/receipts", tags=["Receipts"])

OCR_SERVICE_URL = "http://ocr-ai-service:8000/ocr/classify"
S3_BUCKET = "aws-ledger-receipts"


@router.post("/upload")
async def upload_receipt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        print("🔎 CURRENT USER:", current_user)

        # 1FREE 한도 체크
        check_ocr_limit(db, current_user)

        #  S3 업로드 
        s3_key = upload_receipt_to_s3(file)

        print("📦 S3 UPLOAD:", s3_key)

        # OCR 호출 (S3 기준) 
        response = requests.post(
            OCR_SERVICE_URL,
            json={
                "s3_bucket": S3_BUCKET,
                "s3_key": s3_key,
            },
            timeout=30,
        )

        print("OCR STATUS:", response.status_code)

        if response.status_code != 200:
            print("OCR RESPONSE:", response.text)
            raise HTTPException(status_code=500, detail="OCR 서비스 오류")

        result = response.json()
        print("OCR RESULT:", result)

        # 저장
        saved = save_receipt(
            db=db,
            user_id=current_user["user_id"],
            classification=result.get("classification"),
            raw_text=result.get("ocr_text"),
        )

        # 성공했을 때만 +1
        increment_ocr_usage(db, current_user)

        return saved

    except HTTPException:
        raise

    except Exception as e:
        print("실제 에러 발생:", repr(e))
        raise HTTPException(status_code=500, detail=str(e)) from e
