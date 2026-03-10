import { apiRequest, AUTH_BASE, LEDGER_BASE } from "../api.js";

let categoryChart;
let dailyChart;
let monthlyChart;

let selectedYear;
let selectedMonth;

/* ===========================
   RENDER
=========================== */

export async function renderDashboard() {
  return `
    <div class="dashboard">


        <div class="header">

          <div class="header-title">
            ??쒕낫??
          </div>

          <div class="header-controls">

          <select id="yearSelect"></select>
          <select id="monthSelect"></select>

          <div class="plan-badge" id="planBadge">PRO</div>

          </div>

        </div>

      <!-- KPI -->
      <div class="kpi-section">
        <div class="kpi-card highlight">
          <span>珥?吏異?/span>
          <h2 id="totalAmount">0 ??/h2>

          <div class="budget-info">
            <div>?덉궛 <b id="budgetAmount">0 ??/b></div>
            <div>?⑥? 湲덉븸 <b id="remainingAmount">0 ??/b></div>
          </div>

          <div class="budget-bar">
            <div id="budgetProgress"></div>
          </div>

          <div id="monthCompare" class="month-compare"></div>
        </div>
        <div class="kpi-card">
          <span>?대쾲 ???곸닔利???/span>
          <h2 id="receiptCount">0 嫄?/h2>
        </div>

        <div class="kpi-card">
          <span>理쒕? ?뚮퉬 移댄뀒怨좊━</span>
          <h2 id="topCategory">-</h2>
        </div>
      </div>

      <!-- AI ?몄궗?댄듃 -->
      <div class="ai-card">
        <h3>AI ?뚮퉬 遺꾩꽍</h3>
        <p id="aiInsight">-</p>
      </div>

      <!-- 李⑦듃 ?곸뿭 -->
      <div class="main-section">

        <div class="chart-card">
          <div class="chart-header">
            <h3>移댄뀒怨좊━蹂??뚮퉬</h3>
          </div>
          <div class="chart-wrapper">
            <canvas id="categoryChart"></canvas>
          </div>
        </div>

        <div class="chart-card">
          <h3>?쇰퀎 ?뚮퉬</h3>
          <div class="chart-wrapper">
            <canvas id="dailyChart"></canvas>
          </div>
        </div>

      </div>

      
      <div class="chart-card wide">
        <h3>理쒓렐 12媛쒖썡 ?뚮퉬</h3>
        <div class="chart-wrapper">
          <canvas id="monthlyChart"></canvas>
        </div>
      </div>

      <!-- ?섎떒 -->
      <div class="bottom-section">

        <div class="recent-card">
          <h3>理쒓렐 ?뚮퉬</h3>
          <div id="recentList"></div>
        </div>

        <div class="predict-card">
          <span>?대쾲 ???덉긽 吏異?/span>
          <h2 id="predictedAmount">0 ??/h2>
          <small id="avgDailyText"></small>
        </div>

      </div>

    </div>
  `;
}

/* ===========================
   AFTER RENDER
=========================== */

export async function afterRenderDashboard() {
  const now = new Date();
  selectedYear = now.getFullYear();
  selectedMonth = now.getMonth() + 1;

  initMonthSelector();

  await loadDashboard(selectedYear, selectedMonth);
}

/* ===========================
   LOAD DASHBOARD
=========================== */

async function loadDashboard(year, month) {
  try {
    const user = await apiRequest(AUTH_BASE, `/me`);
    document.getElementById("planBadge").innerText = user.plan;

 
    const data = await apiRequest(
      LEDGER_BASE,
      `/dashboard/overview?year=${selectedYear}&month=${selectedMonth}`,
    );

    renderSummary(data.summary, user.plan);
    renderCategoryChart(data.category_chart);
    renderDailyChart(data.daily_chart);
    renderRecent(data.recent_transactions);

    /* ?뵦 理쒓렐 12媛쒖썡 洹몃옒??*/
    loadMonthlyChart();

    /* AI */
    if (user.plan === "PRO") {
      loadAiInsight(selectedYear, selectedMonth);
    } else {
      const insightBox = document.getElementById("aiInsight");
      insightBox.innerText = "PRO ?뚮옖?먯꽌 ?댁슜 媛?ν빀?덈떎.";
    }
  } catch (error) {
    if (error.message.includes("401")) {
      localStorage.removeItem("access_token");
      window.location.href = "login.html";
    }
  }
}

