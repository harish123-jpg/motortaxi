
/* ===================================================================
   MOTOTAXI ADMIN — settings.js
   Settings page controller:
   1. General settings: language, theme, currency, timezone
   2. Profile information and password change
   3. Notification preferences (local browser storage)
   4. Admin accounts (read-only unless backend endpoints are added)
   5. API configuration (not persisted without a secure backend)
   =================================================================== */

(function () {
  "use strict";

  const D = window.MOTOTAXI_DATA || {};
  const UI = window.MOTOTAXI_UI;
  const I18N = window.MOTOTAXI_I18N;

  if (typeof window.bootPage === "function") {
    window.bootPage("settings", "Settings");
  }

  if (I18N && typeof I18N.applyI18n === "function") {
    I18N.applyI18n();
  }

  const SETTINGS_URLS = window.MOTOTAXI_SETTINGS_URLS || {
    save: "",
    changePassword: ""
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  function toast(type, title, message) {
    if (UI && typeof UI.toast === "function") {
      UI.toast(type, title, message);
    } else {
      window.alert(title + (message ? "\n" + message : ""));
    }
  }

  function safeStorageGet(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function safeStorageSet(key, value) {
    try {
      localStorage.setItem(key, String(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function getCookie(name) {
    const prefix = name + "=";
    const cookie = document.cookie
      .split(";")
      .map(value => value.trim())
      .find(value => value.startsWith(prefix));

    return cookie
      ? decodeURIComponent(cookie.substring(prefix.length))
      : "";
  }

  function getCSRFToken() {
    return (
      $('input[name="csrfmiddlewaretoken"]')?.value ||
      getCookie("csrftoken")
    );
  }

  function getSaveURL() {
    return (
      SETTINGS_URLS.save ||
      $("form[data-settings-save-url]")?.dataset.settingsSaveUrl ||
      ""
    );
  }

  async function postForm(url, formData) {
    if (!url) {
      throw new Error(
        "Settings save URL is missing. Configure MOTOTAXI_SETTINGS_URLS.save in settings.html."
      );
    }

    const token = getCSRFToken();

    const response = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "X-CSRFToken": token,
        "X-Requested-With": "XMLHttpRequest"
      },
      body: formData
    });

    if (response.redirected) {
      window.location.assign(response.url);
      return null;
    }

    if (!response.ok) {
      throw new Error(
        "Unable to save settings. Please check the form and try again."
      );
    }

    return response;
  }

  /* ============================================================
     CARD 1 — General Application Settings
     ============================================================ */

  const darkMQ = window.matchMedia("(prefers-color-scheme: dark)");

  function applyTheme(mode) {
    const theme = mode === "system"
      ? (darkMQ.matches ? "dark" : "light")
      : mode;

    document.documentElement.setAttribute("data-theme", theme);

    const toggle = document.getElementById("themeToggle");

    if (toggle) {
      const isDark = theme === "dark";

      toggle.setAttribute(
        "aria-label",
        isDark ? "Switch to light theme" : "Switch to dark theme"
      );
    }
  }

  function selectedTheme() {
    return (
      $('input[name="theme"]:checked')?.value ||
      $('input[data-theme-radio]:checked')?.value ||
      safeStorageGet("mototaxi.theme", "light")
    );
  }

  function selectedLanguage() {
    return (
      $('input[name="language"]:checked')?.value ||
      $('input[data-lang-radio]:checked')?.value ||
      safeStorageGet("mototaxi.lang", "en")
    );
  }

  const initialTheme = selectedTheme();
  applyTheme(initialTheme);

  // Support both the original HTML data attributes and the updated form names.
  $$('input[data-lang-radio], input[name="language"]').forEach(input => {
    if (input.value === selectedLanguage()) {
      input.checked = true;
    }

    input.addEventListener("change", () => {
      if (!input.checked) return;

      // Language is saved to Django when the user saves the settings form.
      toast(
        "info",
        "Language selected",
        "Click Save Changes to save your language preference."
      );
    });
  });

  $$('input[data-theme-radio], input[name="theme"]').forEach(input => {
    if (input.value === initialTheme) {
      input.checked = true;
    }

    input.addEventListener("change", () => {
      if (!input.checked) return;

      applyTheme(input.value);

      toast(
        "info",
        "Theme preview",
        "Click Save Changes to save your theme preference."
      );
    });
  });

  darkMQ.addEventListener("change", () => {
    if (selectedTheme() === "system") {
      applyTheme("system");
    }
  });

  /* ============================================================
     CARD 2 — Profile Information
     ============================================================ */

  const profileName = $("#profileName");
  const profileEmail = $("#profileEmail");
  const profilePhone = $("#profilePhone");

  function updateProfilePreview() {
    const name =
      profileName?.value.trim() ||
      profileEmail?.value.trim() ||
      "Admin";

    const email = profileEmail?.value.trim() || "";
    const phone = profilePhone?.value.trim() || "";

    const displayName = $("#profileDisplayName");
    const displayContact = $("#profileDisplayContact");
    const avatar = $("#profileAvatar");

    if (displayName) displayName.textContent = name;

    if (displayContact) {
      displayContact.textContent = [email, phone]
        .filter(Boolean)
        .join(" · ");
    }

    if (avatar) {
      avatar.textContent = name.slice(0, 2).toUpperCase();
    }
  }

  [profileName, profileEmail, profilePhone].forEach(input => {
    input?.addEventListener("input", updateProfilePreview);
  });

  function getSettingsForm() {
    return (
      $("#settingsForm") ||
      $("#profileForm") ||
      $("form[data-settings-form]")
    );
  }

  function buildSettingsFormData() {
    const form = getSettingsForm();
    const data = form ? new FormData(form) : new FormData();

    // Include fields even if the original HTML does not wrap them in a form.
    if (profileName) data.set("full_name", profileName.value.trim());
    if (profileEmail) data.set("email", profileEmail.value.trim());
    if (profilePhone) data.set("phone_number", profilePhone.value.trim());

    const langInput = $(
      'input[data-lang-radio]:checked, input[name="language"]:checked'
    );

    const themeInput = $(
      'input[data-theme-radio]:checked, input[name="theme"]:checked'
    );

    if (langInput) data.set("language", langInput.value);
    if (themeInput) data.set("theme", themeInput.value);

    return data;
  }

  async function saveProfile() {
    if (!profileName || !profileEmail || !profilePhone) {
      toast(
        "error",
        "Missing profile fields",
        "Check that profileName, profileEmail and profilePhone exist in settings.html."
      );
      return;
    }

    const name = profileName.value.trim();
    const email = profileEmail.value.trim();

    if (!name || !email) {
      toast(
        "warning",
        "Required fields",
        "Full name and email address are required."
      );
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast("error", "Invalid email", "Enter a valid email address.");
      return;
    }

    const saveURL = getSaveURL();

    if (!saveURL) {
      toast(
        "error",
        "Backend URL missing",
        "Configure the settings_save URL in settings.html."
      );
      return;
    }

    const button = $("#btnSaveProfile");
    const oldText = button?.textContent;

    if (button) {
      button.disabled = true;
      button.textContent = "Saving...";
    }

    try {
      const response = await postForm(saveURL, buildSettingsFormData());

      if (response === null) return;

      // The Django view normally redirects after a successful save.
      // If it returns a normal response, reload to fetch updated server data.
      toast("success", "Settings saved", "Your profile settings were saved.");
      window.location.reload();
    } catch (error) {
      toast("error", "Save failed", error.message);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = oldText || "Save Profile";
      }
    }
  }

  $("#btnSaveProfile")?.addEventListener("click", event => {
    event.preventDefault();
    saveProfile();
  });

  /* ============================================================
     Change Password — Django backend
     ============================================================ */

  function openPasswordModal() {
    if (!UI || typeof UI.modal !== "function") {
      toast("error", "Modal unavailable", "The shared UI modal helper is not loaded.");
      return;
    }

    const body = `
      <div class="form-group" style="margin-bottom:14px;">
        <label for="cpOld">Current Password</label>
        <input class="input" type="password" id="cpOld"
               autocomplete="current-password" required>
      </div>

      <div class="form-group" style="margin-bottom:14px;">
        <label for="cpNew">New Password</label>
        <input class="input" type="password" id="cpNew"
               autocomplete="new-password" required>
      </div>

      <div class="form-group" style="margin-bottom:14px;">
        <label for="cpConfirm">Confirm New Password</label>
        <input class="input" type="password" id="cpConfirm"
               autocomplete="new-password" required>
      </div>

      <div id="cpError" role="alert"
           style="display:none;color:var(--danger,#dc2626);
                  font-size:12px;margin-top:10px;"></div>
    `;

    const foot = `
      <button class="btn btn-ghost" type="button" data-close>Cancel</button>
      <button class="btn btn-primary" type="button" id="cpSubmit">
        Update Password
      </button>
    `;

    UI.modal({
      title: "Change Password",
      subtitle: "Verify your current password before changing it.",
      body,
      foot,
      size: "",
      onMount: overlay => {
        const submit = $("#cpSubmit", overlay);
        const errorBox = $("#cpError", overlay);

        submit.addEventListener("click", async () => {
          const oldValue = $("#cpOld", overlay).value;
          const newValue = $("#cpNew", overlay).value;
          const confirmValue = $("#cpConfirm", overlay).value;

          errorBox.style.display = "none";
          errorBox.textContent = "";

          if (!oldValue || !newValue || !confirmValue) {
            errorBox.textContent = "All password fields are required.";
            errorBox.style.display = "block";
            return;
          }

          if (newValue !== confirmValue) {
            errorBox.textContent = "New passwords do not match.";
            errorBox.style.display = "block";
            return;
          }

          if (newValue === oldValue) {
            errorBox.textContent =
              "New password must differ from the current password.";
            errorBox.style.display = "block";
            return;
          }

          if (!SETTINGS_URLS.changePassword) {
            errorBox.textContent =
              "Password endpoint is not configured in settings.html.";
            errorBox.style.display = "block";
            return;
          }

          submit.disabled = true;
          submit.textContent = "Updating...";

          try {
            const response = await fetch(SETTINGS_URLS.changePassword, {
              method: "POST",
              credentials: "same-origin",
              headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCSRFToken(),
                "X-Requested-With": "XMLHttpRequest"
              },
              body: JSON.stringify({
                current_password: oldValue,
                new_password: newValue,
                confirm_password: confirmValue
              })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
              throw new Error(
                result.message || "Unable to change password."
              );
            }

            if (typeof UI.closeAll === "function") {
              UI.closeAll();
            }

            toast("success", "Password changed", result.message);
          } catch (error) {
            errorBox.textContent =
              error.message || "An unexpected error occurred.";
            errorBox.style.display = "block";
          } finally {
            submit.disabled = false;
            submit.textContent = "Update Password";
          }
        });
      }
    });
  }

  $("#btnChangePassword")?.addEventListener("click", openPasswordModal);

  /* ============================================================
     CARD 3 — Notification Preferences
     These settings are browser-local, not server notification rules.
     ============================================================ */

  const NOTIFS = [
    {
      key: "email",
      label: "Email notifications",
      desc: "Receive ride summaries and commission reports by email.",
      def: true
    },
    {
      key: "push",
      label: "Push notifications",
      desc: "Alerts for driver registrations and pending approvals.",
      def: true
    },
    {
      key: "sms",
      label: "SMS alerts",
      desc: "Critical alerts for failed transactions and blocked accounts.",
      def: false
    },
    {
      key: "digest",
      label: "Daily revenue digest",
      desc: "Preference for the daily revenue summary.",
      def: true
    },
    {
      key: "weekly",
      label: "Weekly commission report",
      desc: "Preference for weekly commission reports.",
      def: true
    },
    {
      key: "newDriver",
      label: "New driver registration",
      desc: "Preference for new driver registration alerts.",
      def: true
    },
    {
      key: "failedTxn",
      label: "Failed transaction alert",
      desc: "Preference for failed transaction alerts.",
      def: true
    }
  ];

  function notificationState(key, defaultValue) {
    const stored = safeStorageGet("mototaxi.notif." + key);

    if (stored === "true") return true;
    if (stored === "false") return false;

    return defaultValue;
  }

  const notifBody = $("#notifBody");

  if (notifBody) {
    notifBody.innerHTML = NOTIFS.map((item, index) => {
      const enabled = notificationState(item.key, item.def);
      const border = index === NOTIFS.length - 1
        ? ""
        : "border-bottom:1px solid var(--line);";

      return `
        <div class="flex between items-center"
             style="padding:12px 0;gap:16px;${border}">
          <div style="min-width:0;flex:1;">
            <div style="font-size:13.5px;font-weight:600;color:var(--ink);">
              ${item.label}
            </div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">
              ${item.desc}
            </div>
          </div>
          <label class="switch" style="flex-shrink:0;">
            <input type="checkbox"
                   data-notif-key="${item.key}"
                   ${enabled ? "checked" : ""}>
            <span class="slider"></span>
          </label>
        </div>
      `;
    }).join("");

    $$("input[data-notif-key]", notifBody).forEach(checkbox => {
      checkbox.addEventListener("change", () => {
        const key = checkbox.dataset.notifKey;
        const item = NOTIFS.find(notification => notification.key === key);
        const saved = safeStorageSet(
          "mototaxi.notif." + key,
          checkbox.checked
        );

        if (!saved) {
          toast(
            "error",
            "Preference not saved",
            "Browser storage is unavailable."
          );
          return;
        }

        toast(
          "success",
          "Preference saved locally",
          `${item.label} is ${checkbox.checked ? "ON" : "OFF"}. This does not enable server-side notifications.`
        );
      });
    });
  }

  /* ============================================================
     CARD 4 — Admin Roles & Permissions
     No real create/edit/delete endpoint was supplied.
     Do not mutate real accounts or show fake success messages.
     ============================================================ */

  const adminsBody = $("#adminsBody");

  function renderAdminBackendNotice() {
    if (!adminsBody) return;

    const serverRows = adminsBody.querySelectorAll("tr");

    // If Django rendered real database rows, preserve them.
    if (serverRows.length > 0) {
      $$("[data-edit-admin], [data-remove-admin]", adminsBody).forEach(button => {
        button.addEventListener("click", () => {
          toast(
            "info",
            "Admin management unavailable",
            "Connect a protected backend endpoint before editing or removing admin accounts."
          );
        });
      });
      return;
    }

    // Avoid presenting hardcoded sample administrators as real accounts.
    adminsBody.innerHTML = `
      <tr>
        <td colspan="6">
          Admin accounts will appear here when loaded from the Django backend.
        </td>
      </tr>
    `;
  }

  renderAdminBackendNotice();

  $("#btnAddAdmin")?.addEventListener("click", () => {
    toast(
      "info",
      "Backend required",
      "Creating admin accounts requires a protected backend endpoint and permission checks."
    );
  });

  /* ============================================================
     CARD 5 — API Configuration
     No secure API configuration endpoint was supplied.
     ============================================================ */

  $("#btnTestConn")?.addEventListener("click", () => {
    toast(
      "info",
      "Backend required",
      "A real connection test must be performed by the backend. No test was run."
    );
  });

  const apiKeyInput = $("#apiKey");
  const toggleApiKey = $("#btnToggleApiKey");

  toggleApiKey?.addEventListener("click", () => {
    if (!apiKeyInput) return;

    apiKeyInput.type =
      apiKeyInput.type === "password" ? "text" : "password";

    const hidden = apiKeyInput.type === "password";
    toggleApiKey.setAttribute(
      "aria-label",
      hidden ? "Show API key" : "Hide API key"
    );
  });

  function copyText(text, label) {
    if (!text) {
      toast("warning", "Nothing to copy", `${label} is empty.`);
      return;
    }

    if (!navigator.clipboard?.writeText) {
      toast(
        "error",
        "Clipboard unavailable",
        "Use a secure context or copy the value manually."
      );
      return;
    }

    navigator.clipboard.writeText(text)
      .then(() => toast("success", "Copied", `${label} copied to clipboard.`))
      .catch(() => toast("error", "Copy failed", "Clipboard access was denied."));
  }

  $("#btnCopyApiKey")?.addEventListener("click", () => {
    copyText(apiKeyInput?.value || "", "API key");
  });

  $("#btnCopyWebhookSecret")?.addEventListener("click", () => {
    copyText($("#webhookSecret")?.value || "", "Webhook secret");
  });

  $("#btnRegenKey")?.addEventListener("click", () => {
    toast(
      "warning",
      "Backend required",
      "API keys cannot be securely regenerated in browser JavaScript."
    );
  });

  $("#btnSaveConfig")?.addEventListener("click", () => {
    toast(
      "info",
      "Configuration not saved",
      "API configuration needs a secure backend endpoint. No values were persisted."
    );
  });

  /* ============================================================
     PAGE ACTION — Save All Changes
     Save supported server-side fields through Django.
     ============================================================ */

  async function saveAllSettings() {
    const data = buildSettingsFormData();
    const name = (data.get("full_name") || "").trim();
    const email = (data.get("email") || "").trim();

    if (!name || !email) {
      toast(
        "warning",
        "Required fields",
        "Full name and email address are required."
      );
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast("error", "Invalid email", "Enter a valid email address.");
      return;
    }

    const button = $("#btnSaveAll");
    const oldText = button?.textContent;

    if (button) {
      button.disabled = true;
      button.textContent = "Saving...";
    }

    try {
      const response = await postForm(getSaveURL(), data);

      if (response === null) return;

      toast(
        "success",
        "Settings saved",
        "Profile, language and theme preferences were submitted successfully."
      );

      window.location.reload();
    } catch (error) {
      toast("error", "Save failed", error.message);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = oldText || "Save All Changes";
      }
    }
  }

  $("#btnSaveAll")?.addEventListener("click", event => {
    event.preventDefault();
    saveAllSettings();
  });

})();
