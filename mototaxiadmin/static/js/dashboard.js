
/* ===================================================================
   MOTOTAXI ADMIN — dashboard.js
   Existing UI preserved; dashboard data comes from Django.
   =================================================================== */

(function () {
  "use strict";

  const D = window.MOTOTAXI_DATA;
  const UI = window.MOTOTAXI_UI;

  if (!D) {
    console.error("MOTOTAXI_DATA is missing. Check dashboard.html.");
    return;
  }

  // Preserve the existing shared application shell.
  bootPage("dashboard", "Dashboard");
  window.MOTOTAXI_I18N.applyI18n();

  const STATS = D.DASH_STATS || {};
  const trends = D.DASHBOARD_TRENDS || [];
  const vehicleSplit = D.VEHICLE_SPLIT || { labels: [], data: [] };
  const txSplit = D.TX_STATUS_SPLIT || { labels: [], data: [] };
  const recentBookings = D.RECENT_BOOKINGS || [];
  const recentTxns = D.RECENT_TXNS || [];
  const activityFeed = D.ACTIVITY_FEED || [];
  const agents = D.AGENTS || [];

  const fmtMoney = (value) => D.fmtFCFA(Number(value || 0));

  const fmtDate = (value) => {
    if (!value) return "—";
    return D.fmtDate(value, true);
  };

  // Prevent database text from being interpreted as HTML.
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  /* ---------- Stat cards: original UI and icons ---------- */

  const STAT_DEFS = [
    {
      label: "Total Customers",
      value: Number(STATS.totalCustomers || 0).toLocaleString(),
      icon: "customers",
      ic: "ic-brand"
    },
    {
      label: "Active Drivers",
      value: Number(STATS.activeDrivers || 0).toLocaleString(),
      icon: "drivers",
      ic: "ic-blue"
    },
    {
      label: "Total Rides Today",
      value: Number(STATS.ridesToday || 0).toLocaleString(),
      icon: "rides",
      ic: "ic-purple"
    },
    {
      label: "Revenue Today",
      value: fmtMoney(STATS.revenueToday),
      icon: "wallets",
      ic: "ic-green"
    },
    {
      label: "Platform Commission",
      value: fmtMoney(STATS.commissionToday),
      icon: "commissions",
      ic: "ic-brand"
    },
    {
      label: "Total Wallet Balance",
      value: fmtMoney(STATS.totalWalletBalance),
      icon: "wallets",
      ic: "ic-amber"
    },
    {
      label: "Pending Transactions",
      value: Number(STATS.pendingTxns || 0).toLocaleString(),
      icon: "transactions",
      ic: "ic-red"
    }
  ];

  const ICONS = {
    customers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>',
    drivers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 5h10l4 5-2 5H4l-2-5 4-5z"/><circle cx="7" cy="15" r="1.5"/><circle cx="15" cy="15" r="1.5"/></svg>',
    rides: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6h7a3 3 0 0 1 3 3v6"/></svg>',
    wallets: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="17" cy="14" r="1.2"/></svg>',
    commissions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M6 6h8a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h8"/></svg>',
    transactions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h13l-3-3M20 17H7l3 3"/></svg>'
  };

  const statGrid = document.getElementById("statGrid");

  if (statGrid) {
    statGrid.innerHTML = STAT_DEFS.map((stat) => `
      <div class="stat-card">
        <div class="stat-top">
          <div class="stat-ic ${stat.ic}">
            ${ICONS[stat.icon]}
          </div>
        </div>
        <div class="stat-label">${escapeHTML(stat.label)}</div>
        <div class="stat-value">${escapeHTML(stat.value)}</div>
        <div class="stat-meta">
          <span class="trend up">● Live</span>
          <span>database data</span>
        </div>
      </div>
    `).join("");
  }

  /* ---------- Chart.js global theme ---------- */

  function themeColors() {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";

    return {
      text: dark ? "#a9b6cb" : "#64748b",
      grid: dark ? "rgba(255,255,255,.06)" : "rgba(15,23,42,.06)",
      brand: "#16a34a",
      brandDark: "#15803d",
      amber: "#f59e0b",
      red: "#dc2626",
      blue: "#2563eb",
      purple: "#7c3aed"
    };
  }

  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.font.size = 11;

  /* ---------- Revenue line chart ---------- */

  const revenueChart = new Chart(
    document.getElementById("chartRevenue"),
    {
      type: "line",
      data: {
        labels: trends.map((item) => item.label),
        datasets: [{
          label: "Revenue (FCFA)",
          data: trends.map((item) => Number(item.revenue || 0)),
          borderColor: themeColors().brand,
          backgroundColor: "rgba(22,163,74,.12)",
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
              label: (context) => fmtMoney(context.parsed.y)
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: themeColors().text,
              callback: (value) => (value / 1000) + "k"
            },
            grid: { color: themeColors().grid }
          },
          x: {
            ticks: {
              color: themeColors().text,
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8
            },
            grid: { display: false }
          }
        }
      }
    }
  );

  /* ---------- Vehicle doughnut: real database aggregation ---------- */

  const vehicleChart = new Chart(
    document.getElementById("chartVehicle"),
    {
      type: "doughnut",
      data: {
        labels: vehicleSplit.labels || [],
        datasets: [{
          data: vehicleSplit.data || [],
          backgroundColor: [
            themeColors().brand,
            themeColors().blue,
            themeColors().amber
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: themeColors().text,
              padding: 14,
              usePointStyle: true,
              pointStyle: "circle"
            }
          }
        }
      }
    }
  );

  /* ---------- Rides bar chart ---------- */

  const ridesChart = new Chart(
    document.getElementById("chartRides"),
    {
      type: "bar",
      data: {
        labels: trends.map((item) => item.label),
        datasets: [{
          label: "Rides",
          data: trends.map((item) => Number(item.rides || 0)),
          backgroundColor: themeColors().brand,
          borderRadius: 4,
          barThickness: "flex",
          maxBarThickness: 12
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: themeColors().text },
            grid: { color: themeColors().grid }
          },
          x: {
            ticks: {
              color: themeColors().text,
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8
            },
            grid: { display: false }
          }
        }
      }
    }
  );

  /* ---------- Transaction status pie: real payment status counts ---------- */

  const txStatusChart = new Chart(
    document.getElementById("chartTxStatus"),
    {
      type: "pie",
      data: {
        labels: txSplit.labels || [],
        datasets: [{
          data: txSplit.data || [],
          backgroundColor: [
            themeColors().brand,
            themeColors().amber,
            themeColors().red
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: themeColors().text,
              padding: 14,
              usePointStyle: true,
              pointStyle: "circle"
            }
          }
        }
      }
    }
  );

  /* ---------- Top drivers by earnings ---------- */

  const topAgents = [...agents]
    .sort((a, b) => Number(b.earned || 0) - Number(a.earned || 0))
    .slice(0, 5);

  const agentsChart = new Chart(
    document.getElementById("chartAgents"),
    {
      type: "bar",
      data: {
        labels: topAgents.map(
          (agent) => agent.label || `Driver ${agent.id}`
        ),
        datasets: [{
          label: "Driver earnings (FCFA)",
          data: topAgents.map((agent) => Number(agent.earned || 0)),
          backgroundColor: themeColors().brand,
          borderRadius: 4,
          barThickness: 18
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => fmtMoney(context.parsed.x)
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              color: themeColors().text,
              callback: (value) => (value / 1000) + "k"
            },
            grid: { color: themeColors().grid }
          },
          y: {
            ticks: { color: themeColors().text },
            grid: { display: false }
          }
        }
      }
    }
  );

  /* ---------- Preserve theme switching for all charts ---------- */

  new MutationObserver(() => {
    const colors = themeColors();

    Chart.defaults.color = colors.text;

    [
      [revenueChart, [colors.brand], "rgba(22,163,74,.12)"],
      [vehicleChart, [colors.brand, colors.blue, colors.amber], null],
      [ridesChart, [colors.brand], null],
      [txStatusChart, [colors.brand, colors.amber, colors.red], null],
      [agentsChart, [colors.brand], null]
    ].forEach(([chart, palette, background]) => {
      if (chart.config.type === "line") {
        chart.data.datasets[0].borderColor = palette[0];
        chart.data.datasets[0].backgroundColor = background;
      } else {
        chart.data.datasets[0].backgroundColor = palette;
      }

      ["x", "y"].forEach((axis) => {
        const scale = chart.options.scales && chart.options.scales[axis];

        if (scale) {
          scale.ticks.color = colors.text;

          if (scale.grid) {
            scale.grid.color = colors.grid;
          }
        }
      });

      if (chart.options.plugins.legend) {
        chart.options.plugins.legend.labels.color = colors.text;
      }

      chart.update();
    });
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"]
  });

  /* ---------- Recent bookings: original table classes ---------- */

  const rbBody = document.querySelector("#recentBookingsTbl tbody");

  if (rbBody) {
    rbBody.innerHTML = recentBookings.length
      ? recentBookings.map((ride) => `
        <tr>
          <td><strong>${escapeHTML(ride.id)}</strong></td>
          <td>${escapeHTML(ride.customer)}</td>
          <td>${escapeHTML(ride.driver)}</td>
          <td>${escapeHTML(ride.pickup)}</td>
          <td>${escapeHTML(ride.drop)}</td>
          <td><span class="tag">${escapeHTML(ride.vehicleType)}</span></td>
          <td><span class="amount green">${escapeHTML(fmtMoney(ride.total))}</span></td>
          <td>${UI.statusBadge(ride.status)}</td>
        </tr>
      `).join("")
      : '<tr><td colspan="8">No bookings found.</td></tr>';
  }

  /* ---------- Recent transactions: original table classes ---------- */

  const rtBody = document.querySelector("#recentTxnsTbl tbody");

  if (rtBody) {
    rtBody.innerHTML = recentTxns.length
      ? recentTxns.map((txn) => {
        const directionIcon = txn.direction === "Sent"
          ? '<span class="arrow-cell up">▲ Sent</span>'
          : '<span class="arrow-cell down">▼ Received</span>';

        return `
          <tr>
            <td><strong>${escapeHTML(txn.id)}</strong></td>
            <td>${escapeHTML(txn.sender)}</td>
            <td>${escapeHTML(txn.receiver)}</td>
            <td>${directionIcon}</td>
            <td><span class="amount">${escapeHTML(fmtMoney(txn.amount))}</span></td>
            <td><span class="tag">${escapeHTML(txn.type)}</span></td>
            <td>${UI.statusBadge(txn.status)}</td>
            <td>${escapeHTML(fmtDate(txn.date))}</td>
          </tr>
        `;
      }).join("")
      : '<tr><td colspan="8">No wallet transactions found.</td></tr>';
  }

  /* ---------- Activity feed: preserve original timeline styling ---------- */

  const feed = document.getElementById("activityFeed");

  if (feed) {
    feed.innerHTML = activityFeed.length
      ? activityFeed.map((activity, index, all) => `
        <div class="activity-item">
          <div class="dot-col">
            <span class="dot dot-${escapeHTML(activity.kind)}"></span>
            ${index < all.length - 1 ? '<div class="line"></div>' : ""}
          </div>
          <div class="content">
            <div class="ttl">${escapeHTML(activity.title)}</div>
            <div class="desc">${escapeHTML(activity.desc)}</div>
            <div class="time">${escapeHTML(fmtDate(activity.time))}</div>
          </div>
        </div>
      `).join("")
      : "<p>No recent activity found.</p>";
  }

  /* ---------- Actions: use the existing UI helpers ---------- */

  const refreshButton = document.getElementById("btnRefresh");

  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      if (UI && typeof UI.toast === "function") {
        UI.toast("info", "Refreshing", "Loading latest dashboard data…");
      }

      // Fetch fresh Django-rendered database data.
      window.location.reload();
    });
  }

  const exportButton = document.getElementById("btnExport");

  if (exportButton) {
    exportButton.addEventListener("click", () => {
      if (!UI || typeof UI.exportCSV !== "function") {
        console.error("MOTOTAXI_UI.exportCSV is unavailable.");
        return;
      }

      UI.exportCSV("mototaxi-dashboard-snapshot.csv", [
        {
          Metric: "Total Customers",
          Value: STATS.totalCustomers || 0
        },
        {
          Metric: "Active Drivers",
          Value: STATS.activeDrivers || 0
        },
        {
          Metric: "Rides Today",
          Value: STATS.ridesToday || 0
        },
        {
          Metric: "Revenue Today (FCFA)",
          Value: STATS.revenueToday || 0
        },
        {
          Metric: "Commission Today (FCFA)",
          Value: STATS.commissionToday || 0
        },
        {
          Metric: "Wallet Balance (FCFA)",
          Value: STATS.totalWalletBalance || 0
        },
        {
          Metric: "Pending Ride Payments",
          Value: STATS.pendingTxns || 0
        }
      ]);
    });
  }
})();
