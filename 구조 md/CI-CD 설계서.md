# CI/CD 설계서

## 1. 목적
- GitHub `main` 브랜치 push 시 자동 배포를 수행한다.
- 현재 운영 방식(ECR + EC2 docker compose)을 기준으로 배포 절차를 표준화한다.
- 향후 ECS 기반으로 확장 가능한 형태로 문서화한다.

## 2. 현재 파이프라인 기준
기준 파일: `.github/workflows/deploy.yml`

- Workflow 이름: `Deploy AWS Ledger`
- 트리거: `push` on `main`
- Runner: `ubuntu-latest`
- 배포 리전: `ap-northeast-2`
- 배포 대상: EC2 (`appleboy/ssh-action` 사용)

## 3. 현재 CD 절차 (As-Is)
1. 저장소 체크아웃 (`actions/checkout@v3`)
2. AWS 자격증명 설정 (`aws-actions/configure-aws-credentials@v2`)
   - `AWS_ACCESS_KEY`, `AWS_SECRET_KEY` 사용
3. ECR 로그인
4. Docker 이미지 빌드
   - `docker build -t ledger-service .`
5. ECR 업로드
   - `ledger-service:latest` 태그 푸시
6. EC2 원격 접속 후 배포
   - `cd /home/ec2-user/project`
   - `docker compose pull`
   - `docker compose up -d`

## 4. GitHub Secrets
- `AWS_ACCESS_KEY`
- `AWS_SECRET_KEY`
- `EC2_HOST`
- `EC2_SSH_KEY`

추가 권장
- `ECR_REGISTRY` (현재 `YOUR_ECR_URL` 하드코딩 대체)

## 5. 현재 방식의 장단점
장점
- 구현이 단순하고 빠르게 운영 반영 가능
- 기존 docker compose 운영 방식과 동일

한계
- 현재 워크플로는 `ledger-service`만 빌드/푸시
- `latest` 단일 태그 사용으로 롤백 추적성이 약함
- 테스트/lint/security scan 단계 부재
- EC2 상태 의존도가 높아 배포 일관성 저하 가능

## 6. 개선 권장안 (To-Be)
### 6.1 단기 개선
- 이미지 태그를 `git sha`로 병행
  - `ledger-service:${GITHUB_SHA}` + `latest`
- 배포 전 CI 단계 추가
  - lint, pytest, docker build 검증
- `YOUR_ECR_URL`를 Secret/Env로 치환

### 6.2 중기 개선
- 서비스별 분리 배포
  - `auth-service`, `ledger-service`, `ocr-ai-service`
- 경로 기반 변경 감지(`paths-filter`) 도입

### 6.3 장기 개선
- ECS Fargate 기반 무중단 배포 전환
- Blue/Green 또는 canary 전략 도입

## 7. 롤백 정책
- EC2에서 이전 안정 태그로 이미지 재기동
- 운영 표준
  - `latest` 의존 최소화
  - 릴리즈 태그(sha/버전) 보존

## 8. 운영 체크리스트
- [ ] `YOUR_ECR_URL`를 실제 ECR 주소로 교체
- [ ] 빌드 컨텍스트가 `ledger-service`에 맞는지 확인 (`.` 경로 검증)
- [ ] CI 테스트 단계 추가
- [ ] 태그 전략(`latest` + `sha`) 적용
- [ ] 실패 시 롤백 명령 문서화
