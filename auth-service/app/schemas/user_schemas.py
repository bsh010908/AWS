# Pydantic은 "요청/응답 DTO"를 정의하는 라이브러리
from pydantic import BaseModel, EmailStr


# 회원가입 요청 DTO
class UserCreate(BaseModel):
    # 잘못된 형식이면 FastAPI가 422 에러를 자동 반환
    email: EmailStr
    password: str
    name: str


# 회원가입 응답 DTO
class UserResponse(BaseModel):
    user_id: int
    email: str
    name: str
    role: str
    status: str
    # Pydantic v2 설정
    class Config:
        # SQLAlchemy 모델 객체를 그대로 반환해도
        # 자동으로 이 DTO에 맞춰 변환해줌
        # (Spring에서 Entity → DTO 매핑하는 역할을 자동 처리)
        from_attributes = True