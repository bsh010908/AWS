from pydantic import BaseModel, EmailStr, Field
from datetime import datetime

# 회원가입 요청 DTO
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(..., min_length=4, max_length=100)
    name: str = Field(..., min_length=1, max_length=100)


# 로그인 요청 DTO
class UserLogin(BaseModel):
    username: str
    password: str


# 회원가입 응답 DTO
class UserResponse(BaseModel):
    user_id: int
    username: str
    email: str
    name: str
    plan: str | None = None
    subscription_status: str | None = None
    next_billing_at: datetime | None = None

    class Config:
        from_attributes = True
