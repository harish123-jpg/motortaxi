/* ===================================================================
   MOTOTAXI ADMIN — wallets.js
   Renders stat cards, toolbar filters, wallets table, wallet details
   modal with balance summary + transaction history, top-up form modal,
   block wallet action, and CSV export for the Wallets management page.
   =================================================================== */

(function () {
  const D = window.MOTOTAXI_DATA;
  const UI = window.MOTOTAXI_UI;
  const t = window.MOTOTAXI_I18N.t;

  // Bootstrap shared shell (sidebar + topbar + theme + i18n wiring)
  bootPage('wallets', 'Wallets');
  window.MOTOTAXI_I18N.applyI18n();

  /* ---------- Inline SVG icons ---------- */
  const ICONS = {
    wallet:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h14a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H5a2 2 0 0 1-2-2V7z"/><path d="M3 7l2-3h9l2 3"/><circle cx="16" cy="13" r="1.3"/></svg>',
    balance:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h18v4H3zM5 11v6m4-6v6m4-6v6m4-6v6m4-6v6M3 19h18"/></svg>',
    check:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4 10-10"/></svg>',
    block:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M5 5l14 14"/></svg>',
    eye:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    arrowUp:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="13" height="13"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    arrowDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="13" height="13"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
  };

  /* ---------- Working copy of wallets (mutable for block action) ---------- */
  const wallets = D.WALLETS.map(w => ({ ...w }));

  /* ---------- Page state ---------- */
  const state = {
    search: '',
    type: '',
    status: '',
    page: 1,
    pageSize: 8,
  };

  /* ---------- Helpers ---------- */
  function isAgent(owner) {
    return typeof owner === 'string' && owner.startsWith('AGENT-');
  }

  function ownerInitials(owner) {
    return isAgent(owner) ? 'AG' : UI.initials(owner);
  }

  function ownerTypeTag(type) {
    if (type === 'Customer') return `<span class="tag" style="background:var(--green-bg);color:var(--green)">Customer</span>`;
    if (type === 'Driver')   return `<span class="tag" style="background:var(--blue-bg);color:var(--blue)">Driver</span>`;
    if (type === 'Agent')    return `<span class="tag" style="background:var(--purple-bg);color:var(--purple)">Agent</span>`;
    return `<span class="tag">${type}</span>`;
  }

  /* ---------- Render top stat cards ---------- */
  function renderStats() {
    const total = wallets.length;
    const totalBalance = wallets.reduce((s, w) => s + (Number(w.balance) || 0), 0);
    const active = wallets.filter(w => w.status === 'Active').length;
    const inactive = wallets.filter(w => w.status === 'Inactive').length;

    const stats = [
      { label: 'Total Wallets',        value: total,                          ic: 'ic-brand',  icon: ICONS.wallet,  trend: `${active} active · ${inactive} inactive`, dir: 'up', meta: 'fleet-wide' },
      { label: 'Total Wallet Balance', value: D.fmtFCFA(totalBalance),       ic: 'ic-green',  icon: ICONS.balance, trend: `across ${total} wallets`,                dir: 'up', meta: 'sum of balances' },
      { label: 'Active Wallets',       value: active,                         ic: 'ic-blue',   icon: ICONS.check,   trend: `${total ? Math.round(active / total * 100) : 0}% of total`, dir: 'up', meta: 'live wallets' },
      { label: 'Inactive Wallets',     value: inactive,                      ic: 'ic-red',    icon: ICONS.block,   trend: `${total ? Math.round(inactive / total * 100) : 0}% of total`, dir: 'down', meta: 'blocked or dormant' },
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
    return wallets.filter(w => {
      if (q && !(`${w.id} ${w.owner} ${w.phone}`.toLowerCase().includes(q))) return false;
      if (state.type && w.type !== state.type) return false;
      if (state.status && w.status !== state.status) return false;
      return true;
    });
  }

  /* ---------- Owner Name cell ---------- */
  function ownerNameCell(w) {
    if (isAgent(w.owner)) {
      return `<span class="text-muted text-bold">${w.owner}</span> <span class="tag" style="background:var(--purple-bg);color:var(--purple)">Agent</span>`;
    }
    const cls = UI.avatarColor(w.owner);
    return `
      <div class="cell-user">
        <div class="avatar ${cls}">${UI.initials(w.owner)}</div>
        <div>
          <div class="name">${w.owner}</div>
          <div class="sub">${w.id}</div>
        </div>
      </div>`;
  }

  /* ---------- Balance cell ---------- */
  function balanceCell(w) {
    const cls = (Number(w.balance) || 0) === 0 ? 'amount red' : 'amount green';
    return `<span class="${cls}">${D.fmtFCFA(w.balance)}</span>`;
  }

  /* ---------- Render table body + pagination ---------- */
  function renderTable() {
    const data = getFiltered();
    const info = UI.paginate({ data, page: state.page, pageSize: state.pageSize });
    const tbody = document.getElementById('walletsBody');

    if (info.total === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="padding:0">${UI.emptyStateHTML('No wallets match your filters', 'Try clearing filters or searching by a different term.')}</td></tr>`;
    } else {
      tbody.innerHTML = info.slice.map(w => `
        <tr>
          <td><strong>${w.id}</strong></td>
          <td>${ownerNameCell(w)}</td>
          <td>${ownerTypeTag(w.type)}</td>
          <td class="tabular">${w.phone}</td>
          <td>${balanceCell(w)}</td>
          <td><span class="amount">${D.fmtFCFA(w.credits)}</span></td>
          <td><span class="amount">${D.fmtFCFA(w.debits)}</span></td>
          <td>${UI.statusBadge(w.status)}</td>
          <td class="tabular">${D.fmtDate(w.lastTx, true)}</td>
          <td>
            <div class="actions">
              <button class="row-btn" data-view="${w.id}" title="View wallet" aria-label="View">${ICONS.eye}</button>
            </div>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => openWalletModal(b.dataset.view)));
    }

    UI.renderPagination(document.getElementById('pagination'), info, (p) => {
      state.page = p;
      renderTable();
    });
  }

  /* ---------- Transaction history for a wallet ---------- */
  function walletTransactions(owner) {
    return D.TRANSACTIONS
      .filter(tx => tx.sender === owner || tx.receiver === owner)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);
  }

  /* ---------- Transaction row for the modal mini-table ---------- */
  function txRow(tx, owner) {
    const sent = tx.sender === owner;
    const dir = sent
      ? `<span class="arrow-cell up">${ICONS.arrowUp} Sent</span>`
      : `<span class="arrow-cell down">${ICONS.arrowDown} Received</span>`;
    const counterparty = sent ? tx.receiver : tx.sender;
    return `
      <tr>
        <td><strong>${tx.id}</strong></td>
        <td>${dir}</td>
        <td>${counterparty}</td>
        <td><span class="amount">${D.fmtFCFA(tx.amount)}</span></td>
        <td><span class="tag">${tx.type}</span></td>
        <td>${UI.statusBadge(tx.status)}</td>
        <td class="tabular">${D.fmtDate(tx.date, true)}</td>
      </tr>`;
  }

  /* ---------- Wallet details modal ---------- */
  function openWalletModal(id) {
    const w = wallets.find(x => x.id === id);
    if (!w) return;

    const txs = walletTransactions(w.owner);
    const txTable = txs.length ? `
      <div class="table-scroll" style="margin-top:8px">
        <table class="tbl">
          <thead>
            <tr>
              <th>TXN ID</th>
              <th>Direction</th>
              <th>Counterparty</th>
              <th>Amount</th>
              <th>Type</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>${txs.map(tx => txRow(tx, w.owner)).join('')}</tbody>
        </table>
      </div>
    ` : `
      <div class="empty-state" style="padding:24px 12px">
        <div class="ic"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg></div>
        <h4>No transactions yet for this wallet.</h4>
        <p>Top-up or ride payments will appear here.</p>
      </div>
    `;

    const body = `
      <div class="profile-banner">
        <div class="avatar">${ownerInitials(w.owner)}</div>
        <div>
          <div class="name">${w.owner}</div>
          <div class="sub">${w.id} · ${w.type}</div>
        </div>
      </div>

      <div class="kv-list mt-16">
        <div class="kv"><div class="k">Wallet ID</div><div class="v tabular">${w.id}</div></div>
        <div class="kv"><div class="k">Owner Name</div><div class="v">${w.owner}</div></div>
        <div class="kv"><div class="k">Owner Type</div><div class="v">${ownerTypeTag(w.type)}</div></div>
        <div class="kv"><div class="k">Phone</div><div class="v tabular">${w.phone}</div></div>
        <div class="kv"><div class="k">Current Balance</div><div class="v amount">${D.fmtFCFA(w.balance)}</div></div>
        <div class="kv"><div class="k">Total Credits</div><div class="v amount green">${D.fmtFCFA(w.credits)}</div></div>
        <div class="kv"><div class="k">Total Debits</div><div class="v amount red">${D.fmtFCFA(w.debits)}</div></div>
        <div class="kv"><div class="k">Wallet Status</div><div class="v">${UI.statusBadge(w.status)}</div></div>
        <div class="kv"><div class="k">Last Transaction</div><div class="v">${D.fmtDate(w.lastTx, true)}</div></div>
      </div>

      <div class="divider"></div>
      <div class="text-muted" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:10px">Balance Summary</div>
      <div class="fare-breakdown">
        <div class="fare-row">
          <span class="lbl">Total Credits</span>
          <span class="val" style="color:var(--green)">${D.fmtFCFA(w.credits)}</span>
        </div>
        <div class="fare-row">
          <span class="lbl">Total Debits</span>
          <span class="val" style="color:var(--red)">${D.fmtFCFA(w.debits)}</span>
        </div>
        <div class="fare-row total">
          <span class="lbl">Net Balance</span>
          <span class="val">${D.fmtFCFA(w.balance)}</span>
        </div>
      </div>

      <div class="divider"></div>
      <div class="flex between items-center" style="margin-bottom:6px">
        <div class="text-muted" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.4px;font-weight:600">Transaction History</div>
        <span class="text-muted" style="font-size:12px">${txs.length} record${txs.length === 1 ? '' : 's'}${txs.length === 8 ? ' (latest 8)' : ''}</span>
      </div>
      ${txTable}
    `;

    const isActive = w.status === 'Active';
    const foot = `
      <button class="btn btn-ghost" data-close>Close</button>
      <button class="btn btn-soft" id="modalTopUpBtn" data-close>Top up</button>
      ${isActive ? `<button class="btn btn-danger" id="modalBlockBtn" data-close>Block Wallet</button>` : ''}
    `;

    UI.modal({
      title: w.id,
      subtitle: w.owner,
      body,
      foot,
      size: 'lg',
      onMount: (el) => {
        const topUpBtn = el.querySelector('#modalTopUpBtn');
        if (topUpBtn) topUpBtn.addEventListener('click', () => {
          UI.closeAll();
          setTimeout(() => openTopUpModal(w.id), 220);
        });

        const blockBtn = el.querySelector('#modalBlockBtn');
        if (blockBtn) blockBtn.addEventListener('click', async () => {
          const ok = await UI.confirm({
            title: 'Block Wallet',
            message: `Block wallet <strong>${w.id}</strong> (${w.owner})? The owner will no longer be able to send or receive funds until it is reactivated.`,
            confirmText: 'Block Wallet',
            cancelText: 'Cancel',
            danger: true,
          });
          if (!ok) return;
          w.status = 'Inactive';
          renderStats();
          renderTable();
          UI.toast('warning', 'Wallet blocked', `${w.id} (${w.owner}) has been blocked.`);
        });
      },
    });
  }

  /* ---------- Top up wallet modal (demo form) ---------- */
  function openTopUpModal(presetWalletId) {
    const options = wallets.map(w =>
      `<option value="${w.id}" ${presetWalletId === w.id ? 'selected' : ''}>${w.id} — ${w.owner} (${w.type})</option>`
    ).join('');

    const body = `
      <div class="form-group">
        <label>Wallet</label>
        <select class="select" id="topUpWallet">${options}</select>
      </div>
      <div class="form-group">
        <label>Amount (FCFA)</label>
        <input type="number" class="input" id="topUpAmount" min="100" step="100" placeholder="e.g. 5000">
      </div>
      <div class="form-group">
        <label>Payment Method</label>
        <select class="select" id="topUpMethod">
          <option>Mobile Money (MTN)</option>
          <option>Mobile Money (Orange)</option>
          <option>Cash (Agent)</option>
          <option>Bank Transfer</option>
        </select>
      </div>
      <div class="form-group">
        <label>Note (optional)</label>
        <input type="text" class="input" id="topUpNote" placeholder="Reference / reason for top-up">
      </div>
      <p class="text-muted" style="font-size:12px;margin-top:6px">Demo only — top-ups are not persisted to the dataset.</p>
    `;

    const foot = `
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="topUpSubmit" data-close>Top up Wallet</button>
    `;

    UI.modal({
      title: 'Top up Wallet',
      subtitle: 'Credit a wallet with funds',
      body,
      foot,
      size: '',
      onMount: (el) => {
        el.querySelector('#topUpSubmit').addEventListener('click', () => {
          const walletId = el.querySelector('#topUpWallet').value;
          const amount = parseFloat(el.querySelector('#topUpAmount').value) || 0;
          const method = el.querySelector('#topUpMethod').value;
          const w = wallets.find(x => x.id === walletId);
          if (!w) return;
          if (amount <= 0) {
            UI.toast('error', 'Invalid amount', 'Enter a positive amount to top up.');
            return;
          }
          UI.toast(
            'success',
            'Top-up scheduled',
            `${D.fmtFCFA(amount)} → ${walletId} via ${method}. Connect your payment API to settle this credit.`,
          );
        });
      },
    });
  }

  /* ---------- Wire toolbar inputs ---------- */
  const searchInput = document.getElementById('searchWallet');
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

  document.getElementById('btnReset').addEventListener('click', () => {
    state.search = ''; state.type = ''; state.status = ''; state.page = 1;
    searchInput.value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('filterStatus').value = '';
    renderTable();
    UI.toast('info', 'Filters reset', 'All filters cleared — showing every wallet.');
  });

  /* ---------- Page action buttons ---------- */
  document.getElementById('btnExport').addEventListener('click', () => {
    const data = getFiltered();
    const rows = data.map(w => ({
      'Wallet ID':         w.id,
      'Owner Name':        w.owner,
      'Owner Type':        w.type,
      'Phone Number':      w.phone,
      'Current Balance':   w.balance,
      'Total Credits':     w.credits,
      'Total Debits':      w.debits,
      'Wallet Status':     w.status,
      'Last Transaction':  w.lastTx,
    }));
    UI.exportCSV('mototaxi-wallets.csv', rows);
  });

  document.getElementById('btnTopUp').addEventListener('click', () => {
    openTopUpModal();
  });

  /* ---------- Initial render ---------- */
  renderStats();
  renderTable();
})();
