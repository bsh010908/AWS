import { apiRequest, AUTH_BASE, LEDGER_BASE } from "../api.js";

export async function renderSubscription() {
  return `
    <section class="page subscription-page">

      <h2 class="sub-title">💎 구독 관리</h2>

      <div class="subscription-grid">

        <!-- PRO 플랜 카드 -->
        <div class="plan-card main-card">
          <div class="plan-top">
            <div>
              <h3 id="planTitle">👑 PRO 플랜</h3>
              <p class="plan-status">
                <span class="status-dot"></span>
                <span id="subscriptionStatus">확인 중...</span>
              </p>
            </div>
            <div class="price" id="planPrice">₩4,900 / 월</div>
          </div>

          <ul class="plan-features">
            <li>✔ 월 OCR 100회</li>
            <li>✔ AI 자동 분류</li>
            <li>✔ 고급 통계 분석</li>
          </ul>

          <div class="plan-actions" id="planActions">
            <!-- 버튼 동적 삽입 -->
          </div>
        </div>

        <!-- 사용량 카드 -->
        <div class="plan-card side-card">
          <h4>📊 이번 달 OCR 사용량</h4>

          <div class="usage-number" id="usageNumber">
            불러오는 중...
          </div>

          <div class="usage-bar">
            <div class="usage-fill" id="usageFill"></div>
          </div>

          <div class="usage-percent" id="usagePercent"></div>
        </div>

        <!-- 다음 결제 카드 -->
        <div class="plan-card side-card">
          <h4>📅 다음 결제일</h4>
          <div class="next-billing" id="nextBilling">
            -
          </div>
          <div class="billing-desc">
            자동 결제로 ₩4,900이 청구됩니다.
          </div>
        </div>

      </div>

    </section>
  `;
}

export async function afterRenderSubscription() {

  // 1️⃣ 사용자 정보
  const user = await apiRequest(AUTH_BASE, "/me");

  // 2️⃣ OCR 사용량 (ledger-service)
  const usage = await apiRequest(LEDGER_BASE, "/ocr/usage");

  const statusEl = document.getElementById("subscriptionStatus");
  const actionsEl = document.getElementById("planActions");
  const usageNumber = document.getElementById("usageNumber");
  const usageFill = document.getElementById("usageFill");
  const usagePercent = document.getElementById("usagePercent");
  const nextBilling = document.getElementById("nextBilling");

  const isPro = user.plan === "PRO";

  /* =========================
     플랜 상태 표시
  ========================= */

  if (isPro) {
    statusEl.textContent = "✅ 활성 상태 (PRO)";
    actionsEl.innerHTML = `
      <button class="secondary-btn">결제 정보 관리</button>
      <button class="danger-btn">구독 취소</button>
    `;
  } else {
    statusEl.textContent = "🟡 FREE 플랜 이용 중";
    actionsEl.innerHTML = `
      <button id="upgradeBtn" class="primary-btn">
        PRO로 업그레이드
      </button>
    `;

    document.getElementById("upgradeBtn").onclick = async () => {
      const res = await apiRequest(
        AUTH_BASE,
        "/billing/create-checkout-session",
        { method: "POST" }
      );

      window.location.href = res.checkout_url;
    };
  }

  /* =========================
     OCR 사용량 표시
  ========================= */

  if (isPro) {
    usageNumber.textContent = "무제한 사용 중";
    usageFill.style.width = "100%";
    usagePercent.textContent = "Unlimited";
  } else {
    const used = usage.used_count ?? 0;
    const limit = 10;
    const percent = Math.min((used / limit) * 100, 100);

    usageNumber.textContent = `${used} / ${limit}`;
    usageFill.style.width = `${percent}%`;
    usagePercent.textContent = `${Math.floor(percent)}% 사용 중`;
  }

  /* =========================
     다음 결제일 (임시)
  ========================= */

  if (isPro) {
    // 실제 Stripe subscription 데이터 있으면 교체 가능
    nextBilling.textContent = "다음 달 자동 결제 예정";
  } else {
    nextBilling.textContent = "FREE 플랜은 결제 없음";
  }
}