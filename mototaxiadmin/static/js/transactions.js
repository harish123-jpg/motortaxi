/* ===================================================================
   MOTOTAXI ADMIN — transactions.js
   Renders stat cards, toolbar filters, transactions table, and the
   transaction details modal (with transfer breakdown + timeline) for
   the Transactions (fintech) management page.
   =================================================================== */

(function () {
  const D = window.MOTOTAXI_DATA;
  const UI = window.MOTOTAXI_UI;
  const t = window.MOTOTAXI_I18N.t;

  // Bootstrap shared shell (sidebar + topbar + theme + i18n wiring)
  bootPage('transactions', 'Transactions');
  window.MOTOTAXI_I18N.applyI18n();

  /* ---------- Inline SVG icons ---------- */
  const ICONS = {
    eye:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    download:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>',
    check:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M5 13l4 4 10-10"/></svg>',
    totalTxn:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h13l-3-3M20 17H7l3 3"/></svg>',
    success:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4 10-10"/></svg>',
    pending:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    failed:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
    volume:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V5M20 19V5M4 19h16M4 12h5l2-3 3 6 2-3h4"/></svg>',
  };

  /* ---------- Working copy of transactions ---------- */
  // Shallow clone so Resolve / Mark Failed mutate the local copy (and
  // the stat cards + table reflect the change) without touching shared data.
  const txns = D.TRANSACTIONS.map(x => ({ ...x }));

  /* ---------- Page state ---------- */
  const state = {
    search: '',
    type: '',
    status: '',
    direction: '',
    dateFrom: '', // YYYY-MM-DD
    dateTo: '',   // YYYY-MM-DD
    page: 1,
    pageSize: 8,
  };

  /* ---------- Render top stat cards ---------- */
  function renderStats() {
    const total = txns.length;
    const successful = txns.filter(x => x.status === 'Successful').length;
    const pending = txns.filter(x => x.status === 'Pending').length;
    const failed = txns.filter(x => x.status === 'Failed').length;
    const volume = txns.reduce((s, x) => s + (x.total || 0), 0);
    const pct = (n) => total ? Math.round((n / total) * 100) : 0;

    const stats = [
      { label: 'Total Transactions',     value: total,            ic: 'ic-brand',  icon: ICONS.totalTxn, trend: `${successful + pending + failed} logged`, dir: 'up',   meta: 'all-time' },
      { label: 'Successful Transactions', value: successful,      ic: 'ic-green',  icon: ICONS.success,  trend: `${pct(successful)}% of total`,             dir: 'up',   meta: 'cleared' },
      { label: 'Pending Transactions',  value: pending,          ic: 'ic-amber',  icon: ICONS.pending,   trend: 'awaiting settlement',                      dir: 'up',   meta: 'live queue' },
      { label: 'Failed Transactions',    value: failed,           ic: 'ic-red',    icon: ICONS.failed,    trend: `${pct(failed)}% of total`,                 dir: 'down', meta: 'retries needed' },
      { label: 'Total Transaction Volume', value: D.fmtFCFA(volume), ic: 'ic-purple', icon: ICONS.volume, trend: 'sum of all totals',                         dir: 'up',   meta: 'FCFA moved' },
    ];

    document.getElementById('statGrid').innerHTML = stats.map(s => `
      <div class="stat-card">
        <div class="stat-top">
          <div class="stat-ic ${s.ic}">${s.icon}</div>
        </div>
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">${s.value}</div>
        <div class="stat-meta">
          <span class="trend ${s.dir}">${s.dir === 'up' ? '▲' : '▼'} ${s.trend}</span>
          <span>${s.meta}</span>
        </div>
      </div>
    `).join('');
  }

  /* ---------- Filter pipeline ---------- */
  function getFiltered() {
    const q = state.search.trim().toLowerCase();
    return txns.filter(x => {
      if (q && !(`${x.id} ${x.invoice} ${x.sender} ${x.receiver}`.toLowerCase().includes(q))) return false;
      if (state.type && x.type !== state.type) return false;
      if (state.status && x.status !== state.status) return false;
      if (state.direction && x.direction !== state.direction) return false;
      if (state.dateFrom) {
        const d = new Date(x.date);
        const from = new Date(state.dateFrom + 'T00:00:00');
        if (d < from) return false;
      }
      if (state.dateTo) {
        const d = new Date(x.date);
        const to = new Date(state.dateTo + 'T23:59:59');
        if (d > to) return false;
      }
      return true;
    });
  }

  /* ---------- Sender / Receiver cell (MOTOTAXI = italic + platform tag) ---------- */
  function partyCell(name) {
    if (name === 'MOTOTAXI') {
      return `<em style="color:var(--muted);font-style:italic"><span class="tag" style="margin-right:6px">platform</span>MOTOTAXI</em>`;
    }
    return `<span>${name}</span>`;
  }

  /* ---------- Direction cell (red up for Sent, green down for Received) ---------- */
  // Inline styles + class so it works in table cells AND modal kv-list /
  // profile-banner contexts (CSS .arrow-cell is scoped to table cells only).
  function directionCell(dir) {
    if (dir === 'Sent') {
      return `<span class="arrow-cell up" style="display:inline-flex;align-items:center;gap:6px;font-weight:600;color:var(--red)">▲ Sent</span>`;
    }
    if (dir === 'Received') {
      return `<span class="arrow-cell down" style="display:inline-flex;align-items:center;gap:6px;font-weight:600;color:var(--green)">▼ Received</span>`;
    }
    return `<span class="text-muted">—</span>`;
  }

  /* ---------- Type tag (green/blue/purple/red tinted by category) ---------- */
  function typeTag(type) {
    const map = {
      'Ride Payment':   ['var(--green-bg)',  'var(--green)'],
      'Driver Payout':  ['var(--blue-bg)',   'var(--blue)'],
      'Wallet Topup':   ['var(--purple-bg)', 'var(--purple)'],
      'Ride Refund':    ['var(--red-bg)',    'var(--red)'],
    };
    const m = map[type];
    if (!m) return `<span class="tag">${type}</span>`;
    return `<span class="tag" style="background:${m[0]};color:${m[1]}">${type}</span>`;
  }

  /* ---------- Render table body + pagination ---------- */
  function renderTable() {
    const data = getFiltered();
    const info = UI.paginate({ data, page: state.page, pageSize: state.pageSize });
    const tbody = document.getElementById('txnsBody');

    if (info.total === 0) {
      tbody.innerHTML = `<tr><td colspan="12" style="padding:0">${UI.emptyStateHTML('No transactions match your filters', 'Try clearing filters or searching by a different TXN ID, sender or date.')}</td></tr>`;
    } else {
      tbody.innerHTML = info.slice.map(x => {
        const isPending = x.status === 'Pending';
        const rowBg = isPending ? ` style="background: var(--amber-bg);"` : '';
        const resolveBtn = isPending
          ? `<button class="row-btn" data-resolve="${x.id}" title="Resolve" aria-label="Resolve">${ICONS.check}</button>`
          : '';
        return `
          <tr${rowBg}>
            <td><strong>${x.id}</strong></td>
            <td><span class="tag">${x.invoice}</span></td>
            <td>${partyCell(x.sender)}</td>
            <td>${partyCell(x.receiver)}</td>
            <td>${directionCell(x.direction)}</td>
            <td><span class="amount">${D.fmtFCFA(x.amount)}</span></td>
            <td><span class="amount${x.fee ? '' : ' text-muted'}">${D.fmtFCFA(x.fee)}</span></td>
            <td><span class="amount green">${D.fmtFCFA(x.total)}</span></td>
            <td>${typeTag(x.type)}</td>
            <td>${UI.statusBadge(x.status)}</td>
            <td>${D.fmtDate(x.date, true)}</td>
            <td>
              <div class="actions">
                <button class="row-btn" data-view="${x.id}" title="View" aria-label="View">${ICONS.eye}</button>
                <button class="row-btn" data-pdf="${x.id}" title="PDF Receipt" aria-label="PDF Receipt">${ICONS.download}</button>
                ${resolveBtn}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => openTxnModal(b.dataset.view)));
      tbody.querySelectorAll('[data-pdf]').forEach(b => b.addEventListener('click', () => {
        UI.toast('info', 'PDF Receipt', `PDF receipt for ${b.dataset.pdf} is a backend action — connect your document service.`);
      }));
      tbody.querySelectorAll('[data-resolve]').forEach(b => b.addEventListener('click', () => resolveTxn(b.dataset.resolve)));
    }

    UI.renderPagination(document.getElementById('pagination'), info, (p) => {
      state.page = p;
      renderTable();
    });
  }

  /* ---------- Resolve a pending transaction (UI.confirm + flip + toast) ---------- */
  async function resolveTxn(id) {
    const x = txns.find(t => t.id === id);
    if (!x) return;
    const ok = await UI.confirm({
      title: 'Resolve Transaction',
      message: `Mark ${x.id} as Successful? The sender will be debited, the tax / fee deducted, and the receiver credited the total amount.`,
      confirmText: 'Resolve',
      cancelText: 'Cancel',
      danger: false,
    });
    if (!ok) return;
    x.status = 'Successful';
    renderStats();
    renderTable();
    UI.toast('success', 'Transaction resolved', `${x.id} marked Successful — receiver credited ${D.fmtFCFA(x.total)}.`);
  }

  /* ---------- Transaction timeline builder ---------- */
  function timelineHTML(x) {
    const base = new Date(x.date);
    const stepDate = (mins) => new Date(base.getTime() + mins * 60000);
    const fmt = (d) => D.fmtDate(d, true);

    // Class decision per spec:
    //   Sender debited  — .done if Successful or Pending, .cancel if Failed
    //   Tax/fee deducted — same as sender debited
    //   Receiver credited — .done if Successful, .pending if Pending, .cancel if Failed
    //   Settled         — .done if Successful, hidden if Pending/Failed
    //   Initiated       — default state (brand dot from CSS)
    const senderCls = (x.status === 'Failed') ? 'cancel' : 'done';
    const taxCls    = (x.status === 'Failed') ? 'cancel' : 'done';
    const recvCls   = x.status === 'Successful' ? 'done'
                    : (x.status === 'Pending'   ? 'pending' : 'cancel');

    const items = [
      { time: fmt(base),         ttl: 'Initiated',          desc: `${x.sender} → ${x.receiver}`, cls: '' },
      { time: fmt(stepDate(1)),  ttl: 'Sender debited',     desc: D.fmtFCFA(x.amount),          cls: senderCls },
      { time: fmt(stepDate(2)),  ttl: 'Tax / fee deducted', desc: D.fmtFCFA(x.fee),              cls: taxCls },
      { time: fmt(stepDate(3)),  ttl: 'Receiver credited',  desc: D.fmtFCFA(x.total),            cls: recvCls },
    ];
    if (x.status === 'Successful') {
      items.push({ time: fmt(stepDate(4)), ttl: 'Settled', desc: 'Transaction closed', cls: 'done' });
    }

    return `<div class="timeline">
      ${items.map(it => `
        <div class="timeline-item ${it.cls}">
          <div class="time">${it.time}</div>
          <div class="body">
            <div class="ttl">${it.ttl}</div>
            <div class="desc">${it.desc}</div>
          </div>
        </div>
      `).join('')}
    </div>`;
  }

  /* ---------- Transaction details modal ---------- */
  function openTxnModal(id) {
    const x = txns.find(t => t.id === id);
    if (!x) return;

    // Profile-banner avatar: direction icon (red up / green down)
    const avatarIcon = x.direction === 'Sent'
      ? `<span style="font-size:24px;font-weight:800;color:var(--red);line-height:1">▲</span>`
      : `<span style="font-size:24px;font-weight:800;color:var(--green);line-height:1">▼</span>`;

    const body = `
      <div class="profile-banner">
        <div class="avatar">${avatarIcon}</div>
        <div>
          <div class="name">${x.sender} → ${x.receiver}</div>
          <div class="sub">${x.id} · ${x.invoice}</div>
        </div>
      </div>

      <div class="kv-list mt-16">
        <div class="kv"><div class="k">Transaction ID</div><div class="v">${x.id}</div></div>
        <div class="kv"><div class="k">Invoice Number</div><div class="v"><span class="tag">${x.invoice}</span></div></div>
        <div class="kv"><div class="k">Sender</div><div class="v">${partyCell(x.sender)}</div></div>
        <div class="kv"><div class="k">Receiver</div><div class="v">${partyCell(x.receiver)}</div></div>
        <div class="kv"><div class="k">Direction</div><div class="v">${directionCell(x.direction)}</div></div>
        <div class="kv"><div class="k">Transaction Type</div><div class="v">${typeTag(x.type)}</div></div>
        <div class="kv"><div class="k">Amount</div><div class="v amount">${D.fmtFCFA(x.amount)}</div></div>
        <div class="kv"><div class="k">Tax / Transfer Fee</div><div class="v amount">${D.fmtFCFA(x.fee)}</div></div>
        <div class="kv"><div class="k">Total Amount</div><div class="v amount green">${D.fmtFCFA(x.total)}</div></div>
        <div class="kv"><div class="k">Payment Status</div><div class="v">${UI.statusBadge(x.status)}</div></div>
        <div class="kv"><div class="k">Date</div><div class="v">${D.fmtDate(x.date, true)}</div></div>
      </div>

      <div class="divider"></div>
      <div class="text-muted" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:10px">Transfer Breakdown</div>
      <div class="fare-breakdown">
        <div class="fare-row"><span class="lbl">Principal Amount</span><span class="val">${D.fmtFCFA(x.amount)}</span></div>
        <div class="fare-row"><span class="lbl">Tax / Transfer Fee</span><span class="val">${D.fmtFCFA(x.fee)}</span></div>
        <div class="fare-row total"><span class="lbl">Total Debited</span><span class="val">${D.fmtFCFA(x.total)}</span></div>
      </div>

      <div class="divider"></div>
      <div class="text-muted" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:10px">Transaction Timeline</div>
      ${timelineHTML(x)}
    `;

    // Footer depends on status (order = primary action first, Close last)
    let foot;
    if (x.status === 'Pending') {
      foot = `
        <button class="btn btn-primary" id="txResolve" data-close>Resolve</button>
        <button class="btn btn-danger"  id="txMarkFailed" data-close>Mark Failed</button>
        <button class="btn btn-ghost"   data-close>Close</button>
      `;
    } else if (x.status === 'Successful') {
      foot = `
        <button class="btn btn-primary" id="txPdf" data-close>PDF Receipt</button>
        <button class="btn btn-ghost"   data-close>Close</button>
      `;
    } else {
      // Failed
      foot = `
        <button class="btn btn-primary" id="txRetry" data-close>Retry</button>
        <button class="btn btn-ghost"   data-close>Close</button>
      `;
    }

    UI.modal({
      title: x.id,
      subtitle: x.invoice,
      body,
      foot,
      size: 'lg',
      onMount: (el) => {
        const r = el.querySelector('#txResolve');
        if (r) r.addEventListener('click', () => {
          x.status = 'Successful';
          renderStats();
          renderTable();
          UI.toast('success', 'Transaction resolved', `${x.id} marked Successful — receiver credited ${D.fmtFCFA(x.total)}.`);
        });

        const mf = el.querySelector('#txMarkFailed');
        if (mf) mf.addEventListener('click', () => {
          x.status = 'Failed';
          renderStats();
          renderTable();
          UI.toast('error', 'Transaction failed', `${x.id} marked Failed — sender will be refunded.`);
        });

        const pdf = el.querySelector('#txPdf');
        if (pdf) pdf.addEventListener('click', () => {
          UI.toast('info', 'PDF Receipt', `PDF receipt for ${x.id} is a backend action — connect your document service.`);
        });

        const retry = el.querySelector('#txRetry');
        if (retry) retry.addEventListener('click', () => {
          UI.toast('info', 'Retry Transaction', `Retry for ${x.id} is a backend action — connect your payment gateway.`);
        });
      },
    });
  }

  /* ---------- Wire toolbar inputs ---------- */
  const searchInput = document.getElementById('searchTxn');
  searchInput.addEventListener('input', (e) => {
    state.search = e.target.value;
    state.page = 1;
    renderTable();
  });

  document.getElementById('filterType').addEventListener('change', (e) => {
    state.type = e.target.value; state.page = 1; renderTable();
  });
  document.getElementById('filterStatus').addEventListener('change', (e) => {
    state.status = e.target.value; state.page = 1; renderTable();
  });
  document.getElementById('filterDir').addEventListener('change', (e) => {
    state.direction = e.target.value; state.page = 1; renderTable();
  });
  document.getElementById('filterFrom').addEventListener('change', (e) => {
    state.dateFrom = e.target.value; state.page = 1; renderTable();
  });
  document.getElementById('filterTo').addEventListener('change', (e) => {
    state.dateTo = e.target.value; state.page = 1; renderTable();
  });

  document.getElementById('btnReset').addEventListener('click', () => {
    state.search = ''; state.type = ''; state.status = '';
    state.direction = ''; state.dateFrom = ''; state.dateTo = '';
    state.page = 1;
    searchInput.value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterDir').value = '';
    document.getElementById('filterFrom').value = '';
    document.getElementById('filterTo').value = '';
    renderTable();
    UI.toast('info', 'Filters reset', 'All filters cleared — showing every transaction.');
  });

  /* ---------- Page action buttons ---------- */
  document.getElementById('btnExport').addEventListener('click', () => {
    const data = getFiltered();
    const rows = data.map(x => ({
      'Transaction ID':          x.id,
      'Invoice Number':          x.invoice,
      'Sender':                  x.sender,
      'Receiver':                x.receiver,
      'Direction':               x.direction,
      'Amount FCFA':             x.amount,
      'Tax / Transfer Fee FCFA': x.fee,
      'Total FCFA':              x.total,
      'Transaction Type':        x.type,
      'Payment Status':          x.status,
      'Date':                    D.fmtDate(x.date, true),
    }));
    UI.exportCSV('mototaxi-transactions.csv', rows);
  });

  document.getElementById('btnPdf').addEventListener('click', () => {
    UI.toast('info', 'PDF Receipt', 'PDF receipt export is a backend action — connect your document service.');
  });

  /* ---------- Initial render ---------- */
  renderStats();
  renderTable();
})();
