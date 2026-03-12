import { apiRequest, LEDGER_BASE } from "../api.js";

let currentYear;
let currentMonth;
let currentPage = 0;
let totalPages = 0;
let currentSourceType = null;
let currentTab = "MONTH";
const pageSize = 10;

export async function renderReceipts() {
  return `
    <section class="page receipts-page">
      <div class="page-header">
        <div class="page-title">
          <h2>거래내역</h2>
          <p class="page-sub">월별 내역과 최근 거래를 한 화면에서 확인할 수 있습니다.</p>
        </div>

        <div class="page-header-bottom">
          <div class="tabs">
            <button class="tab-btn active" data-tab="MONTH">월별 내역</button>
            <button class="tab-btn" data-tab="RECENT">최근 거래</button>
          </div>

          <div class="page-actions">
            <div class="month-picker-wrap">
              <input type="month" id="monthPicker" class="month-picker" />
            </div>

            <button id="addTxBtn" class="primary-btn">+ 거래 추가</button>
            <button id="aiOnlyBtn" class="secondary-btn">AI 인식만</button>
          </div>
        </div>
      </div>

      <div id="transactionList" class="tx-grid"></div>
      <div id="modalRoot"></div>
    </section>
  `;
}

export async function afterRenderReceipts() {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth() + 1;
  currentPage = 0;
  currentTab = "MONTH";
  currentSourceType = null;

  const monthInput = document.getElementById("monthPicker");
  if (monthInput) {
    monthInput.value = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
    monthInput.onchange = async () => {
      const [year, month] = monthInput.value.split("-");
      currentYear = Number(year);
      currentMonth = Number(month);
      currentPage = 0;
      await loadTransactions();
    };
  }

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.onclick = async () => {
      document.querySelectorAll(".tab-btn").forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");
      currentTab = btn.dataset.tab;
      currentPage = 0;
      await loadTransactions();
    };
  });

  const addTxBtn = document.getElementById("addTxBtn");
  if (addTxBtn) {
    addTxBtn.onclick = openCreateTxModal;
  }

  const aiOnlyBtn = document.getElementById("aiOnlyBtn");
  if (aiOnlyBtn) {
    aiOnlyBtn.onclick = async () => {
      currentSourceType = currentSourceType === "OCR" ? null : "OCR";
      currentPage = 0;
      syncAiOnlyButtonState();
      await loadTransactions();
    };
  }

  await loadTransactions();
}

function syncAiOnlyButtonState() {
  const aiOnlyBtn = document.getElementById("aiOnlyBtn");
  if (!aiOnlyBtn) return;
  aiOnlyBtn.classList.toggle("active", currentSourceType === "OCR");
}

async function loadTransactions() {
  syncAiOnlyButtonState();

  const monthWrap = document.querySelector(".month-picker-wrap");
  if (monthWrap) {
    monthWrap.classList.toggle("hidden", currentTab === "RECENT");
  }

  try {
    let data;

    if (currentTab === "RECENT") {
      const list = await apiRequest(LEDGER_BASE, "/transactions/recent");
      data = {
        content: Array.isArray(list) ? list : [],
        total_pages: 1,
        page: 0,
      };
    } else {
      const sourceParam = currentSourceType ? `&source_type=${currentSourceType}` : "";
      data = await apiRequest(
        LEDGER_BASE,
        `/transactions?year=${currentYear}&month=${currentMonth}&page=${currentPage}&size=${pageSize}${sourceParam}`,
      );
    }

    totalPages = Number(data?.total_pages ?? 0);
    currentPage = Number(data?.page ?? 0);

    renderList(data?.content ?? []);
    renderPagination();
  } catch (error) {
    console.error("Failed to load transactions", error);
    totalPages = 0;
    currentPage = 0;
    const container = document.getElementById("transactionList");
    if (container) {
      container.innerHTML = `<div class="empty-state">거래 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>`;
    }
    document.querySelector(".pagination")?.remove();
  }
}

function getConfidenceBadge(confidence) {
  if (confidence == null) return "";

  const percent = Math.round(Number(confidence) * 100);
  const color = percent >= 80 ? "green" : percent >= 50 ? "orange" : "red";

  return `
    <span class="ai-badge ${color}" title="AI 인식 신뢰도">
      AI ${percent}%
    </span>
  `;
}

