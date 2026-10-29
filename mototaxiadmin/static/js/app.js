
/* ===================================================================
   MOTOTAXI ADMIN — app.js
   Shared shell: sidebar, topbar, theme, language, navigation.
   =================================================================== */

/* ---------- Configuration ---------- */

const DEFAULT_URLS = {
  dashboard: "/",
  customers: "/users/",
  drivers: "/drivers/",
  rides: "/rides/",
  vehicles: "/vehicles/",
  wallets: "/wallets/",
  transactions: "/transactions/",
  commissions: "/commissions/",
  pricing: "/pricing/",
  reports: "/reports/",
  settings: "/settings/",
  logout: "/logout/",
  login: "/login/",
};

const MOTOTAXI_CONFIG = {
  urls: window.MOTOTAXI_URLS || {},
  user: window.MOTOTAXI_USER || {},
};

function getAppUrl(key) {
  return MOTOTAXI_CONFIG.urls[key] || DEFAULT_URLS[key] || "/";
}

function getCookie(name) {
  const cookies = document.cookie ? document.cookie.split(";") : [];

  for (const cookie of cookies) {
    const item = cookie.trim();

    if (item.startsWith(`${name}=`)) {
      return decodeURIComponent(item.substring(name.length + 1));
    }
  }

  return null;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });
}

function showToast(type, title, message) {
  if (window.MOTOTAXI_UI?.toast) {
    window.MOTOTAXI_UI.toast(type, title, message);
  }
}

/* ---------- Inline SVG icons ---------- */

const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',

  customers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M22 19c0-2.5-2-4-4.5-4"/></svg>',

  drivers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 5h10l4 5-2 5H4l-2-5 4-5z"/><circle cx="7" cy="15" r="1.5"/><circle cx="15" cy="15" r="1.5"/></svg>',

  rides: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6h7a3 3 0 0 1 3 3v6"/></svg>',

  vehicles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 13l2-6a3 3 0 0 1 3-2h8a3 3 0 0 1 3 2l2 6v5h-2v-2H5v2H3z"/><circle cx="7" cy="16" r="1.2"/><circle cx="17" cy="16" r="1.2"/></svg>',

  wallets: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="17" cy="14" r="1.2"/></svg>',

  transactions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h13l-3-3M20 17H7l3 3"/></svg>',

  commissions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M6 6h8a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h8"/></svg>',

  pricing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 1 18 0 9 9 0 0 1-18 0z"/><path d="M12 8v8M9 11h5a1.5 1.5 0 0 0 0-3H10a1.5 1.5 0 0 1 0-3h5"/></svg>',

  reports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h12l4 4v12H4z"/><path d="M8 16v-4M12 16v-7M16 16v-3"/></svg>',

  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>',

  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M16 17l5-5-5-5M21 12H9"/></svg>',

  toggle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',

  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg>',

  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>',

  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',

  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>',

  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>',

  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>',

  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/></svg>',
};

/* ---------- Navigation ---------- */

const NAV_ITEMS = [
  {
    section: "nav.main",
    items: [
      { key: "dashboard", urlKey: "dashboard", icon: "dashboard", label: "nav.dashboard" },
      { key: "customers", urlKey: "customers", icon: "customers", label: "nav.customers" },
      { key: "drivers", urlKey: "drivers", icon: "drivers", label: "nav.drivers" },
      { key: "rides", urlKey: "rides", icon: "rides", label: "nav.rides" },
      { key: "vehicles", urlKey: "vehicles", icon: "vehicles", label: "nav.vehicles" },
    ],
  },
  {
    section: "nav.fintech",
    items: [
      { key: "wallets", urlKey: "wallets", icon: "wallets", label: "nav.wallets" },
      { key: "transactions", urlKey: "transactions", icon: "transactions", label: "nav.transactions" },
      { key: "commissions", urlKey: "commissions", icon: "commissions", label: "nav.commissions" },
      { key: "pricing", urlKey: "pricing", icon: "pricing", label: "nav.pricing" },
    ],
  },
  {
    section: "nav.system",
    items: [
      { key: "reports", urlKey: "reports", icon: "reports", label: "nav.reports" },
      { key: "settings", urlKey: "settings", icon: "settings", label: "nav.settings" },
    ],
  },
];

/* ---------- POST logout: preserves the existing link UI ---------- */

