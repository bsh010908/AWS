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
            대시보드
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
          <span>총 지출</span>
          <h2 id="totalAmount">0 원</h2>

          <div class="budget-info">
            <div>예산 <b id="budgetAmount">0 원</b></div>
            <div>남은 금액 <b id="remainingAmount">0 원</b></div>
          </div>

          <div class="budget-bar">
            <div id="budgetProgress"></div>
          </div>

          <div id="monthCompare" class="month-compare"></div>
        </div>
        <div class="kpi-card">
          <span>이번 달 영수증 수</span>
          <h2 id="receiptCount">0 건</h2>
        </div>

        <div class="kpi-card">
          <span>최대 소비 카테고리</span>
          <h2 id="topCategory">-</h2>
        </div>
      </div>

      <!-- AI 인사이트 -->
      <div class="ai-card">
        <h3>AI 소비 분석</h3>
        <p id="aiInsight">-</p>
      </div>

      <!-- 차트 영역 -->
      <div class="main-section">

        <div class="chart-card">
          <div class="chart-header">
            <h3>카테고리별 소비</h3>
          </div>
          <div class="chart-wrapper">
            <canvas id="categoryChart"></canvas>
          </div>
        </div>

        <div class="chart-card">
          <h3>일별 소비</h3>
          <div class="chart-wrapper">
            <canvas id="dailyChart"></canvas>
          </div>
        </div>

      </div>

      
      <div class="chart-card wide">
        <h3>최근 12개월 소비</h3>
        <div class="chart-wrapper">
          <canvas id="monthlyChart"></canvas>
        </div>
      </div>

      <!-- 하단 -->
      <div class="bottom-section">

        <div class="recent-card">
          <h3>최근 소비</h3>
          <div id="recentList"></div>
        </div>

        <div class="predict-card">
          <span>이번 달 예상 지출</span>
          <h2 id="predictedAmount">0 원</h2>
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

    /* 🔥 최근 12개월 그래프 */
    loadMonthlyChart();

    /* AI */
    if (user.plan === "PRO") {
      loadAiInsight(selectedYear, selectedMonth);
    } else {
      const insightBox = document.getElementById("aiInsight");
      insightBox.innerText = "PRO 플랜에서 이용 가능합니다.";
    }
  } catch (error) {
    if (error.message.includes("401")) {
      localStorage.removeItem("access_token");
      window.location.href = "login.html";
    }
  }
}

/* ===========================
   🔥 AI INSIGHT
=========================== */

async function loadAiInsight(year, month) {
  const insightBox = document.getElementById("aiInsight");
  if (!insightBox) return;

  insightBox.innerText = "AI 분석 생성 중...";

  try {
    const data = await apiRequest(
      LEDGER_BASE,
      `/dashboard/ai-insight?year=${year}&month=${month}`,
    );

    insightBox.innerText = data.ai_insight || "분석 결과 없음";
  } catch {
    insightBox.innerText = "AI 분석 실패";
  }
}

/* ===========================
   🔥 최근 12개월 차트
=========================== */

async function loadMonthlyChart() {
  try {
    const data = await apiRequest(LEDGER_BASE, `/dashboard/last-12-months`);

    renderMonthlyChart(data);
  } catch {
    console.error("최근 12개월 로딩 실패");
  }
}

function renderMonthlyChart(data) {
  const ctx = document.getElementById("monthlyChart").getContext("2d");

  if (monthlyChart) monthlyChart.destroy();

  monthlyChart = new Chart(ctx, {
    type: "bar",

    data: {
      labels: data.map((d) => d.month),
      datasets: [
        {
          data: data.map((d) => d.total),
          backgroundColor: "#6366f1",
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
    option.textContent=`${y}년`;

    if(y===selectedYear) option.selected=true;

    yearSelect.appendChild(option);

  }

  /* MONTH */

  monthSelect.innerHTML="";

  for(let m=1; m<=12; m++){

    const option=document.createElement("option");

    option.value=m;
    option.textContent=`${m}월`;

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
    summary.total_amount.toLocaleString() + " 원";

  /* ======================
   예산 표시
====================== */

  if (summary.budget !== undefined) {
    document.getElementById("budgetAmount").innerText =
      summary.budget.toLocaleString() + " 원";

    document.getElementById("remainingAmount").innerText =
      summary.remaining.toLocaleString() + " 원";

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

    /* 🔥 여기 추가 */

    const warning = document.getElementById("budgetWarning");

    if (warning) {
      if (percent >= 100) {
        warning.innerText = "⚠ 예산을 초과했습니다";
      } else if (percent >= 80) {
        warning.innerText = "⚠ 예산의 80% 이상 사용했습니다";
      } else {
        warning.innerText = "";
      }
    }
  }
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

    compareEl.innerText = `전월 대비 ${diff > 0 ? "▲" : diff < 0 ? "▼" : "-"} ${Math.abs(diff).toLocaleString()}원 (${rate}%)`;
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
          label: "일 소비",
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
    container.innerHTML = "<p>최근 거래 내역이 없습니다.</p>";
    return;
  }

  list.forEach((item) => {
    const div = document.createElement("div");

    div.className = "recent-item";

    const date = item.occurred_at ? item.occurred_at.slice(0, 10) : "";

    div.innerHTML = `
    <span>${item.merchant_name || "상호명 없음"}</span>
    <span>${item.amount.toLocaleString()} 원</span>
    <small>${date}</small>
  `;

    container.appendChild(div);
  });
}
