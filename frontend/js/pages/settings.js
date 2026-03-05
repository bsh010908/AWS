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

function toKoreanErrorMessage(error, fallback = "요청 처리에 실패했습니다.") {
  const raw = String(error?.message || "").trim();
  if (!raw) return fallback;

  const map = {
    "API Error": "요청 처리 중 오류가 발생했습니다.",
    "Failed to fetch": "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    "NetworkError when attempting to fetch resource.": "네트워크 오류가 발생했습니다.",
    "User not found": "사용자 정보를 찾을 수 없습니다.",
    "checkout_url not found": "결제 링크를 생성하지 못했습니다.",
    "CSV 다운로드 실패": "CSV 다운로드에 실패했습니다.",
    "Token validation failed": "로그인이 만료되었습니다. 다시 로그인해 주세요.",
    "Invalid token": "로그인이 만료되었습니다. 다시 로그인해 주세요.",
  };

  if (map[raw]) return map[raw];
  return raw;
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
    statusEl.textContent = toKoreanErrorMessage(e, "예산 조회에 실패했습니다.");
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
    statusEl.textContent = toKoreanErrorMessage(e, "예산 저장에 실패했습니다.");
    statusEl.classList.add("error");
  }
}

async function fetchCategories() {
  return apiRequest(LEDGER_BASE, "/categories");
}

