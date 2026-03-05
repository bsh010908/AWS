import { apiRequest, AUTH_BASE, LEDGER_BASE } from "../api.js";

export async function renderSettings() {
  return `
  <div class="settings-page">
    <h2 class="page-title">설정</h2>

    <div class="settings-grid">
      <div class="settings-card">
        <h3>계정</h3>
        <p>이메일</p>
        <input id="userEmail" type="text" value="불러오는 중..." disabled />
        <p>비밀번호 변경</p>
        <button id="changePasswordBtn" class="btn-main">비밀번호 변경</button>
      </div>

      <div class="settings-card">
        <h3>구독</h3>
        <p>현재 플랜</p>
        <strong id="planInfo">확인 중...</strong>
        <button id="goSubscriptionBtn" class="btn-main">구독 관리</button>
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
      body: JSON.stringify({
        year,
        month,
        amount,
      }),
    });
    statusEl.textContent = `${year}년 ${month}월 예산을 저장했습니다.`;
    statusEl.classList.add("success");
  } catch (e) {
    statusEl.textContent = e?.message || "예산 저장에 실패했습니다.";
    statusEl.classList.add("error");
  }
}

export async function afterRenderSettings() {
  const emailInput = document.getElementById("userEmail");
  const planInfo = document.getElementById("planInfo");
  const goSubscriptionBtn = document.getElementById("goSubscriptionBtn");
  const changePasswordBtn = document.getElementById("changePasswordBtn");

  const yearSelect = document.getElementById("budgetYear");
  const monthSelect = document.getElementById("budgetMonth");
  const amountInput = document.getElementById("budgetAmountInput");
  const loadBtn = document.getElementById("budgetLoadBtn");
  const saveBtn = document.getElementById("budgetSaveBtn");
  const statusEl = document.getElementById("budgetStatus");

  try {
    const user = await apiRequest(AUTH_BASE, "/me");
    emailInput.value = user.email || "-";
    planInfo.textContent = user.plan || "FREE";
  } catch {
    emailInput.value = "-";
    planInfo.textContent = "확인 실패";
  }

  goSubscriptionBtn.addEventListener("click", () => {
    window.location.hash = "/subscription";
  });

  changePasswordBtn.addEventListener("click", () => {
    alert("비밀번호 변경 기능은 준비중입니다.");
  });

  initYearMonthOptions(yearSelect, monthSelect);

  const getSelectedYearMonth = () => ({
    year: Number(yearSelect.value),
    month: Number(monthSelect.value),
  });

  const refreshCurrentBudget = async () => {
    const { year, month } = getSelectedYearMonth();
    await loadBudget(year, month, amountInput, statusEl);
  };

  await refreshCurrentBudget();

  yearSelect.addEventListener("change", refreshCurrentBudget);
  monthSelect.addEventListener("change", refreshCurrentBudget);
  loadBtn.addEventListener("click", refreshCurrentBudget);

  saveBtn.addEventListener("click", async () => {
    const { year, month } = getSelectedYearMonth();
    const amount = Number(amountInput.value);

    if (!Number.isFinite(amount) || amount < 0) {
      statusEl.textContent = "예산은 0 이상의 숫자로 입력해 주세요.";
      statusEl.classList.remove("success");
      statusEl.classList.add("error");
      return;
    }

    await saveBudget(year, month, Math.floor(amount), statusEl);
  });
}
