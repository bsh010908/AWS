import { renderDashboard, afterRenderDashboard } from "./pages/dashboard.js";
import { renderReceipts, afterRenderReceipts } from "./pages/receipts.js";
import { renderUpload, afterRenderUpload } from "./pages/upload.js";
import { renderSettings } from "./pages/settings.js";
import {
  renderSubscription,
  afterRenderSubscription,
} from "./pages/subscription.js";
const routes = {
  "/dashboard": {
    render: renderDashboard,
    after: afterRenderDashboard,
  },
  "/receipts": {
    render: renderReceipts,
    after: afterRenderReceipts, // ✅ receipts도 after 추가
  },
  "/upload": {
    render: renderUpload,
    after: afterRenderUpload,
  },
  "/subscription": {
    render: renderSubscription,
    after: afterRenderSubscription,
  },
  "/settings": {
    render: renderSettings,
  },
};

export async function router() {
  const hash = location.hash.replace("#", "") || "/dashboard";
  const route = routes[hash];
  const app = document.getElementById("app-content");

  if (!route) {
    app.innerHTML = "<h2>404</h2>";
    return;
  }

  // 🔥 활성 메뉴 표시 처리 (추가 추천)
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.remove("active");
    if (link.getAttribute("href") === `#${hash}`) {
      link.classList.add("active");
    }
  });

  // 1️⃣ 화면 렌더
  app.innerHTML = await route.render();

  // 2️⃣ after 실행
  if (route.after) {
    await route.after();
  }
}
