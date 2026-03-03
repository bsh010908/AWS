import { router } from "./router.js";

// 🔐 로그인 체크
const token = localStorage.getItem("access_token");

if (!token) {
  window.location.href = "login.html";
}

// DOM이 완전히 로드된 뒤 실행
window.addEventListener("DOMContentLoaded", () => {

  // 로그아웃 버튼 안전 처리
  const logoutBtn = document.getElementById("logoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("access_token");
      window.location.href = "index.html";
    });
  }

  // SPA 라우터 실행
  router();
});

// 해시 변경 시 라우터 실행
window.addEventListener("hashchange", router);