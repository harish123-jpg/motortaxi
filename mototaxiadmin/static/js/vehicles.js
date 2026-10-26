
/* MOTOTAXI ADMIN — Vehicles page backed by Django database. */

(function () {
  const D = window.MOTOTAXI_DATA || {};
  const UI = window.MOTOTAXI_UI;
  const URLS = window.MOTOTAXI_VEHICLE_URLS || {};

  let vehicles = Array.isArray(D.VEHICLES) ? D.VEHICLES : [];
  const drivers = Array.isArray(D.DRIVERS) ? D.DRIVERS : [];

  if (typeof bootPage === "function") {
    bootPage("vehicles", "Vehicles");
  }

  window.MOTOTAXI_I18N?.applyI18n?.();

  const ICONS = {
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    total: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 13l2-6a3 3 0 0 1 3-2h8a3 3 0 0 1 3 2l2 6v5h-2v-2H5v2H3z"/><circle cx="7" cy="16" r="1.2"/><circle cx="17" cy="16" r="1.2"/></svg>',
    bike: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="17" r="3.5"/><circle cx="18" cy="17" r="3.5"/><path d="M6 17l4-7h5l3 7M11 10l-2-3H6"/></svg>',
    car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11M5 11h14M5 11v5h2v-2h10v2h2v-5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4 10-10"/></svg>'
  };

  const state = {
    search: "",
    type: "",
    insurance: "",
    verified: "",
    available: "",
    page: 1,
    pageSize: 8
  };

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const toast = (type, title, message) => {
    if (UI?.toast) {
      UI.toast(type, title, message);
    } else {
      alert(`${title}\n${message}`);
    }
  };

  function typeValue(vehicle) {
    return vehicle.vehicleTypeValue ||
      ({ Bike: "BIKE", Car: "CAR", Auto: "AUTO" }[vehicle.type]) ||
      vehicle.type ||
      "";
  }

  function statusBadge(status) {
    return UI?.statusBadge
      ? UI.statusBadge(status)
      : `<span class="badge">${esc(status)}</span>`;
  }

  function renderStats() {
    const total = vehicles.length;
    const bikes = vehicles.filter(v => typeValue(v) === "BIKE").length;
    const cars = vehicles.filter(v => typeValue(v) === "CAR").length;
    const autos = vehicles.filter(v => typeValue(v) === "AUTO").length;
    const active = vehicles.filter(v => v.available).length;

    const pct = (n) => total ? Math.round(n * 100 / total) : 0;

    const stats = [
      {
        label: "Total Vehicles",
        value: total,
        ic: "ic-brand",
        icon: ICONS.total,
        trend: `${bikes} bikes · ${cars} cars · ${autos} autos`,
        meta: "fleet"
      },
      {
        label: "Bike Vehicles",
        value: bikes,
        ic: "ic-green",
        icon: ICONS.bike,
        trend: `${pct(bikes)}% of fleet`,
        meta: "live count"
      },
      {
        label: "Cars",
        value: cars,
        ic: "ic-blue",
        icon: ICONS.car,
        trend: `${pct(cars)}% of fleet`,
        meta: "live count"
      },
      {
        label: "Active Vehicles",
        value: active,
        ic: "ic-purple",
        icon: ICONS.check,
        trend: `${pct(active)}% available`,
        meta: "ready to ride"
      }
    ];

    document.getElementById("statGrid").innerHTML =
      stats.map(s => `
        <div class="stat-card">
          <div class="stat-top">
            <div class="stat-ic ${s.ic}">${s.icon}</div>
          </div>
          <div class="stat-label">${s.label}</div>
          <div class="stat-value">${s.value}</div>
          <div class="stat-meta">
            <span class="trend up">▲ ${esc(s.trend)}</span>
            <span>${s.meta}</span>
          </div>
        </div>
      `).join("");
  }

  function filteredRows() {
    const q = state.search.trim().toLowerCase();

    return vehicles.filter(v => {
      const searchable = [
        v.id,
        v.pk,
        v.model,
        v.make,
        v.modelName,
        v.reg,
        v.driver
      ].join(" ").toLowerCase();

      if (q && !searchable.includes(q)) return false;
      if (state.type && v.type !== state.type) return false;
      if (state.insurance && v.insurance !== state.insurance) return false;
      if (state.verified && v.verified !== state.verified) return false;

      if (
        state.available !== "" &&
        String(Boolean(v.available)) !== state.available
      ) {
        return false;
      }

      return true;
    });
  }

  function typeTag(type) {
    let style = "background:var(--surface-2);color:var(--ink)";

    if (type === "Bike") {
      style = "background:var(--green-bg);color:var(--green)";
    } else if (type === "Car") {
      style = "background:var(--blue-bg);color:var(--blue)";
    }

    return `<span class="tag" style="${style}">${esc(type)}</span>`;
  }

  function availabilityCell(vehicle) {
    return vehicle.available
      ? '<span class="badge badge-success">Available</span>'
      : '<span class="badge badge-muted">Unavailable</span>';
  }

  function paginate(data) {
    const total = data.length;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));

    state.page = Math.min(state.page, pages);

    return {
      total,
      pages,
      slice: data.slice(
        (state.page - 1) * state.pageSize,
        state.page * state.pageSize
      ),
      start: total ? (state.page - 1) * state.pageSize + 1 : 0,
      end: Math.min(state.page * state.pageSize, total)
    };
  }

  function renderPagination(info) {
    const el = document.getElementById("pagination");

    el.innerHTML = `
      <span class="text-muted">
        Showing ${info.start}–${info.end} of ${info.total}
      </span>
      <div class="actions">
        <button class="btn btn-sm"
          ${state.page <= 1 ? "disabled" : ""}
          data-page="${state.page - 1}">
          Previous
        </button>
        <span>Page ${state.page} / ${info.pages}</span>
        <button class="btn btn-sm"
          ${state.page >= info.pages ? "disabled" : ""}
          data-page="${state.page + 1}">
          Next
        </button>
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
    const info = paginate(filteredRows());
    const tbody = document.getElementById("vehiclesBody");

    if (!info.total) {
      const empty = UI?.emptyStateHTML
        ? UI.emptyStateHTML(
            "No vehicles match your filters",
            "Try clearing filters or searching by a different term."
          )
        : "No vehicles found.";

      tbody.innerHTML =
        `<tr><td colspan="9" style="padding:0">${empty}</td></tr>`;
    } else {
      tbody.innerHTML = info.slice.map(v => `
        <tr>
          <td><strong>${esc(v.id)}</strong></td>
          <td>${typeTag(v.type)}</td>
          <td>${esc(v.model)}</td>
          <td class="tabular">${esc(v.reg)}</td>
          <td>
            ${v.driver === "Unassigned"
              ? '<span class="text-muted">—</span>'
              : `<span class="text-bold">${esc(v.driver)}</span>`}
          </td>
          <td>${statusBadge(v.insurance)}</td>
          <td>${statusBadge(v.verified)}</td>
          <td>${availabilityCell(v)}</td>
          <td>
            <div class="actions">
              <button class="row-btn" data-view="${v.pk}"
                title="View vehicle" aria-label="View">
                ${ICONS.eye}
              </button>
              <button class="row-btn" data-edit="${v.pk}"
                title="Edit vehicle" aria-label="Edit">
                ${ICONS.pencil}
              </button>
            </div>
          </td>
        </tr>
      `).join("");

      tbody.querySelectorAll("[data-view]").forEach(button => {
        button.addEventListener("click", () => {
          openViewModal(Number(button.dataset.view));
        });
      });

      tbody.querySelectorAll("[data-edit]").forEach(button => {
        button.addEventListener("click", () => {
          openEditModal(Number(button.dataset.edit));
        });
      });
    }

    renderPagination(info);
  }

  function getVehicle(pk) {
    return vehicles.find(v => Number(v.pk) === Number(pk));
  }

  function openViewModal(pk) {
    const v = getVehicle(pk);
    if (!v) return;

    const body = `
      <div class="profile-banner">
        <div class="avatar">${esc((v.type || "V").slice(0, 1))}</div>
        <div>
          <div class="name">${esc(v.model)}</div>
          <div class="sub">${esc(v.id)} · ${esc(v.type)}</div>
        </div>
      </div>

      <div class="kv-list mt-16">
        <div class="kv">
          <div class="k">Vehicle ID</div>
          <div class="v">${esc(v.id)}</div>
        </div>
        <div class="kv">
          <div class="k">Vehicle Type</div>
          <div class="v">${typeTag(v.type)}</div>
        </div>
        <div class="kv">
          <div class="k">Make / Model</div>
          <div class="v">${esc(v.make)} ${esc(v.modelName)}</div>
        </div>
        <div class="kv">
          <div class="k">Registration Number</div>
          <div class="v tabular">${esc(v.reg)}</div>
        </div>
        <div class="kv">
          <div class="k">Color</div>
          <div class="v">${esc(v.color)}</div>
        </div>
        <div class="kv">
          <div class="k">Assigned Driver</div>
          <div class="v">${esc(v.driver)}</div>
        </div>
        <div class="kv">
          <div class="k">Availability</div>
          <div class="v">${availabilityCell(v)}</div>
        </div>
        <div class="kv">
          <div class="k">Insurance Status</div>
          <div class="v">
            ${statusBadge(v.insurance)}
            ${v.insuranceExpiry
              ? `<div class="text-muted" style="font-size:12px;margin-top:4px">
                   Expiry: ${esc(v.insuranceExpiry)}
                 </div>`
              : ""}
          </div>
        </div>
        <div class="kv">
          <div class="k">Verification Status</div>
          <div class="v">${statusBadge(v.verified)}</div>
        </div>
      </div>
    `;

    UI.modal({
      title: v.model,
      subtitle: `${v.id} · ${v.type}`,
      body,
      foot: `
        <button class="btn btn-ghost" data-close>Close</button>
        <button class="btn btn-primary" id="viewEditBtn" data-close>
          Edit
        </button>
      `,
      size: "lg",
      onMount: el => {
        el.querySelector("#viewEditBtn")?.addEventListener("click", () => {
          openEditModal(pk);
        });
      }
    });
  }

  function driverOptions(selected) {
    return drivers.map(d => `
      <option value="${d.id}"
        ${Number(d.id) === Number(selected) ? "selected" : ""}>
        ${esc(d.name)}
      </option>
    `).join("");
  }

  function editForm(vehicle) {
    const current = vehicle || {
      pk: null,
      id: "New vehicle",
      vehicleTypeValue: "BIKE",
      make: "",
      modelName: "",
      reg: "",
      color: "",
      driverId: "",
      available: true
    };

    return `
      <div class="form-group">
        <label>Vehicle ID</label>
        <input class="input" value="${esc(current.id)}" disabled>
      </div>

      <div class="form-row">
        <div class="form-group" style="flex:1;min-width:180px">
          <label>Vehicle Type</label>
          <select class="select" id="editType">
            <option value="BIKE"
              ${typeValue(current) === "BIKE" ? "selected" : ""}>Bike</option>
            <option value="CAR"
              ${typeValue(current) === "CAR" ? "selected" : ""}>Car</option>
            <option value="AUTO"
              ${typeValue(current) === "AUTO" ? "selected" : ""}>Auto</option>
          </select>
        </div>

        <div class="form-group" style="flex:1;min-width:180px">
          <label>Availability</label>
          <select class="select" id="editAvail">
            <option value="true"
              ${current.available ? "selected" : ""}>Available</option>
            <option value="false"
              ${!current.available ? "selected" : ""}>Unavailable</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group" style="flex:1;min-width:160px">
          <label>Make</label>
          <input class="input" id="editMake" maxlength="50" required
            value="${esc(current.make)}">
        </div>
        <div class="form-group" style="flex:1;min-width:160px">
          <label>Model</label>
          <input class="input" id="editModel" maxlength="50" required
            value="${esc(current.modelName)}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group" style="flex:1;min-width:160px">
          <label>Registration Number</label>
          <input class="input" id="editReg" maxlength="20" required
            value="${esc(current.reg)}">
        </div>
        <div class="form-group" style="flex:1;min-width:160px">
          <label>Color</label>
          <input class="input" id="editColor" maxlength="30" required
            value="${esc(current.color)}">
        </div>
      </div>

      <div class="form-group">
        <label>Assigned Driver</label>
        <select class="select" id="editDriver" required>
          <option value="">Select driver</option>
          ${driverOptions(current.driverId)}
        </select>
      </div>
    `;
  }

  function openEditModal(pk) {
    const vehicle = pk == null ? null : getVehicle(pk);
    if (pk != null && !vehicle) return;

    UI.modal({
      title: vehicle ? "Edit Vehicle" : "Add Vehicle",
      subtitle: vehicle
        ? `${vehicle.id} · ${vehicle.type}`
        : "Register a vehicle",
      body: editForm(vehicle),
      foot: `
        <button class="btn btn-ghost" data-close>Cancel</button>
        <button class="btn btn-primary" id="saveVehicleBtn">
          ${vehicle ? "Save Changes" : "Add Vehicle"}
        </button>
      `,
      size: "lg",
      onMount: el => {
        el.querySelector("#saveVehicleBtn")?.addEventListener(
          "click",
          async () => {
            const button = el.querySelector("#saveVehicleBtn");

            const formData = new URLSearchParams({
              vehicle_type: el.querySelector("#editType").value,
              is_active: el.querySelector("#editAvail").value,
              make: el.querySelector("#editMake").value.trim(),
              model: el.querySelector("#editModel").value.trim(),
              plate_number: el.querySelector("#editReg").value.trim(),
              color: el.querySelector("#editColor").value.trim(),
              driver_id: el.querySelector("#editDriver").value
            });

            if (
              !formData.get("make") ||
              !formData.get("model") ||
              !formData.get("plate_number") ||
              !formData.get("color") ||
              !formData.get("driver_id")
            ) {
              toast(
                "error",
                "Missing fields",
                "Complete all vehicle fields and select a driver."
              );
              return;
            }

            button.disabled = true;
            button.textContent = "Saving…";

            try {
              const url = vehicle
                ? URLS.updateTemplate.replace(
                    "/0/update/",
                    `/${vehicle.pk}/update/`
                  )
                : URLS.create;

              const response = await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/x-www-form-urlencoded;charset=UTF-8",
                  "X-CSRFToken": csrfToken()
                },
                body: formData.toString(),
                credentials: "same-origin"
              });

              const result = await response.json();

              if (!response.ok || !result.ok) {
                throw new Error(
                  result.message || "Unable to save vehicle."
                );
              }

              const saved = result.vehicle;
              const index = vehicles.findIndex(
                item => Number(item.pk) === Number(saved.pk)
              );

              if (index >= 0) {
                vehicles[index] = saved;
              } else {
                vehicles.unshift(saved);
              }

              D.VEHICLES = vehicles;

              const closeButton = el.querySelector("[data-close]");
              if (closeButton) {
                closeButton.click();
              } else {
                document.querySelector(".modal-close")?.click();
              }

              renderStats();
              renderTable();

              toast(
                "success",
                vehicle ? "Vehicle updated" : "Vehicle added",
                result.message
              );
            } catch (error) {
              toast(
                "error",
                "Could not save vehicle",
                error.message || "Please try again."
              );
            } finally {
              button.disabled = false;
              button.textContent = vehicle
                ? "Save Changes"
                : "Add Vehicle";
            }
          }
        );
      }
    });
  }

  function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content || "";
  }

  document.getElementById("searchVeh").addEventListener("input", e => {
    state.search = e.target.value;
    state.page = 1;
    renderTable();
  });

  document.getElementById("filterType").addEventListener("change", e => {
    state.type = e.target.value;
    state.page = 1;
    renderTable();
  });

  document.getElementById("filterIns").addEventListener("change", e => {
    state.insurance = e.target.value;
    state.page = 1;
    renderTable();
  });

  document.getElementById("filterVer").addEventListener("change", e => {
    state.verified = e.target.value;
    state.page = 1;
    renderTable();
  });

  document.getElementById("filterAvail").addEventListener("change", e => {
    state.available = e.target.value;
    state.page = 1;
    renderTable();
  });

  document.getElementById("btnReset").addEventListener("click", () => {
    Object.assign(state, {
      search: "",
      type: "",
      insurance: "",
      verified: "",
      available: "",
      page: 1
    });

    document.getElementById("searchVeh").value = "";

    [
      "filterType",
      "filterIns",
      "filterVer",
      "filterAvail"
    ].forEach(id => {
      document.getElementById(id).value = "";
    });

    renderTable();
    toast("info", "Filters reset", "All filters cleared.");
  });

  document.getElementById("btnExport").addEventListener("click", () => {
    const rows = filteredRows().map(v => ({
      "Vehicle ID": v.id,
      "Vehicle Type": v.type,
      "Make": v.make,
      "Model": v.modelName,
      "Registration Number": v.reg,
      "Color": v.color,
      "Assigned Driver": v.driver,
      "Insurance Status": v.insurance,
      "Verification Status": v.verified,
      "Availability": v.available ? "Available" : "Unavailable"
    }));

    if (UI?.exportCSV) {
      UI.exportCSV("mototaxi-vehicles.csv", rows);
      return;
    }

    const keys = Object.keys(rows[0] || { "Vehicle ID": "" });

    const csv = [
      keys.join(","),
      ...rows.map(row =>
        keys.map(key =>
          '"' + String(row[key] ?? "").replace(/"/g, '""') + '"'
        ).join(",")
      )
    ].join("\r\n");

    const blob = new Blob(
      [csv],
      { type: "text/csv;charset=utf-8;" }
    );

    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);

    link.href = objectUrl;
    link.download = "mototaxi-vehicles.csv";
    link.click();

    URL.revokeObjectURL(objectUrl);
  });

  document.getElementById("btnAdd").addEventListener("click", () => {
    openEditModal(null);
  });

  renderStats();
  renderTable();
})();
