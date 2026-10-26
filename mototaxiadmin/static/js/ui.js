/* ===================================================================
   MOTOTAXI ADMIN — ui.js
   Shared UI primitives: toast, modal, drawer, confirm dialog,
   pagination, CSV export, table renderer helpers, empty-state.
   Exposed via window.MOTOTAXI_UI.
   =================================================================== */

const UI = (() => {

  /* ---------- Toasts ---------- */
  const toastContainer = () => document.getElementById('toastContainer') || (() => {
    const c = document.createElement('div');
    c.id = 'toastContainer';
    c.className = 'toast-container';
    document.body.appendChild(c);
    return c;
  })();

  const TOAST_ICONS = {
    success: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4 10-10"/></svg>',
    error:   '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
    warning: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>',
    info:    '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  };

  function toast(kind, title, desc = '', ms = 3800) {
    const c = toastContainer();
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `${TOAST_ICONS[kind] || TOAST_ICONS.info}
      <div class="body">
        <div class="ttl">${title}</div>
        ${desc ? `<div class="desc">${desc}</div>` : ''}
      </div>
      <button class="btn-ghost btn-sm" aria-label="Close">×</button>`;
    c.appendChild(el);
    const close = () => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 220);
    };
    el.querySelector('button').addEventListener('click', close);
    if (ms) setTimeout(close, ms);
  }

  /* ---------- Modal ---------- */
  function modal({ title, subtitle = '', body = '', foot = '', size = '', closable = true, onMount } = {}) {
    closeAll();
    const mount = document.getElementById('modalMount') || (() => {
      const m = document.createElement('div');
      m.id = 'modalMount';
      document.body.appendChild(m);
      return m;
    })();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal ${size}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div>
            <h3>${title}</h3>
            ${subtitle ? `<div class="sub">${subtitle}</div>` : ''}
          </div>
          <button class="icon-btn" data-close aria-label="Close">×</button>
        </div>
        <div class="modal-body">${body}</div>
        ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
      </div>`;
    mount.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    const close = () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
    };
    overlay.addEventListener('click', (e) => {
      if ((closable && e.target === overlay) || e.target.closest('[data-close]')) close();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    if (onMount) onMount(overlay);
    return { close, el: overlay };
  }

  function closeAll() {
    document.querySelectorAll('.modal-overlay').forEach(o => { o.classList.remove('open'); o.remove(); });
    document.querySelectorAll('.drawer-overlay').forEach(o => { o.classList.remove('open'); o.remove(); });
  }

  /* ---------- Drawer (right) ---------- */
  function drawer({ title, body = '', foot = '', onMount } = {}) {
    closeAll();
    const mount = document.getElementById('modalMount') || (() => {
      const m = document.createElement('div');
      m.id = 'modalMount';
      document.body.appendChild(m);
      return m;
    })();
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.innerHTML = `
      <aside class="drawer" role="dialog" aria-modal="true">
        <div class="drawer-head">
          <h3>${title}</h3>
          <button class="icon-btn" data-close aria-label="Close">×</button>
        </div>
        <div class="drawer-body">${body}</div>
        ${foot ? `<div class="drawer-foot">${foot}</div>` : ''}
      </aside>`;
    mount.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    const close = () => { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 240); };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('[data-close]')) close();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    if (onMount) onMount(overlay);
    return { close, el: overlay };
  }

  /* ---------- Confirm dialog ---------- */
  function confirm({ title = 'Confirm action', message = '', confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}) {
    return new Promise(resolve => {
      const m = modal({
        title,
        body: `<p style="color:var(--muted); font-size:13.5px; line-height:1.6;">${message}</p>`,
        foot: `<button class="btn" data-close>${cancelText}</button>
               <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirmOk">${confirmText}</button>`,
        size: '',
      });
      m.el.querySelector('#confirmOk').addEventListener('click', () => { m.close(); resolve(true); });
      m.el.querySelector('[data-close]').addEventListener('click', () => resolve(false));
      m.el.addEventListener('click', e => { if (e.target === m.el.querySelector('.modal-overlay')) resolve(false); });
    });
  }

  /* ---------- Pagination state builder + render ---------- */
  function paginate({ data, page, pageSize }) {
    const total = data.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    page = Math.min(Math.max(1, page), pages);
    const start = (page - 1) * pageSize;
    return {
      page, pages, total,
      slice: data.slice(start, start + pageSize),
      startIdx: total === 0 ? 0 : start + 1,
      endIdx: Math.min(start + pageSize, total),
    };
  }

  function renderPagination(container, info, onChange) {
    if (!container) return;
    const { page, pages, total, startIdx, endIdx } = info;
    if (total === 0) { container.innerHTML = ''; return; }
    const btns = [];
    btns.push(`<button class="page-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>‹</button>`);
    const maxBtns = 7;
    let from = Math.max(1, page - 3);
    let to = Math.min(pages, from + maxBtns - 1);
    if (to - from < maxBtns - 1) from = Math.max(1, to - maxBtns + 1);
    if (from > 1) { btns.push(`<button class="page-btn" data-page="1">1</button>`); if (from > 2) btns.push(`<span class="page-btn" disabled>…</span>`); }
    for (let i = from; i <= to; i++) {
      btns.push(`<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`);
    }
    if (to < pages) { if (to < pages - 1) btns.push(`<span class="page-btn" disabled>…</span>`); btns.push(`<button class="page-btn" data-page="${pages}">${pages}</button>`); }
    btns.push(`<button class="page-btn" data-page="${page + 1}" ${page === pages ? 'disabled' : ''}>›</button>`);
    container.innerHTML = `
      <div class="info">Showing ${startIdx}–${endIdx} of ${total} records</div>
      <div class="pages">${btns.join('')}</div>`;
    container.querySelectorAll('.page-btn[data-page]').forEach(b => {
      b.addEventListener('click', () => {
        if (b.disabled) return;
        onChange(parseInt(b.dataset.page, 10));
      });
    });
  }

  /* ---------- Empty state ---------- */
  function emptyStateHTML(message = 'No matching records', hint = 'Try a different search or filter.') {
    return `<div class="empty-state">
      <div class="ic"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg></div>
      <h4>${message}</h4>
      <p>${hint}</p>
    </div>`;
  }

  /* ---------- Badge helper ---------- */
  function statusBadge(status) {
    const map = {
      'Active':    'badge-success',
      'Approved':  'badge-success',
      'Verified':  'badge-success',
      'Completed': 'badge-success',
      'Successful':'badge-success',
      'Online':    'badge-online',
      'Available': 'badge-success',
      'Pending':   'badge-warning',
      'Inactive':  'badge-muted',
      'Offline':   'badge-offline',
      'Blocked':   'badge-danger',
      'Cancelled': 'badge-danger',
      'Failed':    'badge-danger',
      'Rejected':  'badge-danger',
      'Expired':   'badge-warning',
    };
    return `<span class="badge ${map[status] || 'badge-muted'}">${status}</span>`;
  }

  function onlineBadge(online) {
    return online
      ? `<span class="badge badge-online">Online</span>`
      : `<span class="badge badge-offline">Offline</span>`;
  }

  /* ---------- Avatar initials ---------- */
  function initials(name = '') {
    return name.split(/\s+/).slice(0, 2).map(s => s[0] || '').join('').toUpperCase() || '?';
  }
  function avatarColor(seed = '') {
    const colors = ['', 'gray', 'amber', 'purple', 'blue'];
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return colors[h % colors.length];
  }

  /* ---------- CSV export ---------- */
  function exportCSV(filename, rows) {
    if (!rows || !rows.length) { toast('warning', 'Nothing to export', 'No rows in current view.'); return; }
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('success', 'CSV exported', `${rows.length} rows → ${filename}`);
  }

  /* ---------- Print ---------- */
  function printPage() { window.print(); }

  /* ---------- Table sort (returns -1/0/1) ---------- */
  function sortData(data, key, dir) {
    const arr = [...data];
    arr.sort((a, b) => {
      let x = a[key], y = b[key];
      if (typeof x === 'string' && !isNaN(parseFloat(x)) && typeof y === 'string' && !isNaN(parseFloat(y))) {
        x = parseFloat(x); y = parseFloat(y);
      } else if (typeof x === 'string' && typeof y === 'string') {
        return dir === 'asc' ? x.localeCompare(y) : y.localeCompare(x);
      }
      x = Number(x) || 0; y = Number(y) || 0;
      return dir === 'asc' ? x - y : y - x;
    });
    return arr;
  }

  return {
    toast, modal, drawer, confirm, paginate, renderPagination,
    emptyStateHTML, statusBadge, onlineBadge, initials, avatarColor,
    exportCSV, printPage, sortData, closeAll,
  };
})();

window.MOTOTAXI_UI = UI;
window.MOTOTAXI_DATA = window.MOTOTAXI_DATA || {};
