const AUTH_BASE = "http://localhost:8001";
const LEDGER_BASE = "http://localhost:8002";

export async function apiRequest(base, endpoint, options = {}) {
  const token = localStorage.getItem("token");

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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "API Error");
  }

  return data;
}

export { AUTH_BASE, LEDGER_BASE };