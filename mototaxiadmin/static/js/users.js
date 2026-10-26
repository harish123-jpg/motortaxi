/* ============================================================
   MOTOTAXI ADMIN — CUSTOMERS
   Dynamic customer page using Django data.
   Preserves the shared admin shell and existing UI components.
   ============================================================ */

(function () {
    "use strict";

    const D = window.MOTOTAXI_DATA || {};
    const UI = window.MOTOTAXI_UI;
    const PAGE_SIZE = 8;

    const customers = Array.isArray(D.CUSTOMERS) ? D.CUSTOMERS : [];
    const rides = Array.isArray(D.RIDES) ? D.RIDES : [];
    const transactions = Array.isArray(D.TRANSACTIONS) ? D.TRANSACTIONS : [];
    const cities = Array.isArray(D.CAM_CITIES) ? D.CAM_CITIES : [];

    if (typeof window.bootPage === "function") {
        window.bootPage("customers", "Customers");
    }

    if (window.MOTOTAXI_I18N?.applyI18n) {
        window.MOTOTAXI_I18N.applyI18n();
    }

    /* ---------------- DOM references ---------------- */

    const statGrid = document.getElementById("statGrid");
    const tbody = document.querySelector("#customersTbl tbody");
    const paginationEl = document.getElementById("custPagination");
    const searchInput = document.getElementById("custSearch");
    const statusSelect = document.getElementById("statusSelect");
    const citySelect = document.getElementById("citySelect");
    const resetBtn = document.getElementById("resetFilters");
    const exportBtn = document.getElementById("btnExport");
    const addBtn = document.getElementById("btnAdd");
    const countEl = document.getElementById("customerCount");

    const state = {
        query: "",
        status: "All",
        city: "All",
        page: 1,
        pageSize: PAGE_SIZE,
        sortKey: "regDate",
        sortDir: "desc"
    };

    /* ---------------- Helpers ---------------- */

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, function (char) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[char];
        });
    }

    function formatNumber(value) {
        if (typeof D.fmtNumber === "function") {
            return D.fmtNumber(Number(value || 0));
        }
        return Number(value || 0).toLocaleString("fr-FR");
    }

    function formatMoney(value) {
        if (typeof D.fmtFCFA === "function") {
            return D.fmtFCFA(Number(value || 0));
        }

        return new Intl.NumberFormat("fr-FR", {
            style: "currency",
            currency: "XAF",
            maximumFractionDigits: 0
        }).format(Number(value || 0));
    }

    function formatDate(value, withTime) {
        if (!value) return "—";

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "—";

        return date.toLocaleString("en-GB", withTime
            ? {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
            : {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );
    }

    function normaliseStatus(value) {
        const status = String(value || "").toUpperCase();

        if (["ACTIVE", "APPROVED", "COMPLETED", "PAID", "SUCCESSFUL"].includes(status)) {
            return "Active";
        }

        if (["BLOCKED", "INACTIVE", "SUSPENDED"].includes(status)) {
            return "Blocked";
        }

        return value || "—";
    }

    function statusBadge(status) {
        if (UI?.statusBadge) {
            return UI.statusBadge(status);
        }

        const safe = escapeHTML(status);
        const key = String(status || "").toLowerCase();

        return `<span class="badge ${key}">${safe}</span>`;
    }

    function initials(name) {
        if (UI?.initials) return UI.initials(name);

        return String(name || "?")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part.charAt(0).toUpperCase())
            .join("") || "?";
    }

    function avatarColor(name) {
        return UI?.avatarColor ? UI.avatarColor(name) : "";
    }

    function toast(type, title, message) {
        if (UI?.toast) {
            UI.toast(type, title, message);
        } else {
            console.log(`${title}: ${message}`);
        }
    }

    function customerById(id) {
        return customers.find(c => String(c.id) === String(id));
    }

    function getCustomerRides(customer) {
        return rides.filter(ride => {
            if (ride.customerId != null) {
                return String(ride.customerId) === String(customer.id);
            }

            if (ride.riderId != null) {
                return String(ride.riderId) === String(customer.id);
            }

            // Compatibility with the original demo-data format.
            return ride.customer === customer.name;
        }).sort((a, b) => new Date(b.date || b.created_at || 0)
            - new Date(a.date || a.created_at || 0));
    }

    function getCustomerTransactions(customer) {
        return transactions.filter(tx => {
            if (tx.customerId != null) {
                return String(tx.customerId) === String(customer.id);
            }

            if (tx.userId != null) {
                return String(tx.userId) === String(customer.id);
            }

            // Compatibility with the original demo-data format.
            return tx.sender === customer.name;
        }).sort((a, b) => new Date(b.date || b.created_at || 0)
            - new Date(a.date || a.created_at || 0));
    }

    /* ---------------- Icons ---------------- */

    const ICONS = {
        customers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M22 19c0-2.5-2-4-4.5-4"/></svg>',
        check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4 10-10"/></svg>',
        block: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>',
        register: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>',
        eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
        lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
        unlock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7-3.2"/></svg>',
        add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
        edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>'
    };

    /* ---------------- Stat cards ---------------- */

    function renderStats() {
        if (!statGrid) return;

        const total = customers.length;
        const active = customers.filter(c => c.status === "Active").length;
        const blocked = customers.filter(c => c.status === "Blocked").length;

        const now = new Date();
        const currentMonth =
            `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

        const newRegs = customers.filter(c =>
            c.regDate && String(c.regDate).startsWith(currentMonth)
        ).length;

        const activePct = total ? Math.round(active / total * 100) : 0;

        const stats = [
            {
                label: "Total Customers",
                value: formatNumber(total),
                icon: "customers",
                color: "ic-brand",
                trend: `${active} active`,
                direction: "up"
            },
            {
                label: "Active Customers",
                value: formatNumber(active),
                icon: "check",
                color: "ic-green",
                trend: `${activePct}%`,
                direction: "up"
            },
            {
                label: "Blocked Customers",
                value: formatNumber(blocked),
                icon: "block",
                color: "ic-red",
                trend: blocked ? "review" : "none",
                direction: "down"
            },
            {
                label: "New Registrations",
                value: formatNumber(newRegs),
                icon: "register",
                color: "ic-purple",
                trend: now.toLocaleDateString("en", {
                    month: "short",
                    year: "numeric"
                }),
                direction: "up"
            }
        ];

        statGrid.innerHTML = stats.map(s => `
            <div class="stat-card">
                <div class="stat-top">
                    <div class="stat-ic ${s.color}">${ICONS[s.icon]}</div>
                </div>
                <div class="stat-label">${s.label}</div>
                <div class="stat-value">${s.value}</div>
                <div class="stat-meta">
                    <span class="trend ${s.direction}">
                        ${s.direction === "up" ? "▲" : "▼"} ${escapeHTML(s.trend)}
                    </span>
                    <span>current data</span>
                </div>
            </div>
        `).join("");
    }

    /* ---------------- City filter ---------------- */

    function renderCityFilter() {
        if (!citySelect) return;

        const available = new Set(
            customers.map(c => String(c.city || "").trim()).filter(Boolean)
        );

        const ordered = [...new Set([...cities, ...available])]
            .filter(city => available.has(city))
            .sort((a, b) => a.localeCompare(b));

        citySelect.innerHTML =
            '<option value="All">All Cities</option>' +
            ordered.map(city => `
                <option value="${escapeHTML(city)}">${escapeHTML(city)}</option>
            `).join("");

        citySelect.value = state.city;
    }

    /* ---------------- Filtering and sorting ---------------- */

    function getFiltered() {
        const q = state.query.trim().toLowerCase();

        let list = customers.filter(customer => {
            if (state.status !== "All" && customer.status !== state.status) {
                return false;
            }

            if (state.city !== "All" && customer.city !== state.city) {
                return false;
            }

            if (q) {
                const searchText = [
                    customer.id,
                    customer.name,
                    customer.phone,
                    customer.email,
                    customer.city
                ].join(" ").toLowerCase();

                if (!searchText.includes(q)) return false;
            }

            return true;
        });

        list.sort((a, b) => {
            let left = a[state.sortKey] ?? "";
            let right = b[state.sortKey] ?? "";

            if (state.sortKey === "regDate") {
                left = new Date(left || 0).getTime();
                right = new Date(right || 0).getTime();
            } else if (["rides", "wallet", "id"].includes(state.sortKey)) {
                left = Number(left) || 0;
                right = Number(right) || 0;
            } else {
                left = String(left).toLowerCase();
                right = String(right).toLowerCase();
            }

            if (left < right) return state.sortDir === "asc" ? -1 : 1;
            if (left > right) return state.sortDir === "asc" ? 1 : -1;
            return 0;
        });

        return list;
    }

    /* ---------------- Table rows ---------------- */

    function rowHTML(customer) {
        const name = escapeHTML(customer.name);
        const id = escapeHTML(customer.id);
        const phone = escapeHTML(customer.phone || "—");
        const email = escapeHTML(customer.email || "");
        const city = escapeHTML(customer.city || "—");

        const color = avatarColor(customer.name);
        const avatarClass = color ? `avatar ${color}` : "avatar";
        const blocked = customer.status === "Blocked";

        return `
            <tr>
                <td><strong>${id}</strong></td>
                <td>
                    <div class="cell-user">
                        <span class="${avatarClass}">
                            ${escapeHTML(initials(customer.name))}
                        </span>
                        <div>
                            <div class="name">${name}</div>
                            <div class="sub">${city}</div>
                        </div>
                    </div>
                </td>
                <td>${phone}</td>
                <td>
                    ${email
                        ? `<a href="mailto:${email}" class="text-brand">${email}</a>`
                        : "—"}
                </td>
                <td>${formatDate(customer.regDate)}</td>
                <td class="tabular">${formatNumber(customer.rides)}</td>
                <td>
                    <span class="${Number(customer.wallet) > 0 ? "amount green" : "amount"}">
                        ${formatMoney(customer.wallet)}
                    </span>
                </td>
                <td>${statusBadge(customer.status)}</td>
                <td>
                    <div class="actions">
                        <button
                            class="row-btn"
                            type="button"
                            data-action="view"
                            data-id="${id}"
                            title="View details"
                            aria-label="View customer"
                        >${ICONS.eye}</button>

                        <button
                            class="${blocked ? "row-btn" : "row-btn danger"}"
                            type="button"
                            data-action="toggle"
                            data-id="${id}"
                            title="${blocked ? "Unblock customer" : "Block customer"}"
                            aria-label="${blocked ? "Unblock customer" : "Block customer"}"
                        >${blocked ? ICONS.unlock : ICONS.lock}</button>
                    </div>
                </td>
            </tr>
        `;
    }

    function renderTable() {
        if (!tbody) return;

        const list = getFiltered();
        const totalPages = Math.max(1, Math.ceil(list.length / state.pageSize));

        if (state.page > totalPages) state.page = totalPages;

        if (countEl) {
            countEl.textContent = `${list.length} customer${list.length === 1 ? "" : "s"}`;
        }

        if (!list.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9">
                        ${UI?.emptyStateHTML
                            ? UI.emptyStateHTML(
                                "No customers found",
                                "Adjust your search or clear filters to see more customers."
                            )
                            : '<div class="empty-state"><h4>No customers found</h4><p>Try changing your filters.</p></div>'}
                    </td>
                </tr>
            `;
            if (paginationEl) paginationEl.innerHTML = "";
            return;
        }

        const start = (state.page - 1) * state.pageSize;
        const pageRows = list.slice(start, start + state.pageSize);

        tbody.innerHTML = pageRows.map(rowHTML).join("");

        renderPagination(list.length, totalPages);

        tbody.querySelectorAll("[data-action]").forEach(button => {
            button.addEventListener("click", () => {
                const id = button.dataset.id;

                if (button.dataset.action === "view") {
                    openDrawer(id);
                } else if (button.dataset.action === "toggle") {
                    confirmToggle(id);
                }
            });
        });
    }

    function renderPagination(total, totalPages) {
        if (!paginationEl) return;

        if (UI?.paginate && UI?.renderPagination) {
            const info = UI.paginate({
                data: getFiltered(),
                page: state.page,
                pageSize: state.pageSize
            });

            UI.renderPagination(paginationEl, info, page => {
                state.page = page;
                renderTable();
            });
            return;
        }

        paginationEl.innerHTML = `
            <div class="pagination">
                <button class="btn btn-soft" type="button" data-page="${state.page - 1}"
                    ${state.page <= 1 ? "disabled" : ""}>Previous</button>
                <span>Page ${state.page} of ${totalPages}</span>
                <button class="btn btn-soft" type="button" data-page="${state.page + 1}"
                    ${state.page >= totalPages ? "disabled" : ""}>Next</button>
            </div>
        `;

        paginationEl.querySelectorAll("[data-page]").forEach(button => {
            button.addEventListener("click", () => {
                state.page = Number(button.dataset.page);
                renderTable();
            });
        });
    }

    /* ---------------- Block / unblock ---------------- */

    async function confirmToggle(id) {
        const customer = customerById(id);
        if (!customer) return false;

        const blocked = customer.status === "Blocked";
        const newStatus = blocked ? "Active" : "Blocked";

        if (!UI?.confirm) {
            toast("error", "Action unavailable", "The confirmation component is missing.");
            return false;
        }

        const confirmed = await UI.confirm({
            title: blocked
                ? `Unblock ${customer.name}?`
                : `Block ${customer.name}?`,
            message: blocked
                ? `${customer.name} will regain access to the platform.`
                : `${customer.name} will no longer be able to access the platform until unblocked.`,
            confirmText: blocked ? "Unblock customer" : "Block customer",
            cancelText: "Cancel",
            danger: !blocked
        });

        if (!confirmed) return false;

        const template = window.MOTOTAXI_ENDPOINTS?.blockUserTemplate;

        if (!template) {
            toast("error", "Configuration error", "The customer block URL is missing.");
            return false;
        }

        const url = template.replace(/\/0\/?$/, `/${encodeURIComponent(id)}/`);
        const csrfToken = document.querySelector(
            '#csrf-form [name="csrfmiddlewaretoken"]'
        )?.value;

        if (!csrfToken) {
            toast("error", "Security error", "CSRF token missing. Refresh the page.");
            return false;
        }

        try {
            const response = await fetch(url, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "X-CSRFToken": csrfToken,
                    "X-Requested-With": "XMLHttpRequest"
                }
            });

            if (!response.ok) {
                let message = `Request failed (${response.status}).`;

                if (response.status === 403) {
                    message = "Permission denied. You may not block this account.";
                }

                throw new Error(message);
            }

            toast(
                "success",
                blocked ? "Customer unblocked" : "Customer blocked",
                `${customer.name} has been ${newStatus.toLowerCase()}.`
            );

            // The server remains the source of truth.
            window.location.reload();
            return true;
        } catch (error) {
            console.error("Customer status update failed:", error);
            toast("error", "Action failed", error.message || "Please try again.");
            return false;
        }
    }

    /* ---------------- Customer details drawer ---------------- */

    function openDrawer(id) {
        const customer = customerById(id);
        if (!customer || !UI?.drawer) return;

        const customerRides = getCustomerRides(customer);
        const customerTxns = getCustomerTransactions(customer);
        const latestRides = customerRides.slice(0, 3);
        const latestTxns = customerTxns.slice(0, 5);

        const blocked = customer.status === "Blocked";
        const color = avatarColor(customer.name);
        const avatarClass = color ? `avatar ${color}` : "avatar";

        const transactionsHTML = latestTxns.length
            ? `
                <div class="table-scroll">
                    <table class="tbl" style="min-width:540px">
                        <thead>
                            <tr>
                                <th>Transaction</th>
                                <th>Direction</th>
                                <th>Amount</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${latestTxns.map(tx => `
                                <tr>
                                    <td><strong>${escapeHTML(tx.id ?? tx.pk ?? "—")}</strong></td>
                                    <td>${escapeHTML(tx.direction || "—")}</td>
                                    <td><span class="amount">${formatMoney(tx.amount)}</span></td>
                                    <td><span class="tag">${escapeHTML(tx.type || tx.reason || "—")}</span></td>
                                    <td>${statusBadge(tx.status || "Recorded")}</td>
                                    <td>${formatDate(tx.date || tx.created_at, true)}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            `
            : `
                <div class="empty-state" style="padding:24px 12px">
                    <h4>No transactions yet</h4>
                    <p>No linked wallet transactions were found.</p>
                </div>
            `;

        const ridesHTML = latestRides.length
            ? `
                <div class="table-scroll">
                    <table class="tbl" style="min-width:540px">
                        <thead>
                            <tr>
                                <th>Ride ID</th>
                                <th>Driver</th>
                                <th>Route</th>
                                <th>Fare</th>
                                <th>Status</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${latestRides.map(ride => `
                                <tr>
                                    <td><strong>${escapeHTML(ride.id ?? ride.pk ?? "—")}</strong></td>
                                    <td>${escapeHTML(ride.driver || "—")}</td>
                                    <td>${escapeHTML(ride.pickup || "—")} → ${escapeHTML(ride.drop || "—")}</td>
                                    <td><span class="amount">${formatMoney(ride.total ?? ride.final_fare ?? ride.estimated_fare)}</span></td>
                                    <td>${statusBadge(ride.status || "—")}</td>
                                    <td>${formatDate(ride.date || ride.created_at, true)}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            `
            : `
                <div class="empty-state" style="padding:24px 12px">
                    <h4>No rides yet</h4>
                    <p>No linked rides were found for this customer.</p>
                </div>
            `;

        const bodyHTML = `
            <div class="profile-banner">
                <span class="${avatarClass}">${escapeHTML(initials(customer.name))}</span>
                <div>
                    <div class="name">${escapeHTML(customer.name)}</div>
                    <div class="sub">#${escapeHTML(customer.id)} · ${escapeHTML(customer.city || "—")}</div>
                </div>
            </div>

            <div style="padding:20px">
                <div class="kv-list">
                    <div class="kv"><div class="k">Customer ID</div><div class="v">${escapeHTML(customer.id)}</div></div>
                    <div class="kv"><div class="k">Phone</div><div class="v">${escapeHTML(customer.phone || "—")}</div></div>
                    <div class="kv"><div class="k">Email</div><div class="v">${escapeHTML(customer.email || "—")}</div></div>
                    <div class="kv"><div class="k">City</div><div class="v">${escapeHTML(customer.city || "—")}</div></div>
                    <div class="kv"><div class="k">Registered</div><div class="v">${formatDate(customer.regDate)}</div></div>
                    <div class="kv"><div class="k">Total Rides</div><div class="v tabular">${formatNumber(customer.rides)}</div></div>
                    <div class="kv"><div class="k">Wallet Balance</div><div class="v amount">${formatMoney(customer.wallet)}</div></div>
                    <div class="kv"><div class="k">Account Status</div><div class="v">${statusBadge(customer.status)}</div></div>
                </div>
            </div>

            <div style="padding:0 20px 20px">
                <h4 style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);margin:0 0 10px">
                    Recent Transactions
                </h4>
                ${transactionsHTML}
            </div>

            <div style="padding:0 20px 20px">
                <h4 style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);margin:0 0 10px">
                    Ride History
                </h4>
                <p class="text-muted" style="font-size:12.5px;margin:0 0 12px">
                    ${customerRides.length} ride(s) on record.
                </p>
                ${ridesHTML}
            </div>
        `;

        const footHTML = `
            <button class="btn ${blocked ? "btn-soft" : "btn-danger"}"
                id="drawerToggle" style="flex:1;justify-content:center">
                ${blocked ? ICONS.unlock : ICONS.lock}
                ${blocked ? "Unblock" : "Block"}
            </button>
            <button class="btn btn-soft" id="drawerEdit"
                style="flex:1;justify-content:center">
                ${ICONS.edit} Edit
            </button>
        `;

        const drawer = UI.drawer({
            title: customer.name,
            body: bodyHTML,
            foot: footHTML
        });

        drawer.el.querySelector("#drawerToggle")?.addEventListener("click", async () => {
            const updated = await confirmToggle(customer.id);
            if (updated) openDrawer(customer.id);
        });

        drawer.el.querySelector("#drawerEdit")?.addEventListener("click", () => {
            toast(
                "info",
                "Edit not available",
                "Customer editing needs a backend update endpoint."
            );
        });
    }

    /* ---------------- Add customer modal ---------------- */

    function openAddModal() {
        if (!UI?.modal) {
            toast("info", "Not available", "The modal component is not loaded.");
            return;
        }

        const cityOptions = [...new Set(cities)].map(city => `
            <option value="${escapeHTML(city)}">${escapeHTML(city)}</option>
        `).join("");

        const bodyHTML = `
            <div class="form-row">
                <div style="flex:1;min-width:200px">
                    <label style="font-size:11.5px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">
                        Full Name
                    </label>
                    <input class="input" id="newName" placeholder="Customer full name" style="width:100%">
                </div>
                <div style="flex:1;min-width:200px">
                    <label style="font-size:11.5px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">
                        Phone Number
                    </label>
                    <input class="input" id="newPhone" placeholder="+237..." style="width:100%">
                </div>
            </div>
            <div style="margin-top:14px">
                <label style="font-size:11.5px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">
                    Email
                </label>
                <input class="input" id="newEmail" type="email" placeholder="name@example.com" style="width:100%">
            </div>
            <div style="margin-top:14px">
                <label style="font-size:11.5px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">
                    City
                </label>
                <select class="select" id="newCity" style="width:100%">
                    ${cityOptions}
                </select>
            </div>
            <p class="text-muted" style="font-size:12.5px;margin-top:16px">
                This form requires a customer-creation endpoint before it can save to the database.
            </p>
        `;

        const modal = UI.modal({
            title: "Add Customer",
            subtitle: "Create a MOTOTAXI customer account",
            body: bodyHTML,
            foot: `
                <button class="btn btn-soft" data-close>Cancel</button>
                <button class="btn btn-primary" id="addSave">${ICONS.add} Create Customer</button>
            `,
            size: "lg"
        });

        modal.el.querySelector("#addSave")?.addEventListener("click", () => {
            const name = modal.el.querySelector("#newName")?.value.trim();

            toast(
                "info",
                "Backend endpoint required",
                name
                    ? `The form for ${name} is ready, but customer creation is not connected yet.`
                    : "Add a customer-creation endpoint to save this form."
            );
        });
    }

    /* ---------------- CSV export ---------------- */

    function exportRows() {
        const list = getFiltered();

        const rows = list.map(customer => ({
            "Customer ID": customer.id,
            "Name": customer.name,
            "Phone": customer.phone,
            "Email": customer.email,
            "City": customer.city,
            "Registration Date": customer.regDate,
            "Total Rides": customer.rides,
            "Wallet Balance FCFA": customer.wallet,
            "Status": customer.status
        }));

        if (UI?.exportCSV) {
            UI.exportCSV("mototaxi-customers.csv", rows);
            return;
        }

        if (!rows.length) {
            toast("info", "No data", "There are no customers to export.");
            return;
        }

        const columns = Object.keys(rows[0]);
        const csv = [
            columns.join(","),
            ...rows.map(row => columns.map(key =>
                `"${String(row[key] ?? "").replace(/"/g, '""')}"`
            ).join(","))
        ].join("\r\n");

        const blob = new Blob(["\uFEFF" + csv], {
            type: "text/csv;charset=utf-8;"
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "mototaxi-customers.csv";
        link.click();
        URL.revokeObjectURL(url);
    }

    /* ---------------- Event listeners ---------------- */

    searchInput?.addEventListener("input", event => {
        state.query = event.target.value;
        state.page = 1;
        renderTable();
    });

    statusSelect?.addEventListener("change", event => {
        state.status = event.target.value;
        state.page = 1;
        renderTable();
    });

    citySelect?.addEventListener("change", event => {
        state.city = event.target.value;
        state.page = 1;
        renderTable();
    });

    resetBtn?.addEventListener("click", () => {
        state.query = "";
        state.status = "All";
        state.city = "All";
        state.page = 1;

        if (searchInput) searchInput.value = "";
        if (statusSelect) statusSelect.value = "All";
        if (citySelect) citySelect.value = "All";

        renderTable();
        toast("info", "Filters reset", "Showing all customers.");
    });

    exportBtn?.addEventListener("click", exportRows);
    addBtn?.addEventListener("click", openAddModal);

    document.querySelectorAll("[data-sort]").forEach(button => {
        button.addEventListener("click", () => {
            const key = button.dataset.sort;

            if (state.sortKey === key) {
                state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
            } else {
                state.sortKey = key;
                state.sortDir = key === "regDate" ? "desc" : "asc";
            }

            state.page = 1;
            renderTable();
        });
    });

    /* ---------------- Initialise page ---------------- */

    renderStats();
    renderCityFilter();
    renderTable();

})();
