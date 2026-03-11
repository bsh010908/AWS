from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.ocr_usage import OcrUsageMonthly

router = APIRouter(prefix="/ledger/ocr", tags=["OCR"])


@router.get("/usage")
def get_current_month_usage(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]
    yyyymm = datetime.now().strftime("%Y%m")

    usage = (
        db.query(OcrUsageMonthly)
        .filter(
            OcrUsageMonthly.user_id == user_id,
            OcrUsageMonthly.yyyymm == yyyymm
        )
        .first()
    )

    if not usage:
        return {
            "used_count": 0
        }

    return {
        "used_count": usage.used_count
    }