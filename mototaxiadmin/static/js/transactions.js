
/* MOTOTAXI ADMIN — transactions.js
   Uses real Django WalletTransaction data.
   No invented payment status, invoice number or fee fields.
*/

(function () {
  const D = window.MOTOTAXI_DATA || {};
  const UI = window.MOTOTAXI_UI;
  const txns = Array.isArray(D.TRANSACTIONS) ? D.TRANSACTIONS : [];

  if (typeof bootPage === "function") {
    bootPage("transactions", "Transactions");
  }
  window.MOTOTAXI_I18N?.applyI18n?.();

  const state = {
    search: "",
    type: "",
    status: "",
    direction: "",
    dateFrom: "",
    dateTo: "",
    page: 1,
    pageSize: 8
  };

  const ICONS = {
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>',
    total: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h13l-3-3M20 17H7l3 3"/></svg>',
    credit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    debit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
    volume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V5M20 19V5M4 19h16M4 12h5l2-3 3 6 2-3h4"/></svg>'
  };

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);

  const money = value => {
    const n = Number(value) || 0;
    if (typeof D.fmtFCFA === "function") return D.fmtFCFA(n);
    return `${n.toLocaleString("fr-FR")} FCFA`;
  };

  const dateText = value => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    if (typeof D.fmtDate === "function") return D.fmtDate(value, true);
    return d.toLocaleString();
  };

  function toast(type, title, message) {
    if (UI?.toast) UI.toast(type, title, message);
    else alert(`${title}\n${message}`);
  }

  function statusBadge(status) {
    return UI?.statusBadge
      ? UI.statusBadge(status)
      : `<span class="tag">${esc(status)}</span>`;
  }

  function renderStats() {
    const total = txns.length;
    const credits = txns.filter(x => x.transactionType === "CREDIT");
    const debits = txns.filter(x => x.transactionType === "DEBIT");
    const creditVolume = credits.reduce((s, x) => s + Number(x.amount || 0), 0);
    const debitVolume = debits.reduce((s, x) => s + Number(x.amount || 0), 0);
    const volume = txns.reduce((s, x) => s + Number(x.amount || 0), 0);

    const stats = [
      {
        label: "Total Transactions",
        value: total,
        ic: "ic-brand",
        icon: ICONS.total,
        trend: `${total} recorded`,
        meta: "database records"
      },
      {
        label: "Credit Transactions",
        value: credits.length,
        ic: "ic-green",
        icon: ICONS.credit,
        trend: money(creditVolume),
        meta: "total credits"
      },
      {
        label: "Debit Transactions",
        value: debits.length,
        ic: "ic-blue",
        icon: ICONS.debit,
        trend: money(debitVolume),
        meta: "total debits"
      },
      {
        label: "Total Transaction Volume",
        value: money(volume),
        ic: "ic-purple",
        icon: ICONS.volume,
        trend: "credits + debits",
        meta: "FCFA recorded"
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

    return txns.filter(x => {
      const searchText = [
        x.id, x.pk, x.invoice, x.walletId, x.walletPk,
        x.sender, x.receiver, x.driver, x.licenseNumber,
        x.type, x.reason, x.rideId
      ].join(" ").toLowerCase();

      if (q && !searchText.includes(q)) return false;
      if (state.type && x.reason !== state.type) return false;
      if (state.status && x.status !== state.status) return false;
      if (state.direction && x.direction !== state.direction) return false;

      if (state.dateFrom) {
        const date = new Date(x.date);
        const from = new Date(`${state.dateFrom}T00:00:00`);
        if (Number.isNaN(date.getTime()) || date < from) return false;
      }

      if (state.dateTo) {
        const date = new Date(x.date);
        const to = new Date(`${state.dateTo}T23:59:59.999`);
        if (Number.isNaN(date.getTime()) || date > to) return false;
      }

      return true;
    });
  }

  function partyCell(name) {
    if (name === "MOTOTAXI") {
      return `<em style="color:var(--muted);font-style:italic">
        <span class="tag" style="margin-right:6px">platform</span>MOTOTAXI
      </em>`;
    }
    return `<span>${esc(name || "—")}</span>`;
  }

  function directionCell(direction) {
    if (direction === "Sent") {
      return `<span class="arrow-cell up" style="color:var(--red);font-weight:600">▲ Sent</span>`;
    }
    if (direction === "Received") {
      return `<span class="arrow-cell down" style="color:var(--green);font-weight:600">▼ Received</span>`;
    }
    return `<span class="text-muted">—</span>`;
  }

  function typeTag(type) {
    const map = {
      "Ride Earning": ["var(--green-bg)", "var(--green)"],
      "Manual Adjustment": ["var(--purple-bg)", "var(--purple)"],
      "Withdrawal": ["var(--blue-bg)", "var(--blue)"]
    };

    const style = map[type];
    if (!style) return `<span class="tag">${esc(type || "—")}</span>`;

    return `<span class="tag" style="background:${style[0]};color:${style[1]}">${esc(type)}</span>`;
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

  function renderTable() {
    const data = getFiltered();
    const total = data.length;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));

    state.page = Math.min(state.page, pages);

    const startIndex = (state.page - 1) * state.pageSize;
    const pageRows = data.slice(startIndex, startIndex + state.pageSize);
    const tbody = document.getElementById("txnsBody");

    if (!total) {
      const empty = UI?.emptyStateHTML
        ? UI.emptyStateHTML(
            "No transactions match your filters",
            "Try clearing filters or searching for another wallet, driver or transaction."
          )
        : "No transactions found.";

      tbody.innerHTML =
        `<tr><td colspan="12" style="padding:0">${empty}</td></tr>`;
    } else {
      tbody.innerHTML = pageRows.map(x => `
        <tr>
          <td><strong>${esc(x.id)}</strong></td>
          <td><span class="tag">${esc(x.invoice || "—")}</span></td>
          <td>${partyCell(x.sender)}</td>
          <td>${partyCell(x.receiver)}</td>
          <td>${directionCell(x.direction)}</td>
          <td><span class="amount">${esc(money(x.amount))}</span></td>
          <td><span class="amount text-muted">—</span></td>
          <td><span class="amount green">${esc(money(x.total))}</span></td>
          <td>${typeTag(x.type)}</td>
          <td>${statusBadge("Recorded")}</td>
          <td>${esc(dateText(x.date))}</td>
          <td>
            <div class="actions">
              <button class="row-btn" data-view="${esc(x.pk)}"
                title="View details" aria-label="View details">
                ${ICONS.eye}
              </button>
              <button class="row-btn" data-pdf="${esc(x.pk)}"
                title="Print receipt" aria-label="Print receipt">
                ${ICONS.download}
              </button>
            </div>
          </td>
        </tr>
      `).join("");

      tbody.querySelectorAll("[data-view]").forEach(button => {
        button.addEventListener("click", () => openTxnModal(button.dataset.view));
      });

      tbody.querySelectorAll("[data-pdf]").forEach(button => {
        button.addEventListener("click", () => printReceipt(button.dataset.pdf));
      });
    }

    renderPagination(total, pages, startIndex);
  }

  function getTxn(pk) {
    return txns.find(x => String(x.pk) === String(pk));
  }

  function openTxnModal(pk) {
    const x = getTxn(pk);
    if (!x) return;

    const body = `
      <div class="profile-banner">
        <div class="avatar">${x.transactionType === "CREDIT" ? "↓" : "↑"}</div>
        <div>
          <div class="name">${esc(x.id)}</div>
          <div class="sub">${esc(x.walletId)} · ${esc(x.driver)}</div>
        </div>
      </div>

      <div class="kv-list mt-16">
        <div class="kv"><div class="k">Transaction ID</div><div class="v">${esc(x.id)}</div></div>
        <div class="kv"><div class="k">Invoice Number</div><div class="v">—</div></div>
        <div class="kv"><div class="k">Wallet ID</div><div class="v">${esc(x.walletId)}</div></div>
        <div class="kv"><div class="k">Driver</div><div class="v">${esc(x.driver)}</div></div>
        <div class="kv"><div class="k">Driver License</div><div class="v">${esc(x.licenseNumber || "—")}</div></div>
        <div class="kv"><div class="k">Sender</div><div class="v">${partyCell(x.sender)}</div></div>
        <div class="kv"><div class="k">Receiver</div><div class="v">${partyCell(x.receiver)}</div></div>
        <div class="kv"><div class="k">Direction</div><div class="v">${directionCell(x.direction)}</div></div>
        <div class="kv"><div class="k">Transaction Type</div><div class="v">${typeTag(x.type)}</div></div>
        <div class="kv"><div class="k">Reason Code</div><div class="v">${esc(x.reason)}</div></div>
        <div class="kv"><div class="k">Amount</div><div class="v amount">${esc(money(x.amount))}</div></div>
        <div class="kv"><div class="k">Tax / Transfer Fee</div><div class="v">—</div></div>
        <div class="kv"><div class="k">Balance After</div><div class="v amount">${esc(money(x.balanceAfter))}</div></div>
        <div class="kv"><div class="k">Payment Status</div><div class="v">${statusBadge("Recorded")}</div></div>
        <div class="kv"><div class="k">Ride ID</div><div class="v">${x.rideId == null ? "—" : esc(x.rideId)}</div></div>
        <div class="kv"><div class="k">Date</div><div class="v">${esc(dateText(x.date))}</div></div>
      </div>

      <div class="divider"></div>
      <div class="text-muted" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:10px">
        Recorded Transaction
      </div>
      <div class="fare-breakdown">
        <div class="fare-row">
          <span class="lbl">Transaction Amount</span>
          <span class="val">${esc(money(x.amount))}</span>
        </div>
        <div class="fare-row">
          <span class="lbl">Balance After</span>
          <span class="val">${esc(money(x.balanceAfter))}</span>
        </div>
      </div>

      <p class="text-muted" style="font-size:12px;margin-top:12px">
        This model stores wallet credits/debits and their resulting balance.
        Invoice, fee and payment settlement status are not stored on this record.
      </p>
    `;

    UI.modal({
      title: x.id,
      subtitle: `${x.walletId} · ${x.driver}`,
      body,
      foot: `
        <button class="btn btn-primary" id="txPrint">Print Receipt</button>
        <button class="btn btn-ghost" data-close>Close</button>
      `,
      size: "lg",
      onMount: el => {
        el.querySelector("#txPrint")?.addEventListener("click", () => {
          printReceipt(x.pk);
        });
      }
    });
  }

  function printReceipt(pk) {
    const x = getTxn(pk);
    if (!x) return;

    const popup = window.open("", "_blank", "width=720,height=800");
    if (!popup) {
      toast("warning", "Popup blocked", "Allow popups to print the receipt.");
      return;
    }

    popup.document.write(`
      <!doctype html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Receipt ${esc(x.id)}</title>
        <style>
          body{font:15px Arial,sans-serif;max-width:680px;margin:40px auto;padding:0 24px;color:#222}
          h1{font-size:24px} .muted{color:#666}
          .row{display:flex;justify-content:space-between;gap:20px;padding:12px 0;border-bottom:1px solid #ddd}
          .note{margin-top:24px;font-size:12px;color:#666}
          @media print{button{display:none}}
        </style>
      </head>
      <body>
        <h1>MOTOTAXI — Transaction Receipt</h1>
        <p class="muted">Wallet ledger receipt · Recorded transaction</p>
        <div class="row"><b>Transaction ID</b><span>${esc(x.id)}</span></div>
        <div class="row"><b>Wallet ID</b><span>${esc(x.walletId)}</span></div>
        <div class="row"><b>Driver</b><span>${esc(x.driver)}</span></div>
        <div class="row"><b>Transaction type</b><span>${esc(x.type)}</span></div>
        <div class="row"><b>Direction</b><span>${esc(x.direction)}</span></div>
        <div class="row"><b>Amount</b><span>${esc(money(x.amount))}</span></div>
        <div class="row"><b>Balance after</b><span>${esc(money(x.balanceAfter))}</span></div>
        <div class="row"><b>Date</b><span>${esc(dateText(x.date))}</span></div>
        <p class="note">This receipt reflects a wallet ledger entry. It does not confirm external payment settlement.</p>
        <button onclick="window.print()">Print</button>
      </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  function exportCSV() {
    const rows = getFiltered().map(x => ({
      "Transaction ID": x.id,
      "Invoice Number": "",
      "Wallet ID": x.walletId,
      "Driver": x.driver,
      "License Number": x.licenseNumber,
      "Sender": x.sender,
      "Receiver": x.receiver,
      "Direction": x.direction,
      "Amount FCFA": x.amount,
      "Tax / Transfer Fee": "",
      "Total Amount FCFA": x.total,
      "Transaction Type": x.type,
      "Reason Code": x.reason,
      "Status": "Recorded",
      "Balance After FCFA": x.balanceAfter,
      "Ride ID": x.rideId ?? "",
      "Date": x.date
    }));

    if (UI?.exportCSV) {
      UI.exportCSV("mototaxi-transactions.csv", rows);
      return;
    }

    const keys = Object.keys(rows[0] || { "Transaction ID": "" });
    const csv = [
      keys.join(","),
      ...rows.map(row => keys.map(key =>
        `"${String(row[key] ?? "").replace(/"/g, '""')}"`
      ).join(","))
    ].join("\r\n");

    const link = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    );

    link.href = url;
    link.download = "mototaxi-transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  document.getElementById("searchTxn").addEventListener("input", e => {
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

  document.getElementById("filterDir").addEventListener("change", e => {
    state.direction = e.target.value;
    state.page = 1;
    renderTable();
  });

  document.getElementById("filterFrom").addEventListener("change", e => {
    state.dateFrom = e.target.value;
    state.page = 1;
    renderTable();
  });

  document.getElementById("filterTo").addEventListener("change", e => {
    state.dateTo = e.target.value;
    state.page = 1;
    renderTable();
  });

  document.getElementById("btnReset").addEventListener("click", () => {
    Object.assign(state, {
      search: "",
      type: "",
      status: "",
      direction: "",
      dateFrom: "",
      dateTo: "",
      page: 1
    });

    document.getElementById("searchTxn").value = "";
    document.getElementById("filterType").value = "";
    document.getElementById("filterStatus").value = "";
    document.getElementById("filterDir").value = "";
    document.getElementById("filterFrom").value = "";
    document.getElementById("filterTo").value = "";

    renderTable();
    toast("info", "Filters reset", "All filters cleared.");
  });

  document.getElementById("btnExport").addEventListener("click", exportCSV);

  document.getElementById("btnPdf").addEventListener("click", () => {
    const selected = getFiltered()[0];

    if (!selected) {
      toast("info", "No transaction", "There is no transaction to print.");
      return;
    }

    printReceipt(selected.pk);
  });

  renderStats();
  renderTable();
})();
