import { apiRequest, AUTH_BASE, LEDGER_BASE } from "../api.js";

const FREE_OCR_LIMIT = 50;

function formatKstDate(isoString) {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export async function renderSubscription() {
  return `
    <section class="page subscription-page">
      <h2 class="sub-title">구독 관리</h2>
      <p id="billingResult" class="billing-result"></p>

      <div class="subscription-grid">
        <div class="plan-card main-card">
          <div class="plan-top">
            <div>
              <h3 id="planTitle">PRO 플랜</h3>
              <p class="plan-status">
                <span class="status-dot"></span>
                <span id="subscriptionStatus">확인 중...</span>
              </p>
            </div>
            <div class="price" id="planPrice">₩4,900 / 월</div>
          </div>

          <ul class="plan-features">
            <li>월 OCR 50회</li>
            <li>AI 자동 분류</li>
            <li>고급 통계 분석</li>
          </ul>

          <div class="plan-actions" id="planActions"></div>
        </div>

        <div class="plan-card side-card">
          <h4>이번 달 OCR 사용량</h4>
          <div class="usage-number" id="usageNumber">불러오는 중...</div>
          <div class="usage-bar">
            <div class="usage-fill" id="usageFill"></div>
          </div>
          <div class="usage-percent" id="usagePercent"></div>
        </div>

        <div class="plan-card side-card">
          <h4>다음 결제일</h4>
          <div class="next-billing" id="nextBilling">-</div>
          <div class="billing-desc">자동 결제로 월 4,900원이 청구됩니다.</div>
        </div>
      </div>
    </section>
  `;
}

export async function afterRenderSubscription() {
  const statusEl = document.getElementById("subscriptionStatus");
  const actionsEl = document.getElementById("planActions");
  const usageNumber = document.getElementById("usageNumber");
  const usageFill = document.getElementById("usageFill");
  const usagePercent = document.getElementById("usagePercent");
  const nextBilling = document.getElementById("nextBilling");
  const billingResult = document.getElementById("billingResult");

  const billingState = new URLSearchParams(window.location.search).get("billing");

  if (billingState === "success") {
    try {
      await apiRequest(AUTH_BASE, "/billing/sync-subscription", { method: "POST" });
    } catch {
      // 웹훅 지연 시에도 최대한 동기화를 시도하고, 실패해도 화면 렌더는 진행
    }
  }

  let [user, usage] = await Promise.all([
    apiRequest(AUTH_BASE, "/me"),
    apiRequest(LEDGER_BASE, "/ocr/usage"),
  ]);

  let isPro = user.plan === "PRO";

  if (isPro && !user.next_billing_at) {
    try {
      await apiRequest(AUTH_BASE, "/billing/sync-subscription", { method: "POST" });
      user = await apiRequest(AUTH_BASE, "/me");
      isPro = user.plan === "PRO";
    } catch {
      // 동기화 실패 시 기존 데이터로 렌더
    }
  }

  if (isPro) {
    statusEl.textContent = "활성 상태 (PRO)";
    actionsEl.innerHTML = `
      <button class="secondary-btn" disabled>결제 정보 관리</button>
      <button id="cancelSubscriptionBtn" class="danger-btn">구독 취소</button>
    `;

    document.getElementById("cancelSubscriptionBtn").onclick = async () => {
      if (!confirm("구독을 취소하시겠습니까?")) return;

      const cancelBtn = document.getElementById("cancelSubscriptionBtn");
      cancelBtn.disabled = true;
      cancelBtn.textContent = "취소 처리 중...";

      try {
        await apiRequest(AUTH_BASE, "/billing/cancel-subscription", {
          method: "POST",
        });
        window.location.href = `${window.location.pathname}?billing=unsubscribed#/subscription`;
      } catch {
        alert("구독 취소에 실패했습니다. 다시 시도해 주세요.");
        cancelBtn.disabled = false;
        cancelBtn.textContent = "구독 취소";
      }
    };
  } else {
    statusEl.textContent = "FREE 플랜 이용 중";
    actionsEl.innerHTML = `
      <button id="upgradeBtn" class="primary-btn">PRO로 업그레이드</button>
    `;

    document.getElementById("upgradeBtn").onclick = async () => {
      const upgradeBtn = document.getElementById("upgradeBtn");
      upgradeBtn.disabled = true;
      upgradeBtn.textContent = "결제 페이지로 이동 중...";

      try {
        const res = await apiRequest(
          AUTH_BASE,
          "/billing/create-checkout-session",
          { method: "POST" },
        );

        if (!res?.checkout_url) {
          throw new Error("checkout_url not found");
        }

        window.location.href = res.checkout_url;
      } catch {
        alert("결제 연결에 실패했습니다. 다시 시도해 주세요.");
        upgradeBtn.disabled = false;
        upgradeBtn.textContent = "PRO로 업그레이드";
      }
    };
  }

  if (isPro) {
    usageNumber.textContent = "무제한 사용";
    usageFill.style.width = "100%";
    usagePercent.textContent = "Unlimited";
  } else {
    const used = usage.used_count ?? 0;
    const percent = Math.min((used / FREE_OCR_LIMIT) * 100, 100);

    usageNumber.textContent = `${used} / ${FREE_OCR_LIMIT}`;
    usageFill.style.width = `${percent}%`;
    usagePercent.textContent = `${Math.floor(percent)}% 사용 중`;
  }

  if (isPro) {
    nextBilling.textContent = user.next_billing_at
      ? formatKstDate(user.next_billing_at)
      : "결제일 정보 동기화 중";
  } else {
    nextBilling.textContent = "FREE 플랜은 결제 없음";
  }

  if (billingState && billingResult) {
    if (billingState === "success") {
      billingResult.textContent = "결제가 완료되었습니다. 플랜 상태를 확인해 주세요.";
      billingResult.classList.add("success");
    } else if (billingState === "cancel") {
      billingResult.textContent = "결제가 취소되었습니다.";
      billingResult.classList.add("cancel");
    } else if (billingState === "unsubscribed") {
      billingResult.textContent = "구독이 취소되었습니다. 다음 결제부터 청구되지 않습니다.";
      billingResult.classList.add("cancel");
    }

    history.replaceState({}, "", `${window.location.pathname}#/subscription`);
  }
}
