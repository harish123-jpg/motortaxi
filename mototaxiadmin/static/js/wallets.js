
/* MOTOTAXI ADMIN — wallets.js: Django-backed driver wallets */

(function () {
  const D = window.MOTOTAXI_DATA || {};
  const UI = window.MOTOTAXI_UI;
  const URLS = window.MOTOTAXI_WALLET_URLS || {};

  let wallets = Array.isArray(D.WALLETS) ? D.WALLETS : [];
  let transactions = Array.isArray(D.WALLET_TRANSACTIONS)
    ? D.WALLET_TRANSACTIONS
    : [];

  if (typeof bootPage === "function") {
    bootPage("wallets", "Wallets");
  }
  window.MOTOTAXI_I18N?.applyI18n?.();

  const state = {
    search: "",
    type: "",
    status: "",
    page: 1,
    pageSize: 8
  };

  const ICONS = {
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h14a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H5a2 2 0 0 1-2-2V7z"/><path d="M3 7l2-3h9l2 3"/><circle cx="16" cy="13" r="1.3"/></svg>',
    balance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h18v4H3zM5 11v6m4-6v6m4-6v6m4-6v6m4-6v6M3 19h18"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4 10-10"/></svg>',
    block: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M5 5l14 14"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>'
  };

  const esc = value =>
    String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);

  const money = value => {
    const number = Number(value) || 0;
    if (typeof D.fmtFCFA === "function") return D.fmtFCFA(number);
    return `${number.toLocaleString("fr-FR")} FCFA`;
  };

  const formatDate = value => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    if (typeof D.fmtDate === "function") return D.fmtDate(value, true);
    return date.toLocaleString();
  };

  const toast = (type, title, message) => {
    if (UI?.toast) UI.toast(type, title, message);
    else alert(`${title}\n${message}`);
  };

  const statusBadge = status => UI?.statusBadge
    ? UI.statusBadge(status)
    : `<span class="badge">${esc(status)}</span>`;

  const getWallet = id =>
    wallets.find(w => String(w.id) === String(id));

  function renderStats() {
    const total = wallets.length;
    const totalBalance = wallets.reduce(
      (sum, w) => sum + (Number(w.balance) || 0), 0
    );
    const active = wallets.filter(w => w.status === "Active").length;
    const inactive = total - active;
    const pct = n => total ? Math.round(n / total * 100) : 0;

    const stats = [
      {
        label: "Total Wallets",
        value: total,
        ic: "ic-brand",
        icon: ICONS.wallet,
        trend: `${active} active · ${inactive} inactive`,
        meta: "driver wallets"
      },
      {
        label: "Total Wallet Balance",
        value: money(totalBalance),
        ic: "ic-green",
        icon: ICONS.balance,
        trend: `Across ${total} wallets`,
        meta: "sum of balances"
      },
      {
        label: "Active Wallets",
        value: active,
        ic: "ic-blue",
        icon: ICONS.check,
        trend: `${pct(active)}% of total`,
        meta: "approved drivers"
      },
      {
        label: "Inactive Wallets",
        value: inactive,
        ic: "ic-red",
        icon: ICONS.block,
        trend: `${pct(inactive)}% of total`,
        meta: "drivers not approved"
      }
    ];

    document.getElementById("statGrid").innerHTML = stats.map(s => `
      <div class="stat-card">
        <div class="stat-top">
          <div class="stat-ic ${s.ic}">${s.icon}</div>
        </div>
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">${esc(s.value)}</div>
        <div class="stat-meta">
          <span class="trend up">● ${esc(s.trend)}</span>
          <span>${esc(s.meta)}</span>
        </div>
      </div>
    `).join("");
  }

  function getFiltered() {
    const q = state.search.trim().toLowerCase();

    return wallets.filter(w => {
      const text = `${w.id} ${w.pk} ${w.owner} ${w.phone} ${w.driverId}`
        .toLowerCase();

      if (q && !text.includes(q)) return false;
      if (state.type && w.type !== state.type) return false;
      if (state.status && w.status !== state.status) return false;
      return true;
    });
  }

  function ownerTypeTag(type) {
    const style = type === "Driver"
      ? "background:var(--blue-bg);color:var(--blue)"
      : "background:var(--surface-2);color:var(--ink)";

    return `<span class="tag" style="${style}">${esc(type)}</span>`;
  }

  function ownerNameCell(w) {
    const initials = w.owner
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join("")
      .toUpperCase();

    const color = UI?.avatarColor
      ? UI.avatarColor(w.owner)
      : "";

    return `
      <div class="cell-user">
        <div class="avatar ${esc(color)}">${esc(initials || "D")}</div>
        <div>
          <div class="name">${esc(w.owner)}</div>
          <div class="sub">${esc(w.id)}</div>
        </div>
      </div>`;
  }

  function renderTable() {
    const data = getFiltered();
    const total = data.length;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));

    state.page = Math.min(state.page, pages);

    const startIndex = (state.page - 1) * state.pageSize;
    const pageRows = data.slice(startIndex, startIndex + state.pageSize);
    const tbody = document.getElementById("walletsBody");

    if (!total) {
      const empty = UI?.emptyStateHTML
        ? UI.emptyStateHTML(
            "No wallets match your filters",
            "Try clearing filters or changing the search."
          )
        : "No wallets found.";

      tbody.innerHTML =
        `<tr><td colspan="10" style="padding:0">${empty}</td></tr>`;
    } else {
      tbody.innerHTML = pageRows.map(w => `
        <tr>
          <td><strong>${esc(w.id)}</strong></td>
          <td>${ownerNameCell(w)}</td>
          <td>${ownerTypeTag(w.type)}</td>
          <td class="tabular">${esc(w.phone || "—")}</td>
          <td>
            <span class="amount ${Number(w.balance) > 0 ? "green" : "red"}">
              ${esc(money(w.balance))}
            </span>
          </td>
          <td><span class="amount">${esc(money(w.credits))}</span></td>
          <td><span class="amount">${esc(money(w.debits))}</span></td>
          <td>${statusBadge(w.status)}</td>
          <td class="tabular">${esc(formatDate(w.lastTx))}</td>
          <td>
            <div class="actions">
              <button class="row-btn" data-view="${esc(w.id)}"
                title="View wallet" aria-label="View wallet">
                ${ICONS.eye}
              </button>
            </div>
          </td>
        </tr>
      `).join("");

      tbody.querySelectorAll("[data-view]").forEach(button => {
        button.addEventListener("click", () => {
          openWalletModal(button.dataset.view);
        });
      });
    }

    renderPagination(total, pages, startIndex);
  }

  function renderPagination(total, pages, startIndex) {
    const el = document.getElementById("pagination");
    const from = total ? startIndex + 1 : 0;
    const to = Math.min(startIndex + state.pageSize, total);

    el.innerHTML = `
      <span class="text-muted">Showing ${from}–${to} of ${total}</span>
      <div class="actions">
        <button class="btn btn-sm" data-page="${state.page - 1}"
          ${state.page <= 1 ? "disabled" : ""}>Previous</button>
        <span>Page ${state.page} / ${pages}</span>
        <button class="btn btn-sm" data-page="${state.page + 1}"
          ${state.page >= pages ? "disabled" : ""}>Next</button>
      </div>
    `;

    el.querySelectorAll("[data-page]").forEach(button => {
      button.addEventListener("click", () => {
        state.page = Number(button.dataset.page);
        renderTable();
      });
    });
  }

  function walletTransactions(wallet) {
    return transactions
      .filter(tx => Number(tx.walletPk) === Number(wallet.pk))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);
  }

  function transactionRows(wallet) {
    const txs = walletTransactions(wallet);

    if (!txs.length) {
      return `
        <tr>
          <td colspan="6">
            <div class="empty-state" style="padding:20px">
              <h4>No transactions yet for this wallet.</h4>
              <p>Recorded credits and debits will appear here.</p>
            </div>
          </td>
        </tr>`;
    }

    return txs.map(tx => {
      const credit = tx.type === "CREDIT";
      const direction = credit
        ? `<span class="arrow-cell down">${ICONS.down} Credit</span>`
        : `<span class="arrow-cell up">${ICONS.up} Debit</span>`;

      return `
        <tr>
          <td><strong>${esc(tx.id)}</strong></td>
          <td>${direction}</td>
          <td>${esc(tx.reason || "—")}</td>
          <td><span class="amount">${esc(money(tx.amount))}</span></td>
          <td>${statusBadge(tx.status || "Recorded")}</td>
          <td class="tabular">${esc(formatDate(tx.date))}</td>
        </tr>`;
    }).join("");
  }

  function openWalletModal(id) {
    const w = getWallet(id);
    if (!w) return;

    const txs = walletTransactions(w);

    const body = `
      <div class="profile-banner">
        <div class="avatar">
          ${esc(w.owner.split(/\s+/).map(p => p[0] || "").slice(0, 2).join("").toUpperCase())}
        </div>
        <div>
          <div class="name">${esc(w.owner)}</div>
          <div class="sub">${esc(w.id)} · ${esc(w.type)}</div>
        </div>
      </div>

      <div class="kv-list mt-16">
        <div class="kv"><div class="k">Wallet ID</div><div class="v">${esc(w.id)}</div></div>
        <div class="kv"><div class="k">Owner Name</div><div class="v">${esc(w.owner)}</div></div>
        <div class="kv"><div class="k">Owner Type</div><div class="v">${ownerTypeTag(w.type)}</div></div>
        <div class="kv"><div class="k">Phone</div><div class="v">${esc(w.phone || "—")}</div></div>
        <div class="kv"><div class="k">Current Balance</div><div class="v amount">${esc(money(w.balance))}</div></div>
        <div class="kv"><div class="k">Total Credits</div><div class="v amount green">${esc(money(w.credits))}</div></div>
        <div class="kv"><div class="k">Total Debits</div><div class="v amount red">${esc(money(w.debits))}</div></div>
        <div class="kv"><div class="k">Wallet Status</div><div class="v">${statusBadge(w.status)}</div></div>
        <div class="kv"><div class="k">Last Transaction</div><div class="v">${esc(formatDate(w.lastTx))}</div></div>
      </div>

      <div class="divider"></div>
      <div class="text-muted" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:10px">
        Transaction History — Latest ${txs.length}
      </div>
      <div class="table-scroll" style="margin-top:8px">
        <table class="tbl">
          <thead>
            <tr>
              <th>TXN ID</th><th>Direction</th><th>Reason</th>
              <th>Amount</th><th>Status</th><th>Date</th>
            </tr>
          </thead>
          <tbody>${transactionRows(w)}</tbody>
        </table>
      </div>
      <p class="text-muted" style="font-size:12px;margin-top:8px">
        Active status reflects driver approval, not a separate wallet block setting.
      </p>
    `;

    UI.modal({
      title: w.id,
      subtitle: w.owner,
      body,
      foot: `
        <button class="btn btn-ghost" data-close>Close</button>
        <button class="btn btn-primary" id="modalTopUpBtn" data-close>
          Top up
        </button>
      `,
      size: "lg",
      onMount: el => {
        el.querySelector("#modalTopUpBtn")?.addEventListener("click", () => {
          openTopUpModal(w.id);
        });
      }
    });
  }

  function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content || "";
  }

  function openTopUpModal(presetId) {
    const eligible = wallets.filter(w => w.status === "Active");

    if (!eligible.length) {
      toast("warning", "No eligible wallets",
        "Only wallets belonging to approved drivers can be topped up.");
      return;
    }

    const options = eligible.map(w => `
      <option value="${w.pk}"
        ${presetId === w.id ? "selected" : ""}>
        ${esc(w.id)} — ${esc(w.owner)}
      </option>
    `).join("");

    UI.modal({
      title: "Top up Wallet",
      subtitle: "Manually credit an approved driver's wallet",
      body: `
        <div class="form-group">
          <label for="topUpWallet">Wallet</label>
          <select class="select" id="topUpWallet">${options}</select>
        </div>
        <div class="form-group">
          <label for="topUpAmount">Amount (FCFA)</label>
          <input type="number" class="input" id="topUpAmount"
            min="0.01" step="0.01" required placeholder="e.g. 5000">
        </div>
        <p class="text-muted" style="font-size:12px;margin-top:6px">
          This immediately credits the wallet and records an ADJUSTMENT credit.
          Confirm the funds have actually been received before submitting.
        </p>
      `,
      foot: `
        <button class="btn btn-ghost" data-close>Cancel</button>
        <button class="btn btn-primary" id="topUpSubmit">Confirm Top up</button>
      `,
      onMount: el => {
        el.querySelector("#topUpSubmit")?.addEventListener("click", async () => {
          const button = el.querySelector("#topUpSubmit");
          const walletPk = el.querySelector("#topUpWallet").value;
          const amount = el.querySelector("#topUpAmount").value;

          if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
            toast("error", "Invalid amount", "Enter an amount greater than zero.");
            return;
          }

          button.disabled = true;
          button.textContent = "Processing…";

          try {
            const response = await fetch(URLS.topUp, {
              method: "POST",
              credentials: "same-origin",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                "X-CSRFToken": csrfToken()
              },
              body: new URLSearchParams({
                wallet_pk: walletPk,
                amount: amount
              }).toString()
            });

            const result = await response.json();

            if (!response.ok || !result.ok) {
              throw new Error(result.message || "Top-up failed.");
            }

            const w = wallets.find(
              item => Number(item.pk) === Number(result.wallet.pk)
            );

            if (w) {
              w.balance = result.wallet.balance;
              w.credits = (Number(w.credits) + Number(amount)).toFixed(2);
              w.lastTx = result.transaction.date;
            }

            transactions.unshift(result.transaction);
            D.WALLETS = wallets;
            D.WALLET_TRANSACTIONS = transactions;

            const close = el.querySelector("[data-close]");
            if (close) close.click();

            renderStats();
            renderTable();

            toast("success", "Top-up successful", result.message);
          } catch (error) {
            toast("error", "Top-up failed", error.message || "Please try again.");
          } finally {
            button.disabled = false;
            button.textContent = "Confirm Top up";
          }
        });
      }
    });
  }

  document.getElementById("searchWallet").addEventListener("input", e => {
    state.search = e.target.value;
    state.page = 1;
    renderTable();
  });

  document.getElementById("filterType").addEventListener("change", e => {
    state.type = e.target.value;
    state.page = 1;
    renderTable();
  });

  document.getElementById("filterStatus").addEventListener("change", e => {
    state.status = e.target.value;
    state.page = 1;
    renderTable();
  });

  document.getElementById("btnReset").addEventListener("click", () => {
    state.search = "";
    state.type = "";
    state.status = "";
    state.page = 1;

    document.getElementById("searchWallet").value = "";
    document.getElementById("filterType").value = "";
    document.getElementById("filterStatus").value = "";

    renderTable();
    toast("info", "Filters reset", "All filters cleared.");
  });

  document.getElementById("btnExport").addEventListener("click", () => {
    const rows = getFiltered().map(w => ({
      "Wallet ID": w.id,
      "Owner Name": w.owner,
      "Owner Type": w.type,
      "Phone Number": w.phone,
      "Current Balance": w.balance,
      "Total Credits": w.credits,
      "Total Debits": w.debits,
      "Wallet Status": w.status,
      "Last Transaction": w.lastTx
    }));

    if (UI?.exportCSV) {
      UI.exportCSV("mototaxi-wallets.csv", rows);
      return;
    }

    const keys = Object.keys(rows[0] || { "Wallet ID": "" });
    const csv = [
      keys.join(","),
      ...rows.map(row =>
        keys.map(key =>
          `"${String(row[key] ?? "").replace(/"/g, '""')}"`
        ).join(",")
      )
    ].join("\r\n");

    const link = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    );

    link.href = url;
    link.download = "mototaxi-wallets.csv";
    link.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("btnTopUp").addEventListener("click", () => {
    openTopUpModal();
  });

  renderStats();
  renderTable();
})();
