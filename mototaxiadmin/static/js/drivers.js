
/* MOTOTAXI ADMIN — Django-connected Drivers page */
(function () {
  'use strict';

  const D = window.MOTOTAXI_DATA || {};
  const UI = window.MOTOTAXI_UI;
  const t = window.MOTOTAXI_I18N.t;

  bootPage('drivers', 'Drivers');
  window.MOTOTAXI_I18N.applyI18n();

  const drivers = (D.DRIVERS || []).map(driver => ({
    ...driver,
    id: String(driver.id),
    online: Boolean(driver.online),
    isActive: driver.isActive !== false
  }));

  const rides = D.RIDES || [];

  const state = {
    search: '',
    vehicle: 'All',
    online: 'All',
    approval: 'All',
    page: 1,
    pageSize: 6
  };

  const ICONS = {
    drivers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 5h10l4 5-2 5H4l-2-5 4-5z"/><circle cx="7" cy="15" r="1.5"/><circle cx="15" cy="15" r="1.5"/></svg>',
    approved: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4 10-10"/></svg>',
    pending: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
    online: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M5 12a7 7 0 0 1 14 0M2 12a10 10 0 0 1 20 0"/></svg>',
    offline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M5 12a7 7 0 0 1 14 0M2 12a10 10 0 0 1 20 0" stroke-dasharray="2 3"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4 10-10"/></svg>',
    cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[ch]);
  }

  function number(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function money(value) {
    if (typeof D.fmtFCFA === 'function') {
      return D.fmtFCFA(number(value));
    }
    return `${number(value).toLocaleString('fr-FR')} FCFA`;
  }

  function numberText(value) {
    if (typeof D.fmtNumber === 'function') {
      return D.fmtNumber(number(value));
    }
    return number(value).toLocaleString();
  }

  function dateText(value) {
    if (!value) return '—';

    if (typeof D.fmtDate === 'function') {
      return D.fmtDate(value, true);
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '—'
      : date.toLocaleDateString();
  }

  function avatarHTML(driver, extraClass = '') {
    const name = driver.name || 'Driver';
    const color = UI.avatarColor(name);
    const initials = UI.initials(name);

    return `<span class="avatar ${esc(color)} ${extraClass}">${esc(initials)}</span>`;
  }

  function getDriver(id) {
    return drivers.find(driver => driver.id === String(id));
  }

  function matchesFilters(driver) {
    const query = state.search.trim().toLowerCase();

    if (query) {
      const searchable = [
        driver.id,
        driver.name,
        driver.phone,
        driver.plate,
        driver.vehicleModel
      ].join(' ').toLowerCase();

      if (!searchable.includes(query)) return false;
    }

    if (
      state.vehicle !== 'All' &&
      String(driver.vehicleType).toLowerCase() !== state.vehicle.toLowerCase()
    ) {
      return false;
    }

    if (state.online === 'Online' && !driver.online) return false;
    if (state.online === 'Offline' && driver.online) return false;

    if (
      state.approval !== 'All' &&
      driver.approval.toLowerCase() !== state.approval.toLowerCase()
    ) {
      return false;
    }

    return true;
  }

  function filteredDrivers() {
    return drivers.filter(matchesFilters);
  }

  function renderStats() {
    const total = drivers.length;
    const approved = drivers.filter(d => d.approval === 'Approved').length;
    const pending = drivers.filter(d => d.approval === 'Pending').length;
    const online = drivers.filter(d => d.online).length;
    const offline = total - online;

    const cards = [
      { label: 'Total Drivers', value: total, icon: 'drivers', cls: 'ic-brand', meta: 'registered partners' },
      { label: 'Approved Drivers', value: approved, icon: 'approved', cls: 'ic-green', meta: 'approved partners' },
      { label: 'Pending Approvals', value: pending, icon: 'pending', cls: 'ic-amber', meta: 'awaiting review' },
      { label: 'Online Drivers', value: online, icon: 'online', cls: 'ic-blue', meta: 'currently on-duty' },
      { label: 'Offline Drivers', value: offline, icon: 'offline', cls: 'ic-purple', meta: 'not in service' }
    ];

    document.getElementById('statGrid').innerHTML = cards.map(card => `
      <div class="stat-card">
        <div class="stat-top">
          <div class="stat-ic ${card.cls}">${ICONS[card.icon]}</div>
        </div>
        <div class="stat-label">${card.label}</div>
        <div class="stat-value">${card.value}</div>
        <div class="stat-meta"><span>${card.meta}</span></div>
      </div>
    `).join('');
  }

  function userCell(driver) {
    return `
      <div class="cell-user">
        ${avatarHTML(driver)}
        <div>
          <div class="name">${esc(driver.name)}</div>
          <div class="sub">#${esc(driver.id)}</div>
        </div>
      </div>
    `;
  }

  function actionButton(action, id, title, icon, danger = false) {
    return `
      <button type="button"
        class="row-btn ${danger ? 'danger' : ''}"
        data-act="${action}"
        data-id="${esc(id)}"
        title="${esc(title)}"
        aria-label="${esc(title)}">
        ${icon}
      </button>
    `;
  }

  function renderTable() {
    const tbody = document.getElementById('driversBody');
    const pagination = document.getElementById('pagination');
    const data = filteredDrivers();

    if (!data.length) {
      tbody.innerHTML = `
        <tr><td colspan="12">
          ${UI.emptyStateHTML(
            'No drivers match your filters',
            'Try adjusting the search or clearing filters.'
          )}
        </td></tr>
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

    tbody.innerHTML = info.slice.map(driver => {
      const viewButton = actionButton(
        'view', driver.id, 'View details', ICONS.eye
      );

      const approveButton = driver.approval === 'Pending'
        ? actionButton('approve', driver.id, 'Approve driver', ICONS.check)
        : '';

      const rejectButton = driver.approval === 'Pending'
        ? actionButton('reject', driver.id, 'Reject driver', ICONS.cross, true)
        : '';

      const blockButton = driver.approval === 'Approved'
        ? actionButton(
            'block',
            driver.id,
            driver.isActive ? 'Block driver' : 'Unblock driver',
            ICONS.lock,
            !driver.isActive
          )
        : '';

      return `
        <tr>
          <td><strong>#${esc(driver.id)}</strong></td>
          <td>${userCell(driver)}</td>
          <td>${esc(driver.phone)}</td>
          <td><span class="tag">${esc(driver.vehicleType)}</span></td>
          <td>${esc(driver.vehicleModel)}</td>
          <td><strong>${esc(driver.plate)}</strong></td>
          <td><span class="amount">★ ${number(driver.rating).toFixed(1)}</span></td>
          <td><span class="tabular">${numberText(driver.rides)}</span></td>
          <td><span class="amount green">${money(driver.earnings)}</span></td>
          <td>${UI.onlineBadge(driver.online)}</td>
          <td>${UI.statusBadge(driver.approval)}</td>
          <td>
            <div class="actions">
              ${viewButton}
              ${approveButton}
              ${rejectButton}
              ${blockButton}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    UI.renderPagination(pagination, info, page => {
      state.page = page;
      renderTable();
    });
  }

  function csrfToken() {
    const input = document.querySelector(
      '#csrfForm input[name="csrfmiddlewaretoken"]'
    );
    return input ? input.value : '';
  }

  async function postAction(driver, action) {
    const urls = {
      approve: driver.approveUrl,
      reject: driver.rejectUrl,
      block: driver.blockUrl
    };

    const url = urls[action];
    if (!url) {
      UI.toast('error', 'Action unavailable', 'The action URL was not provided.');
      return;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'X-CSRFToken': csrfToken(),
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      // Django views redirect after saving; reload to fetch updated DB data.
      window.location.reload();
    } catch (error) {
      console.error('Driver action failed:', error);
      UI.toast(
        'error',
        'Could not update driver',
        'Check your login session, CSRF token and Django server logs.'
      );
    }
  }

  function confirmAction(id, action) {
    const driver = getDriver(id);
    if (!driver) return;

    const messages = {
      approve: {
        title: 'Approve driver',
        text: `Approve ${driver.name}?`,
        confirmText: 'Approve',
        danger: false
      },
      reject: {
        title: 'Reject driver',
        text: `Reject the onboarding request from ${driver.name}?`,
        confirmText: 'Reject',
        danger: true
      },
      block: {
        title: driver.isActive ? 'Block driver' : 'Unblock driver',
        text: `${driver.isActive ? 'Block' : 'Unblock'} ${driver.name}?`,
        confirmText: driver.isActive ? 'Block' : 'Unblock',
        danger: driver.isActive
      }
    };

    const config = messages[action];

    UI.confirm({
      title: config.title,
      message: config.text,
      confirmText: config.confirmText,
      danger: config.danger
    }).then(confirmed => {
      if (confirmed) postAction(driver, action);
    });
  }

  function openDriverModal(id) {
    const driver = getDriver(id);
    if (!driver) return;

    const recentRides = rides
      .filter(ride => String(ride.driverId) === driver.id)
      .slice(0, 5);

    const ridesHTML = recentRides.length
      ? `
        <div class="table-wrap" style="box-shadow:none;border-color:var(--line);">
          <div class="table-scroll">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Ride ID</th>
                  <th>Customer</th>
                  <th>Pickup → Drop</th>
                  <th>Fare</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${recentRides.map(ride => `
                  <tr>
                    <td><strong>#${esc(ride.id)}</strong></td>
                    <td>${esc(ride.customer)}</td>
                    <td>${esc(ride.pickup)} → ${esc(ride.drop)}</td>
                    <td><span class="amount green">${money(ride.total)}</span></td>
                    <td>${UI.statusBadge(ride.status)}</td>
                    <td>${esc(dateText(ride.date))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `
      : UI.emptyStateHTML(
          'No recent rides',
          'No rides were found for this driver.'
        );

    const body = `
      <div class="profile-banner">
        ${avatarHTML(driver)}
        <div style="margin-left:14px;">
          <div class="name">${esc(driver.name)}</div>
          <div class="sub">${esc(driver.vehicleType)} · ${esc(driver.plate)}</div>
        </div>
      </div>

      <div class="kv-list" style="margin-top:18px;">
        <div class="kv"><div class="k">Driver ID</div><div class="v">#${esc(driver.id)}</div></div>
        <div class="kv"><div class="k">Phone</div><div class="v">${esc(driver.phone)}</div></div>
        <div class="kv"><div class="k">Email</div><div class="v">${esc(driver.email || '—')}</div></div>
        <div class="kv"><div class="k">Vehicle Type</div><div class="v">${esc(driver.vehicleType)}</div></div>
        <div class="kv"><div class="k">Vehicle Model</div><div class="v">${esc(driver.vehicleModel)}</div></div>
        <div class="kv"><div class="k">Plate Number</div><div class="v"><strong>${esc(driver.plate)}</strong></div></div>
        <div class="kv"><div class="k">License Status</div><div class="v">${UI.statusBadge(driver.license)}</div></div>
        <div class="kv"><div class="k">Insurance Status</div><div class="v">${UI.statusBadge(driver.insurance)}</div></div>
        <div class="kv"><div class="k">Rating</div><div class="v">★ ${number(driver.rating).toFixed(1)}</div></div>
        <div class="kv"><div class="k">Completed Rides</div><div class="v">${numberText(driver.rides)}</div></div>
        <div class="kv"><div class="k">Total Earnings</div><div class="v amount green">${money(driver.earnings)}</div></div>
        <div class="kv"><div class="k">Online Status</div><div class="v">${UI.onlineBadge(driver.online)}</div></div>
        <div class="kv"><div class="k">Approval Status</div><div class="v">${UI.statusBadge(driver.approval)}</div></div>
        <div class="kv"><div class="k">Account Status</div><div class="v">${driver.isActive ? 'Active' : 'Blocked'}</div></div>
      </div>

      <div style="margin-top:22px;">
        <div class="card-head" style="padding:0 0 10px;border-bottom:1px solid var(--line);">
          <div>
            <h3 style="font-size:14px;">Recent Rides</h3>
            <div class="sub">Latest rides for this driver</div>
          </div>
        </div>
        <div style="margin-top:12px;">${ridesHTML}</div>
      </div>
    `;

    const footer = [];

    if (driver.approval === 'Pending') {
      footer.push('<button class="btn btn-primary" data-modal-act="approve">Approve</button>');
      footer.push('<button class="btn btn-danger" data-modal-act="reject">Reject</button>');
    }

    if (driver.approval === 'Approved') {
      footer.push(
        `<button class="btn btn-danger" data-modal-act="block">${driver.isActive ? 'Block' : 'Unblock'}</button>`
      );
    }

    footer.push('<button class="btn btn-ghost" data-close>Close</button>');

    let modalRef;

    modalRef = UI.modal({
      title: driver.name,
      subtitle: `Driver #${driver.id}`,
      body,
      foot: footer.join(''),
      size: 'lg',
      onMount: overlay => {
        overlay.querySelectorAll('[data-modal-act]').forEach(button => {
          button.addEventListener('click', () => {
            const action = button.dataset.modalAct;
            if (modalRef && modalRef.close) modalRef.close();
            confirmAction(driver.id, action);
          });
        });
      }
    });
  }

  function wireEvents() {
    const search = document.getElementById('searchInput');
    const vehicle = document.getElementById('filterVehicle');
    const online = document.getElementById('filterOnline');
    const approval = document.getElementById('filterApproval');
    const reset = document.getElementById('btnReset');
    const exportButton = document.getElementById('btnExport');
    const addButton = document.getElementById('btnAdd');
    const tbody = document.getElementById('driversBody');

    search.addEventListener('input', event => {
      state.search = event.target.value;
      state.page = 1;
      renderTable();
    });

    vehicle.addEventListener('change', event => {
      state.vehicle = event.target.value;
      state.page = 1;
      renderTable();
    });

    online.addEventListener('change', event => {
      state.online = event.target.value;
      state.page = 1;
      renderTable();
    });

    approval.addEventListener('change', event => {
      state.approval = event.target.value;
      state.page = 1;
      renderTable();
    });

    reset.addEventListener('click', () => {
      state.search = '';
      state.vehicle = 'All';
      state.online = 'All';
      state.approval = 'All';
      state.page = 1;

      search.value = '';
      vehicle.value = 'All';
      online.value = 'All';
      approval.value = 'All';

      renderTable();
      UI.toast('info', 'Filters reset', 'All filters cleared.');
    });

    exportButton.addEventListener('click', () => {
      const rows = filteredDrivers().map(driver => ({
        'Driver ID': driver.id,
        'Name': driver.name,
        'Phone': driver.phone,
        'Vehicle Type': driver.vehicleType,
        'Vehicle Model': driver.vehicleModel,
        'Plate Number': driver.plate,
        'Rating': driver.rating,
        'Completed Rides': driver.rides,
        'Total Earnings (FCFA)': driver.earnings,
        'Online Status': driver.online ? 'Online' : 'Offline',
        'Approval Status': driver.approval,
        'Account Status': driver.isActive ? 'Active' : 'Blocked'
      }));

      UI.exportCSV('mototaxi-drivers.csv', rows);
    });

    addButton.addEventListener('click', () => {
      UI.toast(
        'info',
        'Add Driver',
        'Driver creation needs a backend form/API endpoint; it is not included in the provided URLs.'
      );
    });

    tbody.addEventListener('click', event => {
      const button = event.target.closest('[data-act]');
      if (!button) return;

      const id = button.dataset.id;
      const action = button.dataset.act;

      if (action === 'view') openDriverModal(id);
      if (['approve', 'reject', 'block'].includes(action)) {
        confirmAction(id, action);
      }
    });
  }

  renderStats();
  renderTable();
  wireEvents();
})();
