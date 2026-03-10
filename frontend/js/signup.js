document
  .getElementById("signupForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault(); // 🔥 기본 새로고침 막기 (핵심)

    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const name = document.getElementById("name").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !email || !name || !password) {
      alert("모든 항목을 입력하세요.");
      return;
    }

    try {
      const res = await fetch("http://54.180.56.115:8001/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          name,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "회원가입 실패");
        return;
      }

      alert("회원가입 성공!");
      window.location.href = "index.html";
    } catch (err) {
      alert("서버 연결 실패");
    }
  });