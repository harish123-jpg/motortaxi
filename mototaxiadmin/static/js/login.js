/* ===================================================================
   MOTOTAXI ADMIN — login.js
   Static login demo. No real authentication. The Sign In button
   shows a toast and navigates to dashboard.html after 800ms.
   =================================================================== */

(function () {
  // Apply persisted language
  window.MOTOTAXI_I18N.applyI18n();

  // Lang switch
  document.querySelectorAll('.lang-switch button').forEach(btn => {
    btn.addEventListener('click', () => window.MOTOTAXI_I18N.setLang(btn.dataset.lang));
  });

  // Theme persisted
  const savedTheme = localStorage.getItem('mototaxi.theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Password toggle
  const pw = document.getElementById('loginPassword');
  const toggle = document.getElementById('togglePw');
  if (toggle && pw) {
    toggle.addEventListener('click', () => {
      const isText = pw.type === 'text';
      pw.type = isText ? 'password' : 'text';
      document.getElementById('pwEye').innerHTML = isText
        ? '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
        : '<path d="M3 3l18 18M10 5.5A11 11 0 0 1 22 12s-4 7-10 7a10 10 0 0 1-4-.8M6 6.5A11 11 0 0 1 2 12s4 7 10 7a10 10 0 0 0 4-.8"/><path d="M9.5 9.5a3 3 0 0 0 5 5"/>';
    });
  }

  // Form submit (demo)
  const form = document.getElementById('loginForm');
  const btn = document.getElementById('loginBtn');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('loginIdentifier').value.trim();
    const pwVal = pw.value;
    if (!id || !pwVal) {
      window.MOTOTAXI_UI.toast('warning', 'Missing credentials', 'Please enter both identifier and password.');
      return;
    }
    btn.disabled = true;
    btn.innerHTML = `<span>Signing in…</span>`;
    window.MOTOTAXI_UI.toast('info', 'Demo sign-in', 'Authenticating with mock backend…');
    setTimeout(() => {
      window.MOTOTAXI_UI.toast('success', 'Welcome back', 'Redirecting to your dashboard…');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
    }, 500);
  });

  // Forgot password demo
  document.querySelector('a[data-i18n="login.forgot"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.MOTOTAXI_UI.toast('info', 'Password recovery', 'Connect this flow to your backend password-reset endpoint.');
  });

  // Contact link demo
  document.querySelector('a[data-i18n="login.contact"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.MOTOTAXI_UI.toast('info', 'Account manager', 'Reach out at support@mototaxi.cm or +237 6 90 00 00 00.');
  });
})();
