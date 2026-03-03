import { apiRequest, LEDGER_BASE } from "../api.js";

let currentYear;
let currentMonth;

export async function renderReceipts() {
  return `
    <section class="page receipts-page">
      <div class="page-header">
        <h2>거래내역</h2>
        <input type="month" id="monthPicker" />
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
  monthInput.value =
    currentYear + "-" + String(currentMonth).padStart(2, "0");

  await loadTransactions();

  monthInput.addEventListener("change", async () => {
    const [y, m] = monthInput.value.split("-");
    currentYear = Number(y);
    currentMonth = Number(m);
    await loadTransactions();
  });
}

async function loadTransactions() {
  const data = await apiRequest(
    LEDGER_BASE,
    `/transactions?year=${currentYear}&month=${currentMonth}&page=0&size=20`
  );

  renderList(data.content);
}

function renderList(list) {
  const container = document.getElementById("transactionList");
  container.innerHTML = "";

  if (!list || !list.length) {
    container.innerHTML = `<div class="empty">거래 내역이 없습니다</div>`;
    return;
  }

  list.forEach(tx => {
    const card = document.createElement("div");
    card.className = "tx-card";

    card.innerHTML = `
      <div class="tx-top">
        <div class="tx-category">${tx.category ?? "미분류"}</div>
        <div class="tx-amount">${tx.amount.toLocaleString()} 원</div>
      </div>

      <div class="tx-meta">
        <span>${tx.merchant_name ?? ""}</span>
        <span>${new Date(tx.occurred_at).toLocaleDateString()}</span>
      </div>

      <div class="tx-actions">
        <button class="edit-btn">수정</button>
        <button class="delete-btn">삭제</button>
      </div>
    `;

    card.querySelector(".delete-btn").onclick = async () => {
      if (!confirm("삭제하시겠습니까?")) return;
      await apiRequest(LEDGER_BASE, `/transactions/${tx.id}`, {
        method: "DELETE"
      });
      await loadTransactions();
    };

    card.querySelector(".edit-btn").onclick = () =>
      openEditModal(tx);

    container.appendChild(card);
  });
}

async function openEditModal(tx) {
  const modalRoot = document.getElementById("modalRoot");

  const categories = await apiRequest(
    LEDGER_BASE,
    `/categories`
  );

  modalRoot.innerHTML = `
    <div class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>거래 수정</h3>
          <button id="closeModal" class="close-btn">×</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>금액</label>
            <input id="editAmount" type="number" value="${tx.amount}" />
          </div>

          <div class="form-group">
            <label>카테고리</label>
            <select id="editCategory">
              ${categories.map(c =>
                `<option value="${c.category_id}"
                  ${c.name === tx.category ? "selected" : ""}>
                  ${c.name}
                </option>`
              ).join("")}
            </select>
            <div class="add-category-btn" id="addCategoryBtn">
              + 새 카테고리 추가
            </div>
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

  // 닫기 함수
  function closeModal() {
    modalRoot.innerHTML = "";
    document.removeEventListener("keydown", escHandler);
  }

  document.getElementById("closeModal").onclick = closeModal;
  document.getElementById("closeBtn2").onclick = closeModal;

  // ESC 닫기
  function escHandler(e) {
    if (e.key === "Escape") closeModal();
  }
  document.addEventListener("keydown", escHandler);

  // 외부 클릭 닫기
  document.querySelector(".modal-overlay").onclick = (e) => {
    if (e.target.classList.contains("modal-overlay")) {
      closeModal();
    }
  };

  // 카테고리 추가
  document.getElementById("addCategoryBtn").onclick = async () => {
    const name = prompt("새 카테고리 이름 입력");
    if (!name) return;

    await apiRequest(LEDGER_BASE, "/categories", {
      method: "POST",
      body: JSON.stringify({ name })
    });

    closeModal();
    openEditModal(tx);
  };

  // 저장
  document.getElementById("saveEdit").onclick = async () => {
    await apiRequest(LEDGER_BASE, `/transactions/${tx.id}`, {
      method: "PUT",
      body: JSON.stringify({
        amount: Number(document.getElementById("editAmount").value),
        memo: document.getElementById("editMemo").value,
        category_id: Number(document.getElementById("editCategory").value)
      })
    });

    closeModal();
    await loadTransactions();
  };
}