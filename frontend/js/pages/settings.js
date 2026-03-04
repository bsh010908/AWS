export async function renderSettings() {

  return `
  <div class="settings-page">

    <h2 class="page-title">설정</h2>

    <div class="settings-grid">

      <div class="settings-card">
        <h3>계정</h3>
        <p>이메일</p>
        <input type="text" value="user@email.com" disabled />

        <p>비밀번호 변경</p>
        <button class="btn-main">비밀번호 변경</button>
      </div>

      <div class="settings-card">
        <h3>구독</h3>
        <p>현재 플랜</p>
        <strong id="planInfo">FREE</strong>

        <button class="btn-main">구독 관리</button>
      </div>

      <div class="settings-card">
        <h3>AI 설정</h3>

        <label>
          AI 자동 분류
          <input type="checkbox" checked />
        </label>

        <p>신뢰도 기준</p>
        <input type="number" step="0.1" value="0.7" />
      </div>

      <div class="settings-card">
        <h3>데이터</h3>

        <button class="btn-sub">CSV 다운로드</button>
        <button class="btn-danger">모든 거래 삭제</button>
      </div>

    </div>

  </div>
  `;
}