from sqlalchemy.orm import Session
from app.models.category import Category
from app.models.document import Document
from app.models.transaction import Transaction
from datetime import datetime


def save_receipt(db: Session, user_id: int, classification: dict, raw_text: str):

    # 🔹 기본 카테고리 찾기 (공용 카테고리)
    category = db.query(Category).filter(
        Category.name == classification["category"],
        Category.user_id == None
    ).first()

    # 카테고리 없으면 기타
    if not category:
        category = db.query(Category).filter(
            Category.name == "기타",
            Category.user_id == None
        ).first()

    # 🔹 Document 저장
    document = Document(
        user_id=user_id,
        input_type="RECEIPT",
        raw_text=raw_text,
        extracted_text=raw_text,
        merchant_name=classification.get("merchant_name", ""),
        total_amount=classification.get("amount", 0),
        ai_category_id=category.category_id if category else None,
        ai_confidence=classification.get("confidence", 0),
        status="PROCESSED"
    )

    db.add(document)
    db.flush()  # document_id 생성

    # 🔹 Transaction 저장
    transaction = Transaction(
        user_id=user_id,
        document_id=document.document_id,
        amount=classification.get("amount", 0),
        category_id=category.category_id if category else None,
        occurred_at=datetime.now(),
        memo="AI 자동 등록"
    )

    db.add(transaction)
    db.commit()

    db.refresh(document)
    db.refresh(transaction)

    return {
        "document_id": document.document_id,
        "tx_id": transaction.tx_id,
        "category": category.name if category else "기타",
        "amount": classification.get("amount", 0),
        "merchant_name": classification.get("merchant_name", "")
    }