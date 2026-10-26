/* ===================================================================
   MOTOTAXI ADMIN — pricing.js
   Fare Pricing configuration page controller.
   - Populates Bike + Car rule cards from D.FARE_RULES.
   - Live fare calculator: re-computes on every input/change in both
     rule cards and the calculator inputs (no button click required).
   - Per-card Reset/Save + page-level Reset All / Save All (demo).
   =================================================================== */

(function () {
  const D = window.MOTOTAXI_DATA;
  const UI = window.MOTOTAXI_UI;
  const t = window.MOTOTAXI_I18N.t;

  // Bootstrap shared shell (sidebar + topbar + theme + i18n wiring)
  bootPage('pricing', 'Fare Pricing');
  window.MOTOTAXI_I18N.applyI18n();

  /* ---------- Field IDs for each vehicle ---------- */
  const FIELDS = ['base', 'perKm', 'min', 'commission', 'nightEnabled', 'nightStart', 'nightEnd', 'multiplier'];
  const VEHICLES = ['Bike', 'Car'];

  /* ---------- Populate one rule card from D.FARE_RULES ---------- */
  function populateCard(vehicle) {
    const rule = D.FARE_RULES[vehicle];
    if (!rule) return;
    const prefix = vehicle.toLowerCase();
    FIELDS.forEach((key) => {
      const el = document.getElementById(prefix + '_' + key);
      if (!el) return;
      const v = rule[key];
      if (typeof v === 'boolean') el.checked = v;
      else el.value = v;
    });
  }

  /* ---------- Read one rule card's current values from the inputs ---------- */
  function readCard(vehicle) {
    const prefix = vehicle.toLowerCase();
    const get = (key) => document.getElementById(prefix + '_' + key);
    return {
      base:           parseFloat(get('base').value)       || 0,
      perKm:          parseFloat(get('perKm').value)       || 0,
      min:            parseFloat(get('min').value)         || 0,
      commissionPct:  parseFloat(get('commission').value)  || 0,
      nightEnabled:   get('nightEnabled').checked,
      nightStart:     get('nightStart').value               || '22:00',
      nightEnd:       get('nightEnd').value                 || '05:00',
      multiplier:     parseFloat(get('multiplier').value)  || 1,
    };
  }

  /* ---------- Reset one card to defaults, re-populate, toast ---------- */
  function resetCard(vehicle) {
    populateCard(vehicle);
    calculateFare();
    UI.toast('info', `${vehicle} fares reset`, `${vehicle} pricing rules restored from defaults.`);
  }

  /* ---------- Save one card (demo) ---------- */
  function saveCard(vehicle) {
    UI.toast('success', `${vehicle} pricing saved`, `${vehicle} pricing saved to demo state — connect your backend to persist.`);
  }

  /* ---------- Reset both cards + re-run calculator ---------- */
  async function resetAll() {
    const ok = await UI.confirm({
      title: 'Reset all fare rules?',
      message: 'This restores both Bike and Car fare rules to the demo defaults. Any unsaved edits in the rule cards above will be lost.',
      confirmText: 'Reset all',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;
    VEHICLES.forEach(populateCard);
    calculateFare();
    UI.toast('info', 'All fare rules reset', 'Bike and Car pricing restored to defaults.');
  }

  /* ---------- Save all (demo) ---------- */
  function saveAll() {
    UI.toast('success', 'Pricing rules saved', 'Pricing rules saved to in-memory demo state — connect your backend to persist.');
  }

  /* ---------- Render fare-breakdown rows ---------- */
  function renderBreakdown(rows) {
    const html = rows.map((r) => {
      const noteHtml = r.note
        ? ` <span class="text-muted" style="font-weight:400;font-size:11.5px">— ${r.note}</span>`
        : '';
      const valStyle = r.style ? ` style="${r.style}"` : '';
      const cls = r.total ? 'fare-row total' : 'fare-row';
      return `<div class="${cls}">
        <span class="lbl">${r.label}${noteHtml}</span>
        <span class="val"${valStyle}>${r.value}</span>
      </div>`;
    }).join('');
    document.getElementById('fareBreakdown').innerHTML = html;
  }

  /* ---------- Core fare calculation logic ---------- */
  function calculateFare() {
    // Calculator inputs
    const vehicle   = document.getElementById('calc_vehicle').value;   // 'Bike' | 'Car'
    const distance  = parseFloat(document.getElementById('calc_distance').value) || 0;
    const timeOfDay = document.getElementById('calc_time').value;       // 'Day' | 'Night'

    // Read the matching rule card's CURRENT input values (so the calculator is live)
    const rule = readCard(vehicle);
    const base           = rule.base;
    const perKm          = rule.perKm;
    const min            = rule.min;
    const commissionPct  = rule.commissionPct;
    const nightEnabled   = rule.nightEnabled;
    const nightStart     = rule.nightStart;
    const nightEnd       = rule.nightEnd;
    const multiplier     = rule.multiplier;

    // Computation (per spec)
    const distanceCharge   = perKm * distance;                          // shown separately
    const baseFareAmount    = base + distanceCharge;                    // base + perKm*distance
    const flooredFare      = Math.max(baseFareAmount, min);             // min fare floor applied BEFORE night
    const isNightTime       = (timeOfDay === 'Night' && nightEnabled);
    const totalFare         = isNightTime ? flooredFare * multiplier : flooredFare;
    const nightSurcharge    = isNightTime ? flooredFare * (multiplier - 1) : 0;
    const platformCommission = totalFare * commissionPct / 100;
    const driverPayout       = totalFare - platformCommission;

    // Build display rows (each value formatted via D.fmtFCFA where appropriate)
    const rows = [
      { label: 'Base Fare',
        value: D.fmtFCFA(base),
        note: 'fixed pickup fare' },
      { label: 'Distance Charge',
        value: D.fmtFCFA(distanceCharge),
        note: `${distance} km × ${D.fmtFCFA(perKm)}/km` },
      { label: 'Night Surcharge',
        value: isNightTime
          ? D.fmtFCFA(nightSurcharge)
          : '<span class="text-muted">Not applicable</span>',
        note: isNightTime ? `× ${multiplier} multiplier applied (active ${nightStart} – ${nightEnd})` : 'daytime fare' },
      { label: 'Subtotal (before night)',
        value: D.fmtFCFA(flooredFare),
        note: `min fare floor = ${D.fmtFCFA(min)}` },
      { label: 'Night Multiplier Note',
        value: isNightTime
          ? '<span class="text-brand">Night pricing active</span>'
          : '<span class="text-muted">Daytime fare</span>' },
      { label: 'Total Customer Fare',
        value: D.fmtFCFA(totalFare),
        total: true },
      { label: 'Platform Commission',
        value: D.fmtFCFA(platformCommission),
        note: `${commissionPct}% of total` },
      { label: 'Driver Payout',
        value: D.fmtFCFA(driverPayout),
        style: 'color: var(--green)' },
    ];

    renderBreakdown(rows);
  }

  /* ---------- Wire live events: every relevant input recalculates immediately ---------- */
  function wireLiveCalculator() {
    // Rule-card inputs (Bike + Car)
    VEHICLES.forEach((vehicle) => {
      const prefix = vehicle.toLowerCase();
      FIELDS.forEach((key) => {
        const el = document.getElementById(prefix + '_' + key);
        if (!el) return;
        // checkbox triggers 'change', number/time/select trigger 'input' AND 'change'
        el.addEventListener('input', calculateFare);
        el.addEventListener('change', calculateFare);
      });
    });

    // Calculator inputs
    ['calc_vehicle', 'calc_distance', 'calc_time'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', calculateFare);
      el.addEventListener('change', calculateFare);
    });

    // Calculate button (optional — calculator is already live)
    document.getElementById('calc_btn').addEventListener('click', () => {
      calculateFare();
      UI.toast('info', 'Fare recalculated', 'Estimate refreshed from current rule inputs.');
    });
  }

  /* ---------- Wire per-card and page-level buttons ---------- */
  function wireButtons() {
    // Per-card Save / Reset
    VEHICLES.forEach((vehicle) => {
      const saveBtn = document.getElementById(vehicle.toLowerCase() + '_save');
      const resetBtn = document.getElementById(vehicle.toLowerCase() + '_reset');
      if (saveBtn)  saveBtn.addEventListener('click',  () => saveCard(vehicle));
      if (resetBtn) resetBtn.addEventListener('click', () => resetCard(vehicle));
    });

    // Page-level Reset All + Save All
    document.getElementById('btnResetAll').addEventListener('click', resetAll);
    document.getElementById('btnSaveAll').addEventListener('click', saveAll);
  }

  /* ---------- Init ---------- */
  VEHICLES.forEach(populateCard);
  wireLiveCalculator();
  wireButtons();
  calculateFare();
})();
