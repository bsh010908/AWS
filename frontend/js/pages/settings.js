import { apiRequest, AUTH_BASE, LEDGER_BASE } from "../api.js";

const FREE_OCR_LIMIT = 50;

function formatKstDate(isoString) {
  if (!isoString) return "-";
  const normalized = typeof isoString === "string" && isoString.includes("T")
    ? isoString
    : String(isoString).replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function parseDateSafe(value) {
  if (!value) return null;
  const normalized = typeof value === "string" && value.includes("T")
    ? value
    : String(value).replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isPastDate(value) {
  const date = parseDateSafe(value);
  if (!date) return false;
  return date.getTime() < Date.now();
}

function plusOneMonth(value) {
  const date = parseDateSafe(value);
  if (!date) return null;
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

function pickNextBillingAt(user, syncResult) {
  return (
    syncResult?.next_billing_at ??
    user?.next_billing_at ??
    user?.nextBillingAt ??
    null
  );
}

function initYearMonthOptions(yearSelect, monthSelect) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  yearSelect.innerHTML = "";
  monthSelect.innerHTML = "";

  for (let y = currentYear - 2; y <= currentYear + 2; y += 1) {
    const option = document.createElement("option");
    option.value = String(y);
    option.textContent = `${y}년`;
    if (y === currentYear) option.selected = true;
    yearSelect.appendChild(option);
  }

  for (let m = 1; m <= 12; m += 1) {
    const option = document.createElement("option");
    option.value = String(m);
    option.textContent = `${m}월`;
    if (m === currentMonth) option.selected = true;
    monthSelect.appendChild(option);
  }
}

async function loadBudget(year, month, amountInput, statusEl) {
  statusEl.textContent = "예산 조회 중...";
  statusEl.classList.remove("error", "success");

  try {
    const data = await apiRequest(
      LEDGER_BASE,
      `/budget?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`,
    );

    amountInput.value = Number(data.amount ?? 0);
    statusEl.textContent = `${year}년 ${month}월 예산을 불러왔습니다.`;
    statusEl.classList.add("success");
  } catch (e) {
    statusEl.textContent = e?.message || "예산 조회에 실패했습니다.";
    statusEl.classList.add("error");
  }
}

async function saveBudget(year, month, amount, statusEl) {
  statusEl.textContent = "예산 저장 중...";
  statusEl.classList.remove("error", "success");

  try {
    await apiRequest(LEDGER_BASE, "/budget", {
      method: "POST",
      body: JSON.stringify({ year, month, amount }),
    });
    statusEl.textContent = `${year}년 ${month}월 예산을 저장했습니다.`;
    statusEl.classList.add("success");
  } catch (e) {
    statusEl.textContent = e?.message || "예산 저장에 실패했습니다.";
    statusEl.classList.add("error");
  }
}

export async function renderSettings() {
  return `
  <div class="settings-page">
    <h2 class="page-title">설정</h2>

    <section class="settings-subscription">
      <h3 class="setting-section-title">구독 관리</h3>
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
            <li>FREE: 월 OCR 50회</li>
            <li>PRO: OCR 사용량 무제한</li>
            <li>Stripe 자동 결제/구독 취소</li>
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

    <div class="settings-grid">
      <div class="settings-card">
        <h3>계정</h3>
        <p>이메일</p>
        <input id="userEmail" type="text" value="불러오는 중..." disabled />
        <p>비밀번호 변경</p>
        <button id="changePasswordBtn" class="btn-main">비밀번호 변경</button>
      </div>

      <div class="settings-card">
        <h3>월 예산</h3>
        <p class="setting-help">월별 예산을 설정하면 대시보드 예산/잔액 계산에 반영됩니다.</p>

        <div class="budget-controls">
          <select id="budgetYear"></select>
          <select id="budgetMonth"></select>
        </div>

        <p>예산 금액 (원)</p>
        <input id="budgetAmountInput" type="number" min="0" step="1000" placeholder="예: 500000" />

        <div class="btn-row">
          <button id="budgetLoadBtn" class="btn-sub">불러오기</button>
          <button id="budgetSaveBtn" class="btn-main">저장</button>
        </div>

        <p id="budgetStatus" class="setting-status"></p>
      </div>

      <div class="settings-card">
        <h3>데이터</h3>
        <button class="btn-sub" disabled>CSV 다운로드 (준비중)</button>
        <button class="btn-danger" disabled>모든 거래 삭제 (준비중)</button>
      </div>
    </div>
  </div>
  `;
}

export async function afterRenderSettings() {
  const emailInput = document.getElementById("userEmail");
  const changePasswordBtn = document.getElementById("changePasswordBtn");

  const statusEl = document.getElementById("subscriptionStatus");
  const actionsEl = document.getElementById("planActions");
  const usageNumber = document.getElementById("usageNumber");
  const usageFill = document.getElementById("usageFill");
  const usagePercent = document.getElementById("usagePercent");
  const nextBilling = document.getElementById("nextBilling");
  const billingResult = document.getElementById("billingResult");

  const yearSelect = document.getElementById("budgetYear");
  const monthSelect = document.getElementById("budgetMonth");
  const amountInput = document.getElementById("budgetAmountInput");
  const loadBtn = document.getElementById("budgetLoadBtn");
  const saveBtn = document.getElementById("budgetSaveBtn");
  const budgetStatusEl = document.getElementById("budgetStatus");

  const query = new URLSearchParams(window.location.search);
  const billingState = query.get("billing");
  const sessionId = query.get("session_id");

  let syncResult = null;

  if (billingState === "success") {
    try {
      const syncEndpoint = sessionId
        ? `/billing/sync-subscription?session_id=${encodeURIComponent(sessionId)}`
        : "/billing/sync-subscription";
      syncResult = await apiRequest(AUTH_BASE, syncEndpoint, { method: "POST" });
    } catch {
      // 동기화 실패해도 다음 조회 단계로 진행
    }
  }

  let user = null;
  let usage = { used_count: 0 };

  try {
    [user, usage] = await Promise.all([
      apiRequest(AUTH_BASE, "/me"),
      apiRequest(LEDGER_BASE, "/ocr/usage"),
    ]);
  } catch {
    // apiRequest 내부에서 401 처리를 하므로, 여기서는 렌더만 방어
  }

  if (user) {
    emailInput.value = user.email || "-";
  } else {
    emailInput.value = "-";
  }

  changePasswordBtn.addEventListener("click", () => {
    alert("비밀번호 변경 기능은 준비중입니다.");
  });

  let isPro = user?.plan === "PRO";
  let nextBillingAt = pickNextBillingAt(user, syncResult);

  if (isPro && (!nextBillingAt || isPastDate(nextBillingAt))) {
    try {
      syncResult = await apiRequest(AUTH_BASE, "/billing/sync-subscription", { method: "POST" });
      user = await apiRequest(AUTH_BASE, "/me");
      isPro = user.plan === "PRO";
      nextBillingAt = pickNextBillingAt(user, syncResult);
    } catch {
      // 동기화 실패 시 기존값으로 렌더
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
        await apiRequest(AUTH_BASE, "/billing/cancel-subscription", { method: "POST" });
        window.location.href = `${window.location.pathname}?billing=unsubscribed#/settings`;
      } catch {
        alert("구독 취소에 실패했습니다. 다시 시도해 주세요.");
        cancelBtn.disabled = false;
        cancelBtn.textContent = "구독 취소";
      }
    };
  } else {
    statusEl.textContent = "FREE 플랜 이용 중";
    actionsEl.innerHTML = `<button id="upgradeBtn" class="primary-btn">PRO로 업그레이드</button>`;

    document.getElementById("upgradeBtn").onclick = async () => {
      const upgradeBtn = document.getElementById("upgradeBtn");
      upgradeBtn.disabled = true;
      upgradeBtn.textContent = "결제 페이지로 이동 중...";

      try {
        const res = await apiRequest(AUTH_BASE, "/billing/create-checkout-session", {
          method: "POST",
        });

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
    const used = usage?.used_count ?? 0;
    const percent = Math.min((used / FREE_OCR_LIMIT) * 100, 100);
    usageNumber.textContent = `${used} / ${FREE_OCR_LIMIT}`;
    usageFill.style.width = `${percent}%`;
    usagePercent.textContent = `${Math.floor(percent)}% 사용 중`;
  }

  if (nextBillingAt) {
    let displayValue = nextBillingAt;
    if (isPro && isPastDate(nextBillingAt)) {
      const expectedNext = plusOneMonth(nextBillingAt);
      if (expectedNext) {
        displayValue = expectedNext.toISOString();
      }
    }
    const formatted = formatKstDate(displayValue);
    nextBilling.textContent = formatted === "-" ? String(displayValue) : formatted;
  } else if (isPro) {
    nextBilling.textContent = "결제일 정보 동기화 중";
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

    history.replaceState({}, "", `${window.location.pathname}#/settings`);
  }

  initYearMonthOptions(yearSelect, monthSelect);

  const getSelectedYearMonth = () => ({
    year: Number(yearSelect.value),
    month: Number(monthSelect.value),
  });

  const refreshCurrentBudget = async () => {
    const { year, month } = getSelectedYearMonth();
    await loadBudget(year, month, amountInput, budgetStatusEl);
  };

  await refreshCurrentBudget();

  yearSelect.addEventListener("change", refreshCurrentBudget);
  monthSelect.addEventListener("change", refreshCurrentBudget);
  loadBtn.addEventListener("click", refreshCurrentBudget);

  saveBtn.addEventListener("click", async () => {
    const { year, month } = getSelectedYearMonth();
    const amount = Number(amountInput.value);
    if (!Number.isFinite(amount) || amount < 0) {
      budgetStatusEl.textContent = "예산은 0 이상의 숫자로 입력해 주세요.";
      budgetStatusEl.classList.remove("success");
      budgetStatusEl.classList.add("error");
      return;
    }

    await saveBudget(year, month, Math.floor(amount), budgetStatusEl);
  });
}
