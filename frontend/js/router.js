import { renderDashboard, afterRenderDashboard } from "./pages/dashboard.js";
import { renderReceipts } from "./pages/receipts.js";
import { renderUpload } from "./pages/upload.js";
import { renderSettings } from "./pages/settings.js";

const routes = {
  "/dashboard": {
    render: renderDashboard,
    after: afterRenderDashboard
  },
  "/receipts": {
    render: renderReceipts
  },
  "/upload": {
    render: renderUpload
  },
  "/settings": {
    render: renderSettings
  }
};

export async function router() {
  const hash = location.hash.replace("#", "") || "/dashboard";
  const route = routes[hash];
  const app = document.getElementById("app-content");

  if (!route) {
    app.innerHTML = "<h2>404</h2>";
    return;
  }

  // 1️⃣ 화면 먼저 렌더
  app.innerHTML = await route.render();

  // 2️⃣ 렌더 이후 실행 함수 있으면 실행
  if (route.after) {
    await route.after();
  }
}