function renderCategoryItems(categories, currentUserId, editingCategoryId) {
  if (!categories || categories.length === 0) {
    return `<div class="category-empty">카테고리가 없습니다.</div>`;
  }

  return categories
    .map((c) => {
      const isMine = Number(c.user_id) === Number(currentUserId);
      const isDefault = c.user_id == null;
      const isEditing = isMine && Number(editingCategoryId) === Number(c.category_id);

      return `
        <div class="category-item" data-id="${c.category_id}" data-name="${c.name}">
          <div class="category-meta">
            ${
              isEditing
                ? `<input class="category-inline-input" value="${c.name}" />`
                : `<span class="category-name">${c.name}</span>`
            }
            <span class="category-badge ${isDefault ? "default" : "custom"}">
              ${isDefault ? "기본" : "내 카테고리"}
            </span>
          </div>
          <div class="category-actions">
            ${
              isEditing
                ? `
                  <button class="btn-main category-save-btn">저장</button>
                  <button class="btn-sub category-cancel-btn">취소</button>
                `
                : `
                  <button class="btn-sub category-edit-btn" ${isMine ? "" : "disabled"}>수정</button>
                  <button class="btn-danger category-delete-btn" ${isMine ? "" : "disabled"}>삭제</button>
                `
            }
          </div>
        </div>
      `;
    })
    .join("");
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
          <div class="subscription-section current-status-box">
            <div class="subscription-section-title">현재 상태</div>
            <div class="plan-top">
              <div>
                <h3 id="planTitle">현재 이용 플랜</h3>
                <div class="current-plan-row">
                  <span id="currentPlanBadge" class="current-plan-badge">확인 중...</span>
                  <span id="currentPlanHint" class="current-plan-hint"></span>
                </div>
                <p class="plan-status">
                  <span class="status-dot"></span>
                  <span id="subscriptionStatus">확인 중...</span>
                </p>
              </div>
            </div>
          </div>

          <div class="subscription-section upgrade-info-box">
            <div class="subscription-section-title">업그레이드 정보</div>
            <div class="price" id="planPrice">₩4,900 / 월</div>
            <ul class="plan-features">
              <li>FREE: 월 OCR 50회</li>
              <li>PRO: OCR 사용량 무제한</li>
              <li>Stripe 자동 결제/구독 취소</li>
            </ul>

            <div class="plan-actions" id="planActions"></div>
          </div>
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
        <p class="account-meta-line">가입일: <b id="accountCreatedAt">확인 중...</b></p>
        <p>새 이메일</p>
        <input id="newEmailInput" type="email" placeholder="변경할 이메일 입력" />
        <p class="setting-help" id="emailChangeStatus"></p>
        <p class="setting-help" id="passwordChangeStatus"></p>
        <p class="setting-help delete-status" id="deleteAccountStatus"></p>
        <div class="btn-row account-actions">
          <button id="deleteAccountBtn" class="btn-danger">회원 탈퇴</button>
          <div class="account-actions-right">
            <button id="changeEmailBtn" class="btn-main">저장</button>
            <button id="changePasswordBtn" class="btn-main">비밀번호 변경</button>
          </div>
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
        <h3>카테고리 관리</h3>
        <div class="category-create-row">
          <input id="newCategoryNameInput" type="text" placeholder="새 카테고리 이름" />
          <button id="addCategoryBtn" class="btn-main">추가</button>
        </div>
        <p id="categoryStatus" class="setting-help"></p>
        <div id="categoryList" class="category-list"></div>
      </div>

      <div class="settings-card data-card">
        <h3>데이터</h3>
        <p class="data-card-desc">CSV 파일로 거래 데이터를 다운로드할 수 있습니다.</p>
        <div class="data-info-list">
          <div class="data-info-item">내보내기 기준: <b id="exportTargetMonth">-</b></div>
          <div class="data-info-item">이번 달 거래 건수: <b id="exportTxCount">확인 중...</b></div>
          <div class="data-info-item">포함 항목: 금액, 카테고리, 메모, 상호명, 거래일</div>
        </div>
        <button id="exportCsvBtn" class="btn-sub">CSV 다운로드</button>
        <p id="exportStatus" class="setting-help"></p>
      </div>
    </div>
    <div id="settingsModalRoot"></div>
  </div>
  `;
}

export async function afterRenderSettings() {
  const emailInput = document.getElementById("userEmail");
  const accountCreatedAt = document.getElementById("accountCreatedAt");
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
  const planTitle = document.getElementById("planTitle");
  const currentPlanBadge = document.getElementById("currentPlanBadge");
  const currentPlanHint = document.getElementById("currentPlanHint");

  const yearSelect = document.getElementById("budgetYear");
  const monthSelect = document.getElementById("budgetMonth");
  const amountInput = document.getElementById("budgetAmountInput");
  const loadBtn = document.getElementById("budgetLoadBtn");
  const saveBtn = document.getElementById("budgetSaveBtn");
  const budgetStatusEl = document.getElementById("budgetStatus");
  const newCategoryNameInput = document.getElementById("newCategoryNameInput");
  const addCategoryBtn = document.getElementById("addCategoryBtn");
  const categoryStatusEl = document.getElementById("categoryStatus");
  const categoryListEl = document.getElementById("categoryList");
  const exportCsvBtn = document.getElementById("exportCsvBtn");
  const exportStatusEl = document.getElementById("exportStatus");
  const exportTargetMonth = document.getElementById("exportTargetMonth");
  const exportTxCount = document.getElementById("exportTxCount");

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
    accountCreatedAt.textContent = formatKstDate(user.created_at);
  } else {
    emailInput.value = "-";
    accountCreatedAt.textContent = "-";
  }

  const setInlineStatus = (el, message, isError = false) => {
    el.textContent = message;
    el.classList.toggle("error", isError);
    el.classList.toggle("success", !isError && message.length > 0);
  };

  let cachedCategories = [];
  let editingCategoryId = null;

  const renderAndBindCategories = async ({ reload = true } = {}) => {
    try {
      if (reload) {
        cachedCategories = await fetchCategories();
      }
      categoryListEl.innerHTML = renderCategoryItems(
        cachedCategories,
        user?.user_id,
        editingCategoryId,
      );
      setInlineStatus(categoryStatusEl, "");

      categoryListEl.querySelectorAll(".category-edit-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const item = e.target.closest(".category-item");
          editingCategoryId = Number(item.dataset.id);
          await renderAndBindCategories({ reload: false });
        });
      });

      categoryListEl.querySelectorAll(".category-cancel-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          editingCategoryId = null;
          await renderAndBindCategories({ reload: false });
        });
      });

      categoryListEl.querySelectorAll(".category-save-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const item = e.target.closest(".category-item");
          const categoryId = Number(item.dataset.id);
          const input = item.querySelector(".category-inline-input");
          const nextName = (input?.value || "").trim();
          if (!nextName) {
            setInlineStatus(categoryStatusEl, "카테고리 이름을 입력해 주세요.", true);
            return;
          }

          e.target.disabled = true;
          try {
            await apiRequest(LEDGER_BASE, `/categories/${categoryId}`, {
              method: "PUT",
              body: JSON.stringify({ name: nextName }),
            });
            editingCategoryId = null;
            setInlineStatus(categoryStatusEl, "카테고리가 수정되었습니다.");
            await renderAndBindCategories({ reload: true });
          } catch (err) {
            setInlineStatus(categoryStatusEl, toKoreanErrorMessage(err, "카테고리 수정에 실패했습니다."), true);
            e.target.disabled = false;
          }
        });
      });

      categoryListEl.querySelectorAll(".category-delete-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const item = e.target.closest(".category-item");
          const categoryId = Number(item.dataset.id);
          const name = item.dataset.name;
          if (!confirm(`'${name}' 카테고리를 삭제하시겠습니까?`)) return;

          try {
            await apiRequest(LEDGER_BASE, `/categories/${categoryId}`, {
              method: "DELETE",
            });
            editingCategoryId = null;
            setInlineStatus(categoryStatusEl, "카테고리가 삭제되었습니다.");
            await renderAndBindCategories({ reload: true });
          } catch (err) {
            setInlineStatus(categoryStatusEl, toKoreanErrorMessage(err, "카테고리 삭제에 실패했습니다."), true);
          }
        });
      });
    } catch (err) {
      categoryListEl.innerHTML = `<div class="category-empty">카테고리 목록을 불러오지 못했습니다.</div>`;
      setInlineStatus(categoryStatusEl, toKoreanErrorMessage(err, "카테고리 조회에 실패했습니다."), true);
    }
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
        setInlineStatus(modalStatus, toKoreanErrorMessage(e, "비밀번호 변경에 실패했습니다."), true);
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
        const msg = toKoreanErrorMessage(e, "회원 탈퇴에 실패했습니다.");
        setInlineStatus(modalStatus, msg, true);
        setInlineStatus(deleteAccountStatus, msg, true);
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
      setInlineStatus(emailChangeStatus, toKoreanErrorMessage(e, "저장에 실패했습니다."), true);
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
    planTitle.textContent = "현재 이용 플랜";
    currentPlanBadge.textContent = "PRO";
    currentPlanBadge.classList.add("pro");
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
    planTitle.textContent = "현재 이용 플랜";
    currentPlanBadge.textContent = "FREE";
    currentPlanBadge.classList.remove("pro");
    currentPlanHint.textContent = "기본 기능 사용 중";
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

  const refreshExportCardInfo = async () => {
    const { year, month } = getSelectedYearMonth();
    exportTargetMonth.textContent = `${year}년 ${month}월`;

    try {
      const txPage = await apiRequest(
        LEDGER_BASE,
        `/transactions?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}&page=0&size=1`,
      );
      exportTxCount.textContent = `${Number(txPage?.total_elements ?? 0)}건`;
    } catch {
      exportTxCount.textContent = "조회 실패";
    }
  };

  await refreshCurrentBudget();
  await refreshExportCardInfo();

  yearSelect.addEventListener("change", async () => {
    await refreshCurrentBudget();
    await refreshExportCardInfo();
  });
  monthSelect.addEventListener("change", async () => {
    await refreshCurrentBudget();
    await refreshExportCardInfo();
  });
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

  exportCsvBtn.addEventListener("click", async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      window.location.href = "login.html";
      return;
    }

    const { year, month } = getSelectedYearMonth();
    const endpoint = `${LEDGER_BASE}/transactions/export/csv?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`;

    exportCsvBtn.disabled = true;
    setInlineStatus(exportStatusEl, "CSV 다운로드 중...");

    try {
      const res = await fetch(endpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        localStorage.removeItem("access_token");
        window.location.href = "login.html";
        return;
      }

      if (!res.ok) {
        let msg = "CSV 다운로드 실패";
        try {
          const data = await res.json();
          msg = data?.detail || msg;
        } catch {
          // pass
        }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions_${year}_${String(month).padStart(2, "0")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setInlineStatus(exportStatusEl, `${year}년 ${month}월 CSV를 다운로드했습니다.`);
    } catch (err) {
      setInlineStatus(exportStatusEl, toKoreanErrorMessage(err, "CSV 다운로드에 실패했습니다."), true);
    } finally {
      exportCsvBtn.disabled = false;
    }
  });

  addCategoryBtn.addEventListener("click", async () => {
    const name = newCategoryNameInput.value.trim();
    if (!name) {
      setInlineStatus(categoryStatusEl, "카테고리 이름을 입력해 주세요.", true);
      return;
    }

    addCategoryBtn.disabled = true;
    setInlineStatus(categoryStatusEl, "카테고리 추가 중...");

    try {
      await apiRequest(LEDGER_BASE, "/categories", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      newCategoryNameInput.value = "";
      setInlineStatus(categoryStatusEl, "카테고리가 추가되었습니다.");
      await renderAndBindCategories({ reload: true });
    } catch (err) {
      setInlineStatus(categoryStatusEl, toKoreanErrorMessage(err, "카테고리 추가에 실패했습니다."), true);
    } finally {
      addCategoryBtn.disabled = false;
    }
  });

  await renderAndBindCategories({ reload: true });
}