/* ===========================
   ?뵦 AI INSIGHT
=========================== */

async function loadAiInsight(year, month) {
  const insightBox = document.getElementById("aiInsight");
  if (!insightBox) return;

  insightBox.innerText = "AI 遺꾩꽍 ?앹꽦 以?..";

  try {
    const data = await apiRequest(
      LEDGER_BASE,
      `/dashboard/ai-insight?year=${year}&month=${month}`,
    );

    insightBox.innerText = data.ai_insight || "遺꾩꽍 寃곌낵 ?놁쓬";
  } catch {
    insightBox.innerText = "AI 遺꾩꽍 ?ㅽ뙣";
  }
}

/* ===========================
   ?뵦 理쒓렐 12媛쒖썡 李⑦듃
=========================== */

async function loadMonthlyChart() {
  try {
    const data = await apiRequest(LEDGER_BASE, `/dashboard/last-12-months`);

    renderMonthlyChart(data);
  } catch {
    console.error("최근 12개월 로딩 실패");
    renderMonthlyChart([]);
  }
}

function normalizeLast12Months(data = []) {
  const now = new Date();
  const monthMap = new Map();

  data.forEach((item) => {
    if (!item || !item.month) return;
    monthMap.set(String(item.month), Number(item.total) || 0);
  });

  const normalized = [];

  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    normalized.push({
      month: monthKey,
      total: monthMap.get(monthKey) ?? 0,
    });
  }

  return normalized;
}

