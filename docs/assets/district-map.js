/* District choropleth — 6 criteria pollutants (2018–2024) */

const BOUNDARIES_URL = "data/district/boundaries.geojson";
const BGD_CENTER = [23.685, 90.356];
const BGD_ZOOM = 7;
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

let map, districtLayer, manifestCache = null, boundariesCache = null;
let datesByYear = {};
let currentPollutant = "pm25";
let pollutantMeta = {};
let colorMin = 0, colorMax = 100;
let currentMonthLookup = {};

const el = (id) => document.getElementById(id);

function showError(msg) {
  console.error(msg);
  el("load-status").textContent = "Error: " + msg;
}

function colorScale(v, minV, maxV) {
  const t = Math.max(0, Math.min(1, (v - minV) / (maxV - minV || 1)));
  const stops = [
    [68, 1, 84],
    [49, 104, 142],
    [53, 183, 121],
    [253, 231, 37]
  ];
  const i = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
  const f = t * (stops.length - 1) - i;
  const a = stops[i], b = stops[i + 1];
  return `rgb(${Math.round(a[0] + f * (b[0] - a[0]))},${Math.round(a[1] + f * (b[1] - a[1]))},${Math.round(a[2] + f * (b[2] - a[2]))})`;
}

function selectedDateIso() {
  const y = el("year-select").value;
  const m = el("month-select").value;
  return `${y}-${m}-01`;
}

function parseDates(manifest) {
  datesByYear = {};
  manifest.dates.forEach((d) => {
    const [y, m] = d.split("-");
    if (!datesByYear[y]) datesByYear[y] = [];
    datesByYear[y].push({ iso: d, month: m });
  });
  Object.keys(datesByYear).forEach((y) => {
    datesByYear[y].sort((a, b) => a.month.localeCompare(b.month));
  });
}

function fillMonthOptions(year) {
  const monthSel = el("month-select");
  const prev = monthSel.value;
  monthSel.innerHTML = "";
  (datesByYear[year] || []).forEach(({ month }) => {
    const opt = document.createElement("option");
    opt.value = month;
    opt.textContent = MONTH_NAMES[Number(month) - 1];
    monthSel.appendChild(opt);
  });
  const months = datesByYear[year] || [];
  if (months.some((m) => m.month === prev)) monthSel.value = prev;
}

function pollutantUnit() {
  return pollutantMeta[currentPollutant]?.unit || "µg/m³";
}

function pollutantLabel() {
  return pollutantMeta[currentPollutant]?.label || currentPollutant.toUpperCase();
}

async function loadManifest() {
  if (manifestCache) return manifestCache;
  const bundle = window.__DISTRICT_MAP_BUNDLE__;
  if (!bundle?.manifest) throw new Error("Map data failed to load.");
  manifestCache = bundle.manifest;
  manifestCache.pollutants.forEach((p) => {
    pollutantMeta[p.id] = p;
  });
  parseDates(manifestCache);
  return manifestCache;
}

async function loadBoundaries() {
  if (boundariesCache) return boundariesCache;
  const res = await fetch(BOUNDARIES_URL);
  if (!res.ok) throw new Error("Missing boundaries file.");
  boundariesCache = await res.json();
  return boundariesCache;
}

function getValue(props) {
  const v = parseFloat(props._v);
  return isFinite(v) ? v : null;
}

function styleFeature(feature) {
  const v = getValue(feature.properties);
  return {
    fillColor: v != null ? colorScale(v, colorMin, colorMax) : "#cccccc",
    weight: 1.2,
    opacity: 1,
    color: "#222222",
    fillOpacity: 0.8
  };
}

function onEachFeature(feature, layer) {
  const p = feature.properties;
  layer.bindTooltip(`<strong>${p.district || "—"}</strong>`, { sticky: true });
  layer.on("click", () => {
    const row = currentMonthLookup[p.district_id];
    const v = row?.[currentPollutant];
    el("district-val").textContent = p.district || "—";
    el("division-val").textContent = p.division || "—";
    el("pm-val").textContent =
      v != null && isFinite(v) ? v.toFixed(1) + " " + pollutantUnit() : "—";
  });
}

