import { CRS_NAMES, PROJECTIONS } from "@sluxia/dende-core";
import { ViewerZone } from "./zones";
import { renderTopNav, TOP_NAV_CSS } from "./nav";

interface CrsOption {
  id: string;
  name: string;
}

/**
 * Interactive "check a plot" input page with two modes:
 *  1. Upload a survey plan scan  → existing POST /api/plots pipeline.
 *  2. Enter boundary-corner coordinates → POST /api/plots/from-coordinates,
 *     with a live map preview (zones + polygon), check-only or check + register.
 */
export function renderInputPageHtml(zones: ViewerZone[]): string {
  const crsOptions: CrsOption[] = Object.entries(CRS_NAMES).map(([id, name]) => ({ id, name }));
  const payload = JSON.stringify({
    zones,
    crsOptions,
    projs: PROJECTIONS,
    demo: {
      gps: [
        [5.003491417, 8.366768727],
        [5.003524699, 8.366901295],
        [5.003255837, 8.36696346],
        [5.003222728, 8.366831596]
      ],
      utm: [
        [429802.516, 553084.066],
        [429817.216, 553087.731],
        [429824.079, 553058.003],
        [429809.457, 553054.357]
      ]
    }
  }).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Dende — Check a plot</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body { margin: 0; height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f3f4f6; }
  ${TOP_NAV_CSS}
  .tabs { display: flex; gap: 6px; padding: 12px 16px 0; max-width: 1100px; margin: 0 auto; }
  .tabs button { border: 1px solid #d1d5db; background: #fff; border-radius: 8px 8px 0 0; padding: 8px 18px; font-size: 13px; font-weight: 600; cursor: pointer; color: #4b5563; }
  .tabs button.active { background: #111827; color: #fff; border-color: #111827; }
  .tab { display: none; max-width: 1100px; margin: 0 auto; padding: 16px; }
  .tab.active { display: block; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; }
  .card + .card { margin-top: 14px; }
  .card h2 { font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: #6b7280; margin: 0 0 10px; }
  .grid { display: grid; grid-template-columns: 1fr 420px; gap: 14px; }
  @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  #preview { height: 480px; width: 100%; border-radius: 8px; border: 1px solid #e5e7eb; }
  label { font-size: 12px; font-weight: 600; color: #374151; display: block; margin: 8px 0 4px; }
  select, input[type=text], input[type=file] { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 10px; font-size: 13px; }
  table.verts { border-collapse: collapse; width: 100%; margin-top: 8px; }
  table.verts th { font-size: 11px; color: #6b7280; text-align: left; padding: 2px 4px; }
  table.verts td { padding: 2px 4px; }
  table.verts input { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 6px; padding: 6px 8px; font-size: 13px; font-variant-numeric: tabular-nums; }
  table.verts td.del { width: 26px; text-align: center; }
  table.verts button { border: none; background: none; color: #dc2626; font-size: 15px; cursor: pointer; }
  .rowbtns { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
  .rowbtns button { border: 1px solid #d1d5db; background: #fff; border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
  .rowbtns button:hover { background: #f3f4f6; }
  .btn { border: none; border-radius: 8px; padding: 9px 16px; font-size: 13px; font-weight: 700; cursor: pointer; }
  .btn-dark { background: #111827; color: #fff; }
  .btn-dark:hover { background: #1f2937; }
  .btn-outline { background: #fff; color: #111827; border: 1px solid #d1d5db; }
  .btn-outline:hover { background: #f3f4f6; }
  .submitrow { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 14px; }
  #status { font-size: 13px; color: #6b7280; }
  #status.error { color: #b91c1c; }
  #status.ok { color: #15803d; }
  .finding { border-left: 4px solid #d1d5db; padding: 6px 10px; margin: 6px 0; font-size: 13px; background: #f9fafb; border-radius: 0 6px 6px 0; }
  .finding.overlap { border-left-color: #dc2626; }
  .finding.road { border-left-color: #2563eb; }
  .finding.reserve { border-left-color: #16a34a; }
  .finding.critical { border-left-color: #7f1d1d; background: #fef2f2; }
  .finding.warning { border-left-color: #d97706; background: #fffbeb; }
  .finding.info { border-left-color: #2563eb; background: #eff6ff; }
  .badge { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 10px; font-weight: 700; margin: 0 2px 2px 0; }
  .badge.critical { background: #fee2e2; color: #b91c1c; }
  .badge.warning { background: #fef3c7; color: #b45309; }
  .badge.info { background: #dbeafe; color: #1d4ed8; }
  .badge.ok { background: #dcfce7; color: #15803d; }
  .result-link { display: inline-block; margin-top: 8px; font-size: 13px; color: #2563eb; }
  .evidence{margin-top:10px;border:1px solid #e5e7eb;background:#f9fafb;border-radius:8px;padding:8px}.evidence-title{font-size:11px;font-weight:800;text-transform:uppercase;color:#374151;margin-bottom:5px}.evidence-row{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid #e5e7eb;font-size:11px}.evidence-row:last-of-type{border:0}.evidence-row span{color:#6b7280;text-align:right}.coverage-note{font-size:11px;line-height:1.4;color:#92400e;background:#fffbeb;border-radius:6px;padding:7px;margin-top:7px}
  .legend { background: #fff; padding: 6px 10px; border-radius: 6px; font-size: 11px; box-shadow: 0 1px 4px rgba(0,0,0,.2); }
  .legend div { display: flex; align-items: center; gap: 6px; margin: 2px 0; }
  .swatch { width: 14px; height: 14px; display: inline-block; border-radius: 3px; flex: none; }
  .muted { color: #9ca3af; }
  .checkitem { display: flex; align-items: center; gap: 8px; }
  @media (max-width:600px){
    .tabs{padding:10px 12px 0;display:grid;grid-template-columns:1fr 1fr}.tabs button{padding:8px 6px;min-height:44px;font-size:12px}.tab{padding:12px}.card{padding:13px}#preview{height:42dvh;min-height:300px;max-height:430px}
    table.verts thead{display:none}table.verts tbody,table.verts tr,table.verts td{display:block}table.verts tr{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:7px 9px;border:1px solid #e5e7eb;border-radius:9px;padding:9px;margin:8px 0}table.verts td{padding:0}table.verts td:nth-child(1),table.verts td:nth-child(2){grid-column:1}table.verts td.del{grid-column:2;grid-row:1/3;width:44px;display:flex;align-items:center;justify-content:center}table.verts td::before{content:attr(data-label);display:block;margin-bottom:3px;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase}table.verts td.del::before{display:none}table.verts button,.rowbtns button,.btn{min-height:44px;min-width:44px}.submitrow{align-items:flex-start;flex-direction:column}.submitrow .btn{width:100%}select,input[type=text],input[type=file],table.verts input,#paste-ta{min-height:44px}
  }
</style>
</head>
<body>
${renderTopNav("check")}

<div class="tabs">
  <button id="tab-upload-btn" class="active" onclick="switchTab('upload')">Upload survey plan</button>
  <button id="tab-coords-btn" onclick="switchTab('coords')">Enter coordinates</button>
</div>

<div id="tab-upload" class="tab active">
  <div class="card">
    <h2>Upload a survey plan scan · 2 credits</h2>
    <p class="muted" style="font-size:13px;margin:0 0 10px">Upload a photo/scan of the survey plan (bearing &amp; distance table, coordinate list, or sketch). The vision pipeline reads the boundary, converts it to GPS coordinates, then runs the overlap + zoning checks.</p>
    <input type="file" id="upload-file" accept="image/*" />
    <label class="checkitem" style="margin-top:10px"><input type="checkbox" id="upload-lowconf" /> Register even if low confidence</label>
    <div class="submitrow">
      <button class="btn btn-dark" id="upload-go" onclick="submitUpload()">Scan &amp; check</button>
      <span id="upload-status"></span>
    </div>
    <div id="upload-result"></div>
  </div>
</div>

<div id="tab-coords" class="tab">
  <div class="grid">
    <div class="card">
      <h2>Map preview</h2>
      <div id="preview"></div>
      <p class="muted" style="font-size:12px;margin:8px 0 0">Corridor/reserve zones drawn faintly; your polygon updates as you type.</p>
    </div>
    <div class="card">
      <h2>Boundary corners · 1 credit per check</h2>
      <label for="crs-select">Coordinate system</label>
      <select id="crs-select" onchange="crsChanged()"></select>
      <div class="rowbtns">
        <button onclick="loadDemo('gps')">Load demo (GPS)</button>
        <button onclick="loadDemo('utm')">Load demo (UTM 32N)</button>
      </div>
      <table class="verts">
        <thead><tr><th id="th-a">Latitude</th><th id="th-b">Longitude</th><th></th></tr></thead>
        <tbody id="vert-body"></tbody>
      </table>
      <div class="rowbtns">
        <button onclick="addRow()">+ Add corner</button>
        <button onclick="pasteInto()">Paste…</button>
      </div>
      <div id="paste-box" style="display:none">
        <label>One corner per line: "lat, lng" (or "easting, northing")</label>
        <textarea id="paste-ta" rows="5" style="width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:8px;padding:8px;font-size:13px;font-family:monospace"></textarea>
        <button class="btn btn-outline" style="margin-top:6px" onclick="fillFromPaste()">Fill table</button>
      </div>
      <div class="submitrow">
        <button class="btn btn-outline" onclick="submitCoords(false)">Check only</button>
        <button class="btn btn-dark" onclick="submitCoords(true)">Check &amp; register</button>
        <span id="coords-status"></span>
      </div>
      <div id="register-opt" style="display:none">
        <label>Plot label (optional)</label>
        <input type="text" id="coords-label" placeholder="e.g. Olu's plot — Airport Rd" />
      </div>
      <div id="coords-result"></div>
    </div>
  </div>
</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/proj4@2.11.0/dist/proj4.js"></script>
<script>
  const P = ${payload};

  // ---- helpers ------------------------------------------------------------
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function swap(pts) { return pts.map(function (p) { return [p[1], p[0]]; }); }
  function ringsOf(geom) {
    if (!geom) return [];
    if (geom.type === "Polygon") return [geom.coordinates[0]];
    if (geom.type === "MultiPolygon") return geom.coordinates.map(function (p) { return p[0]; });
    return [];
  }
  function linePts(geom) {
    if (!geom) return [];
    if (geom.type === "LineString") return geom.coordinates;
    if (geom.type === "MultiLineString") return geom.coordinates[0] || [];
    return [];
  }
  Object.keys(P.projs).forEach(function (k) { proj4.defs(k, P.projs[k]); });

  function switchTab(name) {
    document.getElementById("tab-upload").classList.toggle("active", name === "upload");
    document.getElementById("tab-coords").classList.toggle("active", name === "coords");
    document.getElementById("tab-upload-btn").classList.toggle("active", name === "upload");
    document.getElementById("tab-coords-btn").classList.toggle("active", name === "coords");
  }

  // ---- map preview --------------------------------------------------------
  const map = L.map("preview");
  const base = {
    Streets: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }),
    Satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 18, attribution: "Tiles &copy; Esri" })
  };
  base.Streets.addTo(map);
  L.control.layers(base, null, { position: "bottomright", collapsed: false }).addTo(map);
  map.setView([5.0035, 8.3668], 15);

  P.zones.forEach(function (z) {
    if (z.layer === "roads") {
      if (z.bufferGeometry) ringsOf(z.bufferGeometry).forEach(function (ring) {
        L.polygon(swap(ring), { color: "#2563eb", weight: 1, fillColor: "#60a5fa", fillOpacity: 0.08, opacity: 0.6 }).addTo(map);
      });
      L.polyline(swap(linePts(z.geometry)), { color: "#2563eb", weight: 3, opacity: 0.6 }).addTo(map);
    } else {
      ringsOf(z.geometry).forEach(function (ring) {
        L.polygon(swap(ring), { color: "#16a34a", weight: 1, fillColor: "#22c55e", fillOpacity: 0.1 }).addTo(map);
      });
    }
  });

  L.control({ position: "bottomleft" }).onAdd = function () {
    const el = document.createElement("div");
    el.className = "legend";
    el.innerHTML =
      '<div><span class="swatch" style="background:#60a5fa"></span>road corridor</div>' +
      '<div><span class="swatch" style="background:#22c55e"></span>reserve</div>';
    return el;
  };

  const polyLayer = L.layerGroup().addTo(map);

  // ---- CRS + vertex table -------------------------------------------------
  const crsSelect = document.getElementById("crs-select");
  P.crsOptions.forEach(function (o) {
    const opt = document.createElement("option");
    opt.value = o.id;
    opt.textContent = o.id + " — " + o.name;
    if (o.id === "EPSG:4326") opt.selected = true;
    crsSelect.appendChild(opt);
  });

  function isGeographic() { return crsSelect.value === "EPSG:4326"; }

  function crsChanged() {
    document.getElementById("th-a").textContent = isGeographic() ? "Latitude" : "Easting";
    document.getElementById("th-b").textContent = isGeographic() ? "Longitude" : "Northing";
    document.querySelectorAll("#vert-body tr").forEach(function (tr) {
      tr.children[0].dataset.label = isGeographic() ? "Latitude" : "Easting";
      tr.children[1].dataset.label = isGeographic() ? "Longitude" : "Northing";
    });
    redraw();
  }

  function addRow(a, b) {
    const body = document.getElementById("vert-body");
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td data-label="' + (isGeographic() ? "Latitude" : "Easting") + '"><input class="va" type="number" step="any" /></td>' +
      '<td data-label="' + (isGeographic() ? "Longitude" : "Northing") + '"><input class="vb" type="number" step="any" /></td>' +
      '<td class="del"><button title="Remove" onclick="this.closest(&quot;tr&quot;).remove(); redraw();">×</button></td>';
    const [ia, ib] = tr.querySelectorAll("input");
    if (a !== undefined) ia.value = a;
    if (b !== undefined) ib.value = b;
    ia.addEventListener("input", redraw);
    ib.addEventListener("input", redraw);
    body.appendChild(tr);
  }

  function rowsCount() { return document.querySelectorAll("#vert-body tr").length; }

  function tablePts() {
    const pts = [];
    document.querySelectorAll("#vert-body tr").forEach(function (tr) {
      const a = parseFloat(tr.querySelector(".va").value);
      const b = parseFloat(tr.querySelector(".vb").value);
      if (Number.isFinite(a) && Number.isFinite(b)) pts.push([a, b]);
    });
    return pts;
  }

  function loadDemo(kind) {
    const d = P.demo[kind === "gps" ? "gps" : "utm"];
    crsSelect.value = kind === "gps" ? "EPSG:4326" : "EPSG:32632";
    crsChanged();
    document.getElementById("vert-body").innerHTML = "";
    d.forEach(function (p) { addRow(p[0], p[1]); });
    redraw();
  }

  function pasteInto() { document.getElementById("paste-box").style.display = "block"; }

  function fillFromPaste() {
    const lines = document.getElementById("paste-ta").value.split(/\\n/);
    const pts = [];
    lines.forEach(function (line) {
      const parts = line.split(/[,;\\t ]+/).map(parseFloat);
      if (parts.length >= 2 && parts.slice(0, 2).every(Number.isFinite)) pts.push([parts[0], parts[1]]);
    });
    if (pts.length < 3) { document.getElementById("coords-status").textContent = "Need at least 3 valid corners."; return; }
    document.getElementById("vert-body").innerHTML = "";
    pts.forEach(function (p) { addRow(p[0], p[1]); });
    redraw();
  }

  // ---- live preview -------------------------------------------------------
  function projectToLatLng(pts) {
    return pts.map(function (p) {
      if (isGeographic()) return [p[0], p[1]];
      const [lon, lat] = proj4(crsSelect.value, "EPSG:4326", [p[0], p[1]]);
      return [lat, lon];
    });
  }

  function redraw() {
    polyLayer.clearLayers();
    const pts = tablePts();
    if (pts.length === 0) return;
    const latlngs = projectToLatLng(pts);
    latlngs.forEach(function (ll, i) {
      L.marker(ll, { icon: L.divIcon({ className: "", html: "<div style='width:18px;height:18px;border-radius:50%;background:#d97706;color:#fff;font-weight:700;font-size:10px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)'>" + (i + 1) + "</div>", iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(polyLayer);
    });
    if (latlngs.length >= 3) {
      L.polygon(latlngs, { color: "#d97706", weight: 3, fillColor: "#f59e0b", fillOpacity: 0.3 }).addTo(polyLayer);
      map.fitBounds(L.latLngBounds(latlngs).pad(0.5), { padding: [30, 30], maxZoom: 19 });
    }
  }

  // ---- submission ---------------------------------------------------------
  function submitStatus(el, msg, cls) { el.textContent = msg; el.className = cls || ""; }

  function findingsHtml(data) {
    let html = "";
    data.overlaps.forEach(function (o) {
      html += '<div class="finding overlap"><b>Overlap ' + o.intersectionPercent.toFixed(1) + "%</b> — " +
        o.intersectionAreaSqm.toFixed(1) + " m² shared with plot " + esc(o.plotId.slice(0, 8)) + "</div>";
    });
    data.zoningAlerts.forEach(function (a) {
      if (a.layer === "roads") {
        html += '<div class="finding road">' + (a.distanceM != null ? a.distanceM.toFixed(1) + " m" : "near") +
          " from road <b>" + esc(a.zoneName || "?") + "</b> (" + esc(a.zoneType || "") + ")</div>";
      } else {
        html += '<div class="finding reserve">' + (a.intersectionAreaSqm != null ? a.intersectionAreaSqm.toFixed(1) + " m²" : "partly") +
          " inside reserve <b>" + esc(a.zoneName || "?") + "</b> (" + esc(a.zoneType || "") + ")</div>";
      }
    });
    if (!html) html = '<div class="finding">No overlaps or zoning violations found.</div>';
    return html;
  }

  function evidenceHtml(data) {
    const sources = data.consultedSources || [];
    const rows = sources.map(function (source) {
      const latest = source.imports && source.imports.length ? source.imports[source.imports.length - 1] : null;
      return '<div class="evidence-row"><b><a href="/sources/' + encodeURIComponent(source.id) + '">' + esc(source.name) + '</a></b><span>' + esc(source.coverageStatus.replace(/_/g, " ")) + ' · ' + esc(source.authorityLevel.replace(/_/g, " ")) + (latest ? '<br/><a href="/sources/' + encodeURIComponent(source.id) + '/imports/' + encodeURIComponent(latest.id) + '">imported ' + esc(latest.importedAt) + '</a>' : '<br/>unversioned live records') + '</span></div>';
    }).join("");
    return '<div class="evidence"><div class="evidence-title">Data checked (' + sources.length + ')</div>' + (rows || '<div class="evidence-row">No source evidence available</div>') + '<div class="coverage-note">A clean result means no conflict was found in these datasets—not that no other record or claim exists. <a href="/sources">Review coverage →</a></div></div>';
  }

  function renderCoordsResult(json) {
    const el = document.getElementById("coords-result");
    const area = '<p style="font-size:13px;margin:0 0 6px">Plot area: <b>' + json.plotAreaSqm.toFixed(1) + " m²</b></p>";
    let header = "";
    if (json.registered && json.plot) {
      header = '<p style="font-size:13px;margin:0 0 6px"><span class="badge ok">registered</span> plot <code>' +
        esc(json.plot.id.slice(0, 8)) + "</code> · " + esc(json.plot.crs) + "</p>";
      header += '<a class="result-link" href="/api/plots/' + json.plot.id + '/map">open plot map →</a>';
      if (json.violations && json.violations.length) {
        header += '<div style="margin-top:6px">' + json.violations.map(function (v) {
          return '<a class="result-link" style="margin-right:10px" href="/api/violations/' + v + '">violation history →</a>';
        }).join("") + "</div>";
      }
    }
    el.innerHTML = '<div class="card"><h2>Result</h2>' + header + area + findingsHtml(json) + evidenceHtml(json) + "</div>";
  }

  async function submitCoords(register) {
    const st = document.getElementById("coords-status");
    const pts = tablePts();
    if (pts.length < 3) { submitStatus(st, "Enter at least 3 corners.", "error"); return; }
    const vertices = pts.map(function (p) {
      return isGeographic() ? [p[1], p[0]] : [p[0], p[1]];
    });
    const payload = { vertices: vertices, crs: crsSelect.value, register: register };
    const label = document.getElementById("coords-label").value.trim();
    if (register && label) payload.label = label;
    submitStatus(st, register ? "Checking and registering…" : "Checking…", "");
    try {
      const res = await fetch("/api/plots/from-coordinates", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) { submitStatus(st, json.error || "Request failed.", "error"); return; }
      submitStatus(st, register ? "Registered." : "Checked.", "ok");
      renderCoordsResult(json);
    } catch (e) {
      submitStatus(st, "Request failed: " + e, "error");
    }
  }

  // ---- upload mode --------------------------------------------------------
  function renderUploadResult(json) {
    const el = document.getElementById("upload-result");
    const p = json.plot;
    const badges = [];
    if (p.isGood) badges.push('<span class="badge ok">active</span>');
    else badges.push('<span class="badge warning">low confidence</span>');
    let html = '<div class="card"><h2>Result</h2>' +
      '<p style="font-size:13px;margin:0 0 6px">' + badges.join("") +
      ' <b>' + esc(p.method || "?") + '</b> parse · ' + (p.confidence != null ? p.confidence.toFixed(0) + "%" : "—") +
      " · <b>" + json.plotAreaSqm.toFixed(1) + " m²</b></p>" +
      '<a class="result-link" href="/api/plots/' + p.id + '/map">open plot map →</a>' +
      (json.violations && json.violations.length
        ? '<div style="margin-top:6px">' + json.violations.map(function (v) {
            return '<a class="result-link" style="margin-right:10px" href="/api/violations/' + v + '">violation history →</a>';
          }).join("") + "</div>"
        : "") +
      findingsHtml(json) + evidenceHtml(json) + "</div>";
    el.innerHTML = html;
  }

  async function submitUpload() {
    const st = document.getElementById("upload-status");
    const file = document.getElementById("upload-file").files[0];
    if (!file) { submitStatus(st, "Choose a survey plan image first.", "error"); return; }
    const low = document.getElementById("upload-lowconf").checked;
    const fd = new FormData();
    fd.append("image", file);
    submitStatus(st, "Scanning survey plan with the vision model…", "");
    try {
      const res = await fetch("/api/plots?allowLowConfidence=" + low, { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: fd });
      const json = await res.json();
      if (!res.ok) { submitStatus(st, json.error || "Registration failed.", "error"); return; }
      submitStatus(st, "Registered.", "ok");
      renderUploadResult(json);
    } catch (e) {
      submitStatus(st, "Request failed: " + e, "error");
    }
  }

  // ---- init ---------------------------------------------------------------
  crsChanged();
  addRow(); addRow(); addRow();
</script>
</body>
</html>`;
}