function renderMonthlyChart(data) {
  const ctx = document.getElementById("monthlyChart").getContext("2d");
  const normalizedData = normalizeLast12Months(data);

  if (monthlyChart) monthlyChart.destroy();

  monthlyChart = new Chart(ctx, {
    type: "bar",

    data: {
      labels: normalizedData.map((d) => d.month.slice(5)),
      datasets: [
        {
          data: normalizedData.map((d) => d.total),
          backgroundColor: "#6366f1",
          borderRadius: 8,
          maxBarThickness: 22,
          categoryPercentage: 0.72,
          barPercentage: 0.82,
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
          grid: {
            display: false,
          },
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0,
            font: {
              size: window.innerWidth <= 520 ? 10 : 11,
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

/* ===========================
   MONTH SELECTOR
=========================== */

function initMonthSelector(){

  const yearSelect = document.getElementById("yearSelect");
  const monthSelect = document.getElementById("monthSelect");

  if(!yearSelect || !monthSelect) return;

  const now = new Date();
  const currentYear = now.getFullYear();

  /* YEAR */

  yearSelect.innerHTML="";

  for(let y=currentYear; y>=currentYear-3; y--){

    const option=document.createElement("option");

    option.value=y;
    option.textContent=`${y}??;

    if(y===selectedYear) option.selected=true;

    yearSelect.appendChild(option);

  }

  /* MONTH */

  monthSelect.innerHTML="";

  for(let m=1; m<=12; m++){

    const option=document.createElement("option");

    option.value=m;
    option.textContent=`${m}??;

    if(m===selectedMonth) option.selected=true;

    monthSelect.appendChild(option);

  }

  /* EVENTS */

  yearSelect.addEventListener("change",function(){

    selectedYear=Number(this.value);
    loadDashboard(selectedYear,selectedMonth);

  });

  monthSelect.addEventListener("change",function(){

    selectedMonth=Number(this.value);
    loadDashboard(selectedYear,selectedMonth);

  });

}

/* ===========================
   SUMMARY
=========================== */

function renderSummary(summary, plan) {
  document.getElementById("totalAmount").innerText =
    summary.total_amount.toLocaleString() + " ??;

  /* ======================
   ?덉궛 ?쒖떆
====================== */

  if (summary.budget !== undefined) {
    document.getElementById("budgetAmount").innerText =
      summary.budget.toLocaleString() + " ??;

    document.getElementById("remainingAmount").innerText =
      summary.remaining.toLocaleString() + " ??;

    let percent = 0;

    if (summary.budget > 0) {
      percent = (summary.total_amount / summary.budget) * 100;
    }

    percent = Math.min(percent, 100);

    const bar = document.getElementById("budgetProgress");

    if (bar) {
      bar.style.width = percent + "%";

      if (percent >= 100) {
        bar.style.background = "#ef4444";
      } else if (percent >= 80) {
        bar.style.background = "#f59e0b";
      } else {
        bar.style.background = "#111827";
      }
    }

    /* ?뵦 ?ш린 異붽? */

    const warning = document.getElementById("budgetWarning");

    if (warning) {
      if (percent >= 100) {
        warning.innerText = "???덉궛??珥덇낵?덉뒿?덈떎";
      } else if (percent >= 80) {
        warning.innerText = "???덉궛??80% ?댁긽 ?ъ슜?덉뒿?덈떎";
      } else {
        warning.innerText = "";
      }
    }
  }
  document.getElementById("receiptCount").innerText =
    summary.transaction_count + " 嫄?;

  document.getElementById("topCategory").innerText =
    summary.top_category?.name || "-";

  document.getElementById("predictedAmount").innerText =
    summary.predicted_total.toLocaleString() + " ??;

  document.getElementById("avgDailyText").innerText =
    `?섎（ ?됯퇏 ${summary.avg_daily_amount.toLocaleString()} ??;

  const compareEl = document.getElementById("monthCompare");

  if (plan === "PRO" && summary.diff_amount !== undefined) {
    const diff = summary.diff_amount;
    const rate = summary.change_rate;

    compareEl.className =
      "month-compare " + (diff > 0 ? "up" : diff < 0 ? "down" : "same");

    compareEl.innerText = `?꾩썡 ?鍮?${diff > 0 ? "?? : diff < 0 ? "?? : "-"} ${Math.abs(diff).toLocaleString()}??(${rate}%)`;
  }
}

/* ===========================
   CATEGORY CHART
=========================== */

function renderCategoryChart(categories) {
  const ctx = document.getElementById("categoryChart").getContext("2d");

  if (categoryChart) categoryChart.destroy();

  categoryChart = new Chart(ctx, {
    type: "doughnut",

    data: {
      labels: categories.map((c) => c.category),

      datasets: [
        {
          data: categories.map((c) => c.total_amount),
          backgroundColor: ["#6366f1", "#8b5cf6", "#3b82f6", "#10b981"],
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

/* ===========================
   DAILY CHART
=========================== */

function renderDailyChart(dailyData) {
  const ctx = document.getElementById("dailyChart").getContext("2d");

  if (dailyChart) dailyChart.destroy();

  dailyChart = new Chart(ctx, {
    type: "line",

    data: {
      labels: dailyData.map((d) => d.date),

      datasets: [
        {
          label: "???뚮퉬",
          data: dailyData.map((d) => d.total_amount),
          borderColor: "#6366f1",
          backgroundColor: "rgba(99,102,241,0.1)",
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

/* ===========================
   RECENT
=========================== */

function renderRecent(list) {
  const container = document.getElementById("recentList");
  container.innerHTML = "";

  if (!list || list.length === 0) {
    container.innerHTML = "<p>理쒓렐 嫄곕옒 ?댁뿭???놁뒿?덈떎.</p>";
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

    const date = item.occurred_at ? item.occurred_at.slice(0, 10) : "";

    div.innerHTML = `
    <span>${item.merchant_name || "?곹샇紐??놁쓬"}</span>
    <span>${item.amount.toLocaleString()} ??/span>
    <small>${date}</small>
  `;

    container.appendChild(div);
  });
}
