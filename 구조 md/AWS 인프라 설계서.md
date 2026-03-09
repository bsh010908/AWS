# AWS 인프라 설계서

## 1. 목적
- 현재 `docker-compose` 기반 MSA(`auth-service`, `ledger-service`, `ocr-ai-service`, `mysql`)를 AWS 운영 환경으로 전환한다.
- 보안, 확장성, 운영 편의성(로그/모니터링/배포 자동화)을 확보한다.

## 2. 대상 서비스
- Frontend: `frontend` 정적 웹
- Backend API:
  - `auth-service` (인증/구독)
  - `ledger-service` (가계부/카테고리/예산)
  - `ocr-ai-service` (OCR + AI 분류)
- Database: MySQL
- External: Stripe Webhook

## 3. 운영 구조 구분
### 3.1 현재 운영/배포 구조 (deploy.yml 기준)
- GitHub Actions -> ECR 이미지 Push -> EC2 접속 -> `docker compose pull && up -d`
- 현재 자동배포는 `ledger-service` 중심
- 리전: `ap-northeast-2`

### 3.2 목표 구조 (권장 아키텍처)
- ECS Fargate + ALB + RDS + S3 + CloudFront + Route53

## 4. 목표 AWS 구성 요소
- 네트워크
  - VPC 1개, AZ 2개, Subnet 3계층(Public/App/Data)
  - Security Group 분리(ALB/App/RDS)
- 컴퓨팅
  - ECS Fargate 서비스 3개(서비스별 Auto Scaling)
  - ECR에 이미지 저장 후 태스크 배포
- 데이터
  - RDS MySQL (Multi-AZ 권장)
  - S3 버킷 2개: `frontend`, `documents(영수증/이미지)`
- 엣지/도메인
  - Route 53 + ACM + CloudFront
  - HTTPS 종단은 CloudFront/ALB에서 처리
- 운영
  - CloudWatch(Log Group, Metrics, Alarm)
  - X-Ray(선택)로 API 추적
  - AWS Backup(RDS 스냅샷 정책)
- 보안
  - Secrets Manager에 DB/Stripe/API 키 저장
  - ECS Task Role 최소 권한 원칙(IAM)
  - S3 SSE-KMS, 버킷 퍼블릭 차단

## 5. 트래픽 흐름
1. 사용자는 CloudFront 도메인으로 접속한다.
2. 정적 리소스는 S3(Frontend)에서 직접 응답한다.
3. `/api/*`는 ALB로 라우팅된다.
4. ALB Path 기반 라우팅:
   - `/auth/*` -> `auth-service`
   - `/ledger/*` -> `ledger-service`
   - `/ocr/*` -> `ocr-ai-service`
5. OCR/문서 API는 S3 문서 버킷 저장 후 DB 메타데이터를 RDS에 기록한다.
6. Stripe Webhook은 `/auth/billing/webhook`으로 유입된다.

## 6. 배포 전략
### 6.1 현재 (As-Is)
- GitHub Actions에서 ECR Push 후 EC2 `docker compose` 재기동

### 6.2 목표 (To-Be)
- CI: GitHub Actions
  - 테스트 -> Docker Build -> ECR Push
- CD: ECS Rolling Update
  - 서비스별 무중단 배포(최소 healthy percent 적용)
- 환경 분리
  - `dev`, `staging`, `prod` 계정 또는 VPC 분리

## 7. 가용성/복구
- 현재 EC2 단일 구성 시 단일 장애점 존재
- 목표
  - RDS Multi-AZ + 자동 백업 7~35일
  - ECS 서비스 최소 task 2개(프로덕션)
  - ALB Health Check 실패 시 비정상 task 자동 교체
  - S3 버전 관리(문서 버킷) 활성화

## 8. 비용 최적화 포인트
- 초기에는 단일 NAT/단일 ALB로 시작 후 트래픽 증가 시 확장
- OCR 서비스는 CPU 사용량 기준 Auto Scaling
- CloudFront 캐시 정책으로 정적 트래픽 비용 절감
- 로그 보관 주기(예: 30일) 설정

## 9. 보안 체크리스트
- [ ] RDS 퍼블릭 접근 금지
- [ ] ALB 외 App Subnet 인바운드 차단
- [ ] ECS Task Role 최소 권한
- [ ] 민감정보 평문 `.env` 저장 금지
- [ ] WAF(선택)로 API 보호

## 10. 마이그레이션 순서
1. 현재 EC2 compose 배포 안정화(태그/롤백 체계 정리)
2. RDS/S3/VPC/ECS 인프라(Terraform 또는 CDK) 생성
3. 기존 DB 스키마 이관 및 초기 데이터 적재
4. 서비스별 ECR 이미지 배포(ECS)
5. ALB 라우팅 + 도메인 전환(Route 53)
6. CloudWatch 알람 임계치 설정
7. Stripe Webhook endpoint prod 도메인으로 변경
