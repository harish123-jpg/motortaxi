/* ===================================================================
   MOTOTAXI ADMIN — app.js
   Shared shell: sidebar, topbar, theme, language, navigation.
   Every page provides <main class="main"> content; this file injects
   the sidebar + topbar around it.
   =================================================================== */

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


const NAV_ITEMS = [
  {
    section: 'nav.main',
    items: [
      { key: 'dashboard', page: '/', icon: 'dashboard', label: 'nav.dashboard' },
      { key: 'customers', page: '/users/', icon: 'customers', label: 'nav.customers' },
      { key: 'drivers', page: '/drivers/', icon: 'drivers', label: 'nav.drivers', badge: { text: '3', cls: 'amber' } },
      { key: 'rides', page: '/rides/', icon: 'rides', label: 'nav.rides' },
      { key: 'vehicles', page: '/vehicles/', icon: 'vehicles', label: 'nav.vehicles' },
    ]
  },
  {
    section: 'nav.fintech',
    items: [
      { key: 'wallets', page: '/wallets/', icon: 'wallets', label: 'nav.wallets' },
      { key: 'transactions', page: '/transactions/', icon: 'transactions', label: 'nav.transactions', badge: { text: '2', cls: 'amber' } },
      { key: 'commissions', page: '/commissions/', icon: 'commissions', label: 'nav.commissions' },
      { key: 'pricing', page: '/pricing/', icon: 'pricing', label: 'nav.pricing' },
    ]
  },
  {
    section: 'nav.system',
    items: [
      { key: 'reports', page: '/reports/', icon: 'reports', label: 'nav.reports' },
      { key: 'settings', page: '/settings/', icon: 'settings', label: 'nav.settings' },
    ]
  }
];

/* ---------- Build sidebar ---------- */
function buildSidebar(activeKey) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const t = window.MOTOTAXI_I18N.t;
  const sections = NAV_ITEMS.map(group => {
    const items = group.items.map(item => {
      const isActive = item.key === activeKey ? 'active' : '';
      const badge = item.badge ? `<span class="nav-badge ${item.badge.cls || ''}">${item.badge.text}</span>` : '';
      return `<a href="${item.page}" class="nav-item ${isActive}">
        <span class="nav-ic">${ICONS[item.icon]}</span>
        <span class="nav-label">${t(item.label)}</span>
        ${badge}
      </a>`;
    }).join('');
    return `<div class="nav-section">${t(group.section)}</div>${items}`;
  }).join('');
  sidebar.innerHTML = `
    <div class="sidebar-head">
      <div class="logo">M</div>
      <div class="brand">MOTOTAXI<small>Cameroon</small></div>
    </div>
    <nav class="sidebar-nav">
      ${sections}
    </nav>
    <div class="sidebar-foot">
      <a href="login.html" class="nav-item danger">
        <span class="nav-ic">${ICONS.logout}</span>
        <span class="nav-label">${t('nav.logout')}</span>
      </a>
    </div>
  `;
}

