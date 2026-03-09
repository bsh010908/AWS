# API 명세서 (Swagger 형태)

## 1. 개요
- 본 문서는 현재 코드 기준(`auth-service`, `ledger-service`, `ocr-ai-service`) API를 OpenAPI 3.0(Swagger) 스타일로 정리한 명세서다.
- 실제 Swagger UI 경로
  - Auth: `http://localhost:8001/docs`
  - Ledger: `http://localhost:8002/docs`
  - OCR-AI: `http://localhost:8003/docs`

## 2. 공통 인증
- Auth Service 보호 API: `Authorization: Bearer <token>` (OAuth2PasswordBearer)
- Ledger Service 보호 API: `Authorization: Bearer <token>` (HTTPBearer)
- OCR-AI Service: 현재 인증 없음(내부 호출 전제)

---

## 3. Auth Service (`http://localhost:8001`)

```yaml
openapi: 3.0.3
info:
  title: Auth Service API
  version: 1.0.0
servers:
  - url: http://localhost:8001
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    UserCreate:
      type: object
      required: [username, email, password, name]
      properties:
        username: { type: string, minLength: 3, maxLength: 30 }
        email: { type: string, format: email }
        password: { type: string, minLength: 4, maxLength: 100 }
        name: { type: string, minLength: 1, maxLength: 100 }
    UserLogin:
      type: object
      required: [username, password]
      properties:
        username: { type: string }
        password: { type: string }
    TokenResponse:
      type: object
      properties:
        access_token: { type: string }
        token_type: { type: string, example: bearer }
    UserResponse:
      type: object
      properties:
        user_id: { type: integer }
        username: { type: string }
        email: { type: string }
        name: { type: string }
        plan: { type: string, example: FREE }
        subscription_status: { type: string, example: NONE }
        next_billing_at: { type: string, format: date-time, nullable: true }
paths:
  /signup:
    post:
      tags: [Auth]
      summary: 회원가입
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/UserCreate' }
      responses:
        '200':
          description: 성공
          content:
            application/json:
              schema: { $ref: '#/components/schemas/UserResponse' }
        '400': { description: 중복 아이디/이메일 }

  /login:
    post:
      tags: [Auth]
      summary: 로그인
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/UserLogin' }
      responses:
        '200':
          description: 성공
          content:
            application/json:
              schema: { $ref: '#/components/schemas/TokenResponse' }
        '400': { description: 인증 실패 }

  /me:
    get:
      tags: [Auth]
      summary: 내 정보 조회
      security: [{ bearerAuth: [] }]
      responses:
        '200': { description: 성공 }
        '401': { description: 토큰 오류 }
    delete:
      tags: [Auth]
      summary: 회원 탈퇴
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [current_password]
              properties:
                current_password: { type: string }
      responses:
        '200': { description: 탈퇴 완료 }
        '400': { description: 비밀번호 불일치 }

  /me/email:
    put:
      tags: [Auth]
      summary: 이메일 변경
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [new_email]
              properties:
                new_email: { type: string, format: email }
      responses:
        '200': { description: 변경 완료 }
        '400': { description: 중복/동일 이메일 }

  /me/password:
    put:
      tags: [Auth]
      summary: 비밀번호 변경
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [current_password, new_password]
              properties:
                current_password: { type: string }
                new_password: { type: string }
      responses:
        '200': { description: 변경 완료 }
        '400': { description: 검증 실패 }

  /billing/create-checkout-session:
    post:
      tags: [Billing]
      summary: Stripe Checkout Session 생성
      security: [{ bearerAuth: [] }]
      responses:
        '200':
          description: 성공
          content:
            application/json:
              schema:
                type: object
                properties:
                  checkout_url: { type: string }

  /billing/sync-subscription:
    post:
      tags: [Billing]
      summary: 구독 상태 동기화
      security: [{ bearerAuth: [] }]
      parameters:
        - in: query
          name: session_id
          schema: { type: string }
          required: false
      responses:
        '200': { description: 동기화 완료 }

  /billing/cancel-subscription:
    post:
      tags: [Billing]
      summary: 구독 취소
      security: [{ bearerAuth: [] }]
      responses:
        '200': { description: 취소 완료 }

  /billing/webhook:
    post:
      tags: [Billing]
      summary: Stripe Webhook 수신
      description: checkout.session.completed 등 이벤트 처리
      responses:
        '200': { description: 처리 완료 또는 무시 }
        '400': { description: 서명 검증 실패 }
```

