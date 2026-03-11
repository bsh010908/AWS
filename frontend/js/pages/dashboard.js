import { apiRequest, AUTH_BASE, LEDGER_BASE } from "../api.js";

let categoryChart;
let dailyChart;
let monthlyChart;

let selectedYear;
let selectedMonth;

export async function renderDashboard() {
  return `
    <div class="dashboard">
      <div class="header">
        <div class="header-title">대시보드</div>
        <div class="header-controls">
          <select id="yearSelect"></select>
          <select id="monthSelect"></select>
          <div class="plan-badge" id="planBadge">FREE</div>
        </div>
      </div>

      <div class="kpi-section">
        <div class="kpi-card highlight">
          <span>이번 달 지출</span>
          <h2 id="totalAmount">0원</h2>

          <div class="budget-info">
            <div>예산 <b id="budgetAmount">0원</b></div>
            <div>남은 금액 <b id="remainingAmount">0원</b></div>
          </div>

          <div class="budget-bar">
            <div id="budgetProgress"></div>
          </div>

          <div id="monthCompare" class="month-compare"></div>
        </div>

        <div class="kpi-card">
          <span>거래 건수</span>
          <h2 id="receiptCount">0건</h2>
        </div>

        <div class="kpi-card">
          <span>가장 많이 쓴 카테고리</span>
          <h2 id="topCategory">-</h2>
        </div>
      </div>

      <div class="ai-card">
        <h3>AI 소비 인사이트</h3>
        <p id="aiInsight">-</p>
      </div>

      <div class="main-section">
        <div class="chart-card">
          <div class="chart-header">
            <h3>카테고리별 지출</h3>
          </div>
          <div class="chart-wrapper">
            <canvas id="categoryChart"></canvas>
          </div>
        </div>

        <div class="chart-card">
          <h3>일별 지출</h3>
          <div class="chart-wrapper">
            <canvas id="dailyChart"></canvas>
          </div>
        </div>
      </div>

      <div class="chart-card wide">
        <h3>최근 12개월 지출</h3>
        <div class="chart-wrapper">
          <canvas id="monthlyChart"></canvas>
        </div>
      </div>

      <div class="bottom-section">
        <div class="recent-card">
          <h3>최근 거래</h3>
          <div id="recentList"></div>
        </div>

        <div class="predict-card">
          <span>예상 월 지출</span>
          <h2 id="predictedAmount">0원</h2>
          <small id="avgDailyText"></small>
        </div>
      </div>
    </div>
  `;
}

export async function afterRenderDashboard() {
  const now = new Date();
  selectedYear = now.getFullYear();
  selectedMonth = now.getMonth() + 1;

  initMonthSelector();
  await loadDashboard(selectedYear, selectedMonth);
}

async function loadDashboard(year, month) {
  try {
    const user = await apiRequest(AUTH_BASE, "/me");
    const planBadge = document.getElementById("planBadge");
    if (planBadge) {
      planBadge.innerText = user?.plan || "FREE";
    }

    const data = await apiRequest(
      LEDGER_BASE,
      `/dashboard/overview?year=${year}&month=${month}`,
    );

    renderSummary(data.summary, user?.plan);
    renderCategoryChart(data.category_chart || []);
    renderDailyChart(data.daily_chart || []);
    renderRecent(data.recent_transactions || []);
    await loadMonthlyChart();

    if (user?.plan === "PRO") {
      await loadAiInsight(year, month);
    } else {
      const insightBox = document.getElementById("aiInsight");
      if (insightBox) {
        insightBox.innerText = "PRO 플랜에서 AI 인사이트를 확인할 수 있습니다.";
      }
    }
  } catch (error) {
    console.error("Failed to load dashboard", error);
  }
}

async function loadAiInsight(year, month) {
  const insightBox = document.getElementById("aiInsight");
  if (!insightBox) return;

  insightBox.innerText = "AI 인사이트를 불러오는 중...";

  try {
    const data = await apiRequest(
      LEDGER_BASE,
      `/dashboard/ai-insight?year=${year}&month=${month}`,
    );
    insightBox.innerText = data?.ai_insight || "생성된 인사이트가 없습니다.";
  } catch {
    insightBox.innerText = "AI 인사이트를 불러오지 못했습니다.";
  }
}

async function loadMonthlyChart() {
  try {
    const data = await apiRequest(LEDGER_BASE, "/dashboard/last-12-months");
    renderMonthlyChart(data || []);
  } catch (error) {
    console.error("Failed to load monthly chart", error);
    renderMonthlyChart([]);
  }
}

function normalizeLast12Months(data = []) {
  const now = new Date();
  const targetMonths = [];
  const monthMap = new Map();

  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    targetMonths.push(monthKey);
    monthMap.set(monthKey, 0);
  }

  data.forEach((item) => {
    if (!item?.month) return;

    const match = String(item.month).match(/^(\d{4})-(\d{1,2})/);
    if (!match) return;

    const normalizedKey = `${match[1]}-${String(Number(match[2])).padStart(2, "0")}`;
    if (!monthMap.has(normalizedKey)) return;

    monthMap.set(normalizedKey, monthMap.get(normalizedKey) + (Number(item.total) || 0));
  });

  return targetMonths.map((monthKey) => ({
    month: monthKey,
    total: monthMap.get(monthKey) ?? 0,
  }));
}

