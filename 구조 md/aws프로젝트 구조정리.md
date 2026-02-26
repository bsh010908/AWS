# ✅ AWS 가계부 SaaS (EKS + MSA) 프로젝트 구조 (확정본)

> 목표: **2주(15일) 안에 “요구사항 충족형”으로 완성**
- Docker 이미지 → **ECR**
- 운영환경 → **EKS**
- 배포 → **Blue/Green 무중단(최소 구현)**
- 백엔드 → **Python(FastAPI)**
- 프론트 → **Vanilla JS**
- OCR → **Textract**
- 분류 → **OpenAI**
- 저장 → **S3**
- DB → **RDS(MySQL)**

---

## 1) 전체 아키텍처 (요구사항 맞춘 현실형)

**[User Browser]**  
└─ Frontend (Vanilla JS, S3+CloudFront *또는* Nginx in cluster)  
  ↓  
**[API Gateway (선택/권장)]**  
  ↓  
**[ALB Ingress Controller]**  
  ↓  
**[EKS Cluster]**  
├─ auth-service (FastAPI)  
├─ ledger-service (FastAPI)  
└─ ocr-ai-service (FastAPI) *(권장, 시간 부족 시 ledger에 통합 가능)*  
  ↓  
**[RDS(MySQL)] + [S3(영수증 이미지)] + [Textract] + [OpenAI]**

✅ 보안/관측  
- IAM 최소권한, (가능하면) IRSA  
- S3 KMS 암호화  
- CloudWatch Logs  
- WAF(기본 룰)

---

## 2) 마이크로서비스 책임 분리 (MSA처럼 보이게)

### A. auth-service (인증/구독/사용량)
- 회원가입/로그인 (JWT)
- 플랜(FREE/PRO) 및 구독 상태 관리 (Stripe Webhook)
- 월별 OCR 사용량(제한) 체크/증가
- 유저 검증 API (token 검증 또는 user info)

**API 예시**
- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`
- `POST /billing/webhook` (Stripe)
- `GET /usage/my` (이번달 사용량/한도)

---

### B. ledger-service (가계부 핵심)
- 영수증 업로드 요청 수신
- S3 업로드(프리사인 URL 방식 권장)
- 영수증 목록/상세/통계
- 카테고리 신뢰도 낮으면 `기타` 처리
- ocr-ai-service 호출(또는 내부 처리)

**API 예시**
- `POST /receipts/presign` (S3 presigned URL)
- `POST /receipts` (S3 key + metadata 저장)
- `GET /receipts?month=YYYY-MM`
- `GET /receipts/{id}`
- `GET /stats/category?month=YYYY-MM`

---

### C. ocr-ai-service (OCR + AI 분류 전담)
- Textract 호출 (텍스트 추출)
- OpenAI 카테고리 분류
- confidence 기준 fallback(`기타`)
- 결과를 ledger-service로 반환

**API 예시**
- `POST /ocr/classify`
  - input: `{ s3_bucket, s3_key }`
  - output: `{ total_amount, date, merchant, category, confidence, raw_text }`

> 시간 부족하면 C를 없애고 ledger-service 내부 모듈로 합치되,  
> “설계 상 분리 가능”을 문서/발표에 명확히 남기기.

---

## 3) 저장소/리포지토리 구조 (모노레포 추천)

```
project-root/
├─ services/
│  ├─ auth-service/
│  │  ├─ app/
│  │  │  ├─ main.py
│  │  │  ├─ api/            # router
│  │  │  ├─ core/           # settings, security(JWT)
│  │  │  ├─ models/         # SQLAlchemy models
│  │  │  ├─ schemas/        # Pydantic DTO
│  │  │  ├─ services/       # business logic
│  │  │  └─ db/             # session, migrations
│  │  ├─ tests/
│  │  ├─ Dockerfile
│  │  └─ requirements.txt
│  │
│  ├─ ledger-service/
│  │  ├─ app/
│  │  │  ├─ main.py
│  │  │  ├─ api/
│  │  │  ├─ core/
│  │  │  ├─ models/
│  │  │  ├─ schemas/
│  │  │  ├─ services/
│  │  │  ├─ integrations/   # s3, textract, openai client (or http call)
│  │  │  └─ db/
│  │  ├─ tests/
│  │  ├─ Dockerfile
│  │  └─ requirements.txt
│  │
│  └─ ocr-ai-service/
│     ├─ app/
│     │  ├─ main.py
│     │  ├─ api/
│     │  ├─ core/
│     │  ├─ services/       # textract + openai
│     │  └─ integrations/
│     ├─ Dockerfile
│     └─ requirements.txt
│
├─ frontend/
│  ├─ index.html
│  ├─ assets/
│  ├─ js/
│  │  ├─ api.js            # fetch wrapper (JWT 포함)
│  │  ├─ auth.js
│  │  ├─ upload.js         # presigned upload
│  │  ├─ dashboard.js      # stats
│  │  └─ receipts.js
│  └─ css/
│
├─ infra/
│  ├─ k8s/
│  │  ├─ base/
│  │  │  ├─ namespace.yaml
│  │  │  ├─ configmap.yaml
│  │  │  ├─ secrets.yaml        # 실제 값은 Git에 X
│  │  │  ├─ auth-deploy.yaml
│  │  │  ├─ auth-svc.yaml
│  │  │  ├─ ledger-deploy.yaml
│  │  │  ├─ ledger-svc.yaml
│  │  │  ├─ ocr-deploy.yaml
│  │  │  ├─ ocr-svc.yaml
│  │  │  └─ ingress.yaml
│  │  ├─ bluegreen/
│  │  │  ├─ auth-blue.yaml
│  │  │  ├─ auth-green.yaml
│  │  │  ├─ ledger-blue.yaml
│  │  │  ├─ ledger-green.yaml
│  │  │  └─ switch-service-selector.md
│  │  └─ README.md
│  │
│  └─ scripts/
│     ├─ build_push_ecr.sh
│     ├─ deploy_k8s.sh
│     └─ switch_blue_green.sh
│
├─ cicd/
│  ├─ buildspec-auth.yml
│  ├─ buildspec-ledger.yml
│  ├─ buildspec-ocr.yml
│  └─ pipeline.md
│
└─ docs/
   ├─ architecture.md
   ├─ api-contract.md
   ├─ db-schema.md
   ├─ security.md
   └─ runbook.md
