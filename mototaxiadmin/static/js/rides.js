
/* MOTOTAXI ADMIN — Django-connected Rides / Bookings page */
(function () {
  'use strict';

  const D = window.MOTOTAXI_DATA || {};
  const UI = window.MOTOTAXI_UI;

  bootPage('rides', 'Rides / Bookings');
  window.MOTOTAXI_I18N.applyI18n();

  const rides = (D.RIDES || []).map(ride => ({
    ...ride,
    id: String(ride.id),
    status: String(ride.status || 'Unknown'),
    city: String(ride.city || '')
  }));

  const cities = D.CAM_CITIES || [];

  const state = {
    search: '',
    status: '',
    vehicleType: '',
    city: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    pageSize: 6
  };

  const ICONS = {
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    ride: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l2-6a3 3 0 0 1 3-2h8a3 3 0 0 1 3 2l2 6v3h-2v-2H5v2H3z"/><circle cx="7.5" cy="17" r="1"/><circle cx="16.5" cy="17" r="1"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4 10-10"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    cancel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
    money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v6M18 9v6"/></svg>',
    receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>'
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  }

  function num(value) {
    const result = Number(value || 0);
    return Number.isFinite(result) ? result : 0;
  }

  function fmtMoney(value) {
    return typeof D.fmtFCFA === 'function'
      ? D.fmtFCFA(num(value))
      : `${num(value).toLocaleString('fr-FR')} FCFA`;
  }

  function fmtNumber(value) {
    return typeof D.fmtNumber === 'function'
      ? D.fmtNumber(num(value))
      : num(value).toLocaleString();
  }

  function fmtDate(value, withTime = true) {
    if (!value) return '—';

    if (typeof D.fmtDate === 'function') {
      return D.fmtDate(value, withTime);
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return withTime ? date.toLocaleString() : date.toLocaleDateString();
  }

  function typeTag(type) {
    if (type === 'Bike') {
      return '<span class="tag" style="background:var(--green-bg);color:var(--green)">Bike</span>';
    }
    if (type === 'Car') {
      return '<span class="tag" style="background:var(--blue-bg);color:var(--blue)">Car</span>';
    }
    return `<span class="tag">${esc(type || 'Unknown')}</span>`;
  }

  function driverCell(name) {
    if (!name || name === '—') {
      return '<span class="text-muted">—</span>';
    }
    return `<span class="text-bold">${esc(name)}</span>`;
  }

  function renderCityFilter() {
    const select = document.getElementById('filterCity');
    const usedCities = [...new Set(
      rides.map(ride => ride.city).filter(Boolean)
    )];

    const orderedCities = [
      ...cities.filter(city => usedCities.includes(city)),
      ...usedCities.filter(city => !cities.includes(city))
    ];

    select.innerHTML = '<option value="">All Cities</option>' +
      orderedCities.map(city =>
        `<option value="${esc(city)}">${esc(city)}</option>`
      ).join('');
  }

  function renderStats() {
    const total = rides.length;
    const completed = rides.filter(r => r.status === 'Completed').length;
    const ongoing = rides.filter(r => r.status === 'Ongoing').length;
    const cancelled = rides.filter(r => r.status === 'Cancelled').length;
    const revenue = rides.reduce((sum, ride) => sum + num(ride.total), 0);

    const pct = value => total ? Math.round(value / total * 100) : 0;

    const stats = [
      {
        label: 'Total Rides',
        value: fmtNumber(total),
        ic: 'ic-brand',
        icon: ICONS.ride,
        trend: `${completed} completed`,
        dir: 'up',
        meta: 'all records'
      },
      {
        label: 'Completed',
        value: fmtNumber(completed),
        ic: 'ic-green',
        icon: ICONS.check,
        trend: `${pct(completed)}% completed`,
        dir: 'up',
        meta: 'successful rides'
      },
      {
        label: 'Ongoing',
        value: fmtNumber(ongoing),
        ic: 'ic-blue',
        icon: ICONS.clock,
        trend: `${pct(ongoing)}% in progress`,
        dir: 'up',
        meta: 'in progress'
      },
      {
        label: 'Cancelled',
        value: fmtNumber(cancelled),
        ic: 'ic-red',
        icon: ICONS.cancel,
        trend: `${pct(cancelled)}% cancelled`,
        dir: 'down',
        meta: 'cancelled rides'
      },
      {
        label: 'Total Fare Revenue',
        value: fmtMoney(revenue),
        ic: 'ic-purple',
        icon: ICONS.money,
        trend: `across ${total} rides`,
        dir: 'up',
        meta: 'gross recorded fares'
      }
    ];

    document.getElementById('statGrid').innerHTML = stats.map(stat => `
      <div class="stat-card">
        <div class="stat-top">
          <div class="stat-ic ${stat.ic}">${stat.icon}</div>
        </div>
        <div class="stat-label">${stat.label}</div>
        <div class="stat-value">${stat.value}</div>
        <div class="stat-meta">
          <span class="trend ${stat.dir}">${stat.dir === 'up' ? '▲' : '▼'} ${stat.trend}</span>
          <span>${stat.meta}</span>
        </div>
      </div>
    `).join('');
  }

  function filteredRides() {
    const query = state.search.trim().toLowerCase();
    const from = state.dateFrom
      ? new Date(`${state.dateFrom}T00:00:00`)
      : null;
    const to = state.dateTo
      ? new Date(`${state.dateTo}T23:59:59.999`)
      : null;

    return rides.filter(ride => {
      const searchable = [
        ride.id,
        ride.customer,
        ride.driver,
        ride.pickup,
        ride.drop
      ].join(' ').toLowerCase();

      if (query && !searchable.includes(query)) return false;
      if (state.status && ride.status !== state.status) return false;

      if (
        state.vehicleType &&
        String(ride.vehicleType).toLowerCase() !== state.vehicleType.toLowerCase()
      ) return false;

      if (state.city && ride.city !== state.city) return false;

      if (from || to) {
        const date = new Date(ride.date);
        if (Number.isNaN(date.getTime())) return false;
        if (from && date < from) return false;
        if (to && date > to) return false;
      }

      return true;
    });
  }

  function renderTable() {
    const tbody = document.getElementById('ridesBody');
    const pagination = document.getElementById('pagination');
    const data = filteredRides();

    if (!data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="15" style="padding:0">
            ${UI.emptyStateHTML(
              'No rides match your filters',
              'Try clearing filters or searching by a different term.'
            )}
          </td>
        </tr>
      `;
      pagination.innerHTML = '';
      return;
    }

    const info = UI.paginate({
      data,
      page: state.page,
      pageSize: state.pageSize
    });

    state.page = info.page;

    tbody.innerHTML = info.slice.map(ride => `
      <tr>
        <td><strong>#${esc(ride.id)}</strong></td>
        <td>${esc(ride.customer || '—')}</td>
        <td>${driverCell(ride.driver)}</td>
        <td>${esc(ride.pickup || '—')}</td>
        <td>${esc(ride.drop || '—')}</td>
        <td class="tabular">${num(ride.distance)} km</td>
        <td>${typeTag(ride.vehicleType)}</td>
        <td><span class="amount">${fmtMoney(ride.base)}</span></td>
        <td><span class="amount green">${fmtMoney(ride.total)}</span></td>
        <td><span class="amount">${fmtMoney(ride.commission)}</span></td>
        <td><span class="amount green">${fmtMoney(ride.payout)}</span></td>
        <td>${ride.night
          ? '<span class="badge badge-purple">Yes</span>'
          : '<span class="badge badge-muted">No</span>'}</td>
        <td>${UI.statusBadge(ride.status)}</td>
        <td>${esc(fmtDate(ride.date))}</td>
        <td>
          <div class="actions">
            <button type="button" class="row-btn"
              data-view="${esc(ride.id)}"
              title="View ride" aria-label="View ride">
              ${ICONS.eye}
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-view]').forEach(button => {
      button.addEventListener('click', () => {
        openRideModal(button.dataset.view);
      });
    });

    UI.renderPagination(pagination, info, page => {
      state.page = page;
      renderTable();
    });
  }

  function timelineHTML(ride) {
    const items = [];

    items.push({
      cls: 'done',
      time: fmtDate(ride.date),
      title: 'Booking received',
      description: 'Ride request recorded in the system.'
    });

    if (ride.driver && ride.driver !== '—') {
      items.push({
        cls: 'done',
        time: 'Driver assigned',
        title: 'Driver assigned',
        description: `${ride.driver} is associated with this ride.`
      });
    }

    if (ride.status === 'Cancelled') {
      items.push({
        cls: 'cancel',
        time: fmtDate(ride.date),
        title: 'Ride cancelled',
        description: 'The recorded ride status is cancelled.'
      });
    } else if (ride.status === 'Completed') {
      items.push({
        cls: 'done',
        time: fmtDate(ride.date),
        title: 'Ride completed',
        description: `Recorded fare: ${fmtMoney(ride.total)}.`
      });
    } else {
      items.push({
        cls: 'pending',
        time: 'Current status',
        title: esc(ride.status),
        description: 'This is the latest recorded ride status.'
      });
    }

    return `<div class="timeline">${items.map(item => `
      <div class="timeline-item ${item.cls}">
        <div class="time">${esc(item.time)}</div>
        <div class="body">
          <div class="ttl">${esc(item.title)}</div>
          <div class="desc">${esc(item.description)}</div>
        </div>
      </div>
    `).join('')}</div>`;
  }

  function routeHTML(ride) {
    return `
      <div class="route-viz">
        <div class="route-line">
          <div class="pt start">
            <div class="pin"></div>
            <div class="pininfo">
              <div class="label">Pickup</div>
              <div class="addr">${esc(ride.pickup || '—')}</div>
            </div>
          </div>
          <div class="connector"></div>
          <div class="pt end">
            <div class="pin"></div>
            <div class="pininfo">
              <div class="label">Drop</div>
              <div class="addr">${esc(ride.drop || '—')}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function fareHTML(ride) {
    return `
      <div class="fare-breakdown">
        <div class="fare-row">
          <span class="lbl">Base Fare</span>
          <span class="val">${fmtMoney(ride.base)}</span>
        </div>
        <div class="fare-row">
          <span class="lbl">Distance</span>
          <span class="val">${num(ride.distance)} km</span>
        </div>
        <div class="fare-row">
          <span class="lbl">Night Pricing</span>
          <span class="val">${ride.night ? 'Applied' : 'Not recorded as applied'}</span>
        </div>
        <div class="fare-row total">
          <span class="lbl">Total Customer Fare</span>
          <span class="val">${fmtMoney(ride.total)}</span>
        </div>
        <div class="fare-row">
          <span class="lbl">Platform Commission</span>
          <span class="val">${fmtMoney(ride.commission)}</span>
        </div>
        <div class="fare-row">
          <span class="lbl">Driver Payout</span>
          <span class="val" style="color:var(--green)">${fmtMoney(ride.payout)}</span>
        </div>
      </div>
    `;
  }

  function openRideModal(id) {
    const ride = rides.find(item => item.id === String(id));
    if (!ride) return;

    const details = `
      <div class="profile-banner">
        <div class="avatar" style="display:grid;place-items:center">${ICONS.ride}</div>
        <div>
          <div class="name">${esc(ride.pickup)} → ${esc(ride.drop)}</div>
          <div class="sub">Ride #${esc(ride.id)} · ${esc(fmtDate(ride.date))}</div>
        </div>
      </div>

      <div class="kv-list mt-16">
        <div class="kv"><div class="k">Ride ID</div><div class="v">#${esc(ride.id)}</div></div>
        <div class="kv"><div class="k">Customer</div><div class="v">${esc(ride.customer)}</div></div>
        <div class="kv"><div class="k">Driver</div><div class="v">${esc(ride.driver)}</div></div>
        <div class="kv"><div class="k">Vehicle Type</div><div class="v">${typeTag(ride.vehicleType)}</div></div>
        <div class="kv"><div class="k">Distance</div><div class="v">${num(ride.distance)} km</div></div>
        <div class="kv"><div class="k">Booking Date</div><div class="v">${esc(fmtDate(ride.date))}</div></div>
        <div class="kv"><div class="k">Ride Status</div><div class="v">${UI.statusBadge(ride.status)}</div></div>
        <div class="kv"><div class="k">Payment Status</div><div class="v">${UI.statusBadge(ride.paymentStatus || 'Unknown')}</div></div>
        <div class="kv"><div class="k">Payment Method</div><div class="v">${esc(ride.paymentMethod || 'Unknown')}</div></div>
      </div>
    `;

    const label = text => `
      <div class="text-muted"
        style="font-size:11.5px;text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:10px">
        ${text}
      </div>
    `;

    const body = `
      <div class="section-grid cols-2-even">
        <div>
          ${label('Trip Details')}
          ${details}
        </div>
        <div>
          ${label('Route')}
          ${routeHTML(ride)}
        </div>
      </div>
      <div class="divider"></div>
      <div>
        ${label('Fare Breakdown')}
        ${fareHTML(ride)}
      </div>
      <div class="divider"></div>
      <div>
        ${label('Ride Timeline')}
        ${timelineHTML(ride)}
      </div>
    `;

    UI.modal({
      title: `Ride #${ride.id}`,
      subtitle: `${ride.customer || '—'} → ${ride.driver || '—'}`,
      body,
      foot: `
        <button class="btn btn-ghost" data-close>Close</button>
        <button class="btn btn-primary" id="modalPrintBtn" type="button">
          ${ICONS.receipt}
          Print Receipt
        </button>
      `,
      size: 'xl',
      onMount: element => {
        const printButton = element.querySelector('#modalPrintBtn');
        if (printButton) {
          printButton.addEventListener('click', () => {
            window.print();
          });
        }
      }
    });
  }

  function wireEvents() {
    const search = document.getElementById('searchRides');
    const status = document.getElementById('filterStatus');
    const vehicle = document.getElementById('filterVehicle');
    const city = document.getElementById('filterCity');
    const from = document.getElementById('filterFrom');
    const to = document.getElementById('filterTo');
    const reset = document.getElementById('btnReset');
    const exportButton = document.getElementById('btnExport');
    const newButton = document.getElementById('btnNew');

    search.addEventListener('input', event => {
      state.search = event.target.value;
      state.page = 1;
      renderTable();
    });

    status.addEventListener('change', event => {
      state.status = event.target.value;
      state.page = 1;
      renderTable();
    });

    vehicle.addEventListener('change', event => {
      state.vehicleType = event.target.value;
      state.page = 1;
      renderTable();
    });

    city.addEventListener('change', event => {
      state.city = event.target.value;
      state.page = 1;
      renderTable();
    });

    from.addEventListener('change', event => {
      state.dateFrom = event.target.value;
      state.page = 1;
      renderTable();
    });

    to.addEventListener('change', event => {
      state.dateTo = event.target.value;
      state.page = 1;
      renderTable();
    });

    reset.addEventListener('click', () => {
      Object.assign(state, {
        search: '',
        status: '',
        vehicleType: '',
        city: '',
        dateFrom: '',
        dateTo: '',
        page: 1
      });

      search.value = '';
      status.value = '';
      vehicle.value = '';
      city.value = '';
      from.value = '';
      to.value = '';

      renderTable();
      UI.toast('info', 'Filters reset', 'All filters cleared.');
    });

    exportButton.addEventListener('click', () => {
      const rows = filteredRides().map(ride => ({
        'Ride ID': ride.id,
        'Customer': ride.customer,
        'Driver': ride.driver,
        'Pickup Location': ride.pickup,
        'Drop Location': ride.drop,
        'City': ride.city,
        'Distance (km)': ride.distance,
        'Vehicle Type': ride.vehicleType,
        'Base Fare (FCFA)': ride.base,
        'Total Fare (FCFA)': ride.total,
        'Platform Commission (FCFA)': ride.commission,
        'Driver Payout (FCFA)': ride.payout,
        'Night Pricing': ride.night ? 'Yes' : 'No',
        'Ride Status': ride.status,
        'Payment Status': ride.paymentStatus,
        'Booking Date': fmtDate(ride.date)
      }));

      UI.exportCSV('mototaxi-rides.csv', rows);
    });

    newButton.addEventListener('click', () => {
      UI.toast(
        'info',
        'New Booking',
        'Booking creation is not connected because no create-booking endpoint was provided.'
      );
    });
  }

  renderStats();
  renderCityFilter();
  renderTable();
  wireEvents();
})();