/* ---------- Build topbar ---------- */
function buildTopbar(currentPageName = '') {
  const topbar = document.getElementById('topbar');
  if (!topbar) return;
  const t = window.MOTOTAXI_I18N.t;
  const lang = window.MOTOTAXI_I18N.current();
  topbar.innerHTML = `
    <button class="icon-btn hamburger" id="hamburgerBtn" aria-label="Open menu">${ICONS.toggle}</button>
    <button class="icon-btn sidebar-toggle" id="sidebarToggle" aria-label="Collapse sidebar">${ICONS.toggle}</button>
    <div class="search-box">
      <span class="search-ic">${ICONS.search}</span>
      <input type="search" placeholder="${t('topbar.search')}" id="globalSearch">
    </div>
    <div class="right">
      <div class="lang-switch">
        <button data-lang="en" class="${lang === 'en' ? 'active' : ''}">EN</button>
        <button data-lang="fr" class="${lang === 'fr' ? 'active' : ''}">FR</button>
      </div>
      <button class="icon-btn" id="themeToggle" aria-label="Toggle theme">${ICONS.moon}</button>
      <div class="notif-wrap">
        <button class="icon-btn" id="notifBtn" aria-label="Notifications">
          ${ICONS.bell}
          <span class="notif-badge">4</span>
        </button>
        <div class="dropdown" id="notifDropdown">
          <div class="dropdown-head">
            <span>${t('topbar.notifications')}</span>
            <a href="#" id="notifMarkAll">Mark all read</a>
          </div>
          <div class="dropdown-list">
            ${[
              { color: 'green', t: 'Ride RIDE-50130 completed', d: 'Foko Sandrine → Talla Rodrigue — 2 050 FCFA', time: '2 min ago' },
              { color: 'amber', t: 'TXN-901248 pending', d: 'Wallet topup awaiting settlement', time: '12 min ago' },
              { color: 'blue',  t: 'New driver registration', d: 'Eyenga Yannick (Bike) awaiting approval', time: '38 min ago' },
              { color: 'red',   t: 'Ride RIDE-50136 cancelled', d: 'Driver not assigned', time: '1 h ago' },
            ].map(n => `
              <div class="dropdown-item">
                <span class="dot ${n.color}"></span>
                <div>
                  <div class="ttl">${n.t}</div>
                  <div class="desc">${n.d}</div>
                  <div class="time">${n.time}</div>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="dropdown-foot"><a href="#">${t('topbar.viewall')}</a></div>
        </div>
      </div>
      <div class="profile-wrap">
        <button class="profile-btn" id="profileBtn">
          <span class="avatar">AD</span>
          <span class="who">
            Admin Demo
            <small>${t('topbar.admin')}</small>
          </span>
          ${ICONS.chevron}
        </button>
        <div class="dropdown profile-dropdown" id="profileDropdown">
          <div class="head">
            <span class="avatar">AD</span>
            <div>
              <div class="name">Admin Demo</div>
              <div class="email">admin@mototaxi.cm</div>
            </div>
          </div>
          <a href="settings.html" class="item">${ICONS.user}<span>${t('topbar.profile')}</span></a>
          <a href="settings.html" class="item">${ICONS.settings}<span>${t('topbar.settings')}</span></a>
          <a href="login.html" class="item danger">${ICONS.logout}<span>${t('topbar.logout')}</span></a>
        </div>
      </div>
    </div>
  `;
}

/* ---------- Wire interactions ---------- */
function wireShell() {
  const app = document.getElementById('app');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const backdrop = document.getElementById('sidebarBackdrop');
  const themeToggle = document.getElementById('themeToggle');
  const notifBtn = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const profileBtn = document.getElementById('profileBtn');
  const profileDropdown = document.getElementById('profileDropdown');
  const notifMarkAll = document.getElementById('notifMarkAll');

  // Sidebar collapse (desktop)
  if (sidebarToggle) sidebarToggle.addEventListener('click', () => {
    app.classList.toggle('collapsed');
    localStorage.setItem('mototaxi.sidebar.collapsed', app.classList.contains('collapsed'));
  });

  // Mobile slide-in
  if (hamburgerBtn) hamburgerBtn.addEventListener('click', () => app.classList.add('mobile-open'));
  if (backdrop) backdrop.addEventListener('click', () => app.classList.remove('mobile-open'));

  // Restore collapsed state
  if (localStorage.getItem('mototaxi.sidebar.collapsed') === 'true') app.classList.add('collapsed');

  // Theme
  const savedTheme = localStorage.getItem('mototaxi.theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon();
  if (themeToggle) themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('mototaxi.theme', next);
    updateThemeIcon();
    if (window.MOTOTAXI_UI) window.MOTOTAXI_UI.toast('info', 'Theme changed', `Switched to ${next} mode.`);
  });

  function updateThemeIcon() {
    if (!themeToggle) return;
    const cur = document.documentElement.getAttribute('data-theme');
    themeToggle.innerHTML = cur === 'dark' ? ICONS.sun : ICONS.moon;
  }

  // Language switch
  document.querySelectorAll('.lang-switch button').forEach(btn => {
    btn.addEventListener('click', () => window.MOTOTAXI_I18N.setLang(btn.dataset.lang));
  });

  // Notifications dropdown
  if (notifBtn) notifBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDropdown.classList.toggle('open');
    profileDropdown && profileDropdown.classList.remove('open');
  });
  if (notifMarkAll) notifMarkAll.addEventListener('click', (e) => {
    e.preventDefault();
    const badge = document.querySelector('.notif-badge');
    if (badge) badge.style.display = 'none';
    if (window.MOTOTAXI_UI) window.MOTOTAXI_UI.toast('success', 'All caught up', 'Notifications marked as read.');
  });

  // Profile dropdown
  if (profileBtn) profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle('open');
    notifDropdown && notifDropdown.classList.remove('open');
  });

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.notif-wrap') && notifDropdown) notifDropdown.classList.remove('open');
    if (!e.target.closest('.profile-wrap') && profileDropdown) profileDropdown.classList.remove('open');
  });

  // Global search demo
  const globalSearch = document.getElementById('globalSearch');
  if (globalSearch) globalSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && globalSearch.value.trim()) {
      if (window.MOTOTAXI_UI) window.MOTOTAXI_UI.toast('info', 'Search', `Global search for "${globalSearch.value.trim()}" — connect to backend later.`);
    }
  });

  // Apply i18n to dynamic shell content
  window.MOTOTAXI_I18N.applyI18n();
}

/* ---------- Page bootstrapper ---------- */
function bootPage(activeKey, pageName) {
  buildSidebar(activeKey);
  buildTopbar(pageName);
  wireShell();
}
