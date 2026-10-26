/* ===================================================================
   MOTOTAXI ADMIN — settings.js
   Five-card Settings page controller:
     1. General Application Settings (language, theme, currency, timezone)
     2. Profile Information (admin profile, change password)
     3. Notification Preferences (7 toggles persisted to localStorage)
     4. Admin Roles & Permissions (5 demo admins, edit/remove, add modal)
     5. API Configuration (placeholder secrets, copy/show/test/regen)
   =================================================================== */

(function () {
  const D = window.MOTOTAXI_DATA;
  const UI = window.MOTOTAXI_UI;
  const t = window.MOTOTAXI_I18N.t;

  // Bootstrap shared shell (sidebar + topbar + theme + i18n wiring)
  bootPage('settings', 'Settings');
  window.MOTOTAXI_I18N.applyI18n();

  /* ---------- Inline SVG icons ---------- */
  const ICONS = {
    edit:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 7l3-3 3 3-3 3M5 19l5-5 6-6 3 3-6 6-5 5"/></svg>',
    remove: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    save:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M5 13l4 4 10-10"/></svg>',
    key:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 7l3-3 3 3-3 3M5 19l5-5M14 7l-9 9M16 9l-2-2"/></svg>',
    add:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>',
    copy:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    eye:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 3l18 18M10.5 10.7a3 3 0 0 0 4 4M9.4 5.5A11 11 0 0 1 12 5c7 0 11 7 11 7a13 13 0 0 1-2.3 3M6.2 6.2A13 13 0 0 0 1 12s4 7 11 7c1.5 0 2.9-.3 4.1-.8"/></svg>',
    lock:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    bell:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M6 9a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>',
    plug:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M9 3v6M15 3v6M7 9h10v3a5 5 0 0 1-10 0V9zM12 17v4"/></svg>',
  };

  /* ============================================================
     CARD 1 — General Application Settings
     ============================================================ */

  // Persisted language preference (defaults to 'en')
  const savedLang = localStorage.getItem('mototaxi.lang') || 'en';
  document.querySelectorAll('input[data-lang-radio]').forEach(r => {
    if (r.value === savedLang) r.checked = true;
    r.addEventListener('change', () => {
      if (r.checked) {
        UI.toast('info', 'Switching language', `Reloading in ${r.value === 'fr' ? 'French' : 'English'}…`);
        // setLang persists + reloads the page so the entire shell re-renders
        setTimeout(() => window.MOTOTAXI_I18N.setLang(r.value), 300);
      }
    });
  });

  // Theme handling: 'light' | 'dark' | 'system' (persisted)
  const darkMQ = window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme(mode) {
    if (mode === 'system') {
      document.documentElement.setAttribute('data-theme', darkMQ.matches ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', mode);
    }
    // Keep the topbar toggle icon in sync (best-effort; app.js reads data-theme on click)
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      const cur = document.documentElement.getAttribute('data-theme');
      const sunIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>';
      const moonIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
      themeToggle.innerHTML = cur === 'dark' ? sunIcon : moonIcon;
    }
  }

  const savedTheme = localStorage.getItem('mototaxi.theme') || 'light';

  // Re-apply on first load: app.js sets data-theme to the saved string verbatim,
  // so if the saved mode is 'system' we have to translate it to an actual theme.
  applyTheme(savedTheme);

  document.querySelectorAll('input[data-theme-radio]').forEach(r => {
    if (r.value === savedTheme) r.checked = true;
    r.addEventListener('change', () => {
      if (!r.checked) return;
      localStorage.setItem('mototaxi.theme', r.value);
      applyTheme(r.value);
      const label = r.value === 'light' ? 'Light' : (r.value === 'dark' ? 'Dark' : 'System');
      const detail = r.value === 'system'
        ? `Following OS preference — currently ${darkMQ.matches ? 'Dark' : 'Light'}.`
        : `Theme applied across the entire admin panel.`;
      UI.toast('info', `Theme: ${label}`, detail);
    });
  });

  // Live react to OS theme changes when in System mode
  darkMQ.addEventListener('change', (e) => {
    const mode = localStorage.getItem('mototaxi.theme') || 'light';
    if (mode !== 'system') return;
    document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    UI.toast('info', 'System theme changed', `OS is now in ${e.matches ? 'Dark' : 'Light'} mode — applied automatically.`);
  });

  /* ============================================================
     CARD 2 — Profile Information
     ============================================================ */

  const btnSaveProfile = document.getElementById('btnSaveProfile');
  if (btnSaveProfile) btnSaveProfile.addEventListener('click', () => {
    const name = document.getElementById('profileName').value.trim();
    const email = document.getElementById('profileEmail').value.trim();
    const phone = document.getElementById('profilePhone').value.trim();
    if (!name || !email || !phone) {
      UI.toast('warning', 'Missing fields', 'Full name, email and phone are all required.');
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      UI.toast('error', 'Invalid email', 'Please enter a valid email address.');
      return;
    }
    UI.toast('success', 'Profile saved', `Admin profile updated for ${name}. Connect your backend to persist changes.`);
  });

  const btnChangePassword = document.getElementById('btnChangePassword');
  if (btnChangePassword) btnChangePassword.addEventListener('click', () => {
    const body = `
      <div class="form-group">
        <label>Current Password</label>
        <input class="input" type="password" id="cpOld" placeholder="Enter current password" autocomplete="current-password">
      </div>
      <div class="form-group">
        <label>New Password</label>
        <input class="input" type="password" id="cpNew" placeholder="Enter new password" autocomplete="new-password">
        <div style="font-size:11.5px;color:var(--muted);margin-top:4px;">Minimum 12 characters with letters + numbers.</div>
      </div>
      <div class="form-group">
        <label>Confirm New Password</label>
        <input class="input" type="password" id="cpConfirm" placeholder="Re-enter new password" autocomplete="new-password">
      </div>`;
    const foot = `
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="cpSubmit">Update Password</button>`;
    UI.modal({
      title: 'Change Password',
      subtitle: 'admin@mototaxi.cm',
      body,
      foot,
      size: '',
      onMount: (overlay) => {
        const submit = overlay.querySelector('#cpSubmit');
        submit.addEventListener('click', () => {
          const oldV = overlay.querySelector('#cpOld').value;
          const newV = overlay.querySelector('#cpNew').value;
          const conf = overlay.querySelector('#cpConfirm').value;
          if (!oldV || !newV || !conf) {
            UI.toast('warning', 'Missing fields', 'All three password fields are required.');
            return;
          }
          if (newV.length < 8) {
            UI.toast('error', 'Password too short', 'New password must be at least 8 characters.');
            return;
          }
          if (newV !== conf) {
            UI.toast('error', 'Passwords do not match', 'New password and confirmation must be identical.');
            return;
          }
          if (newV === oldV) {
            UI.toast('warning', 'No change', 'New password must differ from the current one.');
            return;
          }
          UI.closeAll();
          UI.toast('success', 'Password changed (demo)', 'Connect to your auth service to actually rotate credentials.');
        });
      },
    });
  });

  /* ============================================================
     CARD 3 — Notification Preferences (7 toggles)
     ============================================================ */

  const NOTIFS = [
    { key: 'email',     label: 'Email notifications',         desc: 'Receive ride summaries and commission reports by email',                def: true },
    { key: 'push',      label: 'Push notifications',          desc: 'Get instant alerts for new driver registrations and pending approvals', def: true },
    { key: 'sms',       label: 'SMS alerts',                 desc: 'Critical alerts only — failed transactions and blocked accounts',       def: false },
    { key: 'digest',    label: 'Daily revenue digest',        desc: "Email summary of yesterday's revenue at 08:00 WAT",                     def: true },
    { key: 'weekly',    label: 'Weekly commission report',   desc: 'Email commission settlement summary every Monday',                       def: true },
    { key: 'newDriver', label: 'New driver registration',    desc: 'Notify when a driver submits registration',                              def: true },
    { key: 'failedTxn', label: 'Failed transaction alert',   desc: 'Immediate alert when a transaction fails',                                def: true },
  ];

  function notifState(key, def) {
    const stored = localStorage.getItem('mototaxi.notif.' + key);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return def;
  }

  const notifBody = document.getElementById('notifBody');
  if (notifBody) {
    notifBody.innerHTML = NOTIFS.map((n, i) => {
      const on = notifState(n.key, n.def);
      const last = i === NOTIFS.length - 1;
      return `
        <div class="flex between items-center" style="padding:12px 0;${last ? '' : 'border-bottom:1px solid var(--line);'}gap:16px;">
          <div style="min-width:0;flex:1;">
            <div style="font-size:13.5px;font-weight:600;color:var(--ink);">${n.label}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;line-height:1.45;">${n.desc}</div>
          </div>
          <label class="switch" style="flex-shrink:0;">
            <input type="checkbox" data-notif-key="${n.key}" ${on ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>`;
    }).join('');

    notifBody.querySelectorAll('input[data-notif-key]').forEach(cb => {
      cb.addEventListener('change', () => {
        const key = cb.dataset.notifKey;
        const meta = NOTIFS.find(n => n.key === key);
        localStorage.setItem('mototaxi.notif.' + key, String(cb.checked));
        UI.toast(
          cb.checked ? 'success' : 'warning',
          cb.checked ? 'Notification enabled' : 'Notification disabled',
          `${meta.label} is now ${cb.checked ? 'ON' : 'OFF'}.`
        );
      });
    });
  }

  /* ============================================================
     CARD 4 — Admin Roles & Permissions (5 demo admins)
     ============================================================ */

  const ADMINS = [
    { id: 'ADM-001', name: 'Admin Demo',     role: 'Super Admin',         email: 'admin@mototaxi.cm',         lastActive: '2025-10-15 14:32', status: 'Active',    color: '' },
    { id: 'ADM-002', name: 'Sandrine K.',    role: 'Operations Manager',  email: 'sandrine.k@mototaxi.cm',   lastActive: '2025-10-15 11:18', status: 'Active',    color: 'purple' },
    { id: 'ADM-003', name: 'Patrick M.',     role: 'Finance Officer',     email: 'patrick.m@mototaxi.cm',    lastActive: '2025-10-14 16:45', status: 'Active',    color: 'blue' },
    { id: 'ADM-004', name: 'Christelle B.',  role: 'Support Agent',        email: 'christelle.b@mototaxi.cm', lastActive: '2025-10-15 09:12', status: 'Active',    color: 'amber' },
    { id: 'ADM-005', name: 'Armand N.',      role: 'Read-only Analyst',   email: 'armand.n@mototaxi.cm',     lastActive: '2025-09-30 08:00', status: 'Suspended', color: 'gray' },
  ];

  const ROLE_PERMISSIONS = {
    'Super Admin':          ['Full access to all modules including Settings, Pricing, and Admin Roles.'],
    'Operations Manager':   ['Manage drivers, vehicles, rides, and customer support tickets.'],
    'Finance Officer':      ['View transactions, manage wallets, manage commissions and pricing rules.'],
    'Support Agent':        ['View-only access to rides and customers; resolve support tickets.'],
    'Read-only Analyst':    ['Read-only access to dashboard, reports and analytics.'],
  };

  function adminRow(a) {
    const initials = UI.initials(a.name);
    const statusBadge = a.status === 'Active'
      ? '<span class="badge badge-success">Active</span>'
      : '<span class="badge badge-muted">Suspended</span>';
    return `
      <tr data-admin-id="${a.id}">
        <td>
          <div class="cell-user">
            <span class="avatar ${a.color}">${initials}</span>
            <div>
              <div class="name">${a.name}</div>
              <div class="sub">${a.id}</div>
            </div>
          </div>
        </td>
        <td><span class="tag">${a.role}</span></td>
        <td><a href="mailto:${a.email}" class="text-brand" style="font-weight:600;">${a.email}</a></td>
        <td class="tabular">${a.lastActive}</td>
        <td>${statusBadge}</td>
        <td>
          <div class="actions">
            <button class="row-btn" data-edit-admin="${a.id}" aria-label="Edit admin">${ICONS.edit}</button>
            <button class="row-btn danger" data-remove-admin="${a.id}" aria-label="Remove admin">${ICONS.remove}</button>
          </div>
        </td>
      </tr>`;
  }

  function renderAdmins() {
    const body = document.getElementById('adminsBody');
    if (!body) return;
    body.innerHTML = ADMINS.map(adminRow).join('');

    body.querySelectorAll('[data-edit-admin]').forEach(btn => {
      btn.addEventListener('click', () => openAdminModal(btn.dataset.editAdmin, true));
    });
    body.querySelectorAll('[data-remove-admin]').forEach(btn => {
      btn.addEventListener('click', () => removeAdmin(btn.dataset.removeAdmin));
    });
  }

  function openAdminModal(id, isEdit) {
    const admin = ADMINS.find(a => a.id === id) || ADMINS[0];
    const title = isEdit ? 'Edit Admin' : 'Add Admin';
    const subtitle = isEdit ? `${admin.name} · ${admin.id}` : 'Create a new admin user — demo only';
    const permBoxes = [
      'View Dashboard',
      'Manage Customers',
      'Manage Drivers',
      'Manage Vehicles',
      'Manage Wallets',
      'View Transactions',
      'Manage Pricing',
      'Export Reports',
    ];
    const body = `
      <div class="form-group">
        <label>Full Name</label>
        <input class="input" type="text" id="aaName" value="${isEdit ? admin.name : ''}" placeholder="Jean-Pierre Kamga">
      </div>
      <div class="form-group">
        <label>Email</label>
        <input class="input" type="email" id="aaEmail" value="${isEdit ? admin.email : ''}" placeholder="jp.kamga@mototaxi.cm">
      </div>
      <div class="form-group">
        <label>Role</label>
        <select class="select" id="aaRole">
          ${['Super Admin', 'Operations Manager', 'Finance Officer', 'Support Agent', 'Read-only Analyst'].map(r => `
            <option value="${r}" ${isEdit && admin.role === r ? 'selected' : ''}>${r}</option>
          `).join('')}
        </select>
        <div style="font-size:11.5px;color:var(--muted);margin-top:4px;" id="aaRoleHint"></div>
      </div>
      <div class="divider"></div>
      <div class="form-group">
        <label>Permissions</label>
        <div class="flex gap-12" style="flex-wrap:wrap;row-gap:8px;">
          ${permBoxes.map(p => `
            <label class="checkbox"><input type="checkbox" data-perm="${p}" ${isEdit ? 'checked' : ''}> ${p}</label>
          `).join('')}
        </div>
        <div style="font-size:11.5px;color:var(--muted);margin-top:6px;">Granular permissions are illustrative — your backend will enforce them.</div>
      </div>`;
    const foot = `
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="aaSubmit">${isEdit ? 'Save Changes' : 'Create Admin'}</button>`;

    UI.modal({
      title,
      subtitle,
      body,
      foot,
      size: '',
      onMount: (overlay) => {
        const roleSel = overlay.querySelector('#aaRole');
        const hint = overlay.querySelector('#aaRoleHint');
        const updateHint = () => {
          const r = roleSel.value;
          hint.textContent = ROLE_PERMISSIONS[r] ? ROLE_PERMISSIONS[r][0] : '';
        };
        updateHint();
        roleSel.addEventListener('change', updateHint);

        overlay.querySelector('#aaSubmit').addEventListener('click', () => {
          const name = overlay.querySelector('#aaName').value.trim();
          const email = overlay.querySelector('#aaEmail').value.trim();
          if (!name || !email) {
            UI.toast('warning', 'Missing fields', 'Full name and email are required.');
            return;
          }
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            UI.toast('error', 'Invalid email', 'Please enter a valid email address.');
            return;
          }
          UI.closeAll();
          UI.toast(
            'success',
            isEdit ? 'Admin updated (demo)' : 'Admin created (demo)',
            `${name} — ${roleSel.value}. Connect your backend to persist admin users.`
          );
        });
      },
    });
  }

  function removeAdmin(id) {
    const admin = ADMINS.find(a => a.id === id);
    if (!admin) return;
    UI.confirm({
      title: 'Remove admin',
      message: `Are you sure you want to remove <strong>${admin.name}</strong> (${admin.role})? This will revoke their access immediately. This is a demo action — no real account is affected.`,
      confirmText: 'Remove',
      danger: true,
    }).then(ok => {
      if (ok) UI.toast('warning', 'Admin removed (demo)', `${admin.name} has been removed from the admin list. Connect your backend to actually revoke access.`);
    });
  }

  const btnAddAdmin = document.getElementById('btnAddAdmin');
  if (btnAddAdmin) btnAddAdmin.addEventListener('click', () => openAdminModal(null, false));

  renderAdmins();

  /* ============================================================
     CARD 5 — API Configuration
     ============================================================ */

  // Test Connection
  const btnTestConn = document.getElementById('btnTestConn');
  if (btnTestConn) btnTestConn.addEventListener('click', () => {
    const url = document.getElementById('apiBaseUrl').value.trim();
    if (!url) {
      UI.toast('warning', 'Missing URL', 'Please enter the API base URL first.');
      return;
    }
    try { new URL(url); } catch {
      UI.toast('error', 'Invalid URL', 'Please enter a valid absolute URL.');
      return;
    }
    btnTestConn.disabled = true;
    btnTestConn.textContent = 'Testing…';
    setTimeout(() => {
      btnTestConn.disabled = false;
      btnTestConn.textContent = 'Test Connection';
      UI.toast('info', 'Connection test', 'Connection test is a backend action — connect your API to perform a real ping.');
    }, 600);
  });

  // Show / Hide API Key
  const btnToggleApiKey = document.getElementById('btnToggleApiKey');
  const apiKeyInput = document.getElementById('apiKey');
  if (btnToggleApiKey && apiKeyInput) {
    // Render the button label/icon based on whether the field is currently hidden (password type)
    const refreshToggleLabel = () => {
      const hidden = apiKeyInput.type === 'password';
      btnToggleApiKey.innerHTML = (hidden ? ICONS.eye : ICONS.eyeOff) +
        '<span style="margin-left:6px;">' + (hidden ? 'Show' : 'Hide') + '</span>';
    };
    btnToggleApiKey.addEventListener('click', () => {
      apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
      refreshToggleLabel();
    });
    refreshToggleLabel();
  }

  // Copy helper with fallback to execCommand
  function copyToClipboard(text, label) {
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) UI.toast('success', 'Copied to clipboard', `${label} copied — paste it carefully.`);
        else UI.toast('error', 'Copy failed', 'Clipboard not available. Copy the value manually.');
      } catch (e) {
        UI.toast('error', 'Copy failed', 'Clipboard not available. Copy the value manually.');
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => UI.toast('success', 'Copied to clipboard', `${label} copied — paste it carefully.`))
        .catch(fallback);
    } else {
      fallback();
    }
  }

  const btnCopyApiKey = document.getElementById('btnCopyApiKey');
  if (btnCopyApiKey) btnCopyApiKey.addEventListener('click', () => {
    const v = apiKeyInput.value;
    copyToClipboard(v, 'API Key');
  });

  // Webhook Secret — show/hide handled by input type=password default; copy button
  const webhookSecretInput = document.getElementById('webhookSecret');
  const btnCopyWebhookSecret = document.getElementById('btnCopyWebhookSecret');
  if (btnCopyWebhookSecret) btnCopyWebhookSecret.addEventListener('click', () => {
    copyToClipboard(webhookSecretInput.value, 'Webhook Secret');
  });

  // Regenerate API Key — confirm + toast
  const btnRegenKey = document.getElementById('btnRegenKey');
  if (btnRegenKey) btnRegenKey.addEventListener('click', () => {
    UI.confirm({
      title: 'Regenerate API Key',
      message: 'Regenerating the API key will invalidate the current key immediately. Any service using the old key will stop working until updated. Continue?',
      confirmText: 'Regenerate',
      danger: true,
    }).then(ok => {
      if (ok) {
        // Rotate the masked placeholder to mimic regeneration
        const chars = '0123456789abcdef';
        let masked = 'sk_live_';
        for (let i = 0; i < 16; i++) masked += chars[Math.floor(Math.random() * chars.length)];
        apiKeyInput.value = masked + '••••••••••••••••';
        UI.toast('success', 'API key regenerated (demo)', 'Replace with your backend regeneration flow. The masked value here is just a placeholder.');
      }
    });
  });

  // Save Configuration
  const btnSaveConfig = document.getElementById('btnSaveConfig');
  if (btnSaveConfig) btnSaveConfig.addEventListener('click', () => {
    const url = document.getElementById('apiBaseUrl').value.trim();
    const webhook = document.getElementById('webhookUrl').value.trim();
    const rate = document.getElementById('rateLimit').value;
    const env = document.getElementById('environment').value;
    if (!url || !webhook) {
      UI.toast('warning', 'Missing fields', 'API Base URL and Webhook URL are required.');
      return;
    }
    if (Number(rate) <= 0) {
      UI.toast('warning', 'Invalid rate limit', 'Rate limit must be greater than 0 req/min.');
      return;
    }
    UI.toast('success', 'Configuration saved (demo)', `Environment: ${env} · Rate limit: ${rate} req/min. Connect your backend to persist these settings.`);
  });

  /* ============================================================
     PAGE ACTION — Save All Changes
     ============================================================ */

  const btnSaveAll = document.getElementById('btnSaveAll');
  if (btnSaveAll) btnSaveAll.addEventListener('click', () => {
    // Persist notification prefs + theme + (demo) profile are already saved on change.
    // The page-level Save All is a single confirmation across all cards.
    UI.toast('success', 'Settings saved to demo state', 'All preferences (language, theme, profile, notifications, admin roles, API config) have been staged in the demo state — connect your backend to persist.');
  });

})();
