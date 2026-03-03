export async function renderSubscription() {
  return `
    <section class="page subscription-page">
      <h2>💎 구독 관리</h2>

      <div class="plan-card current">
        <h3>현재 플랜</h3>
        <p id="currentPlan">FREE</p>
      </div>

      <div class="plan-card">
        <h3>PRO 플랜</h3>
        <ul>
          <li>월 OCR 100회</li>
          <li>AI 자동 분류</li>
          <li>통계 고급 분석</li>
        </ul>
        <button id="upgradeBtn" class="primary-btn">
          PRO로 업그레이드
        </button>
      </div>
    </section>
  `;
}

export async function afterRenderSubscription() {
  document.getElementById("upgradeBtn").onclick = () => {
    alert("Stripe 결제 연결 예정");
  };
}