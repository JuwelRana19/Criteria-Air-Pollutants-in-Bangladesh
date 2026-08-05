/* Bangladesh PM2.5 interactive map — 1 km grid viewer */

const DATA_BASE = "data/";
const BGD_CENTER = [23.685, 90.356];
const BGD_ZOOM = 7;
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

let map, heatLayer, boundaryLayer, currentData = null;
let colorMin = 15, colorMax = 80;
let spatialIndex = null;

const el = (id) => document.getElementById(id);

function manifestDates(manifest) {
  const dates = manifest?.dates;
  if (Array.isArray(dates)) return dates;
  if (typeof dates === "string" && dates) return [dates];
  return [];
}

function formatMonthLabel(dateIso) {
  const [y, m] = dateIso.split("-");
  return MONTH_NAMES[Number(m) - 1] + " " + y;
}

async function loadManifest() {
  const bundle = window.__GRID_MAP_BUNDLE__;
  if (!bundle?.manifest) throw new Error("Map data failed to load.");
  return bundle.manifest;
}

async function loadMonth(dateIso) {
  el("load-status").textContent = "Loading " + dateIso.slice(0, 7) + "…";
  const bundle = window.__GRID_MAP_BUNDLE__;
  const data = bundle?.months?.[dateIso];
  if (!data) throw new Error("No data for " + dateIso.slice(0, 7));
  el("load-status").textContent = `${data.n.toLocaleString()} cells · ${dateIso.slice(0, 7)}`;
  return data;
}

function renderStats(stats) {
  if (!stats) return;
  el("month-stats").innerHTML =
    "<strong>Month summary</strong><br/>Min " +
    stats.min + " · Mean " + stats.mean + " · Median " + stats.median +
    "<br/>Max " + stats.max + " · 95th pct " + stats.q95;
  colorMin = Math.max(0, stats.q05 || stats.min);
  colorMax = stats.q95 || stats.max;
  el("leg-min").textContent = colorMin.toFixed(1);
  el("leg-max").textContent = colorMax.toFixed(1);
}

function buildHeatLayer(data) {
  if (heatLayer) map.removeLayer(heatLayer);
  const heatData = data.points
    .filter((p) => p[2] != null && isFinite(p[2]))
    .map((p) => [p[1], p[0], p[2]]);

  heatLayer = L.heatLayer(heatData, {
    radius: 6,
    blur: 4,
    maxZoom: 12,
    minOpacity: 0.35,
    max: colorMax,
    gradient: {
      0.0: "#440154",
      0.35: "#31688e",
      0.6: "#35b779",
      0.85: "#fde725",
      1.0: "#fde725"
    }
  }).addTo(map);

  currentData = data;
  spatialIndex = buildSpatialIndex(data);
  if (boundaryLayer) boundaryLayer.bringToFront();
}

function buildSpatialIndex(data, cellDeg = 0.05) {
  const index = new Map();
  for (const p of data.points) {
    if (p[2] == null || !isFinite(p[2])) continue;
    const key = `${Math.floor(p[1] / cellDeg)}_${Math.floor(p[0] / cellDeg)}`;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(p);
  }
  return { index, cellDeg };
}

function nearestPoint(lat, lng) {
  if (!spatialIndex) return null;
  const { index, cellDeg } = spatialIndex;
  const ci = Math.floor(lat / cellDeg);
  const cj = Math.floor(lng / cellDeg);
  let best = null;
  let bestD = Infinity;
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const bucket = index.get(`${ci + di}_${cj + dj}`);
      if (!bucket) continue;
      for (const p of bucket) {
        const d = (p[1] - lat) ** 2 + (p[0] - lng) ** 2;
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
    }
  }
  return best;
}

async function onDateChange(dateIso) {
  try {
    const data = await loadMonth(dateIso);
    renderStats(data.stats);
    buildHeatLayer(data);
    const b = data.bounds;
    if (b) {
      map.fitBounds([[b.south, b.west], [b.north, b.east]], { padding: [20, 20] });
    }
  } catch (err) {
    el("load-status").textContent = "Error: " + err.message;
    console.error(err);
  }
}

function initMap() {
  map = L.map("map", { zoomControl: true }).setView(BGD_CENTER, BGD_ZOOM);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap · GADM",
    maxZoom: 18
  }).addTo(map);

  fetch(`${DATA_BASE}bgd_boundary.geojson`)
    .then((r) => (r.ok ? r.json() : null))
    .then((geo) => {
      if (geo) {
        boundaryLayer = L.geoJSON(geo, {
          style: { color: "#0f2940", weight: 2, fillOpacity: 0 }
        }).addTo(map);
      }
    })
    .catch(() => {});

  map.on("mousemove", (e) => {
    const pt = nearestPoint(e.latlng.lat, e.latlng.lng);
    el("lat-val").textContent = e.latlng.lat.toFixed(3);
    el("lon-val").textContent = e.latlng.lng.toFixed(3);
    el("pm-val").textContent = pt ? pt[2].toFixed(1) + " µg/m³" : "—";
  });
}

async function init() {
  initMap();
  try {
    const manifest = await loadManifest();
    const dates = manifestDates(manifest);
    if (!dates.length) throw new Error("No grid dates in manifest.");

    document.title = (manifest.title || "Bangladesh PM2.5") + " | SAIST";
    el("date-range").textContent =
      dates.length === 1
        ? "Preview · " + formatMonthLabel(dates[0])
        : formatMonthLabel(dates[0]) + "–" + formatMonthLabel(dates[dates.length - 1]);

    const sel = el("date-select");
    sel.innerHTML = "";
    dates.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = formatMonthLabel(d);
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => onDateChange(sel.value));

    const defaultDate = manifest.default_date || dates[0];
    sel.value = defaultDate;
    await onDateChange(defaultDate);
  } catch (err) {
    el("load-status").textContent = "Error: " + err.message;
    console.error(err);
  }
}

init();
