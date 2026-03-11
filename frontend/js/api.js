const API_BASE = "https://y1g931km59.execute-api.ap-northeast-2.amazonaws.com";

const AUTH_BASE = API_BASE;
const LEDGER_BASE = API_BASE;

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