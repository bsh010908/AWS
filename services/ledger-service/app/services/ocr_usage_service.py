from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.ocr_usage import OcrUsageMonthly

FREE_OCR_LIMIT = 50


def check_ocr_limit(db: Session, user: dict):
    """
    FREE 유저 한도 초과 여부만 체크
    """

    # ✅ PRO는 무제한
    if user.get("plan") == "PRO":
        return

    user_id = user["user_id"]
    yyyymm = datetime.now().strftime("%Y%m")

    usage = (
        db.query(OcrUsageMonthly)
        .filter(
            OcrUsageMonthly.user_id == user_id,
            OcrUsageMonthly.yyyymm == yyyymm
        )
        .first()
    )

    if usage and usage.used_count >= FREE_OCR_LIMIT:
        raise HTTPException(
            status_code=403,
            detail="이번 달 OCR 사용 한도를 초과했습니다."
        )


def increment_ocr_usage(db: Session, user: dict):
    """
    OCR 성공 시 사용량 +1
    """

    # ✅ PRO는 카운트 안 함
    if user.get("plan") == "PRO":
        return

    user_id = user["user_id"]
    yyyymm = datetime.now().strftime("%Y%m")

    usage = (
        db.query(OcrUsageMonthly)
        .filter(
            OcrUsageMonthly.user_id == user_id,
            OcrUsageMonthly.yyyymm == yyyymm
        )
        .first()
    )

    # 없으면 새로 생성
    if not usage:
        usage = OcrUsageMonthly(
            user_id=user_id,
            yyyymm=yyyymm,
            used_count=1
        )
        db.add(usage)
    else:
        usage.used_count += 1

    db.commit()
