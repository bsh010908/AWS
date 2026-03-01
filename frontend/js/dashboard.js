import { apiRequest, AUTH_BASE, LEDGER_BASE } from "./api.js";

let categoryChart;
let dailyChart;
let selectedYear;
let selectedMonth;

async function loadDashboard(year, month) {
  try {
    const user = await apiRequest(AUTH_BASE, `/me`);
    document.getElementById("planBadge").innerText = user.plan || "FREE";

    const now = new Date();
    selectedYear = year || now.getFullYear();
    selectedMonth = month || now.getMonth() + 1;

    // 🔥 이제 overview 한 번만 호출
    const data = await apiRequest(
      LEDGER_BASE,
      `/dashboard/overview?year=${selectedYear}&month=${selectedMonth}`
    );

    renderSummary(data.summary);
    renderCategoryChart(data.category_chart);
    renderDailyChart(data.daily_chart);
    renderRecent(data.recent_transactions);

  } catch (error) {
    console.error(error);

    if (error.message.includes("401")) {
      localStorage.removeItem("token");
      window.location.href = "./login.html";
    }

    alert("대시보드 로딩 실패");
  }
}

function renderSummary(summary) {
  document.getElementById("totalAmount").innerText =
    (summary.total_amount || 0).toLocaleString() + " 원";

  document.getElementById("receiptCount").innerText =
    (summary.transaction_count || 0) + " 건";

  document.getElementById("topCategory").innerText =
    summary.top_category?.name || "-";
}

function renderCategoryChart(categories) {
  const ctx = document.getElementById("categoryChart").getContext("2d");

  if (categoryChart) categoryChart.destroy();
  if (!categories || categories.length === 0) return;

  const amounts = categories.map(c => c.total_amount);
  const total = amounts.reduce((a, b) => a + b, 0);

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
      ctx.fillText(total.toLocaleString() + "원", width / 2, height / 2);
      ctx.restore();
    },
  };

  categoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: categories.map(c => c.category),
      datasets: [{
        data: amounts,
        backgroundColor: categories.map((_, i) => colors[i % colors.length]),
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

function renderDailyChart(dailyData) {
  const ctx = document.getElementById("dailyChart").getContext("2d");

  if (dailyChart) dailyChart.destroy();
  if (!dailyData) return;

  dailyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dailyData.map(d => d.date),
      datasets: [{
        label: "일별 소비",
        data: dailyData.map(d => d.total_amount),
        borderColor: "#111827",
        backgroundColor: "rgba(17,24,39,0.1)",
        tension: 0.3,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
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
      item.merchant_name ||
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