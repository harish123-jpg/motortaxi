
/* MOTOTAXI ADMIN — database-connected fare pricing */
(function () {
  "use strict";

  const D = window.MOTOTAXI_DATA || {};
  const UI = window.MOTOTAXI_UI;
  const VEHICLES = ["Bike", "Car"];

  bootPage("pricing", "Fare Pricing");

  if (window.MOTOTAXI_I18N?.applyI18n) {
    window.MOTOTAXI_I18N.applyI18n();
  }

  const main = document.querySelector("main.main");
  const saveUrl = main?.dataset.saveUrl;

  const csrfInput = document.querySelector(
    '#pricingCsrfForm input[name="csrfmiddlewaretoken"]'
  );
  const csrfToken = csrfInput?.value || "";

  const FIELD_MAP = {
    base: "base_fare",
    perKm: "per_km_rate",
    min: "minimum_fare",
    commission: "platform_commission_percent",
    multiplier: "night_multiplier",
    nightEnabled: "night_pricing_enabled",
    nightStart: "night_start_hour",
    nightEnd: "night_end_hour"
  };

  const initialRules = {};

  function hourToTime(value) {
    const hour = Math.max(0, Math.min(23, Number(value) || 0));
    return `${String(hour).padStart(2, "0")}:00`;
  }

  function timeToHour(value) {
    const match = /^(\d{2}):\d{2}$/.exec(value || "");
    return match ? Number(match[1]) : 0;
  }

  function ruleFor(vehicle) {
    const type = vehicle.toUpperCase();
    return (window.MOTOTAXI_PRICING_RULES || []).find(
      rule => rule.vehicle_type === type
    ) || null;
  }

  function field(vehicle, key) {
    return document.getElementById(
      `${vehicle.toLowerCase()}_${key}`
    );
  }

  function formatMoney(value) {
    return typeof D.fmtFCFA === "function"
      ? D.fmtFCFA(value)
      : `${Math.round(Number(value) || 0).toLocaleString()} FCFA`;
  }

  function getInitialCard(vehicle) {
    const rule = ruleFor(vehicle);
    if (!rule) return null;

    return {
      base: Number(rule.base_fare),
      perKm: Number(rule.per_km_rate),
      min: Number(rule.minimum_fare),
      commission: Number(rule.platform_commission_percent),
      multiplier: Number(rule.night_multiplier),
      nightEnabled: Boolean(rule.night_pricing_enabled),
      nightStart: hourToTime(rule.night_start_hour),
      nightEnd: hourToTime(rule.night_end_hour)
    };
  }

  function writeCard(vehicle, values) {
    if (!values) return;

    Object.entries(values).forEach(([key, value]) => {
      const input = field(vehicle, key);
      if (!input) return;

      if (input.type === "checkbox") {
        input.checked = Boolean(value);
      } else {
        input.value = value ?? "";
      }
    });
  }

  function readCard(vehicle) {
    const get = key => field(vehicle, key);

    return {
      base: Number(get("base")?.value),
      perKm: Number(get("perKm")?.value),
      min: Number(get("min")?.value),
      commission: Number(get("commission")?.value),
      multiplier: Number(get("multiplier")?.value),
      nightEnabled: Boolean(get("nightEnabled")?.checked),
      nightStart: get("nightStart")?.value || "22:00",
      nightEnd: get("nightEnd")?.value || "05:00"
    };
  }

  function validateCard(vehicle) {
    const values = readCard(vehicle);
    const errors = [];

    const numericFields = [
      ["Base fare", values.base, 0, Infinity],
      ["Price per kilometre", values.perKm, 0, Infinity],
      ["Minimum fare", values.min, 0, Infinity],
      ["Platform commission", values.commission, 0, 100],
      ["Night multiplier", values.multiplier, 1, 3]
    ];

    numericFields.forEach(([label, value, min, max]) => {
      if (!Number.isFinite(value) || value < min || value > max) {
        errors.push(
          `${vehicle}: ${label} must be between ${min} and ${max === Infinity ? "unlimited" : max}.`
        );
      }
    });

    ["nightStart", "nightEnd"].forEach(key => {
      if (!/^\d{2}:\d{2}$/.test(values[key])) {
        errors.push(`${vehicle}: select valid night hours.`);
      }
    });

    return errors;
  }

  function populateFromDatabase() {
    VEHICLES.forEach(vehicle => {
      const values = getInitialCard(vehicle);
      if (values) {
        initialRules[vehicle] = { ...values };
        writeCard(vehicle, values);
      } else {
        const card = document.getElementById(
          `${vehicle.toLowerCase()}Card`
        );
        if (card) {
          card.insertAdjacentHTML(
            "afterbegin",
            `<p class="text-muted" style="margin-bottom:12px">
              No ${vehicle} pricing record exists yet. Enter values and save
              to create one.
            </p>`
          );
        }
      }
    });
  }

  function buildPayload(vehicleTypes) {
    const formData = new FormData();

    vehicleTypes.forEach(vehicle => {
      const prefix = vehicle.toUpperCase().toLowerCase() + "_";
      const values = readCard(vehicle);

      formData.append("vehicle_types", vehicle.toUpperCase());

      Object.entries(FIELD_MAP).forEach(([uiKey, modelField]) => {
        let value = values[uiKey];

        if (uiKey === "nightStart" || uiKey === "nightEnd") {
          value = timeToHour(value);
        }

        if (uiKey === "nightEnabled") {
          formData.append(
            prefix + modelField,
            value ? "on" : "off"
          );
        } else {
          formData.append(prefix + modelField, String(value));
        }
      });
    });

    return formData;
  }

  async function saveVehicles(vehicleTypes) {
    if (!saveUrl) {
      UI.toast("error", "Configuration error", "The pricing save URL is missing.");
      return false;
    }

    const errors = vehicleTypes.flatMap(validateCard);
    if (errors.length) {
      UI.toast("error", "Check pricing values", errors.slice(0, 3).join(" "));
      return false;
    }

    const buttons = [
      document.getElementById("btnSaveAll"),
      ...vehicleTypes.map(vehicle =>
        document.getElementById(`${vehicle.toLowerCase()}_save`)
      )
    ].filter(Boolean);

    buttons.forEach(button => {
      button.disabled = true;
    });

    try {
      const response = await fetch(saveUrl, {
        method: "POST",
        headers: {
          "X-CSRFToken": csrfToken,
          "X-Requested-With": "XMLHttpRequest"
        },
        body: buildPayload(vehicleTypes),
        credentials: "same-origin"
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const messages = result.errors || [
          "The server could not save these pricing rules."
        ];
        UI.toast("error", "Save failed", messages.join(" "));
        return false;
      }

      // Update reset baseline only after the server confirms success.
      vehicleTypes.forEach(vehicle => {
        const values = readCard(vehicle);
        initialRules[vehicle] = { ...values };
      });

      // Replace browser-side initial records with the saved database values.
      const saved = result.rules || {};
      const currentRules = window.MOTOTAXI_PRICING_RULES || [];

      Object.entries(saved).forEach(([type, rule]) => {
        const index = currentRules.findIndex(
          item => item.vehicle_type === type
        );

        if (index >= 0) currentRules[index] = rule;
        else currentRules.push(rule);
      });

      window.MOTOTAXI_PRICING_RULES = currentRules;

      calculateFare();
      UI.toast("success", "Pricing saved", result.message || "Rules saved successfully.");
      return true;
    } catch (error) {
      UI.toast(
        "error",
        "Network error",
        "Could not reach the server. Check your connection and try again."
      );
      return false;
    } finally {
      buttons.forEach(button => {
        button.disabled = false;
      });
    }
  }

  function resetCard(vehicle) {
    if (!initialRules[vehicle]) {
      UI.toast(
        "info",
        "No saved values",
        "No database pricing record was loaded for this vehicle."
      );
      return;
    }

    writeCard(vehicle, initialRules[vehicle]);
    calculateFare();

    UI.toast(
      "info",
      `${vehicle} reset`,
      "Values restored to the last values loaded or saved from the database."
    );
  }

  async function resetAll() {
    const ok = await UI.confirm({
      title: "Reset all fare rules?",
      message: "Discard unsaved changes and restore the last database values for Bike and Car?",
      confirmText: "Reset all",
      cancelText: "Cancel",
      danger: true
    });

    if (!ok) return;

    VEHICLES.forEach(resetCard);
    calculateFare();
  }

  function renderBreakdown(rows) {
    document.getElementById("fareBreakdown").innerHTML =
      rows.map(row => {
        const note = row.note
          ? ` <span class="text-muted" style="font-weight:400;font-size:11.5px">— ${row.note}</span>`
          : "";
        const style = row.style ? ` style="${row.style}"` : "";
        const className = row.total ? "fare-row total" : "fare-row";

        return `
          <div class="${className}">
            <span class="lbl">${row.label}${note}</span>
            <span class="val"${style}>${row.value}</span>
          </div>`;
      }).join("");
  }

  function calculateFare() {
    const vehicle = document.getElementById("calc_vehicle").value;
    const distanceInput = document.getElementById("calc_distance");
    const distance = Math.max(0, Number(distanceInput.value) || 0);
    const timeOfDay = document.getElementById("calc_time").value;
    const rule = readCard(vehicle);

    const distanceCharge = rule.perKm * distance;
    const rawFare = rule.base + distanceCharge;
    const flooredFare = Math.max(rawFare, rule.min);
    const nightActive = timeOfDay === "Night" && rule.nightEnabled;
    const totalFare = nightActive
      ? flooredFare * rule.multiplier
      : flooredFare;
    const nightSurcharge = nightActive
      ? totalFare - flooredFare
      : 0;
    const platformCommission = totalFare * rule.commission / 100;
    const driverPayout = totalFare - platformCommission;

    const rows = [
      {
        label: "Base Fare",
        value: formatMoney(rule.base),
        note: "fixed pickup fare"
      },
      {
        label: "Distance Charge",
        value: formatMoney(distanceCharge),
        note: `${distance} km × ${formatMoney(rule.perKm)}/km`
      },
      {
        label: "Subtotal Before Night Pricing",
        value: formatMoney(flooredFare),
        note: `minimum fare floor = ${formatMoney(rule.min)}`
      },
      {
        label: "Night Surcharge",
        value: nightActive
          ? formatMoney(nightSurcharge)
          : '<span class="text-muted">Not applicable</span>',
        note: nightActive
          ? `× ${rule.multiplier} multiplier (${rule.nightStart}–${rule.nightEnd})`
          : "daytime fare or night pricing disabled"
      },
      {
        label: "Total Customer Fare",
        value: formatMoney(totalFare),
        total: true
      },
      {
        label: "Platform Commission",
        value: formatMoney(platformCommission),
        note: `${rule.commission}% of total`
      },
      {
        label: "Driver Payout Estimate",
        value: formatMoney(driverPayout),
        style: "color:var(--green)"
      }
    ];

    renderBreakdown(rows);
  }

  function wireLiveCalculator() {
    VEHICLES.forEach(vehicle => {
      Object.keys(FIELD_MAP).forEach(key => {
        const input = field(vehicle, key);
        if (!input) return;

        input.addEventListener("input", calculateFare);
        input.addEventListener("change", calculateFare);
      });
    });

    ["calc_vehicle", "calc_distance", "calc_time"].forEach(id => {
      const input = document.getElementById(id);
      if (!input) return;

      input.addEventListener("input", calculateFare);
      input.addEventListener("change", calculateFare);
    });

    document.getElementById("calc_btn")?.addEventListener("click", () => {
      calculateFare();
      UI.toast("info", "Fare recalculated", "Estimate refreshed using the current input values.");
    });
  }

  function wireButtons() {
    VEHICLES.forEach(vehicle => {
      document.getElementById(`${vehicle.toLowerCase()}_save`)
        ?.addEventListener("click", () => saveVehicles([vehicle]));

      document.getElementById(`${vehicle.toLowerCase()}_reset`)
        ?.addEventListener("click", () => resetCard(vehicle));
    });

    document.getElementById("btnSaveAll")
      ?.addEventListener("click", () => saveVehicles(VEHICLES));

    document.getElementById("btnResetAll")
      ?.addEventListener("click", resetAll);
  }

  populateFromDatabase();
  wireLiveCalculator();
  wireButtons();
  calculateFare();
})();
