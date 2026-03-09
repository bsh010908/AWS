# DB 설계서 (ERD)

## 1. 범위
- 본 문서는 현재 코드 기준 SQLAlchemy 모델을 기반으로 작성했다.
- 대상 DB
  - `auth_db`: 사용자/구독
  - `ledger_db`: 가계부 도메인

## 2. ERD
```text
[USERS]
 PK: user_id
 UK: username, email
   |
   | (logical user_id relation)
   +--> [DOCUMENTS] --------------------+
   |      PK: document_id               |
   |                                    v
   +--> [CATEGORIES] --------------> [TRANSACTIONS]
   |      PK: category_id              PK: tx_id
   |                                   FK: document_id -> DOCUMENTS.document_id
   +--> [OCR_USAGE_MONTHLY]            FK: category_id -> CATEGORIES.category_id
   |      PK: (user_id, yyyymm)
   |
   +--> [BUDGETS]
          PK: budget_id
```

## 3. 테이블 상세

### 3.1 `auth_db.users`
| 컬럼 | 타입 | 제약/설명 |
|---|---|---|
| user_id | bigint | PK |
| username | varchar(50) | UNIQUE, NOT NULL |
| email | varchar(255) | UNIQUE, NOT NULL |
| password | varchar(255) | NOT NULL |
| name | varchar(100) | nullable |
| plan | varchar(20) | 기본값 `FREE` |
| stripe_customer_id | varchar(100) | nullable |
| stripe_subscription_id | varchar(100) | nullable |
| subscription_status | varchar(20) | 기본값 `NONE` |
| next_billing_at | datetime | nullable |
| created_at | timestamp | default now |
| updated_at | timestamp | default now, on update now |

### 3.2 `ledger_db.documents`
| 컬럼 | 타입 | 제약/설명 |
|---|---|---|
| document_id | bigint | PK |
| user_id | bigint | NOT NULL |
| input_type | varchar(20) | IMAGE/TEXT |
| s3_bucket | varchar(255) | nullable |
| s3_key | varchar(255) | nullable |
| raw_text | text | nullable |
| extracted_text | text | nullable |
| merchant_name | varchar(255) | nullable |
| total_amount | int | nullable |
| occurred_at | timestamp | nullable |
| ai_category_id | bigint | nullable |
| ai_confidence | decimal(4,3) | nullable |
| status | varchar(20) | 기본값 `UPLOADED` |
| created_at | timestamp | default now |

### 3.3 `ledger_db.categories`
| 컬럼 | 타입 | 제약/설명 |
|---|---|---|
| category_id | bigint | PK |
| user_id | bigint | nullable (NULL이면 시스템 기본 카테고리) |
| name | varchar(100) | NOT NULL |
| type | varchar(20) | `EXPENSE`/`INCOME` |
| is_active | boolean | 기본값 true |
| created_at | datetime | default now |
| updated_at | datetime | default now, on update now |

### 3.4 `ledger_db.transactions`
| 컬럼 | 타입 | 제약/설명 |
|---|---|---|
| tx_id | bigint | PK |
| user_id | bigint | NOT NULL, 인덱스 |
| document_id | bigint | FK -> documents.document_id, nullable |
| category_id | bigint | FK -> categories.category_id, NOT NULL |
| amount | int | NOT NULL |
| occurred_at | timestamp | NOT NULL, 인덱스 |
| memo | varchar(255) | nullable |
| merchant_name | varchar(100) | nullable |
| source_type | varchar(20) | 기본값 `MANUAL` |
| created_at | datetime | default now |

인덱스
- `idx_user_date (user_id, occurred_at)`

### 3.5 `ledger_db.ocr_usage_monthly`
| 컬럼 | 타입 | 제약/설명 |
|---|---|---|
| user_id | bigint | PK(복합) |
| yyyymm | char(6) | PK(복합), 예: `202603` |
| used_count | int | 기본값 0 |
| updated_at | timestamp | default now, on update now |

### 3.6 `ledger_db.budgets`
| 컬럼 | 타입 | 제약/설명 |
|---|---|---|
| budget_id | bigint | PK |
| user_id | bigint | NOT NULL, 인덱스 |
| year | int | NOT NULL |
| month | int | NOT NULL |
| amount | bigint | NOT NULL |
| created_at | timestamp | default now |

## 4. 관계/무결성 요약
- `transactions.document_id`는 문서 기반 거래일 때만 연결된다.
- `transactions.category_id`는 반드시 카테고리를 참조한다.
- `documents`, `transactions`, `categories`, `budgets`, `ocr_usage_monthly`는 모두 `user_id` 기준 멀티테넌트 분리를 전제한다.

## 5. 권장 개선사항
- FK 보강: `documents.user_id`, `categories.user_id`, `budgets.user_id`, `ocr_usage_monthly.user_id`를 `auth_db.users.user_id`와 애플리케이션 레벨 또는 DB 링크 전략으로 일관 관리.
- 유니크 제약: `budgets (user_id, year, month)` UNIQUE 권장.
- 열거형 관리: `input_type`, `status`, `type`, `source_type`는 ENUM 또는 CHECK 제약 권장.
- 감사 추적: 주요 테이블에 `updated_at` 통일 추가 고려.
