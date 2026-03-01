from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.category import Category
from app.models.document import Document
from app.models.transaction import Transaction
from datetime import datetime


def save_receipt(classification, raw_text):

    db: Session = SessionLocal()

    # 기본 카테고리 찾기
    category = db.query(Category).filter(
        Category.name == classification["category"],
        Category.user_id == None
    ).first()

    if not category:
        category = db.query(Category).filter(
            Category.name == "기타",
            Category.user_id == None
        ).first()

    # Document 저장 
    document = Document(
        user_id=1,
        input_type="RECEIPT",
        raw_text=raw_text,
        extracted_text=raw_text,
        merchant_name=classification.get("merchant_name", ""),  # 🔥 추가
        total_amount=classification["amount"],
        ai_category_id=category.category_id,
        ai_confidence=classification["confidence"],
        status="PROCESSED"
    )

    db.add(document)
    db.flush()  # document_id 생성됨

    # Transaction 저장
    transaction = Transaction(
        user_id=1,
        document_id=document.document_id,
        amount=classification["amount"],
        category_id=category.category_id,
        occurred_at=datetime.now(),
        memo="AI 자동 등록"
    )

    db.add(transaction)
    db.commit()

    # commit 이후 refresh
    db.refresh(document)
    db.refresh(transaction)

    # 값 먼저 꺼내두기
    doc_id = document.document_id
    tx_id = transaction.tx_id
    category_name = category.name
    amount = classification["amount"]
    merchant = classification.get("merchant_name", "")

    db.close()

    return {
        "document_id": doc_id,
        "tx_id": tx_id,
        "category": category_name,
        "amount": amount,
        "merchant_name": merchant
    }