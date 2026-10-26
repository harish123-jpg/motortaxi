
/* MOTOTAXI Admin — database-connected commissions page */
(function () {
  "use strict";

  const D = window.MOTOTAXI_DATA || {};
  const UI = window.MOTOTAXI_UI;
  const drivers = Array.isArray(D.COMMISSION_DRIVERS)
    ? D.COMMISSION_DRIVERS
    : [];
  const pricing = Array.isArray(D.COMMISSION_PRICING)
    ? D.COMMISSION_PRICING
    : [];

  bootPage("commissions", "Commission Management");

  if (window.MOTOTAXI_I18N?.applyI18n) {
    window.MOTOTAXI_I18N.applyI18n();
  }

  const state = {
    search: "",
    location: "",
    status: "",
    page: 1,
    pageSize: 6
  };

  const ICONS = {
    drivers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/></svg>',
    earnings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>',
    trips: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 13l2-6h14l2 6v6H3z"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/></svg>',
    volume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 3 5-7"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>'
  };

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function money(value) {
    if (value === null || value === undefined || value === "") return "—";
    const number = Number(value);
    return Number.isFinite(number)
      ? D.fmtFCFA(number)
      : `${escapeHTML(value)} FCFA`;
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? D.fmtNumber(parsed) : "—";
  }

  function badge(value) {
    return UI.statusBadge(escapeHTML(value || "Unknown"));
  }

  function driverStatusMatches(driver) {
    if (!state.status) return true;
    return String(driver.status || "").toLowerCase() ===
      state.status.toLowerCase();
  }

  function getFiltered() {
    const query = state.search.trim().toLowerCase();

    return drivers.filter(driver => {
      const searchable = [
        driver.id,
        driver.pk,
        driver.name,
        driver.phone,
        driver.location,
        driver.licenseNumber
      ].join(" ").toLowerCase();

      if (query && !searchable.includes(query)) return false;
      if (state.location && driver.location !== state.location) return false;
      if (!driverStatusMatches(driver)) return false;

      return true;
    });
  }

  function renderStats() {
    const totalEarned = drivers.reduce(
      (sum, driver) => sum + (Number(driver.earned) || 0), 0
    );
    const totalTrips = drivers.reduce(
      (sum, driver) => sum + (Number(driver.trips) || 0), 0
    );
    const totalVolume = drivers.reduce(
      (sum, driver) => sum + (Number(driver.volume) || 0), 0
    );

    const cards = [
      {
        label: "Registered Drivers",
        value: number(drivers.length),
        icon: ICONS.drivers,
        className: "ic-brand",
        meta: "Drivers in database"
      },
      {
        label: "Commission Earned",
        value: money(totalEarned),
        icon: ICONS.earnings,
        className: "ic-green",
        meta: "From existing commission calculations"
      },
      {
        label: "Total Trips",
        value: number(totalTrips),
        icon: ICONS.trips,
        className: "ic-blue",
        meta: "Reported by commission service"
      },
      {
        label: "Ride Volume",
        value: money(totalVolume),
        icon: ICONS.volume,
        className: "ic-amber",
        meta: "Reported by commission service"
      }
    ];

    document.getElementById("statGrid").innerHTML = cards.map(card => `
      <div class="stat-card">
        <div class="stat-top">
          <div class="stat-ic ${card.className}">${card.icon}</div>
        </div>
        <div class="stat-label">${card.label}</div>
        <div class="stat-value">${card.value}</div>
        <div class="stat-meta"><span>${card.meta}</span></div>
      </div>
    `).join("");
  }

  function renderLocationFilter() {
    const select = document.getElementById("filterCity");
    const locations = [...new Set(
      drivers.map(driver => driver.location).filter(
        location => location && location !== "—"
      )
    )].sort();

    select.innerHTML =
      '<option value="">All Locations</option>' +
      locations.map(location =>
        `<option value="${escapeHTML(location)}">${escapeHTML(location)}</option>`
      ).join("");
  }

  function driverCell(driver) {
    const initials = UI.initials(driver.name || "Driver");
    const color = UI.avatarColor(driver.name || "Driver");

    return `
      <div class="cell-user">
        <div class="avatar ${escapeHTML(color)}">${escapeHTML(initials)}</div>
        <div>
          <div class="name">${escapeHTML(driver.name || "Unknown driver")}</div>
          <div class="text-muted" style="font-size:11px">
            ${escapeHTML(driver.licenseNumber || "No licence number")}
          </div>
        </div>
      </div>
    `;
  }

  function renderTable() {
    const filtered = getFiltered();
    const info = UI.paginate({
      data: filtered,
      page: state.page,
      pageSize: state.pageSize
    });
    const tbody = document.getElementById("agentsBody");

    if (!info.total) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="padding:0">
            ${UI.emptyStateHTML(
              "No drivers found",
              "Try another search or clear your filters."
            )}
          </td>
        </tr>`;
    } else {
      tbody.innerHTML = info.slice.map(driver => `
        <tr>
          <td class="text-bold">${escapeHTML(driver.id)}</td>
          <td>${driverCell(driver)}</td>
          <td>${escapeHTML(driver.phone || "—")}</td>
          <td><span class="tag">${escapeHTML(driver.location || "—")}</span></td>
          <td><span class="tabular">${number(driver.trips)}</span></td>
          <td><span class="amount">${money(driver.volume)}</span></td>
          <td><span class="amount green">${money(driver.earned)}</span></td>
          <td>
            <span class="text-muted" title="Settlement tracking is not available">
              Not tracked
            </span>
          </td>
          <td>
            ${badge(driver.status)}
            <div class="text-muted" style="font-size:11px;margin-top:4px">
              ${escapeHTML(driver.verificationStatus || "")}
            </div>
          </td>
          <td>
            <div class="actions">
              <button class="row-btn" data-view="${Number(driver.pk)}"
                title="View driver commission" aria-label="View driver commission">
                ${ICONS.eye}
              </button>
            </div>
          </td>
        </tr>
      `).join("");

      tbody.querySelectorAll("[data-view]").forEach(button => {
        button.addEventListener("click", () => {
          openDriverDetails(Number(button.dataset.view));
        });
      });
    }

    UI.renderPagination(
      document.getElementById("pagination"),
      info,
      page => {
        state.page = page;
        renderTable();
      }
    );
  }

  function openDriverDetails(pk) {
    const driver = drivers.find(item => Number(item.pk) === pk);
    if (!driver) return;

    const body = `
      <div class="profile-banner">
        <div class="avatar">${escapeHTML(UI.initials(driver.name || "Driver"))}</div>
        <div>
          <div class="name">${escapeHTML(driver.name || "Unknown driver")}</div>
          <div class="sub">${escapeHTML(driver.id)}</div>
        </div>
      </div>

      <div class="kv-list mt-16">
        <div class="kv"><div class="k">Driver ID</div><div class="v">${escapeHTML(driver.id)}</div></div>
        <div class="kv"><div class="k">Phone</div><div class="v">${escapeHTML(driver.phone || "—")}</div></div>
        <div class="kv"><div class="k">Location</div><div class="v">${escapeHTML(driver.location || "—")}</div></div>
        <div class="kv"><div class="k">Licence Number</div><div class="v">${escapeHTML(driver.licenseNumber || "—")}</div></div>
        <div class="kv"><div class="k">Driver Status</div><div class="v">${badge(driver.status)}</div></div>
        <div class="kv"><div class="k">Verification</div><div class="v">${badge(driver.verificationStatus)}</div></div>
        <div class="kv"><div class="k">Total Trips</div><div class="v tabular">${number(driver.trips)}</div></div>
        <div class="kv"><div class="k">Ride Volume</div><div class="v amount">${money(driver.volume)}</div></div>
        <div class="kv"><div class="k">Commission Earned</div><div class="v amount">${money(driver.earned)}</div></div>
        <div class="kv"><div class="k">Wallet Balance</div><div class="v amount">${money(driver.walletBalance)}</div></div>
        <div class="kv"><div class="k">Pending Settlement</div><div class="v">Not tracked by current database</div></div>
      </div>

      <div class="divider"></div>
      <p class="text-muted" style="font-size:12px">
        Settlement history is unavailable because the current application
        does not have a commission settlement model.
      </p>
    `;

    UI.modal({
      title: "Driver Commission Details",
      subtitle: driver.id,
      body,
      foot: '<button class="btn btn-ghost" data-close>Close</button>',
      size: "lg"
    });
  }

  function renderPricingRules() {
    const tbody = document.getElementById("pricingRulesBody");

    if (!pricing.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="padding:0">
            ${UI.emptyStateHTML(
              "No pricing rules found",
              "Add vehicle pricing records to display commission settings."
            )}
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = pricing.map(rule => `
      <tr>
        <td><strong>${escapeHTML(rule.vehicleType)}</strong></td>
        <td>${money(rule.baseFare)}</td>
        <td>${money(rule.perKmRate)}</td>
        <td>${money(rule.minimumFare)}</td>
        <td><span class="amount">${escapeHTML(rule.platformCommissionPercent)}%</span></td>
      </tr>
    `).join("");
  }

  function exportCSV() {
    const rows = getFiltered().map(driver => ({
      "Driver ID": driver.id,
      "Driver Name": driver.name,
      "Phone": driver.phone,
      "Location": driver.location,
      "Licence Number": driver.licenseNumber,
      "Driver Status": driver.status,
      "Verification Status": driver.verificationStatus,
      "Total Trips": driver.trips,
      "Ride Volume FCFA": driver.volume,
      "Commission Earned FCFA": driver.earned,
      "Pending Settlement": "Not tracked"
    }));

    if (!rows.length) {
      UI.toast("info", "No data to export", "No drivers match the current filters.");
      return;
    }

    UI.exportCSV("mototaxi-driver-commissions.csv", rows);
  }

  function showCommissionInfo() {
    const body = `
      <p>
        Commission totals are calculated by the existing backend commission
        service. Pricing rules shown here are loaded from the VehiclePricing
        database model.
      </p>
      <p>
        The current schema does not record commission settlement transactions,
        settlement status, or agent commissions. Therefore, this page does not
        mark commissions as settled or claim that a payout has occurred.
      </p>
    `;

    UI.modal({
      title: "Commission Information",
      subtitle: "Current backend capabilities",
      body,
      foot: '<button class="btn btn-ghost" data-close>Close</button>',
      size: "md"
    });
  }

  function wireEvents() {
    const search = document.getElementById("searchAgents");
    const location = document.getElementById("filterCity");
    const status = document.getElementById("filterStatus");

    search.addEventListener("input", event => {
      state.search = event.target.value;
      state.page = 1;
      renderTable();
    });

    location.addEventListener("change", event => {
      state.location = event.target.value;
      state.page = 1;
      renderTable();
    });

    status.addEventListener("change", event => {
      state.status = event.target.value;
      state.page = 1;
      renderTable();
    });

    document.getElementById("btnReset").addEventListener("click", () => {
      state.search = "";
      state.location = "";
      state.status = "";
      state.page = 1;

      search.value = "";
      location.value = "";
      status.value = "";

      renderTable();
      UI.toast("info", "Filters reset", "Showing all drivers.");
    });

    document.getElementById("btnExport").addEventListener("click", exportCSV);
    document.getElementById("btnHistory").addEventListener("click", showCommissionInfo);
  }

  renderStats();
  renderLocationFilter();
  renderTable();
  renderPricingRules();
  wireEvents();
})();