function renderMonthlyChart(data) {
  const canvas = document.getElementById("monthlyChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const normalizedData = normalizeLast12Months(data);

  if (monthlyChart) monthlyChart.destroy();

  monthlyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: normalizedData.map((d) => {
        const [year, month] = d.month.split("-");
        return `${year.slice(2)}.${month}`;
      }),
      datasets: [
        {
          data: normalizedData.map((d) => d.total),
          backgroundColor: "#6366f1",
          borderRadius: 8,
          barThickness: window.innerWidth <= 520 ? 6 : 8,
          maxBarThickness: window.innerWidth <= 520 ? 6 : 8,
          categoryPercentage: 0.82,
          barPercentage: 0.42,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        x: {
          offset: true,
          grid: {
            display: false,
          },
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0,
            font: {
              size: window.innerWidth <= 520 ? 9 : 10,
            },
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            font: {
              size: window.innerWidth <= 520 ? 10 : 11,
            },
          },
        },
      },
    },
  });
}

function initMonthSelector() {
  const yearSelect = document.getElementById("yearSelect");
  const monthSelect = document.getElementById("monthSelect");
  if (!yearSelect || !monthSelect) return;

  const currentYear = new Date().getFullYear();

  yearSelect.innerHTML = "";
  for (let year = currentYear; year >= currentYear - 3; year -= 1) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = `${year}년`;
    option.selected = year === selectedYear;
    yearSelect.appendChild(option);
  }

  monthSelect.innerHTML = "";
  for (let month = 1; month <= 12; month += 1) {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = `${month}월`;
    option.selected = month === selectedMonth;
    monthSelect.appendChild(option);
  }

  yearSelect.addEventListener("change", async function onYearChange() {
    selectedYear = Number(this.value);
    await loadDashboard(selectedYear, selectedMonth);
  });

  monthSelect.addEventListener("change", async function onMonthChange() {
    selectedMonth = Number(this.value);
    await loadDashboard(selectedYear, selectedMonth);
  });
}

function renderSummary(summary = {}, plan) {
  const totalAmount = Number(summary.total_amount) || 0;
  const budget = Number(summary.budget) || 0;
  const remaining = Number(summary.remaining) || 0;
  const transactionCount = Number(summary.transaction_count) || 0;
  const predictedTotal = Number(summary.predicted_total) || 0;
  const avgDailyAmount = Number(summary.avg_daily_amount) || 0;

  document.getElementById("totalAmount").innerText = `${totalAmount.toLocaleString()}원`;
  document.getElementById("budgetAmount").innerText = `${budget.toLocaleString()}원`;
  document.getElementById("remainingAmount").innerText = `${remaining.toLocaleString()}원`;
  document.getElementById("receiptCount").innerText = `${transactionCount.toLocaleString()}건`;
  document.getElementById("topCategory").innerText = summary.top_category?.name || "-";
  document.getElementById("predictedAmount").innerText = `${predictedTotal.toLocaleString()}원`;
  document.getElementById("avgDailyText").innerText = `일평균 ${avgDailyAmount.toLocaleString()}원 사용`;

  const progressBar = document.getElementById("budgetProgress");
  if (progressBar) {
    const percent = budget > 0 ? Math.min((totalAmount / budget) * 100, 100) : 0;
    progressBar.style.width = `${percent}%`;
    progressBar.style.background =
      percent >= 100 ? "#ef4444" : percent >= 80 ? "#f59e0b" : "#111827";
  }

  const compareEl = document.getElementById("monthCompare");
  if (!compareEl) return;

  if (plan === "PRO" && summary.diff_amount !== undefined) {
    const diff = Number(summary.diff_amount) || 0;
    const rate = Number(summary.change_rate) || 0;
    compareEl.className =
      "month-compare " + (diff > 0 ? "up" : diff < 0 ? "down" : "same");

    const label = diff > 0 ? "증가" : diff < 0 ? "감소" : "변동 없음";
    compareEl.innerText = `지난달 대비 ${label} ${Math.abs(diff).toLocaleString()}원 (${rate}%)`;
    return;
  }

  compareEl.className = "month-compare";
  compareEl.innerText = "";
}

function renderCategoryChart(categories) {
  const canvas = document.getElementById("categoryChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (categoryChart) categoryChart.destroy();

  categoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: categories.map((c) => c.category),
      datasets: [
        {
          data: categories.map((c) => c.total_amount),
          backgroundColor: ["#6366f1", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
    },
  });
}

function renderDailyChart(dailyData) {
  const canvas = document.getElementById("dailyChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (dailyChart) dailyChart.destroy();

  dailyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dailyData.map((d) => d.date),
      datasets: [
        {
          label: "일별 지출",
          data: dailyData.map((d) => d.total_amount),
          borderColor: "#6366f1",
          backgroundColor: "rgba(99, 102, 241, 0.1)",
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

function renderRecent(list) {
  const container = document.getElementById("recentList");
  if (!container) return;

  container.innerHTML = "";

  if (!list.length) {
    container.innerHTML = "<p>최근 거래 내역이 없습니다.</p>";
    return;
  }

  const sortedList = [...list].sort((a, b) => {
    const aDate = a?.occurred_at ? a.occurred_at.slice(0, 10) : "";
    const bDate = b?.occurred_at ? b.occurred_at.slice(0, 10) : "";
    return bDate.localeCompare(aDate);
  });

  sortedList.forEach((item) => {
    const div = document.createElement("div");
    div.className = "recent-item";

    const merchant = item.merchant_name || "미등록 가맹점";
    const date = item.occurred_at ? item.occurred_at.slice(0, 10) : "";

    div.innerHTML = `
      <span>${merchant}</span>
      <span>${Number(item.amount || 0).toLocaleString()}원</span>
      <small>${date}</small>
    `;

    container.appendChild(div);
  });
}
