from pydantic import BaseModel
from datetime import datetime


class TransactionCreate(BaseModel):
    amount: int
    category: str
    occurred_at: datetime



class TransactionResponse(BaseModel):
    tx_id: int
    amount: int
    category: str
    occurred_at: datetime

    class Config:
        from_attributes = True