---

## 4. Ledger Service (`http://localhost:8002`)

```yaml
openapi: 3.0.3
info:
  title: Ledger Service API
  version: 1.0.0
servers:
  - url: http://localhost:8002
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    BudgetCreate:
      type: object
      required: [year, month, amount]
      properties:
        year: { type: integer }
        month: { type: integer }
        amount: { type: integer }
    TransactionCreate:
      type: object
      required: [amount, category, occurred_at]
      properties:
        amount: { type: integer }
        category: { type: string }
        occurred_at: { type: string, format: date-time }
        memo: { type: string, nullable: true }
        merchant_name: { type: string, nullable: true }
security:
  - bearerAuth: []
paths:
  /budget:
    post:
      tags: [Budget]
      summary: 월 예산 등록/수정
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/BudgetCreate' }
      responses:
        '200': { description: 성공 }
    get:
      tags: [Budget]
      summary: 월 예산 조회
      parameters:
        - in: query
          name: year
          required: true
          schema: { type: integer }
        - in: query
          name: month
          required: true
          schema: { type: integer }
      responses:
        '200': { description: 성공 }

  /categories:
    get:
      tags: [Categories]
      summary: 카테고리 목록(시스템+사용자)
      responses:
        '200': { description: 성공 }
    post:
      tags: [Categories]
      summary: 사용자 카테고리 생성
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name]
              properties:
                name: { type: string }
      responses:
        '200': { description: 생성 성공 }
        '400': { description: 입력/중복 오류 }

  /categories/{category_id}:
    put:
      tags: [Categories]
      summary: 사용자 카테고리 수정
      parameters:
        - in: path
          name: category_id
          required: true
          schema: { type: integer }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name]
              properties:
                name: { type: string }
      responses:
        '200': { description: 수정 성공 }
        '403': { description: 권한 없음/기본 카테고리 }
        '404': { description: 없음 }
    delete:
      tags: [Categories]
      summary: 카테고리 삭제(soft delete)
      parameters:
        - in: path
          name: category_id
          required: true
          schema: { type: integer }
      responses:
        '200': { description: 삭제 성공 }

  /transactions:
    post:
      tags: [Transactions]
      summary: 거래 생성
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/TransactionCreate' }
      responses:
        '200': { description: 성공 }
    get:
      tags: [Transactions]
      summary: 월별 거래 목록(페이징)
      parameters:
        - in: query
          name: year
          required: true
          schema: { type: integer }
        - in: query
          name: month
          required: true
          schema: { type: integer }
        - in: query
          name: page
          schema: { type: integer, default: 0 }
        - in: query
          name: size
          schema: { type: integer, default: 10 }
        - in: query
          name: source_type
          schema: { type: string, nullable: true }
      responses:
        '200': { description: 성공 }

  /transactions/recent:
    get:
      tags: [Transactions]
      summary: 최근 거래 목록
      parameters:
        - in: query
          name: limit
          schema: { type: integer, default: 20 }
      responses:
        '200': { description: 성공 }

  /transactions/export/csv:
    get:
      tags: [Transactions]
      summary: 거래 CSV 다운로드
      parameters:
        - in: query
          name: year
          schema: { type: integer, nullable: true }
        - in: query
          name: month
          schema: { type: integer, minimum: 1, maximum: 12, nullable: true }
      responses:
        '200':
          description: CSV 파일
          content:
            text/csv:
              schema: { type: string, format: binary }

  /transactions/{tx_id}:
    get:
      tags: [Transactions]
      summary: 거래 상세
      parameters:
        - in: path
          name: tx_id
          required: true
          schema: { type: integer }
      responses:
        '200': { description: 성공 }
        '404': { description: 거래 없음 }
    put:
      tags: [Transactions]
      summary: 거래 수정
      parameters:
        - in: path
          name: tx_id
          required: true
          schema: { type: integer }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              description: 일부 필드만 보내도 됨
              properties:
                memo: { type: string }
                category_id: { type: integer }
                amount: { type: integer }
                occurred_at: { type: string, format: date-time }
                merchant_name: { type: string }
      responses:
        '200': { description: 수정 성공 }
    delete:
      tags: [Transactions]
      summary: 거래 삭제
      parameters:
        - in: path
          name: tx_id
          required: true
          schema: { type: integer }
      responses:
        '200': { description: 삭제 성공 }

  /receipts/upload:
    post:
      tags: [Receipts]
      summary: 영수증 업로드 + OCR + 거래 자동생성
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [file]
              properties:
                file:
                  type: string
                  format: binary
      responses:
        '200': { description: 문서/거래 생성 성공 }
        '500': { description: OCR 서비스 오류 }

  /ocr/usage:
    get:
      tags: [OCR]
      summary: 당월 OCR 사용량 조회
      responses:
        '200': { description: 성공 }

  /dashboard/overview:
    get:
      tags: [Dashboard]
      summary: 통합 대시보드
      parameters:
        - in: query
          name: year
          schema: { type: integer, nullable: true }
        - in: query
          name: month
          schema: { type: integer, nullable: true }
      responses:
        '200': { description: 성공 }

  /dashboard/summary:
    get:
      tags: [Dashboard]
      summary: 월 요약
      responses:
        '200': { description: 성공 }

  /dashboard/category:
    get:
      tags: [Dashboard]
      summary: 카테고리 통계
      responses:
        '200': { description: 성공 }

  /dashboard/daily:
    get:
      tags: [Dashboard]
      summary: 일별 통계
      responses:
        '200': { description: 성공 }

  /dashboard/ai-insight:
    get:
      tags: [Dashboard]
      summary: AI 인사이트(PRO 전용)
      responses:
        '200': { description: 성공 }
        '403': { description: PRO 전용 }

  /dashboard/recent:
    get:
      tags: [Dashboard]
      summary: 최근 거래(요약)
      parameters:
        - in: query
          name: limit
          schema: { type: integer, default: 5 }
      responses:
        '200': { description: 성공 }

  /dashboard/yearly-summary:
    get:
      tags: [Dashboard]
      summary: 연도별 월 합계
      parameters:
        - in: query
          name: year
          required: true
          schema: { type: integer }
      responses:
        '200': { description: 성공 }

  /dashboard/last-12-months:
    get:
      tags: [Dashboard]
      summary: 최근 12개월 합계
      responses:
        '200': { description: 성공 }

  /dashboard/transactions/{tx_id}:
    get:
      tags: [Dashboard]
      summary: 대시보드용 거래 상세
      parameters:
        - in: path
          name: tx_id
          required: true
          schema: { type: integer }
      responses:
        '200': { description: 성공 }
        '404': { description: 거래 없음 }
```

---

## 5. OCR-AI Service (`http://localhost:8003`)

```yaml
openapi: 3.0.3
info:
  title: OCR AI Service API
  version: 1.0.0
servers:
  - url: http://localhost:8003
paths:
  /ocr/classify:
    post:
      tags: [OCR]
      summary: 이미지 OCR + 영수증 분류
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [file]
              properties:
                file:
                  type: string
                  format: binary
      responses:
        '200':
          description: 성공
          content:
            application/json:
              schema:
                type: object
                properties:
                  ocr_text: { type: string }
                  classification:
                    type: object
                    properties:
                      merchant_name: { type: string }
                      amount: { type: number }
                      category: { type: string }
                      confidence: { type: number }
                      date: { type: string, nullable: true }
```

---

## 6. 테스트용 예시

### 6.1 로그인
```bash
curl -X POST http://localhost:8001/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"1234"}'
```

### 6.2 거래 조회
```bash
curl "http://localhost:8002/transactions?year=2026&month=3&page=0&size=10" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### 6.3 영수증 업로드
```bash
curl -X POST http://localhost:8002/receipts/upload \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -F "file=@receipt.jpg"
```
