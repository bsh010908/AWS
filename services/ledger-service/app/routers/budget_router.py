from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user
from app.schemas.budget_schema import BudgetCreate, BudgetResponse
from app.services.budget_service import set_budget
from app.models.budget import Budget

router = APIRouter(prefix="/ledger/budget", tags=["budget"])


# ===============================
# 예산 설정
# ===============================
@router.post("")
def create_budget(
    data: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):

    user_id = current_user["user_id"]

    budget = set_budget(
        db,
        user_id=user_id,
        year=data.year,
        month=data.month,
        amount=data.amount
    )

    return {
        "year": budget.year,
        "month": budget.month,
        "amount": budget.amount
    }


# ===============================
# 예산 조회
# ===============================
@router.get("", response_model=BudgetResponse)
def get_budget(
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):

    user_id = current_user["user_id"]

    budget = (
        db.query(Budget)
        .filter(
            Budget.user_id == user_id,
            Budget.year == year,
            Budget.month == month
        )
        .first()
    )

    if not budget:
        return {
            "year": year,
            "month": month,
            "amount": 0
        }

    return {
        "year": budget.year,
        "month": budget.month,
        "amount": budget.amount
    }