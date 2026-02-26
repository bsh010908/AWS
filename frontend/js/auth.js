document.getElementById("loginForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
      alert("아이디와 비밀번호를 입력하세요.");
      return;
    }

    try {
      const res = await fetch("http://localhost:8001/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "로그인 실패");
        return;
      }

      localStorage.setItem("token", data.access_token);
      window.location.href = "dashboard.html";

    } catch (err) {
      alert("서버 연결 실패");
    }
  });

document.getElementById("goSignupBtn")
  .addEventListener("click", () => {
    window.location.href = "signup.html";
  });