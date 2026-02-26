from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import get_db
from app.models.transaction import Transaction

router = APIRouter()


@router.get("/db-test")
def db_test(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT 1")).fetchone()
    return {"result": result[0]}



    from app.models.transaction import Transaction


@router.get("/transactions-test")
def transactions_test(db: Session = Depends(get_db)):
    data = db.query(Transaction).limit(5).all()
    return data