/* ===================================================================
   MOTOTAXI ADMIN — commissions.js
   Renders summary cards, agent commission table, the Tax & Commission
   Rules card, the agent details modal and the commission settlement
   history modal for the Commission Management page.
   =================================================================== */

(function () {
  const D = window.MOTOTAXI_DATA;
  const UI = window.MOTOTAXI_UI;
  const t = window.MOTOTAXI_I18N.t;

  // Bootstrap shared shell (sidebar + topbar + theme + i18n wiring)
  bootPage('commissions', 'Commission Management');
  window.MOTOTAXI_I18N.applyI18n();

  /* ---------- Inline SVG icons ---------- */
  const ICONS = {
    platform: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/></svg>',
    agents:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M21 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    fees:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
    pending:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    eye:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    cash:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>',
    history:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 4v4h4M12 8v4l3 2"/></svg>',
    settle:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4 10-10"/></svg>',
    block:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/></svg>',
    rules:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M3 6h18M3 12h18M3 18h18M7 3v18M17 3v18"/></svg>',
  };

  /* ---------- Working copy of agents ---------- */
  // Shallow clone so Settle / Block mutate the local copy (and the
  // summary cards + table reflect the change) without touching shared data.
  const agents = D.AGENTS.map(a => ({ ...a }));

  /* ---------- Default rules + current rules (in-memory only) ---------- */
  const DEFAULT_RULES = { fee: 25, agentPct: 5, platformPct: 15 };
  const rules = { ...DEFAULT_RULES };

  /* ---------- Page state ---------- */
  const state = {
    search: '',
    city: '',
    status: '',
    page: 1,
    pageSize: 6,
  };

  // Reference "today" = latest date in demo dataset (so settlement dates
  // rendered look consistent across page reloads and don't drift with the
  // system clock of whoever opens the template).
  const TODAY = new Date('2026-10-26T18:00:00');

  /* ---------- Summary cards ---------- */
  // Platform commission + transfer fees are read-only aggregations from the
  // immutable shared arrays; agent commission + pending are re-read from the
  // mutable working copy so the cards stay in sync after Settle / Block.
  function computeSummary() {
    const platformCommission = D.RIDES.reduce((s, r) => s + (r.commission || 0), 0);
    const agentCommission    = agents.reduce((s, a) => s + (a.earned || 0), 0);
    const transferFees       = D.TRANSACTIONS.reduce((s, tx) => s + (tx.fee || 0), 0);
    const pendingCommissions = agents.reduce((s, a) => s + (a.pending || 0), 0);
    return { platformCommission, agentCommission, transferFees, pendingCommissions };
  }

  function renderStats() {
    const s = computeSummary();
    const cards = [
      { label: 'Total Platform Commission', value: D.fmtFCFA(s.platformCommission), ic: 'ic-brand',  icon: ICONS.platform, meta: `${D.RIDES.length} rides`,       dir: 'up',   trend: 'sum of ride commissions' },
      { label: 'Total Agent Commission',    value: D.fmtFCFA(s.agentCommission),    ic: 'ic-green',  icon: ICONS.agents,   meta: `${D.AGENTS.length} agents`,   dir: 'up',   trend: 'earned to date' },
      { label: 'Total Transfer Fees',        value: D.fmtFCFA(s.transferFees),        ic: 'ic-blue',   icon: ICONS.fees,     meta: `${D.TRANSACTIONS.length} txns`, dir: 'up',   trend: 'fees collected' },
      { label: 'Pending Commissions',        value: D.fmtFCFA(s.pendingCommissions), ic: 'ic-amber',  icon: ICONS.pending,  meta: 'awaiting settlement',          dir: 'down', trend: `${agents.filter(a => a.pending > 0).length} agents due` },
    ];

    document.getElementById('statGrid').innerHTML = cards.map(c => `
      <div class="stat-card">
        <div class="stat-top"><div class="stat-ic ${c.ic}">${c.icon}</div></div>
        <div class="stat-label">${c.label}</div>
        <div class="stat-value">${c.value}</div>
        <div class="stat-meta">
          <span class="trend ${c.dir}">${c.dir === 'up' ? '▲' : '▼'} ${c.trend}</span>
          <span>${c.meta}</span>
        </div>
      </div>
    `).join('');
  }

  /* ---------- City filter (All + unique cities from D.AGENTS) ---------- */
  function renderCityFilter() {
    const select = document.getElementById('filterCity');
    const seen = new Set();
    const cities = [];
    D.AGENTS.forEach(a => {
      if (!seen.has(a.city)) { seen.add(a.city); cities.push(a.city); }
    });
    select.innerHTML = `<option value="">All Cities</option>` +
      cities.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  /* ---------- Filter pipeline ---------- */
  function getFiltered() {
    const q = state.search.trim().toLowerCase();
    return agents.filter(a => {
      if (q && !(`${a.id} ${a.name} ${a.phone} ${a.city}`.toLowerCase().includes(q))) return false;
      if (state.city && a.city !== state.city) return false;
      if (state.status && a.status !== state.status) return false;
      return true;
    });
  }

  /* ---------- Agent name cell (.cell-user with avatar + name) ---------- */
  function agentCell(a) {
    const ini = UI.initials(a.name);
    const col = UI.avatarColor(a.name);
    return `<div class="cell-user">
      <div class="avatar ${col}">${ini}</div>
      <div><div class="name">${a.name}</div></div>
    </div>`;
  }

  /* ---------- Render table body + pagination ---------- */
  function renderTable() {
    const data = getFiltered();
    const info = UI.paginate({ data, page: state.page, pageSize: state.pageSize });
    const tbody = document.getElementById('agentsBody');

    if (info.total === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="padding:0">${UI.emptyStateHTML('No agents match your filters', 'Try clearing filters or searching by a different agent ID, name, phone or city.')}</td></tr>`;
    } else {
      tbody.innerHTML = info.slice.map(a => {
        const pendingCell = a.pending > 0
          ? `<span class="amount red">${D.fmtFCFA(a.pending)}</span>`
          : `<span class="text-muted">${D.fmtFCFA(0)}</span>`;
        const settleBtn = a.pending > 0
          ? `<button class="row-btn" data-settle="${a.id}" title="Settle Pending" aria-label="Settle Pending">${ICONS.cash}</button>`
          : '';
        return `
          <tr>
            <td class="text-bold">${a.id}</td>
            <td>${agentCell(a)}</td>
            <td>${a.phone}</td>
            <td><span class="tag">${a.city}</span></td>
            <td><span class="tabular">${D.fmtNumber(a.txns)}</span></td>
            <td><span class="amount">${D.fmtFCFA(a.volume)}</span></td>
            <td><span class="amount green">${D.fmtFCFA(a.earned)}</span></td>
            <td>${pendingCell}</td>
            <td>${UI.statusBadge(a.status)}</td>
            <td>
              <div class="actions">
                <button class="row-btn" data-view="${a.id}" title="View" aria-label="View">${ICONS.eye}</button>
                ${settleBtn}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => openAgentModal(b.dataset.view)));
      tbody.querySelectorAll('[data-settle]').forEach(b => b.addEventListener('click', () => settlePending(b.dataset.settle)));
    }

    UI.renderPagination(document.getElementById('pagination'), info, (p) => {
      state.page = p;
      renderTable();
    });
  }

  /* ---------- Per-agent settlements (4-5 records, past 30 days) ---------- */
  // Splits the agent's `earned` total across 5 records, dates spread across
  // the past 30 days from TODAY. The last record is Pending if the agent
  // currently has a pending balance (matches the live state of `agents`).
  function agentSettlements(agent) {
    const total = Math.max(0, agent.earned || 0);
    const n = 5;
    const base = Math.floor(total / n);
    const seed = agent.id.charCodeAt(agent.id.length - 1) || 1;
    const out = [];
    let remaining = total;
    for (let i = 0; i < n; i++) {
      let amt;
      if (i === n - 1) {
        amt = Math.max(0, remaining);
      } else {
        const variation = Math.floor(base * 0.25 * Math.sin(seed + i * 1.7));
        amt = Math.max(500, base + variation);
        remaining -= amt;
      }
      const daysAgo = (i + 1) * 6 + (seed % 4);
      const d = new Date(TODAY);
      d.setDate(d.getDate() - daysAgo);
      out.push({
        id: `SETT-${agent.id.split('-').pop()}-${String(i + 1).padStart(2, '0')}`,
        amount: amt,
        date: d.toISOString(),
        status: (i === n - 1 && agent.pending > 0) ? 'Pending' : 'Settled',
      });
    }
    return out;
  }

  /* ---------- Global settlement history (6 demo rows) ---------- */
  // SETT-001..006 — one row per the first 6 agents, each row representing
  // one of the 3-4 splits of that agent's `earned` commission.
  function globalSettlements() {
    const out = [];
    const split = 4;
    for (let i = 0; i < 6; i++) {
      const a = D.AGENTS[i];
      if (!a) break;
      const amount = Math.round((a.earned || 0) / split);
      const daysAgo = (i + 1) * 4 + (i % 2);
      const d = new Date(TODAY);
      d.setDate(d.getDate() - daysAgo);
      out.push({
        id: `SETT-${String(i + 1).padStart(3, '0')}`,
        agent: a.name,
        agentId: a.id,
        amount,
        date: d.toISOString(),
        status: a.pending > 0 ? 'Pending' : 'Settled',
      });
    }
    return out;
  }

  /* ---------- Agent details modal ---------- */
  function openAgentModal(id) {
    const a = agents.find(x => x.id === id);
    if (!a) return;

    const settlements = agentSettlements(a);
    const pendingV = a.pending > 0
      ? `<div class="v amount" style="color:var(--red)">${D.fmtFCFA(a.pending)}</div>`
      : `<div class="v amount">${D.fmtFCFA(a.pending)}</div>`;

    const body = `
      <div class="profile-banner">
        <div class="avatar">${UI.initials(a.name)}</div>
        <div>
          <div class="name">${a.name}</div>
          <div class="sub">${a.id} · ${a.city}</div>
        </div>
      </div>

      <div class="kv-list mt-16">
        <div class="kv"><div class="k">Agent ID</div><div class="v">${a.id}</div></div>
        <div class="kv"><div class="k">Phone</div><div class="v">${a.phone}</div></div>
        <div class="kv"><div class="k">City</div><div class="v"><span class="tag">${a.city}</span></div></div>
        <div class="kv"><div class="k">Total Transactions</div><div class="v tabular">${D.fmtNumber(a.txns)}</div></div>
        <div class="kv"><div class="k">Total Transfer Volume</div><div class="v amount">${D.fmtFCFA(a.volume)}</div></div>
        <div class="kv"><div class="k">Total Commission Earned</div><div class="v amount" style="color:var(--green)">${D.fmtFCFA(a.earned)}</div></div>
        <div class="kv"><div class="k">Pending Commission</div>${pendingV}</div>
        <div class="kv"><div class="k">Status</div><div class="v">${UI.statusBadge(a.status)}</div></div>
      </div>

      <div class="divider"></div>
      <div class="text-muted" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:10px">Recent Commission Settlements</div>
      <div class="table-scroll">
        <table class="tbl">
          <thead>
            <tr><th>Settlement ID</th><th>Amount</th><th>Date</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${settlements.map(s => `
              <tr>
                <td><strong>${s.id}</strong></td>
                <td><span class="amount ${s.status === 'Pending' ? 'red' : 'green'}">${D.fmtFCFA(s.amount)}</span></td>
                <td>${D.fmtDate(s.date, true)}</td>
                <td>${UI.statusBadge(s.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Footer: Settle Pending (if pending > 0) + Block Agent (if Active) + Close
    const foot = `
      ${a.pending > 0 ? `<button class="btn btn-primary" id="agSettle" data-close>Settle Pending</button>` : ''}
      ${a.status === 'Active' ? `<button class="btn btn-danger" id="agBlock" data-close>Block Agent</button>` : ''}
      <button class="btn btn-ghost" data-close>Close</button>
    `;

    UI.modal({
      title: a.name,
      subtitle: a.id,
      body,
      foot,
      size: 'lg',
      onMount: (el) => {
        const settleBtn = el.querySelector('#agSettle');
        if (settleBtn) settleBtn.addEventListener('click', () => { settlePending(a.id); });
        const blockBtn = el.querySelector('#agBlock');
        if (blockBtn) blockBtn.addEventListener('click', () => { blockAgent(a.id); });
      },
    });
  }

  /* ---------- Settle pending (per-agent) ---------- */
  async function settlePending(id) {
    const a = agents.find(x => x.id === id);
    if (!a || a.pending <= 0) return;
    const ok = await UI.confirm({
      title: 'Settle Pending Commission',
      message: `Settle ${D.fmtFCFA(a.pending)} pending commission for agent ${a.name} (${a.id})? This action credits the agent wallet and clears the pending balance in this demo.`,
      confirmText: 'Settle',
      cancelText: 'Cancel',
      danger: false,
    });
    if (!ok) return;
    const settled = a.pending;
    a.pending = 0;
    renderStats();
    renderTable();
    UI.toast('success', 'Commission settled', `${a.id} pending balance cleared — ${D.fmtFCFA(settled)} credited.`);
  }

  /* ---------- Block agent ---------- */
  async function blockAgent(id) {
    const a = agents.find(x => x.id === id);
    if (!a) return;
    const ok = await UI.confirm({
      title: 'Block Agent',
      message: `Block agent ${a.name} (${a.id})? The agent will no longer receive new ride assignments or commission settlements.`,
      confirmText: 'Block Agent',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;
    a.status = 'Inactive';
    renderStats();
    renderTable();
    UI.toast('warning', 'Agent blocked', `${a.id} is now Inactive — no new assignments will be routed.`);
  }

  /* ---------- Commission settlement history modal ---------- */
  function openHistoryModal() {
    const rows = globalSettlements();
    const body = `
      <div class="table-scroll">
        <table class="tbl">
          <thead>
            <tr><th>Settlement ID</th><th>Agent</th><th>Amount</th><th>Date</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td><strong>${r.id}</strong></td>
                <td>
                  <div>${r.agent}</div>
                  <div class="text-muted" style="font-size:11px">${r.agentId}</div>
                </td>
                <td><span class="amount ${r.status === 'Pending' ? 'red' : 'green'}">${D.fmtFCFA(r.amount)}</span></td>
                <td>${D.fmtDate(r.date, true)}</td>
                <td>${UI.statusBadge(r.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    UI.modal({
      title: 'Commission Settlement History',
      subtitle: 'Recent settlement records derived from D.AGENTS',
      body,
      foot: `<button class="btn btn-ghost" data-close>Close</button>`,
      size: 'lg',
    });
  }

  /* ---------- Page-head: Settle Pending (all agents) ---------- */
  async function settleAllPending() {
    const pendingAgents = agents.filter(a => a.pending > 0);
    if (pendingAgents.length === 0) {
      UI.toast('info', 'Nothing to settle', 'No agent currently has a pending commission balance.');
      return;
    }
    const total = pendingAgents.reduce((s, a) => s + a.pending, 0);
    const ok = await UI.confirm({
      title: 'Settle All Pending Commissions',
      message: `Settle pending commissions for ${pendingAgents.length} agent(s), totalling ${D.fmtFCFA(total)}? This is a demo action — connect your backend to wire real wallet transfers.`,
      confirmText: 'Settle All',
      cancelText: 'Cancel',
      danger: false,
    });
    if (!ok) return;
    pendingAgents.forEach(a => { a.pending = 0; });
    renderStats();
    renderTable();
    UI.toast('success', 'Pending commissions settled', `${pendingAgents.length} agents cleared — total ${D.fmtFCFA(total)}.`);
  }

  /* ---------- Page-head: Export CSV ---------- */
  function exportCSV() {
    const data = getFiltered();
    const rows = data.map(a => ({
      'Agent ID':                  a.id,
      'Agent Name':                a.name,
      'Phone':                     a.phone,
      'City':                      a.city,
      'Total Transactions':        a.txns,
      'Total Transfer Volume FCFA': a.volume,
      'Total Commission Earned FCFA': a.earned,
      'Pending Commission FCFA':   a.pending,
      'Status':                    a.status,
    }));
    UI.exportCSV('mototaxi-commissions.csv', rows);
  }

  /* ---------- Tax & Commission Rules card ---------- */
  function wireRuleCard() {
    const feeInput      = document.getElementById('ruleFee');
    const agentInput    = document.getElementById('ruleAgent');
    const platformInput = document.getElementById('rulePlatform');

    document.getElementById('btnSaveRules').addEventListener('click', () => {
      const fee      = parseFloat(feeInput.value);
      const agent    = parseFloat(agentInput.value);
      const platform = parseFloat(platformInput.value);
      if (isNaN(fee) || fee < 0
          || isNaN(agent) || agent < 0 || agent > 100
          || isNaN(platform) || platform < 0 || platform > 100) {
        UI.toast('error', 'Invalid rules', 'Please enter valid numbers — fee ≥ 0 and percentages between 0 and 100.');
        return;
      }
      rules.fee        = fee;
      rules.agentPct   = agent;
      rules.platformPct = platform;
      UI.toast('success', 'Rules saved', 'Rules saved to in-memory demo state — connect your backend to persist.');
    });

    document.getElementById('btnResetRules').addEventListener('click', () => {
      feeInput.value      = DEFAULT_RULES.fee;
      agentInput.value    = DEFAULT_RULES.agentPct;
      platformInput.value = DEFAULT_RULES.platformPct;
      rules.fee        = DEFAULT_RULES.fee;
      rules.agentPct   = DEFAULT_RULES.agentPct;
      rules.platformPct = DEFAULT_RULES.platformPct;
      UI.toast('info', 'Rules reset', `Default values restored — ${DEFAULT_RULES.fee} FCFA fee, ${DEFAULT_RULES.agentPct}% agent, ${DEFAULT_RULES.platformPct}% platform.`);
    });
  }

  /* ---------- Wire toolbar + page actions ---------- */
  function wireEvents() {
    const searchInput = document.getElementById('searchAgents');
    searchInput.addEventListener('input', (e) => {
      state.search = e.target.value;
      state.page = 1;
      renderTable();
    });

    document.getElementById('filterCity').addEventListener('change', (e) => {
      state.city = e.target.value; state.page = 1; renderTable();
    });
    document.getElementById('filterStatus').addEventListener('change', (e) => {
      state.status = e.target.value; state.page = 1; renderTable();
    });

    document.getElementById('btnReset').addEventListener('click', () => {
      state.search = ''; state.city = ''; state.status = '';
      state.page = 1;
      searchInput.value = '';
      document.getElementById('filterCity').value = '';
      document.getElementById('filterStatus').value = '';
      renderTable();
      UI.toast('info', 'Filters reset', 'All filters cleared — showing every agent.');
    });

    document.getElementById('btnExport').addEventListener('click', exportCSV);
    document.getElementById('btnSettleAll').addEventListener('click', settleAllPending);
    document.getElementById('btnHistory').addEventListener('click', openHistoryModal);
  }

  /* ---------- Initial render ---------- */
  renderCityFilter();
  renderStats();
  renderTable();
  wireRuleCard();
  wireEvents();
})();
