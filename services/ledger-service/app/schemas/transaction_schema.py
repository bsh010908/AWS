from pydantic import BaseModel
from datetime import datetime


class TransactionCreate(BaseModel):
    amount: int
    category: str
    occurred_at: datetime
    memo: str | None = None 
    merchant_name: str | None = None  


class TransactionResponse(BaseModel):
    tx_id: int
    amount: int
    category: str
    occurred_at: datetime
    merchant_name: str | None = None  
    memo: str | None = None          

    class Config:
        from_attributes = True