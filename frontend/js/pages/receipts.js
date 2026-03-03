import { apiRequest, LEDGER_BASE } from "../api.js";

let currentYear;
let currentMonth;
let currentPage = 0;
let totalPages = 0;
let currentSourceType = null; // null = 전체, "OCR" = AI만
const pageSize = 10;

/* =====================================================
   기본 렌더
===================================================== */
export async function renderReceipts() {
  return `
    <section class="page receipts-page">

      <div class="page-header">

        <div class="page-title">
          <h2>거래내역</h2>
          <p class="page-sub">
            수기 입력 · 수정 · 삭제 · 카테고리 관리
          </p>
        </div>

        <div class="page-actions">

          <div class="month-picker-wrap">
            <input 
              type="month" 
              id="monthPicker" 
              class="month-picker" 
            />
          </div>

          <button id="addTxBtn" class="primary-btn">
            + 거래 추가
          </button>

          <button id="aiOnlyBtn" class="secondary-btn">
             AI만 보기
          </button>

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

  const monthInput = document.getElementById("monthPicker");
  monthInput.value = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

  document.getElementById("addTxBtn").onclick = openCreateTxModal;
  document.getElementById("aiOnlyBtn").onclick = async () => {
    if (currentSourceType === "OCR") {
      currentSourceType = null; // 전체 보기
    } else {
      currentSourceType = "OCR"; // AI만 보기
    }

    currentPage = 0;
    await loadTransactions();
  };

  await loadTransactions();

  monthInput.onchange = async () => {
    const [y, m] = monthInput.value.split("-");
    currentYear = Number(y);
    currentMonth = Number(m);
    currentPage = 0;
    await loadTransactions();
  };
}

/* =====================================================
   리스트 로딩
===================================================== */
async function loadTransactions() {
  const sourceParam = currentSourceType
    ? `&source_type=${currentSourceType}`
    : "";

  const data = await apiRequest(
    LEDGER_BASE,
    `/transactions?year=${currentYear}&month=${currentMonth}&page=${currentPage}&size=${pageSize}${sourceParam}`,
  );

  console.log("응답:", data);

  totalPages = data.total_pages ?? 0;
  currentPage = data.page ?? 0;

  renderList(data.content ?? []);
  renderPagination();
}

function getConfidenceBadge(conf) {
  if (conf == null) return "";

  const percent = Math.round(conf * 100);

  let color = "gray";
  if (percent >= 80) color = "green";
  else if (percent >= 50) color = "orange";
  else color = "red";

  return `
  <span 
    class="ai-badge ${color}" 
    title="AI 자동 분류 신뢰도">
    AI ${percent}%
  </span>
`;
}
function renderList(list) {
  const container = document.getElementById("transactionList");
  container.innerHTML = "";

  if (!list?.length) {
    container.innerHTML = `<div class="empty-state">거래 내역이 없습니다</div>`;
    return;
  }

  list.forEach((tx) => {
    const card = document.createElement("div");
    card.className = "tx-card";

    const dateText = tx.occurred_at
      ? new Date(tx.occurred_at).toLocaleDateString()
      : "";

    card.innerHTML = `
      <div class="tx-card-inner">

        <div class="tx-left">
          <div class="tx-category">${tx.category ?? "미분류"}</div>
          <div class="tx-merchant">${tx.merchant_name ?? ""}</div>
        </div>

        <div class="tx-right">
          <div class="tx-amount">
            ${Number(tx.amount).toLocaleString()} 원
          </div>

          ${getConfidenceBadge(tx.ai_confidence)}

          <div class="tx-date">
            ${dateText}
          </div>
        </div>

      </div>

      <div class="tx-actions">
        <button class="edit-btn">수정</button>
        <button class="delete-btn">삭제</button>
      </div>
    `;

    card.querySelector(".delete-btn").onclick = async () => {
      if (!confirm("삭제하시겠습니까?")) return;

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
  // 기존 pagination 제거
  document.querySelector(".pagination")?.remove();

  if (totalPages === 0) return;

  const pagination = document.createElement("div");
  pagination.className = "pagination";

  const maxVisible = 5; // 한 번에 보여줄 페이지 수
  let start = Math.max(0, currentPage - 2);
  let end = Math.min(totalPages - 1, start + maxVisible - 1);

  // 끝쪽 보정
  if (end - start < maxVisible - 1) {
    start = Math.max(0, end - maxVisible + 1);
  }

  let html = "";

  // 앞쪽 ... 처리
  if (start > 0) {
    html += `<button class="page-btn" data-page="0">1</button>`;
    if (start > 1) {
      html += `<span class="dots">...</span>`;
    }
  }

  // 중앙 숫자들
  for (let i = start; i <= end; i++) {
    html += `
      <button 
        class="page-btn ${i === currentPage ? "active" : ""}"
        data-page="${i}">
        ${i + 1}
      </button>
    `;
  }

  // 뒤쪽 ... 처리
  if (end < totalPages - 1) {
    if (end < totalPages - 2) {
      html += `<span class="dots">...</span>`;
    }
    html += `<button class="page-btn" data-page="${totalPages - 1}">
      ${totalPages}
    </button>`;
  }

  pagination.innerHTML = html;

  pagination.querySelectorAll(".page-btn").forEach((btn) => {
    btn.onclick = async () => {
      currentPage = Number(btn.dataset.page);
      await loadTransactions();
    };
  });

  const list = document.getElementById("transactionList");
  list.insertAdjacentElement("afterend", pagination);
}

/* =====================================================
   공용 모달 헬퍼
===================================================== */
function openModal(html, { onMount } = {}) {
  const modalRoot = document.getElementById("modalRoot");
  modalRoot.innerHTML = html;

  const overlay = document.querySelector(".modal-overlay");
  const closeBtn = document.getElementById("closeModal");
  const closeBtn2 = document.getElementById("closeBtn2");

  function closeModal() {
    modalRoot.innerHTML = "";
    document.removeEventListener("keydown", escHandler);
  }

  function escHandler(e) {
    if (e.key === "Escape") closeModal();
  }

  document.addEventListener("keydown", escHandler);

  if (closeBtn) closeBtn.onclick = closeModal;
  if (closeBtn2) closeBtn2.onclick = closeModal;

  if (overlay) {
    overlay.onclick = (e) => {
      if (e.target.classList.contains("modal-overlay")) {
        closeModal();
      }
    };
  }

  if (typeof onMount === "function") {
    onMount({ closeModal });
  }

  return { closeModal };
}

/* =====================================================
   유틸
===================================================== */
async function fetchCategoriesSafe() {
  const res = await apiRequest(LEDGER_BASE, "/categories");
  return Array.isArray(res) ? res : (res?.data ?? []);
}

function isoFromDateInput(dateStr) {
  return `${dateStr}T00:00:00`;
}

function renderCategoryOptions(categories, selectedName) {
  if (!categories.length)
    return `<option value="">(카테고리가 없습니다)</option>`;

  return categories
    .map(
      (c) => `
        <option value="${c.category_id}" ${
          selectedName === c.name ? "selected" : ""
        }>
          ${c.name}
        </option>
      `,
    )
    .join("");
}

function validateTx({ amount, categoryValue, dateValue }) {
  if (!categoryValue) {
    alert("카테고리를 선택하세요");
    return false;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    alert("금액을 올바르게 입력하세요");
    return false;
  }
  if (!dateValue) {
    alert("날짜를 선택하세요");
    return false;
  }
  return true;
}

/* =====================================================
   카테고리 인라인 추가
===================================================== */
function renderInlineAddCategory() {
  return `
    <div class="inline-add">
      <input id="newCategoryName" type="text" placeholder="새 카테고리 이름" />
      <button id="createCategoryBtn" class="chip-btn">추가</button>
    </div>
    <div class="inline-hint">
      기본 카테고리와 이름이 겹치면 추가되지 않습니다.
    </div>
  `;
}

async function bindInlineAddCategory({ afterCreated }) {
  const input = document.getElementById("newCategoryName");
  const btn = document.getElementById("createCategoryBtn");

  btn.onclick = async () => {
    const name = input.value.trim();
    if (!name) {
      alert("카테고리 이름을 입력하세요");
      return;
    }

    try {
      await apiRequest(LEDGER_BASE, "/categories", {
        method: "POST",
        body: JSON.stringify({ name }),
      });

      input.value = "";
      if (afterCreated) await afterCreated();
    } catch (e) {
      alert(e?.message || "카테고리 추가 실패");
    }
  };
}

/* =====================================================
   거래 수정 모달
===================================================== */
async function openEditModal(tx) {
  const categories = await fetchCategoriesSafe();

  const html = `
    <div class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>거래 수정</h3>
          <button id="closeModal" class="close-btn">×</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>금액</label>
            <input id="editAmount" type="number"
              value="${Number(tx.amount) || 0}" />
          </div>
          <div class="form-group">
  <label>상호명</label>
<input id="editMerchant" type="text"
  value="${tx.merchant_name ?? ""}" placeholder="예) 스타벅스 / CU / 버스"/>
</div>

          <div class="form-group">
            <label>날짜</label>
            <input id="editDate" type="date"
              value="${tx.occurred_at?.slice(0, 10) ?? ""}" />
          </div>

          <div class="form-group">
            <label>카테고리</label>
            <select id="editCategory">
              ${renderCategoryOptions(categories, tx.category)}
            </select>
            <div class="inline-area">
              ${renderInlineAddCategory()}
            </div>
          </div>

          <div class="form-group">
            <label>메모</label>
            <input id="editMemo" type="text"
              value="${tx.memo ?? ""}" />
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
          select.innerHTML = renderCategoryOptions(updated);
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

/* =====================================================
   거래 생성 모달
===================================================== */
async function openCreateTxModal() {
  const categories = await fetchCategoriesSafe();
  const today = new Date().toISOString().slice(0, 10);

  const html = `
    <div class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>거래 추가</h3>
          <button id="closeModal" class="close-btn">×</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>금액</label>
            <input id="createAmount" type="number"
              placeholder="예) 12000" />
          </div>
          <div class="form-group">
  <label>상호명</label>
  <input id="createMerchant" type="text"
  placeholder="예) 스타벅스 / CU / 버스" />
</div>

          <div class="form-group">
            <label>날짜</label>
            <input id="createDate" type="date"
              value="${today}" />
          </div>

          <div class="form-group">
            <label>카테고리</label>
            <select id="createCategory">
              ${renderCategoryOptions(categories)}
            </select>
            <div class="inline-area">
              ${renderInlineAddCategory()}
            </div>
          </div>

          <div class="form-group">
            <label>메모</label>
            <input id="createMemo" type="text"
              placeholder="예) 점심 / 버스 / 편의점" />
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
          select.innerHTML = renderCategoryOptions(updated);
        },
      });

      document.getElementById("saveCreate").onclick = async () => {
        const amount = Number(document.getElementById("createAmount").value);
        const memo = document.getElementById("createMemo").value;
        const categorySelect = document.getElementById("createCategory");
        const categoryName =
          categorySelect.options[categorySelect.selectedIndex].text;
        const dateValue = document.getElementById("createDate").value;
        const merchant = document.getElementById("createMerchant").value;

        if (
          !validateTx({
            merchant_name: merchant || null,
            amount,
            categoryValue: categorySelect.value,
            dateValue,
          })
        )
          return;

        await apiRequest(LEDGER_BASE, "/transactions", {
          method: "POST",
          body: JSON.stringify({
            amount,
            memo: memo || "",
            category: categoryName, // 🔥 여기
            occurred_at: new Date(dateValue).toISOString(),
          }),
        });

        closeModal();
        await loadTransactions();
      };
    },
  });
}
