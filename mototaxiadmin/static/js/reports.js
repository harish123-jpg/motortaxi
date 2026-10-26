/* ===================================================================
   MOTOTAXI ADMIN — reports.js
   Renders date-range card, summary stat cards, 4 Chart.js charts and
   a detailed per-day report table. Theme-aware (re-renders charts on
   data-theme change). Filters + sorts the table live.
   =================================================================== */

(function () {
  const D = window.MOTOTAXI_DATA;
  const UI = window.MOTOTAXI_UI;
  const t = window.MOTOTAXI_I18N.t;

  // Bootstrap shared shell
  bootPage('reports', 'Reports & Analytics');
  window.MOTOTAXI_I18N.applyI18n();

  /* ---------- Inline icon set (theme-agnostic, no external font) ---------- */
  const ICONS = {
    daily: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l5-5 4 4 8-8"/><path d="M21 3v8h-8"/></svg>',
    monthly: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4M7 14h4"/></svg>',
    commission: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M6 6h8a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h8"/></svg>',
    payout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="17" cy="14" r="1.2"/></svg>',
    rides: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6h7a3 3 0 0 1 3 3v6"/></svg>',
    cancel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M8 8l8 8M16 8l-8 8"/></svg>',
  };

  /* ---------- State ---------- */
  const TODAY_ISO = '2026-10-26';
  const TODAY = new Date(TODAY_ISO);
  function isoDaysAgo(n) {
    const d = new Date(TODAY);
    d.setDate(d.getDate() - (n - 1));
    return d.toISOString().slice(0, 10);
  }
  const state = {
    dateFrom: isoDaysAgo(30), // 2026-09-27
    dateTo: TODAY_ISO,        // 2026-10-26
    search: '',
    sortKey: 'date',
    sortDir: 'asc',
  };

  /* ---------- Trend subset (filtered by current date range) ---------- */
  function getFilteredTrends() {
    return D.DASHBOARD_TRENDS.filter(d => d.date >= state.dateFrom && d.date <= state.dateTo);
  }

  /* ---------- Stat cards ---------- */
  function renderStats() {
    const trends = getFilteredTrends();
    const lastItem = trends.length ? trends[trends.length - 1] : null;
    const dailyRevenue = lastItem ? lastItem.revenue : 0;
    const monthlyRevenue = trends.reduce((s, d) => s + d.revenue, 0);
    const commission = trends.reduce((s, d) => s + d.commission, 0);
    const payout = trends.reduce((s, d) => s + d.payout, 0);
    const completedRides = D.RIDES.filter(r => r.status === 'Completed').length;
    const totalRides = D.RIDES.length;
    const cancelled = D.RIDES.filter(r => r.status === 'Cancelled').length;
    const cancelRate = totalRides ? (cancelled / totalRides) * 100 : 0;

    const STAT_DEFS = [
      { label: 'Daily Revenue',         value: D.fmtFCFA(dailyRevenue),        icon: 'daily',      ic: 'ic-green',  trend: lastItem ? lastItem.label : '—', dir: 'up'   },
      { label: 'Monthly Revenue',       value: D.fmtFCFA(monthlyRevenue),     icon: 'monthly',     ic: 'ic-brand',  trend: `${trends.length} days`, dir: 'up' },
      { label: 'Platform Commission',   value: D.fmtFCFA(commission),         icon: 'commission',  ic: 'ic-blue',   trend: '~15% of revenue', dir: 'up' },
      { label: 'Driver Payouts',         value: D.fmtFCFA(payout),             icon: 'payout',      ic: 'ic-purple', trend: '~85% of revenue', dir: 'up' },
      { label: 'Total Completed Rides',   value: D.fmtNumber(completedRides),   icon: 'rides',       ic: 'ic-amber',  trend: `of ${D.fmtNumber(totalRides)} total`, dir: 'up' },
      { label: 'Cancellation Rate',       value: cancelRate.toFixed(1) + '%',  icon: 'cancel',      ic: 'ic-red',    trend: `${cancelled} cancelled`, dir: 'down' },
    ];

    document.getElementById('statGrid').innerHTML = STAT_DEFS.map(s => `
      <div class="stat-card">
        <div class="stat-top">
          <div class="stat-ic ${s.ic}">${ICONS[s.icon]}</div>
        </div>
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">${s.value}</div>
        <div class="stat-meta">
          <span class="trend ${s.dir}">${s.dir === 'up' ? '▲' : '▼'} ${s.trend}</span>
        </div>
      </div>
    `).join('');

    // Range badge reflects current span
    const badge = document.getElementById('rangeBadge');
    if (badge) {
      const days = trends.length;
      badge.textContent = days === 0 ? 'No data' : `Last ${days} day${days === 1 ? '' : 's'}`;
    }
  }

  /* ---------- Chart.js global theme ---------- */
  function themeColors() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      text: dark ? '#a9b6cb' : '#64748b',
      grid: dark ? 'rgba(255,255,255,.06)' : 'rgba(15,23,42,.06)',
      brand: '#16a34a',
      brandDark: '#15803d',
      amber: '#f59e0b',
      red: '#dc2626',
      blue: '#2563eb',
      purple: '#7c3aed',
    };
  }
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.font.size = 11;

  let revenueChart, ridesChart, vehicleChart, txStatusChart;

  function buildCharts() {
    const trends = getFilteredTrends();
    const c = themeColors();
    const labels = trends.map(d => d.label);

    // Destroy any existing instances before rebuilding
    [revenueChart, ridesChart, vehicleChart, txStatusChart].forEach(ch => { if (ch) ch.destroy(); });

    /* Revenue over time — line */
    revenueChart = new Chart(document.getElementById('chartRevenue'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Revenue (FCFA)',
          data: trends.map(d => d.revenue),
          borderColor: c.brand,
          backgroundColor: 'rgba(22,163,74,.12)',
          fill: true, tension: .35, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => D.fmtFCFA(ctx.parsed.y) } }
        },
        scales: {
          y: { ticks: { color: c.text, callback: v => (v / 1000) + 'k' }, grid: { color: c.grid } },
          x: { ticks: { color: c.text, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } }
        }
      }
    });

    /* Rides over time — bar */
    ridesChart = new Chart(document.getElementById('chartRides'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Rides',
          data: trends.map(d => d.rides),
          backgroundColor: c.brand,
          borderRadius: 4, barThickness: 'flex', maxBarThickness: 12,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { color: c.text }, grid: { color: c.grid } },
          x: { ticks: { color: c.text, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } }
        }
      }
    });

    /* Revenue by Vehicle Type — doughnut (sum of r.total per type) */
    const bikeRev = D.RIDES.filter(r => r.vehicleType === 'Bike').reduce((s, r) => s + r.total, 0);
    const carRev  = D.RIDES.filter(r => r.vehicleType === 'Car').reduce((s, r) => s + r.total, 0);
    vehicleChart = new Chart(document.getElementById('chartVehicle'), {
      type: 'doughnut',
      data: {
        labels: ['Bike', 'Car'],
        datasets: [{
          data: [bikeRev, carRev],
          backgroundColor: [c.brand, c.blue],
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: {
          legend: { position: 'bottom', labels: { color: c.text, padding: 14, usePointStyle: true, pointStyle: 'circle' } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${D.fmtFCFA(ctx.parsed)}` } }
        }
      }
    });

    /* Payment Status Distribution — pie (counts from TRANSACTIONS) */
    const successful = D.TRANSACTIONS.filter(x => x.status === 'Successful').length;
    const pending    = D.TRANSACTIONS.filter(x => x.status === 'Pending').length;
    const failed     = D.TRANSACTIONS.filter(x => x.status === 'Failed').length;
    txStatusChart = new Chart(document.getElementById('chartTxStatus'), {
      type: 'pie',
      data: {
        labels: ['Successful', 'Pending', 'Failed'],
        datasets: [{
          data: [successful, pending, failed],
          backgroundColor: [c.brand, c.amber, c.red],
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: c.text, padding: 14, usePointStyle: true, pointStyle: 'circle' } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed} txn(s)` } }
        }
      }
    });
  }

  /* Re-render charts on theme change (pattern from dashboard.js) */
  new MutationObserver(() => {
    const c = themeColors();
    Chart.defaults.color = c.text;
    [
      [revenueChart, [c.brand], 'rgba(22,163,74,.12)'],
      [ridesChart, [c.brand], null],
      [vehicleChart, [c.brand, c.blue], null],
      [txStatusChart, [c.brand, c.amber, c.red], null],
    ].forEach(([chart, colors, bg]) => {
      if (!chart) return;
      if (chart.config.type === 'line') {
        chart.data.datasets[0].borderColor = colors[0];
        chart.data.datasets[0].backgroundColor = bg;
      } else {
        chart.data.datasets[0].backgroundColor = colors;
      }
      ['x', 'y'].forEach(ax => {
        if (chart.options.scales && chart.options.scales[ax]) {
          chart.options.scales[ax].ticks.color = c.text;
          if (chart.options.scales[ax].grid) chart.options.scales[ax].grid.color = c.grid;
        }
      });
      if (chart.options.plugins && chart.options.plugins.legend) {
        chart.options.plugins.legend.labels.color = c.text;
      }
      chart.update();
    });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- Detailed report table ---------- */
  function getTableRows() {
    const trends = getFilteredTrends();
    let rows = trends.map(d => ({
      date: d.date,
      label: d.label,
      revenue: d.revenue,
      rides: d.rides,
      commission: d.commission,
      payout: d.payout,
      avgFare: d.rides > 0 ? Math.round(d.revenue / d.rides) : 0,
      cancellations: Math.round(d.rides * 0.12),
    }));

    // Search by date — match either the human label or ISO date
    if (state.search) {
      const q = state.search.toLowerCase();
      rows = rows.filter(d =>
        d.label.toLowerCase().includes(q) ||
        d.date.toLowerCase().includes(q)
      );
    }

    // Sort via shared helper
    rows = UI.sortData(rows, state.sortKey, state.sortDir);
    return rows;
  }

  function renderTable() {
    const rows = getTableRows();
    const body = document.querySelector('#reportsTable tbody');
    if (rows.length === 0) {
      body.innerHTML = `<tr><td colspan="7" style="padding:0">${UI.emptyStateHTML('No matching days', 'Try clearing the date search or widening the date range.')}</td></tr>`;
      return;
    }
    body.innerHTML = rows.map(d => `
      <tr>
        <td><strong>${d.label}</strong><div class="text-muted" style="font-size:11px;font-weight:400">${d.date}</div></td>
        <td><span class="amount green">${D.fmtFCFA(d.revenue)}</span></td>
        <td class="tabular">${D.fmtNumber(d.rides)}</td>
        <td><span class="amount">${D.fmtFCFA(d.commission)}</span></td>
        <td><span class="amount">${D.fmtFCFA(d.payout)}</span></td>
        <td><span class="amount">${D.fmtFCFA(d.avgFare)}</span></td>
        <td class="tabular">${d.cancellations}</td>
      </tr>
    `).join('');
  }

  /* ---------- Range controls ---------- */
  function setQuickRange(days) {
    const from = isoDaysAgo(days);
    document.getElementById('dateFrom').value = from;
    document.getElementById('dateTo').value = TODAY_ISO;
    state.dateFrom = from;
    state.dateTo = TODAY_ISO;
    renderStats();
    buildCharts();
    renderTable();
    UI.toast('info', `${days}-day range applied`, `Reports recomputed for the last ${days} day${days === 1 ? '' : 's'}.`);
  }

  function applyRange() {
    const fromVal = document.getElementById('dateFrom').value;
    const toVal   = document.getElementById('dateTo').value;
    if (!fromVal || !toVal) {
      UI.toast('error', 'Incomplete range', 'Please pick both From and To dates.');
      return;
    }
    if (fromVal > toVal) {
      UI.toast('error', 'Invalid range', 'From date cannot be after the To date.');
      return;
    }
    state.dateFrom = fromVal;
    state.dateTo = toVal;
    renderStats();
    buildCharts();
    renderTable();
    UI.toast('success', 'Range applied', `Reports updated for ${fromVal} → ${toVal}.`);
  }

  /* ---------- Wire events ---------- */
  function wireEvents() {
    document.getElementById('btnApplyRange').addEventListener('click', applyRange);
    document.getElementById('btnRange7').addEventListener('click', () => setQuickRange(7));
    document.getElementById('btnRange30').addEventListener('click', () => setQuickRange(30));
    document.getElementById('btnRange90').addEventListener('click', () => setQuickRange(90));

    document.getElementById('searchDate').addEventListener('input', (e) => {
      state.search = e.target.value.trim();
      renderTable();
    });

    document.getElementById('sortKey').addEventListener('change', (e) => {
      const [key, dir] = e.target.value.split('|');
      state.sortKey = key;
      state.sortDir = dir;
      renderTable();
    });

    document.getElementById('btnResetTable').addEventListener('click', () => {
      state.search = '';
      state.sortKey = 'date';
      state.sortDir = 'asc';
      document.getElementById('searchDate').value = '';
      document.getElementById('sortKey').value = 'date|asc';
      renderTable();
      UI.toast('info', 'Table reset', 'Search cleared and sort reset to date ascending.');
    });

    document.getElementById('btnExport').addEventListener('click', () => {
      const rows = getTableRows().map(d => ({
        Date: d.label,
        'ISO Date': d.date,
        'Revenue (FCFA)': d.revenue,
        Rides: d.rides,
        'Commission (FCFA)': d.commission,
        'Driver Payouts (FCFA)': d.payout,
        'Avg Fare (FCFA)': d.avgFare,
        Cancellations: d.cancellations,
      }));
      UI.exportCSV('mototaxi-report.csv', rows);
    });

    document.getElementById('btnPrint').addEventListener('click', () => {
      UI.printPage();
    });
  }

  /* ---------- Init ---------- */
  document.getElementById('dateFrom').value = state.dateFrom;
  document.getElementById('dateTo').value = state.dateTo;
  renderStats();
  buildCharts();
  renderTable();
  wireEvents();
})();
