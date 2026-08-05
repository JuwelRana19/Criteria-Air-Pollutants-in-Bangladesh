/* District choropleth — 6 criteria pollutants (2018–2024, annual averages) */

const BOUNDARIES_URL = "data/district/boundaries.geojson";
const BGD_CENTER = [23.685, 90.356];
const BGD_ZOOM = 7;

let map, districtLayer, manifestCache = null, boundariesCache = null;
let currentPollutant = "pm25";
let pollutantMeta = {};
let colorMin = 0, colorMax = 100;
let selectedLayer = null;
let layerById = {};

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

function selectedYear() {
  return el("year-select").value;
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

function baseStyle(feature, selected) {
  const v = getValue(feature.properties);
  return {
    fillColor: v != null ? colorScale(v, colorMin, colorMax) : "#cccccc",
    weight: selected ? 3.5 : 1.2,
    opacity: 1,
    color: selected ? "#ffffff" : "#222222",
    fillOpacity: selected ? 0.95 : 0.8
  };
}

function styleFeature(feature) {
  const selected =
    selectedLayer?.feature?.properties?.district_id === feature.properties.district_id;
  return baseStyle(feature, selected);
}

function popupContent(p, v) {
  const val = v != null ? v.toFixed(1) + " " + pollutantUnit() : "—";
  return (
    "<div class=\"district-popup\">" +
    "<strong>" + (p.district || "—") + "</strong><br/>" +
    (p.division || "—") + "<br/>" +
    "<span class=\"district-popup-value\">" + pollutantLabel() + " (annual mean): " + val + "</span>" +
    "</div>"
  );
}

function updateSidebar(p, v) {
  el("division-val").textContent = p.division || "—";
  el("pm-val").textContent = v != null ? v.toFixed(1) + " " + pollutantUnit() : "—";
}

function populateDistrictSelect(values) {
  const sel = el("district-select");
  const prev = sel.value;
  sel.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "— Select district —";
  sel.appendChild(empty);
  [...values]
    .sort((a, b) => (a.district || "").localeCompare(b.district || ""))
    .forEach((row) => {
      const opt = document.createElement("option");
      opt.value = row.district_id;
      opt.textContent = row.district || row.district_id;
      sel.appendChild(opt);
    });
  sel.value = prev && layerById[prev] ? prev : "";
}

function clearDistrictSelection() {
  if (selectedLayer) {
    selectedLayer.setStyle(baseStyle(selectedLayer.feature, false));
    selectedLayer.closePopup();
    selectedLayer = null;
  }
  el("district-select").value = "";
  updateSidebar({ division: "—" }, null);
}

function selectDistrictById(districtId) {
  if (!districtId) {
    clearDistrictSelection();
    return;
  }
  const layer = layerById[districtId];
  if (!layer) return;
  const p = layer.feature.properties;
  selectDistrict(layer, p, getValue(p));
  const bounds = layer.getBounds();
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
  }
}

function selectDistrict(layer, p, v) {
  if (selectedLayer && selectedLayer !== layer) {
    selectedLayer.setStyle(baseStyle(selectedLayer.feature, false));
  }
  selectedLayer = layer;
  layer.setStyle(baseStyle(layer.feature, true));
  if (typeof layer.bringToFront === "function") layer.bringToFront();
  layer.setPopupContent(popupContent(p, v));
  layer.openPopup();
  el("district-select").value = p.district_id || "";
  updateSidebar(p, v);
}

function onEachFeature(feature, layer) {
  const p = feature.properties;
  const v = getValue(p);
  layer.bindTooltip(
    `<strong>${p.district || "—"}</strong><br/>${v != null ? v.toFixed(1) + " " + pollutantUnit() : "no data"}`,
    { sticky: true }
  );
  layer.bindPopup(popupContent(p, v), {
    closeButton: true,
    className: "district-popup-wrap"
  });
  layer.on("click", (e) => {
    if (e.originalEvent) L.DomEvent.stopPropagation(e);
    selectDistrict(layer, p, v);
  });
}

async function loadYearValues(year) {
  el("load-status").textContent = "Loading " + year + "…";
  const bundle = window.__DISTRICT_MAP_BUNDLE__;
  const yearData = bundle?.years?.[String(year)];
  if (!yearData) throw new Error("No data for " + year);
  return yearData;
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
    "<strong>National summary</strong> (annual mean)<br/>Min " +
    min.toFixed(1) + " · Mean " + mean.toFixed(1) + " · Max " + max.toFixed(1) +
    " " + pollutantUnit();
  el("leg-min").textContent = min.toFixed(1);
  el("leg-max").textContent = max.toFixed(1);
  el("legend-title").textContent = pollutantLabel() + " (" + pollutantUnit() + ")";
  el("value-label").textContent = pollutantLabel();
}

async function refreshMap() {
  const year = selectedYear();
  const [boundaries, yearData] = await Promise.all([
    loadBoundaries(),
    loadYearValues(year)
  ]);

  renderStats(yearData.values);

  const byId = Object.fromEntries(yearData.values.map((row) => [row.district_id, row]));

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
  selectedLayer = null;
  layerById = {};
  districtLayer = L.geoJSON(geo, {
    style: styleFeature,
    onEachFeature: onEachFeature
  }).addTo(map);
  districtLayer.eachLayer((layer) => {
    const id = layer.feature?.properties?.district_id;
    if (id) layerById[id] = layer;
  });

  populateDistrictSelect(yearData.values);
  if (el("district-select").value) {
    selectDistrictById(el("district-select").value);
  } else {
    updateSidebar({ division: "—" }, null);
  }

  const bounds = districtLayer.getBounds();
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
  map.invalidateSize();
  el("load-status").textContent =
    geo.features.length + " districts · " + pollutantLabel() + " · " + year + " (annual)";
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
      refreshMap().catch(showError);
    };

    const years = (manifest.years || []).map(String).sort();
    const yearSel = el("year-select");
    yearSel.innerHTML = "";
    years.forEach((y) => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      yearSel.appendChild(opt);
    });

    yearSel.value = String(manifest.default_year || years[0]);
    el("date-range").textContent =
      years[0] + "–" + years[years.length - 1] + " · annual averages";

    yearSel.onchange = () => refreshMap().catch(showError);

    el("district-select").onchange = () => selectDistrictById(el("district-select").value);

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