function renderList(list) {
  const container = document.getElementById("transactionList");
  if (!container) return;

  container.innerHTML = "";

  if (!list.length) {
    container.innerHTML = `<div class="empty-state">표시할 거래 내역이 없습니다.</div>`;
    return;
  }

  list.forEach((tx) => {
    const card = document.createElement("div");
    card.className = "tx-card";

    const dateText = tx.occurred_at ? new Date(tx.occurred_at).toLocaleDateString() : "";
    const category = tx.category ?? "미분류";
    const merchant = tx.merchant_name ?? "";

    card.innerHTML = `
      <div class="tx-card-inner">
        <div class="tx-left">
          <div class="tx-category">${category}</div>
          <div class="tx-merchant">${merchant}</div>
        </div>

        <div class="tx-right">
          <div class="tx-amount">${Number(tx.amount || 0).toLocaleString()}원</div>
          ${getConfidenceBadge(tx.ai_confidence)}
          <div class="tx-date">${dateText}</div>
        </div>
      </div>

      <div class="tx-actions">
        <button class="edit-btn">수정</button>
        <button class="delete-btn">삭제</button>
      </div>
    `;

    card.querySelector(".delete-btn").onclick = async () => {
      if (!window.confirm("이 거래를 삭제하시겠습니까?")) return;

      await apiRequest(LEDGER_BASE, `/transactions/${tx.id}`, {
        method: "DELETE",
      });

      await loadTransactions();
    };

    card.querySelector(".edit-btn").onclick = () => openEditModal(tx);
    container.appendChild(card);
  });
}

function renderPagination() {
  document.querySelector(".pagination")?.remove();

  if (totalPages <= 1 || currentTab === "RECENT") return;

  const pagination = document.createElement("div");
  pagination.className = "pagination";

  const maxVisible = 5;
  let start = Math.max(0, currentPage - 2);
  let end = Math.min(totalPages - 1, start + maxVisible - 1);

  if (end - start < maxVisible - 1) {
    start = Math.max(0, end - maxVisible + 1);
  }

  let html = "";

  if (start > 0) {
    html += `<button class="page-btn" data-page="0">1</button>`;
    if (start > 1) {
      html += `<span class="dots">...</span>`;
    }
  }

  for (let index = start; index <= end; index += 1) {
    html += `
      <button class="page-btn ${index === currentPage ? "active" : ""}" data-page="${index}">
        ${index + 1}
      </button>
    `;
  }

  if (end < totalPages - 1) {
    if (end < totalPages - 2) {
      html += `<span class="dots">...</span>`;
    }
    html += `<button class="page-btn" data-page="${totalPages - 1}">${totalPages}</button>`;
  }

  pagination.innerHTML = html;
  pagination.querySelectorAll(".page-btn").forEach((btn) => {
    btn.onclick = async () => {
      currentPage = Number(btn.dataset.page);
      await loadTransactions();
    };
  });

  document.getElementById("transactionList")?.insertAdjacentElement("afterend", pagination);
}

function openModal(html, { onMount } = {}) {
  const modalRoot = document.getElementById("modalRoot");
  if (!modalRoot) return { closeModal: () => {} };

  modalRoot.innerHTML = html;

  const closeModal = () => {
    modalRoot.innerHTML = "";
    document.removeEventListener("keydown", escHandler);
  };

  const escHandler = (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  };

  document.addEventListener("keydown", escHandler);

  document.getElementById("closeModal")?.addEventListener("click", closeModal);
  document.getElementById("closeBtn2")?.addEventListener("click", closeModal);

  document.querySelector(".modal-overlay")?.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal-overlay")) {
      closeModal();
    }
  });

  if (typeof onMount === "function") {
    onMount({ closeModal });
  }

  return { closeModal };
}

async function fetchCategoriesSafe() {
  const response = await apiRequest(LEDGER_BASE, "/categories");
  return Array.isArray(response) ? response : (response?.data ?? []);
}

function isoFromDateInput(dateStr) {
  return `${dateStr}T00:00:00`;
}

function renderCategoryOptions(categories, selectedName) {
  if (!categories.length) {
    return `<option value="">카테고리가 없습니다</option>`;
  }

  return categories
    .map(
      (category) => `
        <option value="${category.category_id}" ${selectedName === category.name ? "selected" : ""}>
          ${category.name}
        </option>
      `,
    )
    .join("");
}

function validateTx({ amount, categoryValue, dateValue }) {
  if (!categoryValue) {
    alert("카테고리를 선택해 주세요.");
    return false;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("금액은 0보다 커야 합니다.");
    return false;
  }

  if (!dateValue) {
    alert("날짜를 선택해 주세요.");
    return false;
  }

  return true;
}

function renderInlineAddCategory() {
  return `
    <div class="inline-add">
      <input id="newCategoryName" type="text" placeholder="새 카테고리 이름" />
      <button id="createCategoryBtn" class="chip-btn">추가</button>
    </div>
    <div class="inline-hint">새 카테고리를 만들면 바로 목록에 반영됩니다.</div>
  `;
}

async function bindInlineAddCategory({ afterCreated }) {
  const input = document.getElementById("newCategoryName");
  const btn = document.getElementById("createCategoryBtn");
  if (!input || !btn) return;

  btn.onclick = async () => {
    const name = input.value.trim();
    if (!name) {
      alert("카테고리 이름을 입력해 주세요.");
      return;
    }

    try {
      await apiRequest(LEDGER_BASE, "/categories", {
        method: "POST",
        body: JSON.stringify({ name }),
      });

      input.value = "";
      if (afterCreated) {
        await afterCreated();
      }
    } catch (error) {
      alert(error?.message || "카테고리 추가에 실패했습니다.");
    }
  };
}

