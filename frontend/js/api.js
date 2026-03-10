const AUTH_BASE = "http://43.201.103.180:8001";
const LEDGER_BASE = "http://43.201.103.180:8002";

export async function apiRequest(base, endpoint, options = {}) {
  const token = localStorage.getItem("access_token");

  const headers = {
    "Content-Type": "application/json",
    ...options.headers
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${base}${endpoint}`, {
    ...options,
    headers
  });

  // 🔐 인증 만료 처리
  if (response.status === 401) {
    localStorage.removeItem("access_token");
    window.location.href = "index.html";
    return;
  }

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.detail || "API Error");
  }

  return data;
}

export { AUTH_BASE, LEDGER_BASE };
