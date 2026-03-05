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
      <div class="settings-card account-card">
        <h3>계정</h3>
        <p>이메일</p>
        <input id="userEmail" type="text" value="불러오는 중..." disabled />
        <p>새 이메일</p>
        <input id="newEmailInput" type="email" placeholder="변경할 이메일 입력" />
        <div class="btn-row account-actions">
          <button id="changeEmailBtn" class="btn-main">저장</button>
          <button id="changePasswordBtn" class="btn-main">비밀번호 변경</button>
        </div>
        <p class="setting-help" id="emailChangeStatus"></p>
        <p class="setting-help" id="passwordChangeStatus"></p>
        <div class="account-corner-actions">
          <button id="deleteAccountBtn" class="btn-danger corner-delete-btn">회원 탈퇴</button>
          <p class="setting-help delete-status" id="deleteAccountStatus"></p>
        </div>
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
      </div>
    </div>
    <div id="settingsModalRoot"></div>
  </div>
  `;
}

export async function afterRenderSettings() {
  const emailInput = document.getElementById("userEmail");
  const changePasswordBtn = document.getElementById("changePasswordBtn");
  const settingsModalRoot = document.getElementById("settingsModalRoot");
  const changeEmailBtn = document.getElementById("changeEmailBtn");
  const newEmailInput = document.getElementById("newEmailInput");
  const emailChangeStatus = document.getElementById("emailChangeStatus");
  const passwordChangeStatus = document.getElementById("passwordChangeStatus");
  const deleteAccountBtn = document.getElementById("deleteAccountBtn");
  const deleteAccountStatus = document.getElementById("deleteAccountStatus");

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

  const setInlineStatus = (el, message, isError = false) => {
    el.textContent = message;
    el.classList.toggle("error", isError);
    el.classList.toggle("success", !isError && message.length > 0);
  };

  const closeModal = () => {
    settingsModalRoot.innerHTML = "";
    document.removeEventListener("keydown", handleEscClose);
  };

  const handleEscClose = (e) => {
    if (e.key === "Escape") closeModal();
  };

  const openPasswordChangeModal = () => {
    settingsModalRoot.innerHTML = `
      <div class="modal-overlay" id="passwordModalOverlay">
        <div class="modal">
          <div class="modal-header">
            <h3>비밀번호 변경</h3>
            <button id="closePasswordModalBtn" class="close-btn">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label for="pwCurrentInputModal">현재 비밀번호</label>
              <input id="pwCurrentInputModal" type="password" placeholder="현재 비밀번호" />
            </div>
            <div class="form-group">
              <label for="pwNewInputModal">새 비밀번호</label>
              <input id="pwNewInputModal" type="password" placeholder="새 비밀번호" />
            </div>
            <div class="form-group">
              <label for="pwConfirmInputModal">새 비밀번호 확인</label>
              <input id="pwConfirmInputModal" type="password" placeholder="새 비밀번호 확인" />
            </div>
            <p id="passwordModalStatus" class="setting-help"></p>
          </div>
          <div class="modal-footer">
            <button id="cancelPasswordModalBtn" class="btn-sub">취소</button>
            <button id="submitPasswordModalBtn" class="btn-main">변경하기</button>
          </div>
        </div>
      </div>
    `;

    document.addEventListener("keydown", handleEscClose);

    const overlay = document.getElementById("passwordModalOverlay");
    const closeBtn = document.getElementById("closePasswordModalBtn");
    const cancelBtn = document.getElementById("cancelPasswordModalBtn");
    const submitBtn = document.getElementById("submitPasswordModalBtn");
    const currentInput = document.getElementById("pwCurrentInputModal");
    const newInput = document.getElementById("pwNewInputModal");
    const confirmInput = document.getElementById("pwConfirmInputModal");
    const modalStatus = document.getElementById("passwordModalStatus");

    closeBtn.addEventListener("click", closeModal);
    cancelBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });

    submitBtn.addEventListener("click", async () => {
      const currentPassword = currentInput.value;
      const newPassword = newInput.value;
      const newPasswordConfirm = confirmInput.value;

      if (!currentPassword || !newPassword || !newPasswordConfirm) {
        setInlineStatus(modalStatus, "모든 비밀번호 입력값을 채워 주세요.", true);
        return;
      }

      if (newPassword !== newPasswordConfirm) {
        setInlineStatus(modalStatus, "새 비밀번호 확인이 일치하지 않습니다.", true);
        return;
      }

      submitBtn.disabled = true;
      setInlineStatus(modalStatus, "비밀번호 변경 중...");

      try {
        await apiRequest(AUTH_BASE, "/me/password", {
          method: "PUT",
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
          }),
        });

        setInlineStatus(passwordChangeStatus, "비밀번호가 변경되었습니다. 다시 로그인합니다.");
        localStorage.removeItem("access_token");
        closeModal();
        setTimeout(() => {
          window.location.href = "login.html";
        }, 700);
      } catch (e) {
        setInlineStatus(modalStatus, e?.message || "비밀번호 변경에 실패했습니다.", true);
        submitBtn.disabled = false;
      }
    });
  };

  const openDeleteAccountModal = () => {
    settingsModalRoot.innerHTML = `
      <div class="modal-overlay" id="deleteAccountModalOverlay">
        <div class="modal">
          <div class="modal-header">
            <h3>회원 탈퇴</h3>
            <button id="closeDeleteModalBtn" class="close-btn">×</button>
          </div>
          <div class="modal-body">
            <p class="setting-help" style="margin:0;">
              탈퇴하면 계정을 복구할 수 없습니다. 진행하려면 현재 비밀번호를 입력해 주세요.
            </p>
            <div class="form-group">
              <label for="deleteCurrentPwInputModal">현재 비밀번호</label>
              <input id="deleteCurrentPwInputModal" type="password" placeholder="현재 비밀번호" />
            </div>
            <p id="deleteModalStatus" class="setting-help"></p>
          </div>
          <div class="modal-footer">
            <button id="cancelDeleteModalBtn" class="btn-sub">취소</button>
            <button id="submitDeleteModalBtn" class="btn-danger">탈퇴하기</button>
          </div>
        </div>
      </div>
    `;

    document.addEventListener("keydown", handleEscClose);

    const overlay = document.getElementById("deleteAccountModalOverlay");
    const closeBtn = document.getElementById("closeDeleteModalBtn");
    const cancelBtn = document.getElementById("cancelDeleteModalBtn");
    const submitBtn = document.getElementById("submitDeleteModalBtn");
    const currentPwInput = document.getElementById("deleteCurrentPwInputModal");
    const modalStatus = document.getElementById("deleteModalStatus");

    closeBtn.addEventListener("click", closeModal);
    cancelBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });

    submitBtn.addEventListener("click", async () => {
      const currentPassword = currentPwInput.value;
      if (!currentPassword) {
        setInlineStatus(modalStatus, "현재 비밀번호를 입력해 주세요.", true);
        return;
      }

      if (!confirm("정말 회원 탈퇴를 진행하시겠습니까?")) {
        return;
      }

      submitBtn.disabled = true;
      setInlineStatus(modalStatus, "회원 탈퇴 처리 중...");

      try {
        await apiRequest(AUTH_BASE, "/me", {
          method: "DELETE",
          body: JSON.stringify({
            current_password: currentPassword,
          }),
        });

        localStorage.removeItem("access_token");
        window.location.href = "index.html";
      } catch (e) {
        setInlineStatus(modalStatus, e?.message || "회원 탈퇴에 실패했습니다.", true);
        setInlineStatus(deleteAccountStatus, e?.message || "회원 탈퇴에 실패했습니다.", true);
        submitBtn.disabled = false;
      }
    });
  };

  changeEmailBtn.addEventListener("click", async () => {
    const newEmail = newEmailInput.value.trim();

    if (!newEmail) {
      setInlineStatus(emailChangeStatus, "새 이메일을 입력해 주세요.", true);
      return;
    }

    changeEmailBtn.disabled = true;
    setInlineStatus(emailChangeStatus, "저장 중...");

    try {
      const res = await apiRequest(AUTH_BASE, "/me/email", {
        method: "PUT",
        body: JSON.stringify({
          new_email: newEmail,
        }),
      });

      emailInput.value = res?.email || newEmail;
      newEmailInput.value = "";
      setInlineStatus(emailChangeStatus, "저장되었습니다.");
    } catch (e) {
      setInlineStatus(emailChangeStatus, e?.message || "저장에 실패했습니다.", true);
    } finally {
      changeEmailBtn.disabled = false;
    }
  });

  changePasswordBtn.addEventListener("click", openPasswordChangeModal);

  deleteAccountBtn.addEventListener("click", openDeleteAccountModal);

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