async function openEditModal(tx) {
  const categories = await fetchCategoriesSafe();

  const html = `
    <div class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>거래 수정</h3>
          <button id="closeModal" class="close-btn">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>금액</label>
            <input id="editAmount" type="number" value="${Number(tx.amount) || 0}" />
          </div>

          <div class="form-group">
            <label>가맹점</label>
            <input
              id="editMerchant"
              type="text"
              value="${tx.merchant_name ?? ""}"
              placeholder="예: 스타벅스 / CU / 버스"
            />
          </div>

          <div class="form-group">
            <label>날짜</label>
            <input id="editDate" type="date" value="${tx.occurred_at?.slice(0, 10) ?? ""}" />
          </div>

          <div class="form-group">
            <label>카테고리</label>
            <select id="editCategory">
              ${renderCategoryOptions(categories, tx.category)}
            </select>
            <div class="inline-area">${renderInlineAddCategory()}</div>
          </div>

          <div class="form-group">
            <label>메모</label>
            <input id="editMemo" type="text" value="${tx.memo ?? ""}" />
          </div>
        </div>

        <div class="modal-footer">
          <button class="secondary-btn" id="closeBtn2">취소</button>
          <button class="primary-btn" id="saveEdit">저장</button>
        </div>
      </div>
    </div>
  `;

  openModal(html, {
    onMount: async ({ closeModal }) => {
      await bindInlineAddCategory({
        afterCreated: async () => {
          const updated = await fetchCategoriesSafe();
          const select = document.getElementById("editCategory");
          if (select) {
            select.innerHTML = renderCategoryOptions(updated, tx.category);
          }
        },
      });

      document.getElementById("saveEdit").onclick = async () => {
        const amount = Number(document.getElementById("editAmount").value);
        const memo = document.getElementById("editMemo").value;
        const categoryValue = document.getElementById("editCategory").value;
        const dateValue = document.getElementById("editDate").value;
        const merchant = document.getElementById("editMerchant").value;

        if (!validateTx({ amount, categoryValue, dateValue })) return;

        await apiRequest(LEDGER_BASE, `/transactions/${tx.id}`, {
          method: "PUT",
          body: JSON.stringify({
            merchant_name: merchant || null,
            amount,
            memo,
            category_id: Number(categoryValue),
            occurred_at: isoFromDateInput(dateValue),
          }),
        });

        closeModal();
        await loadTransactions();
      };
    },
  });
}

async function openCreateTxModal() {
  const categories = await fetchCategoriesSafe();
  const today = new Date().toISOString().slice(0, 10);

  const html = `
    <div class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>거래 추가</h3>
          <button id="closeModal" class="close-btn">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>금액</label>
            <input id="createAmount" type="number" placeholder="예: 12000" />
          </div>

          <div class="form-group">
            <label>가맹점</label>
            <input id="createMerchant" type="text" placeholder="예: 스타벅스 / CU / 버스" />
          </div>

          <div class="form-group">
            <label>날짜</label>
            <input id="createDate" type="date" value="${today}" />
          </div>

          <div class="form-group">
            <label>카테고리</label>
            <select id="createCategory">
              ${renderCategoryOptions(categories)}
            </select>
            <div class="inline-area">${renderInlineAddCategory()}</div>
          </div>

          <div class="form-group">
            <label>메모</label>
            <input id="createMemo" type="text" placeholder="선택 입력" />
          </div>
        </div>

        <div class="modal-footer">
          <button class="secondary-btn" id="closeBtn2">취소</button>
          <button class="primary-btn" id="saveCreate">추가</button>
        </div>
      </div>
    </div>
  `;

  openModal(html, {
    onMount: async ({ closeModal }) => {
      await bindInlineAddCategory({
        afterCreated: async () => {
          const updated = await fetchCategoriesSafe();
          const select = document.getElementById("createCategory");
          if (select) {
            select.innerHTML = renderCategoryOptions(updated);
          }
        },
      });

      document.getElementById("saveCreate").onclick = async () => {
        const amount = Number(document.getElementById("createAmount").value);
        const memo = document.getElementById("createMemo").value;
        const categorySelect = document.getElementById("createCategory");
        const dateValue = document.getElementById("createDate").value;
        const merchant = document.getElementById("createMerchant").value;

        if (!validateTx({ amount, categoryValue: categorySelect.value, dateValue })) return;

        await apiRequest(LEDGER_BASE, "/transactions", {
          method: "POST",
          body: JSON.stringify({
            amount,
            memo: memo || "",
            merchant_name: merchant || null,
            category_id: Number(categorySelect.value),
            category: categorySelect.options[categorySelect.selectedIndex].text,
            occurred_at: isoFromDateInput(dateValue),
          }),
        });

        closeModal();
        await loadTransactions();
      };
    },
  });
}
