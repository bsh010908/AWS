import { router } from "./router.js";

const token = localStorage.getItem("access_token");

if (!token) {
  window.location.href = "index.html";
}

function setSidebarOpen(isOpen) {
  document.body.classList.toggle("sidebar-open", isOpen);

  const menuBtn = document.getElementById("mobileMenuBtn");
  if (menuBtn) {
    menuBtn.setAttribute("aria-expanded", String(isOpen));
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  const menuBtn = document.getElementById("mobileMenuBtn");
  const overlay = document.getElementById("sidebarOverlay");
  const navLinks = document.querySelectorAll(".nav-link");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("access_token");
      window.location.href = "index.html";
    });
  }

  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      const isOpen = document.body.classList.contains("sidebar-open");
      setSidebarOpen(!isOpen);
    });
  }

  if (overlay) {
    overlay.addEventListener("click", () => setSidebarOpen(false));
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 900) {
        setSidebarOpen(false);
      }
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) {
      setSidebarOpen(false);
    }
  });

  router();
});

window.addEventListener("hashchange", () => {
  if (window.innerWidth <= 900) {
    setSidebarOpen(false);
  }
  router();
});