function submitLogout() {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = getAppUrl("logout");
  form.style.display = "none";

  const csrfToken = getCookie("csrftoken");

  if (csrfToken) {
    const csrfInput = document.createElement("input");
    csrfInput.type = "hidden";
    csrfInput.name = "csrfmiddlewaretoken";
    csrfInput.value = csrfToken;
    form.appendChild(csrfInput);
  }

  document.body.appendChild(form);
  form.submit();
}

function wireLogoutLinks() {
  const logoutLinks = [
    document.getElementById("sidebarLogout"),
    document.getElementById("topbarLogout"),
  ];

  logoutLinks.forEach((link) => {
    if (!link) return;

    link.addEventListener("click", (event) => {
      event.preventDefault();
      submitLogout();
    });
  });
}

/* ---------- Build sidebar ---------- */

function buildSidebar(activeKey) {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar || !window.MOTOTAXI_I18N) return;

  const t = window.MOTOTAXI_I18N.t;

  const sections = NAV_ITEMS.map((group) => {
    const items = group.items.map((item) => {
      const isActive = item.key === activeKey ? "active" : "";
      const badge = item.badge
        ? `<span class="nav-badge ${item.badge.cls || ""}">${item.badge.text}</span>`
        : "";

      return `
        <a href="${getAppUrl(item.urlKey)}" class="nav-item ${isActive}">
          <span class="nav-ic">${ICONS[item.icon]}</span>
          <span class="nav-label">${t(item.label)}</span>
          ${badge}
        </a>
      `;
    }).join("");

    return `<div class="nav-section">${t(group.section)}</div>${items}`;
  }).join("");

  sidebar.innerHTML = `
    <div class="sidebar-head">
      <div class="logo">M</div>
      <div class="brand">MOTOTAXI<small>Cameroon</small></div>
    </div>

    <nav class="sidebar-nav">${sections}</nav>

    <div class="sidebar-foot">
      <a href="${getAppUrl("logout")}" class="nav-item danger" id="sidebarLogout">
        <span class="nav-ic">${ICONS.logout}</span>
        <span class="nav-label">${t("nav.logout")}</span>
      </a>
    </div>
  `;
}

/* ---------- Build topbar ---------- */

function buildTopbar(currentPageName = "") {
  const topbar = document.getElementById("topbar");
  if (!topbar || !window.MOTOTAXI_I18N) return;

  const t = window.MOTOTAXI_I18N.t;
  const lang = window.MOTOTAXI_I18N.current();
  const user = MOTOTAXI_CONFIG.user || {};

  const fullName = user.full_name || user.name || "Admin";
  const email = user.email || "";
  const initials = getInitials(fullName);

  topbar.innerHTML = `
    <button class="icon-btn hamburger" id="hamburgerBtn" aria-label="Open menu">
      ${ICONS.toggle}
    </button>

    <button class="icon-btn sidebar-toggle" id="sidebarToggle" aria-label="Collapse sidebar">
      ${ICONS.toggle}
    </button>

    <div class="search-box">
      <span class="search-ic">${ICONS.search}</span>
      <input type="search" placeholder="${escapeHTML(t("topbar.search"))}" id="globalSearch">
    </div>

    <div class="right">
      <div class="lang-switch">
        <button data-lang="en" class="${lang === "en" ? "active" : ""}">EN</button>
        <button data-lang="fr" class="${lang === "fr" ? "active" : ""}">FR</button>
      </div>

      <button class="icon-btn" id="themeToggle" aria-label="Toggle theme">
        ${ICONS.moon}
      </button>

      <div class="notif-wrap">
        <button class="icon-btn" id="notifBtn" aria-label="Notifications">
          ${ICONS.bell}
          <span class="notif-badge">4</span>
        </button>

        <div class="dropdown" id="notifDropdown">
          <div class="dropdown-head">
            <span>${escapeHTML(t("topbar.notifications"))}</span>
            <a href="#" id="notifMarkAll">Mark all read</a>
          </div>

          <div class="dropdown-list">
            ${[
              {
                color: "green",
                title: "Ride completed",
                description: "A ride has been completed.",
                time: "Recently",
              },
              {
                color: "amber",
                title: "Transaction pending",
                description: "A transaction may require attention.",
                time: "Recently",
              },
              {
                color: "blue",
                title: "Driver registration",
                description: "A new driver registration may need review.",
                time: "Recently",
              },
              {
                color: "red",
                title: "Ride cancelled",
                description: "A ride has been cancelled.",
                time: "Recently",
              },
            ].map((notification) => `
              <div class="dropdown-item">
                <span class="dot ${notification.color}"></span>
                <div>
                  <div class="ttl">${escapeHTML(notification.title)}</div>
                  <div class="desc">${escapeHTML(notification.description)}</div>
                  <div class="time">${escapeHTML(notification.time)}</div>
                </div>
              </div>
            `).join("")}
          </div>

          <div class="dropdown-foot">
            <a href="${getAppUrl("reports")}">${escapeHTML(t("topbar.viewall"))}</a>
          </div>
        </div>
      </div>

      <div class="profile-wrap">
        <button class="profile-btn" id="profileBtn">
          <span class="avatar">${escapeHTML(initials)}</span>
          <span class="who">
            ${escapeHTML(fullName)}
            <small>${escapeHTML(t("topbar.admin"))}</small>
          </span>
          ${ICONS.chevron}
        </button>

        <div class="dropdown profile-dropdown" id="profileDropdown">
          <div class="head">
            <span class="avatar">${escapeHTML(initials)}</span>
            <div>
              <div class="name">${escapeHTML(fullName)}</div>
              <div class="email">${escapeHTML(email)}</div>
            </div>
          </div>

          <a href="${getAppUrl("settings")}" class="item">
            ${ICONS.user}
            <span>${escapeHTML(t("topbar.profile"))}</span>
          </a>

          <a href="${getAppUrl("settings")}" class="item">
            ${ICONS.settings}
            <span>${escapeHTML(t("topbar.settings"))}</span>
          </a>

          <a href="${getAppUrl("logout")}" class="item danger" id="topbarLogout">
            ${ICONS.logout}
            <span>${escapeHTML(t("topbar.logout"))}</span>
          </a>
        </div>
      </div>
    </div>
  `;
}