async function loadMonthValues(dateIso) {
  el("load-status").textContent = "Loading " + dateIso.slice(0, 7) + "…";
  const bundle = window.__DISTRICT_MAP_BUNDLE__;
  const monthData = bundle?.months?.[dateIso];
  if (!monthData) throw new Error("No data for " + dateIso.slice(0, 7));
  return monthData;
}

function renderStats(values) {
  const nums = values
    .map((v) => v[currentPollutant])
    .filter((x) => x != null && isFinite(x));
  if (!nums.length) return;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  colorMin = min;
  colorMax = max;
  el("month-stats").innerHTML =
    "<strong>National summary</strong><br/>Min " +
    min.toFixed(1) + " · Mean " + mean.toFixed(1) + " · Max " + max.toFixed(1) +
    " " + pollutantUnit();
  el("leg-min").textContent = min.toFixed(1);
  el("leg-max").textContent = max.toFixed(1);
  el("legend-title").textContent = pollutantLabel() + " (" + pollutantUnit() + ")";
  el("value-label").textContent = pollutantLabel();
}

async function refreshMap() {
  const dateIso = selectedDateIso();
  const [boundaries, monthData] = await Promise.all([
    loadBoundaries(),
    loadMonthValues(dateIso)
  ]);

  renderStats(monthData.values);

  currentMonthLookup = Object.fromEntries(
    monthData.values.map((row) => [row.district_id, row])
  );

  const byId = currentMonthLookup;

  const geo = {
    type: "FeatureCollection",
    features: boundaries.features.map((feat) => {
      const row = byId[feat.properties.district_id] || {};
      const v = row[currentPollutant];
      return {
        type: "Feature",
        properties: {
          district_id: feat.properties.district_id,
          district: row.district || feat.properties.district,
          division: row.division || feat.properties.division,
          _v: v != null && isFinite(v) ? v : null
        },
        geometry: feat.geometry
      };
    })
  };

  if (districtLayer) map.removeLayer(districtLayer);
  districtLayer = L.geoJSON(geo, {
    style: styleFeature,
    onEachFeature: onEachFeature
  }).addTo(map);

  const bounds = districtLayer.getBounds();
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
  map.invalidateSize();
  el("load-status").textContent =
    geo.features.length + " districts · " + pollutantLabel() + " · " + dateIso.slice(0, 7);
}

function initMap() {
  map = L.map("map", { preferCanvas: true }).setView(BGD_CENTER, BGD_ZOOM);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap · GADM",
    maxZoom: 12
  }).addTo(map);
}

async function init() {
  initMap();
  try {
    const manifest = await loadManifest();
    currentPollutant = manifest.default_pollutant || "pm25";

    const polSel = el("pollutant-select");
    polSel.innerHTML = "";
    manifest.pollutants.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.label + " (" + p.unit + ")";
      polSel.appendChild(opt);
    });
    polSel.value = currentPollutant;
    polSel.onchange = () => {
      currentPollutant = polSel.value;
      el("district-val").textContent = "—";
      el("division-val").textContent = "—";
      el("pm-val").textContent = "—";
      refreshMap().catch(showError);
    };

    const years = Object.keys(datesByYear).sort();
    const yearSel = el("year-select");
    yearSel.innerHTML = "";
    years.forEach((y) => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      yearSel.appendChild(opt);
    });

    const defaultDate = manifest.default_date || manifest.dates[0];
    const [defY, defM] = defaultDate.split("-");
    yearSel.value = defY;
    fillMonthOptions(defY);
    el("month-select").value = defM;

    el("date-range").textContent =
      years[0] + "–" + years[years.length - 1] + " · " + manifest.dates.length + " months";

    yearSel.onchange = () => {
      fillMonthOptions(yearSel.value);
      el("district-val").textContent = "—";
      el("division-val").textContent = "—";
      el("pm-val").textContent = "—";
      refreshMap().catch(showError);
    };
    el("month-select").onchange = () => {
      el("district-val").textContent = "—";
      el("division-val").textContent = "—";
      el("pm-val").textContent = "—";
      refreshMap().catch(showError);
    };

    await refreshMap();
  } catch (err) {
    showError(err.message || String(err));
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