```

✅ 평가/발표 포인트: “구조”가 반은 먹고 들어감  
- 서비스 책임 분리  
- infra(k8s) 분리  
- cicd 분리  
- docs 분리  

---

## 4) Blue/Green 배포 (최소 구현, 요구사항 충족형)

### 핵심 아이디어
- 같은 서비스에 대해 Deployment를 2개 운영: **blue / green**
- Service가 바라보는 selector만 바꿔서 트래픽 전환
- ALB Ingress는 그대로, Service만 스위치

### 구성
- Deployment: `auth-blue`, `auth-green`
- Service: `auth-svc` (selector=blue or green)
- 동일하게 ledger도 적용

### 전환 절차(예)
1) green 배포 + 헬스체크 OK  
2) `auth-svc` selector를 green으로 변경  
3) 문제가 없으면 blue 유지/삭제(선택)  

> Argo Rollouts 같은 고급 도구는 “시간 여유 있을 때” 옵션.  
> 2주 기준은 위 방식이 가장 안전.

---

## 5) “15일 완성”을 위한 스코프 고정

✅ 반드시 구현
- 로그인(JWT)
- 영수증 업로드(S3)
- Textract OCR
- OpenAI 카테고리 분류 + confidence fallback(`기타`)
- 영수증 리스트/상세
- 카테고리별 통계(원형차트용 API)
- EKS 배포 + Blue/Green 전환 시연
- CloudWatch 로그 확인 스크린샷

❌ 시간 남으면(옵션)
- Stripe 결제 실제 연결 (또는 “모의 Webhook”으로 대체)
- CloudFront, WAF 룰 강화, IRSA 완벽 적용, HPA

---

## 6) 다음 단계 체크리스트

1) 서비스 3개로 갈지(권장) / 2개로 합칠지(절약) 결정  
2) DB 스키마를 auth/ledger로 나눠 확정  
3) API Contract(요청/응답 JSON) 먼저 고정  
4) k8s manifest 초안 작성(blue/green 포함)  
