from sqlalchemy.orm import Session
from app.models.category import Category
from app.models.document import Document
from app.models.transaction import Transaction
from datetime import datetime


def save_receipt(db: Session, user_id: int, classification: dict, raw_text: str):

    category_name = classification.get("category", "기타")

    #  기본 카테고리 찾기
    category = db.query(Category).filter(
        Category.name == category_name,
        Category.user_id == None
    ).first()

    #  없으면 기타 fallback
    if not category:
        category = db.query(Category).filter(
            Category.name == "기타",
            Category.user_id == None
        ).first()

    # 🔥 그래도 없으면 시스템 오류
    if not category:
        raise Exception("기본 카테고리 '기타'가 DB에 없습니다")

    # 🔹 Document 저장
    document = Document(
        user_id=user_id,
        input_type="RECEIPT",
        raw_text=raw_text,
        extracted_text=raw_text,
        merchant_name=classification.get("merchant_name", ""),
        total_amount=classification.get("amount", 0),
        ai_category_id=category.category_id,
        ai_confidence=classification.get("confidence", 0),
        status="PROCESSED"
    )

    db.add(document)
    db.flush()

    # 날짜 처리
    raw_date = classification.get("date")

    try:
        occurred_at = datetime.fromisoformat(raw_date) if raw_date else datetime.now()
    except Exception:
        occurred_at = datetime.now()

    # Transaction 저장
    transaction = Transaction(
        user_id=user_id,
        document_id=document.document_id,
        merchant_name=document.merchant_name,
        amount=document.total_amount,
        category_id=category.category_id,   # 🔥 절대 NULL 안됨
        occurred_at=occurred_at,
        memo="AI 자동 등록",
        source_type="OCR"
    )

    db.add(transaction)
    db.commit()

    db.refresh(document)
    db.refresh(transaction)

    return {
        "document_id": document.document_id,
        "tx_id": transaction.tx_id,
        "category": category.name,
        "amount": transaction.amount,
        "merchant_name": transaction.merchant_name,
        "ai_confidence": document.ai_confidence,
        "occurred_at": transaction.occurred_at
    }