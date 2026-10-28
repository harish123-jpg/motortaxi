/* MOTOTAXI ADMIN — Reports & Analytics (Django-backed) */
(function () {
  'use strict';

  const D = window.MOTOTAXI_DATA || {};
  const UI = window.MOTOTAXI_UI || {};

  const payloadNode = document.getElementById('reports-data');
  const DATA = payloadNode
    ? JSON.parse(payloadNode.textContent || '{}')
    : {};

  const stats = DATA.stats || {};
  const trends = Array.isArray(DATA.trend) ? DATA.trend : [];
  const tableRows = Array.isArray(DATA.table_rows)
    ? DATA.table_rows
    : [];

  const vehicleSplit = DATA.vehicle_revenue_split || {
    labels: ['Bike', 'Car', 'Auto'],
    data: [0, 0, 0]
  };

  const txSplit = DATA.tx_status_split || {
    labels: ['Successful', 'Pending', 'Failed'],
    data: [0, 0, 0]
  };

  if (typeof window.bootPage === 'function') {
    window.bootPage('reports', 'Reports & Analytics');
  }

  if (
    window.MOTOTAXI_I18N &&
    typeof window.MOTOTAXI_I18N.applyI18n === 'function'
  ) {
    window.MOTOTAXI_I18N.applyI18n();
  }

  const money = value => {
    const amount = Number(value || 0);

    return typeof D.fmtFCFA === 'function'
      ? D.fmtFCFA(amount)
      : `${amount.toLocaleString()} FCFA`;
  };

  const number = value => {
    const amount = Number(value || 0);

    return typeof D.fmtNumber === 'function'
      ? D.fmtNumber(amount)
      : amount.toLocaleString();
  };

  const ICONS = {
    daily: `
      <svg viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2">
        <path d="M3 17l5-5 4 4 8-8"/>
        <path d="M21 3v8h-8"/>
      </svg>`,

    revenue: `
      <svg viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2">
        <rect x="3" y="5" width="18" height="16" rx="2"/>
        <path d="M3 9h18M8 3v4M16 3v4"/>
      </svg>`,

    commission: `
      <svg viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2">
        <path d="M12 2v20M6 6h8a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h8"/>
      </svg>`,

    payout: `
      <svg viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2">
        <rect x="3" y="6" width="18" height="13" rx="2"/>
        <path d="M3 10h18"/>
        <circle cx="17" cy="14" r="1.2"/>
      </svg>`,

    rides: `
      <svg viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2">
        <circle cx="6" cy="6" r="2.5"/>
        <circle cx="18" cy="18" r="2.5"/>
        <path d="M8.5 6h7a3 3 0 0 1 3 3v6"/>
      </svg>`,

    cancel: `
      <svg viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="9"/>
        <path d="M8 8l8 8M16 8l-8 8"/>
      </svg>`
  };

  /* ---------------- Summary Cards ---------------- */

  function renderStats() {
    const definitions = [
      {
        label: 'Revenue on Final Day',
        value: money(stats.daily_revenue),
        icon: 'daily',
        ic: 'ic-green',
        meta: 'Selected range end date'
      },
      {
        label: 'Total Range Revenue',
        value: money(stats.range_revenue),
        icon: 'revenue',
        ic: 'ic-brand',
        meta: `${trends.length} calendar days`
      },
      {
        label: 'Platform Commission',
        value: money(stats.platform_commission),
        icon: 'commission',
        ic: 'ic-blue',
        meta: 'Completed rides in range'
      },
      {
        label: 'Driver Payouts',
        value: money(stats.driver_payouts),
        icon: 'payout',
        ic: 'ic-purple',
        meta: 'Completed rides in range'
      },
      {
        label: 'Completed Rides',
        value: number(stats.completed_rides),
        icon: 'rides',
        ic: 'ic-amber',
        meta: `Of ${number(stats.total_rides)} total rides`
      },
      {
        label: 'Cancellation Rate',
        value: `${Number(stats.cancellation_rate || 0).toFixed(1)}%`,
        icon: 'cancel',
        ic: 'ic-red',
        meta: `${number(stats.cancelled_rides)} cancelled`
      }
    ];

    const target = document.getElementById('statGrid');
    if (!target) return;

    target.innerHTML = definitions.map(item => `
      <div class="stat-card">
        <div class="stat-top">
          <div class="stat-ic ${item.ic}">
            ${ICONS[item.icon]}
          </div>
        </div>
        <div class="stat-label">${item.label}</div>
        <div class="stat-value">${item.value}</div>
        <div class="stat-meta">
          <span class="text-muted">${item.meta}</span>
        </div>
      </div>
    `).join('');
  }

  /* ---------------- Chart Theme ---------------- */

  function chartTheme() {
    const dark =
      document.documentElement.getAttribute('data-theme') === 'dark';

    return {
      text: dark ? '#a9b6cb' : '#64748b',
      grid: dark
        ? 'rgba(255,255,255,.06)'
        : 'rgba(15,23,42,.06)',
      green: '#16a34a',
      blue: '#2563eb',
      amber: '#f59e0b',
      red: '#dc2626',
      purple: '#7c3aed'
    };
  }

  let charts = [];

  function buildCharts() {
    if (typeof window.Chart === 'undefined') {
      if (typeof UI.toast === 'function') {
        UI.toast(
          'error',
          'Charts unavailable',
          'Chart.js could not be loaded.'
        );
      }
      return;
    }

    charts.forEach(chart => {
      if (chart) chart.destroy();
    });

    charts = [];

    const c = chartTheme();

    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = c.text;

    const labels = trends.map(row => row.label);

    const commonScales = () => ({
      y: {
        ticks: { color: c.text },
        grid: { color: c.grid }
      },
      x: {
        ticks: {
          color: c.text,
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8
        },
        grid: { display: false }
      }
    });

    /* Revenue line chart */
    const revenueCanvas = document.getElementById('chartRevenue');

    if (revenueCanvas) {
      charts.push(new Chart(revenueCanvas, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Revenue (FCFA)',
            data: trends.map(row => row.revenue),
            borderColor: c.green,
            backgroundColor: 'rgba(22,163,74,.12)',
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: context => money(context.parsed.y)
              }
            }
          },
          scales: {
            ...commonScales(),
            y: {
              ...commonScales().y,
              ticks: {
                color: c.text,
                callback: value => `${Math.round(value / 1000)}k`
              }
            }
          }
        }
      }));
    }

    /* Completed rides bar chart */
    const ridesCanvas = document.getElementById('chartRides');

    if (ridesCanvas) {
      charts.push(new Chart(ridesCanvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Completed rides',
            data: trends.map(row => row.rides),
            backgroundColor: c.green,
            borderRadius: 4,
            maxBarThickness: 14
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: commonScales()
        }
      }));
    }

    /* Vehicle revenue doughnut chart */
    const vehicleCanvas = document.getElementById('chartVehicle');

    if (vehicleCanvas) {
      charts.push(new Chart(vehicleCanvas, {
        type: 'doughnut',
        data: {
          labels: vehicleSplit.labels,
          datasets: [{
            data: vehicleSplit.data,
            backgroundColor: [c.green, c.blue, c.purple],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: c.text,
                padding: 14,
                usePointStyle: true,
                pointStyle: 'circle'
              }
            },
            tooltip: {
              callbacks: {
                label: context =>
                  `${context.label}: ${money(context.parsed)}`
              }
            }
          }
        }
      }));
    }

    /* Payment status pie chart */
    const txCanvas = document.getElementById('chartTxStatus');

    if (txCanvas) {
      charts.push(new Chart(txCanvas, {
        type: 'pie',
        data: {
          labels: txSplit.labels,
          datasets: [{
            data: txSplit.data,
            backgroundColor: [c.green, c.amber, c.red],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: c.text,
                padding: 14,
                usePointStyle: true,
                pointStyle: 'circle'
              }
            },
            tooltip: {
              callbacks: {
                label: context =>
                  `${context.label}: ${number(context.parsed)} ride(s)`
              }
            }
          }
        }
      }));
    }
  }

  /* ---------------- Detailed Report Table ---------------- */

  const tableState = {
    search: '',
    sortKey: 'date',
    sortDir: 'asc'
  };

  function getRows() {
    let rows = tableRows.slice();

    if (tableState.search) {
      const query = tableState.search.toLowerCase();

      rows = rows.filter(row =>
        String(row.date || '').toLowerCase().includes(query) ||
        String(row.label || '').toLowerCase().includes(query)
      );
    }

    rows.sort((a, b) => {
      const av = a[tableState.sortKey];
      const bv = b[tableState.sortKey];

      const result = typeof av === 'string'
        ? av.localeCompare(bv)
        : Number(av || 0) - Number(bv || 0);

      return tableState.sortDir === 'asc'
        ? result
        : -result;
    });

    return rows;
  }

  function renderTable() {
    const body = document.querySelector('#reportsTable tbody');
    if (!body) return;

    const rows = getRows();

    if (!rows.length) {
      const emptyHTML = typeof UI.emptyStateHTML === 'function'
        ? UI.emptyStateHTML(
            'No matching days',
            'Try clearing the search or widening the date range.'
          )
        : 'No matching days.';

      body.innerHTML = `
        <tr>
          <td colspan="7" style="padding:0">
            ${emptyHTML}
          </td>
        </tr>
      `;
      return;
    }

    body.innerHTML = rows.map(row => `
      <tr>
        <td>
          <strong>${row.label}</strong>
          <div class="text-muted"
               style="font-size:11px;font-weight:400">
            ${row.date}
          </div>
        </td>
        <td><span class="amount green">${money(row.revenue)}</span></td>
        <td class="tabular">${number(row.rides)}</td>
        <td><span class="amount">${money(row.commission)}</span></td>
        <td><span class="amount">${money(row.payout)}</span></td>
        <td><span class="amount">${money(row.avgFare)}</span></td>
        <td class="tabular">${number(row.cancellations)}</td>
      </tr>
    `).join('');
  }

  /* ---------------- Date Range ---------------- */

  function applyRange(from, to) {
    if (!from || !to) {
      if (typeof UI.toast === 'function') {
        UI.toast(
          'error',
          'Incomplete range',
          'Please select both From and To dates.'
        );
      }
      return;
    }

    if (from > to) {
      if (typeof UI.toast === 'function') {
        UI.toast(
          'error',
          'Invalid range',
          'From date cannot be after the To date.'
        );
      }
      return;
    }

    const url = new URL(window.location.href);

    url.searchParams.set('date_from', from);
    url.searchParams.set('date_to', to);

    window.location.assign(url.toString());
  }

  function isoDateDaysAgo(days) {
    const date = new Date();

    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (days - 1));

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  /* ---------------- Events ---------------- */

  function wireEvents() {
    document.getElementById('btnApplyRange')
      ?.addEventListener('click', () => {
        applyRange(
          document.getElementById('dateFrom').value,
          document.getElementById('dateTo').value
        );
      });

    document.getElementById('btnRange7')
      ?.addEventListener('click', () => {
        applyRange(
          isoDateDaysAgo(7),
          isoDateDaysAgo(1)
        );
      });

    document.getElementById('btnRange30')
      ?.addEventListener('click', () => {
        applyRange(
          isoDateDaysAgo(30),
          isoDateDaysAgo(1)
        );
      });

    document.getElementById('btnRange90')
      ?.addEventListener('click', () => {
        applyRange(
          isoDateDaysAgo(90),
          isoDateDaysAgo(1)
        );
      });

    document.getElementById('searchDate')
      ?.addEventListener('input', event => {
        tableState.search = event.target.value.trim();
        renderTable();
      });

    document.getElementById('sortKey')
      ?.addEventListener('change', event => {
        const [key, direction] = event.target.value.split('|');

        tableState.sortKey = key;
        tableState.sortDir = direction;

        renderTable();
      });

    document.getElementById('btnResetTable')
      ?.addEventListener('click', () => {
        tableState.search = '';
        tableState.sortKey = 'date';
        tableState.sortDir = 'asc';

        document.getElementById('searchDate').value = '';
        document.getElementById('sortKey').value = 'date|asc';

        renderTable();

        if (typeof UI.toast === 'function') {
          UI.toast(
            'info',
            'Table reset',
            'Search and sorting have been reset.'
          );
        }
      });

    document.getElementById('btnExport')
      ?.addEventListener('click', () => {
        const rows = getRows().map(row => ({
          Date: row.label,
          'ISO Date': row.date,
          'Revenue (FCFA)': row.revenue,
          Rides: row.rides,
          'Commission (FCFA)': row.commission,
          'Driver Payouts (FCFA)': row.payout,
          'Avg Fare (FCFA)': row.avgFare,
          Cancellations: row.cancellations
        }));

        if (typeof UI.exportCSV === 'function') {
          UI.exportCSV('mototaxi-report.csv', rows);
        } else {
          exportCSVFallback(rows);
        }
      });

    document.getElementById('btnPrint')
      ?.addEventListener('click', () => {
        if (typeof UI.printPage === 'function') {
          UI.printPage();
        } else {
          window.print();
        }
      });
  }

  /* ---------------- CSV Fallback ---------------- */

  function exportCSVFallback(rows) {
    if (!rows.length) {
      if (typeof UI.toast === 'function') {
        UI.toast(
          'info',
          'No data',
          'There are no rows to export.'
        );
      }
      return;
    }

    const headers = Object.keys(rows[0]);

    const csv = [
      headers.join(','),
      ...rows.map(row =>
        headers.map(key =>
          `"${String(row[key] ?? '').replace(/"/g, '""')}"`
        ).join(',')
      )
    ].join('\r\n');

    const blob = new Blob(
      [csv],
      { type: 'text/csv;charset=utf-8;' }
    );

    const link = document.createElement('a');
    const objectURL = URL.createObjectURL(blob);

    link.href = objectURL;
    link.download = 'mototaxi-report.csv';

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(objectURL);
  }

  /* ---------------- Initialization ---------------- */

  renderStats();
  buildCharts();
  renderTable();
  wireEvents();

  // Rebuild charts if the shared application changes theme.
  new MutationObserver(() => {
    buildCharts();
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

})();