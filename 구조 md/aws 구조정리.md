# AWS Ledger 프로젝트 — 확정 AWS 서비스 메모

예산: 약 5만원  
EKS 사용 ❌ (EC2 + Docker 구조)

## 사용 AWS 서비스 (확정)

1. EC2  
2. VPC  
3. API Gateway  
4. ALB (Application Load Balancer)  
5. S3  
6. RDS  
7. Textract  
8. ECR  
9. CodeCommit  
10. CodePipeline  
11. CodeBuild  
12. IAM  
13. CloudWatch  

총: **13개 AWS 서비스**

---

# 아키텍처 기본 방향

User  
↓  
API Gateway  
↓  
ALB  
↓  
EC2 (Docker)

EC2 내부
- auth-service
- ledger-service
- ocr-ai-service

↓  
RDS (DB)

↓  
S3 (영수증 이미지)

↓  
Textract (OCR)

---

# CI/CD 흐름

CodeCommit  
↓  
CodeBuild (Docker build)  
↓  
ECR (이미지 저장)  
↓  
CodePipeline (배포 자동화)  
↓  
EC2 업데이트

---

# 모니터링 / 보안

IAM  
- 서비스 권한 관리

CloudWatch  
- 로그
- 모니터링

---

# 목표

AWS 클라우드 기반  
Docker 컨테이너 MSA 구조  
CI/CD 자동 배포  
AI 서비스(Textract) 활용
SaaS 가계부 서비스 구축