import { apiRequest, AUTH_BASE, LEDGER_BASE } from "./api.js";

let categoryChart;
let dailyChart;
let selectedYear;
let selectedMonth;

async function loadDashboard(year, month) {
  try {
    const user = await apiRequest(AUTH_BASE, `/me`);
    document.getElementById("planBadge").innerText = user.plan;

    const now = new Date();
    selectedYear = year || now.getFullYear();
    selectedMonth = month || now.getMonth() + 1;

    const data = await apiRequest(
      LEDGER_BASE,
      `/dashboard/overview?year=${selectedYear}&month=${selectedMonth}`
    );

    renderSummary(data.summary, user.plan);
    renderCategoryChart(data.category_chart);
    renderDailyChart(data.daily_chart);
    renderRecent(data.recent_transactions);

  } catch (error) {
    if (error.message.includes("401")) {
      localStorage.removeItem("token");
      window.location.href = "./login.html";
    }
  }
}

/* ===========================
   🔥 월 선택 드롭다운 생성
=========================== */

function initMonthSelector() {
  const select = document.getElementById("monthSelect");
  if (!select) return;

  select.innerHTML = "";

  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  for (let i = 1; i <= 12; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = `${i}월`;

    if (i === currentMonth) option.selected = true;

    select.appendChild(option);
  }

  select.addEventListener("change", function () {
    selectedMonth = Number(this.value);
    loadDashboard(selectedYear, selectedMonth);
  });
}

/* ===========================
   SUMMARY
=========================== */

function renderSummary(summary, plan) {
  document.getElementById("totalAmount").innerText =
    summary.total_amount.toLocaleString() + " 원";

  document.getElementById("receiptCount").innerText =
    summary.transaction_count + " 건";

  document.getElementById("topCategory").innerText =
    summary.top_category?.name || "-";

  document.getElementById("predictedAmount").innerText =
    summary.predicted_total.toLocaleString() + " 원";

  document.getElementById("avgDailyText").innerText =
    `하루 평균 ${summary.avg_daily_amount.toLocaleString()} 원`;

  const compareEl = document.getElementById("monthCompare");

  if (plan === "PRO" && summary.diff_amount !== undefined) {
    const diff = summary.diff_amount;
    const rate = summary.change_rate;

    compareEl.className =
      "month-compare " + (diff > 0 ? "up" : diff < 0 ? "down" : "same");

    compareEl.innerText =
      `전월 대비 ${diff > 0 ? "▲" : diff < 0 ? "▼" : "-"} ${Math.abs(diff).toLocaleString()}원 (${rate}%)`;
  }
}

/* ===========================
   CATEGORY CHART
=========================== */

function renderCategoryChart(categories) {
  const ctx = document.getElementById("categoryChart").getContext("2d");
  if (categoryChart) categoryChart.destroy();

  const colors = ["#6366f1", "#8b5cf6", "#3b82f6", "#10b981"];

  categoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: categories.map(c => c.category),
      datasets: [{
        data: categories.map(c => c.total_amount),
        backgroundColor: colors,
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
    }
  });
}

/* ===========================
   DAILY CHART
=========================== */

function renderDailyChart(dailyData) {
  const ctx = document.getElementById("dailyChart").getContext("2d");
  if (dailyChart) dailyChart.destroy();

  dailyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dailyData.map(d => d.date),
      datasets: [{
        data: dailyData.map(d => d.total_amount),
        borderColor: "#6366f1",
        backgroundColor: "rgba(99,102,241,0.1)",
        tension: 0.3,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    }
  });
}

/* ===========================
   RECENT LIST
=========================== */

function renderRecent(list) {
  const container = document.getElementById("recentList");
  container.innerHTML = "";

  if (!list || list.length === 0) {
    container.innerHTML = "<p>최근 거래 내역이 없습니다.</p>";
    return;
  }

  list.forEach(item => {
    const div = document.createElement("div");
    div.className = "recent-item";
    div.innerHTML = `
      <span>${item.merchant_name || "상호명 없음"}</span>
      <span>${item.amount.toLocaleString()} 원</span>
    `;
    container.appendChild(div);
  });
}

/* ===========================
   INIT
=========================== */

document.addEventListener("DOMContentLoaded", () => {
  initMonthSelector();   // 🔥 이거 반드시 필요
  loadDashboard();
});

window.addEventListener("resize", () => {
  if (categoryChart) categoryChart.resize();
  if (dailyChart) dailyChart.resize();
});