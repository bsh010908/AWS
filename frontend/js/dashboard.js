import { apiRequest, AUTH_BASE, LEDGER_BASE } from "./api.js";

let chart;
let selectedYear;
let selectedMonth;

async function loadDashboard(year, month) {
  try {
    const user = await apiRequest(AUTH_BASE, `/me`);
    document.getElementById("planBadge").innerText = user.plan || "FREE";

    const now = new Date();
    selectedYear = year || now.getFullYear();
    selectedMonth = month || now.getMonth() + 1;

    const summary = await apiRequest(
      LEDGER_BASE,
      `/dashboard/summary?year=${selectedYear}&month=${selectedMonth}`
    );

    const categories = await apiRequest(
      LEDGER_BASE,
      `/dashboard/category?year=${selectedYear}&month=${selectedMonth}`
    );

    const recent = await apiRequest(LEDGER_BASE, `/dashboard/recent`);

    renderSummary(summary);
    renderChart(categories);
    renderRecent(recent);
  } catch (error) {
    console.error(error);

    if (error.message.includes("401")) {
      localStorage.removeItem("token");
      window.location.href = "./login.html";
    }

    alert("대시보드 로딩 실패");
  }
}

function renderSummary(data) {
  document.getElementById("totalAmount").innerText =
    (data.total_amount || 0).toLocaleString() + " 원";

  document.getElementById("receiptCount").innerText =
    (data.receipt_count || 0) + " 건";

  document.getElementById("topCategory").innerText =
    data.top_category || "-";
}

function renderChart(categories) {
  const canvas = document.getElementById("categoryChart");
  const ctx = canvas.getContext("2d");

  if (chart) chart.destroy();
  if (!categories || categories.length === 0) return;

  const amounts = categories.map(c => Number(c.total_amount) || 0);
  const total = amounts.reduce((a, b) => a + b, 0);

  if (total === 0) return;

  const colors = [
    "#111827",
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#14b8a6",
    "#f43f5e",
  ];

  // 🔥 도넛 중앙 텍스트 플러그인
  const centerTextPlugin = {
    id: "centerText",
    beforeDraw(chart) {
      const { width, height } = chart;
      const ctx = chart.ctx;

      ctx.save();
      ctx.font = "bold 22px sans-serif";
      ctx.fillStyle = "#111827";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        total.toLocaleString() + "원",
        width / 2,
        height / 2
      );
      ctx.restore();
    },
  };

  chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: categories.map(c => c.category),
      datasets: [{
        data: amounts,
        backgroundColor: categories.map(
          (_, i) => colors[i % colors.length]
        ),
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: { position: "bottom" },
      },
    },
    plugins: [centerTextPlugin],
  });
}

function renderRecent(list) {
  const container = document.getElementById("recentList");
  container.innerHTML = "";

  if (!list || list.length === 0) {
    container.innerHTML = "<p>최근 거래 내역이 없습니다.</p>";
    return;
  }

  list.forEach((item) => {
    const name =
      item.merchant ||
      item.store_name ||
      item.description ||
      "상호명 없음";

    const amount = item.amount || 0;

    const div = document.createElement("div");
    div.className = "recent-item";
    div.innerHTML = `
      <span>${name}</span>
      <span>${amount.toLocaleString()} 원</span>
    `;

    container.appendChild(div);
  });
}

// 🔥 월 선택 드롭다운 초기화
function initMonthSelector() {
  const select = document.getElementById("monthSelect");
  if (!select) return;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  for (let i = 1; i <= 12; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = `${i}월`;
    if (i === currentMonth) option.selected = true;
    select.appendChild(option);
  }

  select.addEventListener("change", (e) => {
    loadDashboard(selectedYear, Number(e.target.value));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.clear();
      window.location.href = "./login.html";
    });
  }

  initMonthSelector();
  loadDashboard();
});