function getInitials(name) {
  const parts = String(name || "Admin")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "AD";

  return parts.slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

/* ---------- Theme ---------- */

function applyTheme(theme, persist = true) {
  if (!["light", "dark", "system"].includes(theme)) {
    theme = "light";
  }

  const root = document.documentElement;
  root.setAttribute("data-theme", theme);

  const resolvedTheme = theme === "system"
    ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;

  root.setAttribute("data-theme-resolved", resolvedTheme);

  if (persist) {
    try {
      localStorage.setItem("mototaxi.theme", theme);
    } catch (error) {
      console.warn("Unable to save theme preference.", error);
    }

    document.cookie =
      `mototaxi_theme=${encodeURIComponent(theme)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }

  updateThemeIcon();

  document.querySelectorAll('[data-theme-radio], input[name="theme"]').forEach((input) => {
    input.checked = input.value === theme;
  });
}

function updateThemeIcon() {
  const themeToggle = document.getElementById("themeToggle");
  if (!themeToggle) return;

  const theme = document.documentElement.getAttribute("data-theme-resolved") ||
    document.documentElement.getAttribute("data-theme");

  themeToggle.innerHTML = theme === "dark" ? ICONS.sun : ICONS.moon;
}

function getSavedTheme() {
  const cookieTheme = getCookie("mototaxi_theme");

  if (["light", "dark", "system"].includes(cookieTheme)) {
    return cookieTheme;
  }

  try {
    const storedTheme = localStorage.getItem("mototaxi.theme");

    if (["light", "dark", "system"].includes(storedTheme)) {
      return storedTheme;
    }
  } catch (error) {
    console.warn("Unable to read saved theme.", error);
  }

  return "light";
}

/* ---------- Wire interactions ---------- */

function wireShell() {
  const app = document.getElementById("app");
  const sidebarToggle = document.getElementById("sidebarToggle");
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  const backdrop = document.getElementById("sidebarBackdrop");
  const themeToggle = document.getElementById("themeToggle");
  const notifBtn = document.getElementById("notifBtn");
  const notifDropdown = document.getElementById("notifDropdown");
  const profileBtn = document.getElementById("profileBtn");
  const profileDropdown = document.getElementById("profileDropdown");
  const notifMarkAll = document.getElementById("notifMarkAll");

  /* Sidebar collapse */

  if (sidebarToggle && app) {
    sidebarToggle.addEventListener("click", () => {
      app.classList.toggle("collapsed");

      try {
        localStorage.setItem(
          "mototaxi.sidebar.collapsed",
          app.classList.contains("collapsed") ? "true" : "false"
        );
      } catch (error) {
        console.warn("Unable to save sidebar state.", error);
      }
    });
  }

  /* Mobile sidebar */

  if (hamburgerBtn && app) {
    hamburgerBtn.addEventListener("click", () => {
      app.classList.add("mobile-open");
    });
  }

  if (backdrop && app) {
    backdrop.addEventListener("click", () => {
      app.classList.remove("mobile-open");
    });
  }

  /* Restore sidebar state */

  if (app) {
    try {
      if (localStorage.getItem("mototaxi.sidebar.collapsed") === "true") {
        app.classList.add("collapsed");
      }
    } catch (error) {
      console.warn("Unable to restore sidebar state.", error);
    }
  }

  /* Theme toggle */

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme-resolved") ||
        document.documentElement.getAttribute("data-theme") ||
        "light";

      const next = current === "dark" ? "light" : "dark";

      applyTheme(next, true);

      showToast("info", "Theme changed", `Switched to ${next} mode.`);
    });
  }

  /* Language switch */

  document.querySelectorAll(".lang-switch button").forEach((button) => {
    button.addEventListener("click", () => {
      const language = button.dataset.lang;

      if (["en", "fr"].includes(language) && window.MOTOTAXI_I18N?.setLang) {
        window.MOTOTAXI_I18N.setLang(language);
      }
    });
  });

  /* Notifications dropdown */

  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener("click", (event) => {
      event.stopPropagation();

      notifDropdown.classList.toggle("open");
      profileDropdown?.classList.remove("open");
    });
  }

  if (notifMarkAll) {
    notifMarkAll.addEventListener("click", (event) => {
      event.preventDefault();

      const badge = document.querySelector(".notif-badge");

      if (badge) {
        badge.style.display = "none";
      }

      showToast("success", "Notifications", "Notification indicator cleared.");
    });
  }

  /* Profile dropdown */

  if (profileBtn && profileDropdown) {
    profileBtn.addEventListener("click", (event) => {
      event.stopPropagation();

      profileDropdown.classList.toggle("open");
      notifDropdown?.classList.remove("open");
    });
  }

  /* Close dropdowns on outside click */

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".notif-wrap") && notifDropdown) {
      notifDropdown.classList.remove("open");
    }

    if (!event.target.closest(".profile-wrap") && profileDropdown) {
      profileDropdown.classList.remove("open");
    }
  });

  /* Global search */

  const globalSearch = document.getElementById("globalSearch");

  if (globalSearch) {
    globalSearch.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;

      const query = globalSearch.value.trim();
      if (!query) return;

      const searchUrl = MOTOTAXI_CONFIG.urls.search;

      if (searchUrl) {
        const separator = searchUrl.includes("?") ? "&" : "?";

        window.location.href =
          `${searchUrl}${separator}q=${encodeURIComponent(query)}`;
      } else {
        showToast(
          "info",
          "Search",
          "Global search is not connected to a backend endpoint yet."
        );
      }
    });
  }

  /* IMPORTANT: bind logout handlers after topbar/sidebar are rendered */

  wireLogoutLinks();

  /* Apply translations */

  if (window.MOTOTAXI_I18N?.applyI18n) {
    window.MOTOTAXI_I18N.applyI18n();
  }
}

/* ---------- Page bootstrapper ---------- */

function bootPage(activeKey, pageName = "") {
  buildSidebar(activeKey);
  buildTopbar(pageName);
  wireShell();
}

/* ---------- Initialize ---------- */

(function initializeMotoTaxiShell() {
  applyTheme(getSavedTheme(), false);

  if (window.matchMedia) {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemTheme = () => {
      if (document.documentElement.getAttribute("data-theme") === "system") {
        applyTheme("system", false);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleSystemTheme);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleSystemTheme);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const main = document.querySelector("main.main");

    if (!main) return;

    const activeKey = main.dataset.activePage;
    const pageName = main.dataset.pageName || "";

    if (activeKey && !document.getElementById("sidebar")?.children.length) {
      bootPage(activeKey, pageName);
    }
  });
})();
