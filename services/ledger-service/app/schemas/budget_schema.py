from pydantic import BaseModel


class BudgetCreate(BaseModel):
    year: int
    month: int
    amount: int


class BudgetResponse(BaseModel):
    year: int
    month: int
    amount: int