import { renderTopNav, TOP_NAV_CSS } from "./nav";
import type { ViewerZone } from "./zones";

export interface ViewerPlot {
  id: string;
  status: string;
  method: string | null;
  confidence: number | null;
  crs: string | null;
  computedAreaSqm: number | null;
  sourceFile: string | null;
  recordType: string;
  centerLat: number;
  centerLon: number;
  createdAt: string;
  geometry: { type: string; coordinates: unknown };
  rawVertices: Array<{ beaconId: string; easting: number; northing: number }> | null;
  overlapCount: number;
  alertCount: number;
}

export interface ViewerOverlap {
  plotId: string;
  otherPlotId: string;
  intersectionAreaSqm: number;
  intersectionPercent: number;
  violationId: string;
  status: string;
  geometry: { type: string; coordinates: unknown };
}

export type { ViewerZone } from "./zones";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Renders a self-contained registry viewer: one Leaflet map with every
 * registered plot polygon + numbered pins, overlap areas, road/reserve zones,
 * and a table of plots with their overlap/zoning alert counts.
 */
export function renderViewerHtml(plots: ViewerPlot[], overlaps: ViewerOverlap[] = [], zones: ViewerZone[] = []): string {
  const data = JSON.stringify({ plots, overlaps, zones }).replace(/</g, "\\u003c");

  const rows = plots
    .map((p, i) => {
      const findingPills = [
        p.overlapCount > 0 ? `<span class="badge overlap">${p.overlapCount} overlap${p.overlapCount === 1 ? "" : "s"}</span>` : "",
        p.alertCount > 0 ? `<span class="badge alert">${p.alertCount} alert${p.alertCount === 1 ? "" : "s"}</span>` : "",
        p.overlapCount === 0 && p.alertCount === 0 ? '<span class="badge ok">No findings</span>' : ""
      ].filter(Boolean).slice(0, 3).join("");
      const added = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(p.createdAt));
      return `<tr class="registry-row" data-row-index="${i}" onclick="window.location.href='/api/plots/${p.id}/map'" style="cursor:pointer" title="Open details">
        <td><span class="location">${p.centerLat.toFixed(5)}, ${p.centerLon.toFixed(5)}</span></td>
        <td class="num">${p.computedAreaSqm != null ? p.computedAreaSqm.toFixed(1) : "—"}</td>
        <td><div class="finding-pills">${findingPills}</div></td>
        <td><time datetime="${escapeHtml(String(p.createdAt))}">${added}</time></td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Dende — Spatial Registry</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body { margin: 0; height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f3f4f6; }
  ${TOP_NAV_CSS}
  .wrap { display: grid; grid-template-columns: minmax(0,1fr) 480px; height: calc(100vh - 48px); }
  @media (max-width: 1000px) { .wrap { grid-template-columns: 1fr; grid-template-rows:auto 44vh auto; height:auto; min-height:calc(100dvh - 48px); } #panel{display:contents} .hero{grid-row:1}.wrap>#map{grid-row:2}.registry-section{grid-row:3} }
  #map { height: 100%; width: 100%; }
  #panel { background: #fff; overflow-y: auto; padding: 0; box-sizing: border-box; max-height:calc(100vh - 48px); }
  #panel h1 { font-size: 27px; line-height:1.08; letter-spacing:-.025em; margin: 5px 0 8px; }
  #panel .sub { font-size: 12px; color: #6b7280; margin-bottom: 12px; }
  #panel table { border-collapse: collapse; width: 100%; font-size: 12px; }
  #panel th, #panel td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
  #panel td.num { font-variant-numeric: tabular-nums; }
  #panel th { color:#6b7280; font-size:10px; letter-spacing:.04em; text-transform:uppercase; }
  .location { white-space:nowrap; font-variant-numeric:tabular-nums; color:#4b5563; font-size:11px; }
  .pin-num { width: 20px; height: 20px; border-radius: 50%; background: #d97706; color: #fff; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: 700; margin: 1px 2px 1px 0; }
  .badge.ok { background: #dcfce7; color: #15803d; }
  .badge.warn { background: #fef3c7; color: #b45309; }
  .badge.overlap { background: #fee2e2; color: #b91c1c; }
  .badge.alert { background: #fef9c3; color: #a16207; }
  .finding-pills { display:flex; flex-wrap:wrap; gap:3px; }
  .muted { color: #9ca3af; }
  .marker-label { background: #fff; border: 1px solid #d97706; border-radius: 4px; padding: 1px 5px; font-size: 11px; font-weight: 600; color: #222; box-shadow: 0 1px 3px rgba(0,0,0,.3); white-space: nowrap; }
  .legend { background: #fff; padding: 6px 10px; border-radius: 6px; font-size: 11px; box-shadow: 0 1px 4px rgba(0,0,0,.2); }
  .legend div { display: flex; align-items: center; gap: 6px; margin: 2px 0; }
  .swatch { width: 14px; height: 14px; display: inline-block; border-radius: 3px; flex: none; }
  .hero { padding:20px 18px 17px; color:#fff; background:linear-gradient(145deg,#111827,#1f2937 68%,#312e24); }
  .eyebrow { color:#fbbf24; font-size:10px; font-weight:850; letter-spacing:.12em; text-transform:uppercase; }
  .hero p { color:#d1d5db; font-size:13px; line-height:1.48; margin:0 0 14px; }
  .hero-actions { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:15px; }
  .hero-actions a { border-radius:8px; padding:8px 11px; font-size:12px; font-weight:750; text-decoration:none; }
  .hero-actions .primary { color:#111827; background:#f59e0b; }
  .hero-actions .secondary { color:#fff; border:1px solid #4b5563; }
  .checker { background:#fff; color:#111827; border-radius:11px; padding:13px; box-shadow:0 12px 30px rgba(0,0,0,.2); }
  .checker-title { display:flex; justify-content:space-between; gap:10px; align-items:center; margin-bottom:8px; font-size:13px; font-weight:800; }
  .checker-title span { color:#6b7280; font-size:10px; font-weight:600; }
  .demos { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:9px; }
  .demos button { border:1px solid #d1d5db; background:#f9fafb; color:#374151; border-radius:999px; padding:5px 8px; cursor:pointer; font-size:10px; font-weight:700; }
  .demos button:hover { border-color:#d97706; color:#92400e; }
  #quick-coords { display:block; box-sizing:border-box; width:100%; max-width:100%; resize:vertical; min-height:68px; border:1px solid #d1d5db; border-radius:8px; padding:8px; font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace; }
  .check-row { display:flex; gap:9px; align-items:center; margin-top:8px; }
  #quick-check { border:0; border-radius:8px; padding:8px 12px; background:#111827; color:#fff; font-size:11px; font-weight:800; cursor:pointer; }
  #quick-status { color:#6b7280; font-size:11px; }
  #quick-result { margin-top:9px; display:none; }
  .quick-summary { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-bottom:7px; }
  .quick-summary div { background:#f3f4f6; padding:7px; border-radius:7px; }
  .quick-summary b { display:block; font-size:15px; }.quick-summary span{font-size:9px;color:#6b7280}
  .quick-finding { border-left:3px solid #d1d5db; background:#f9fafb; padding:6px 8px; margin:4px 0; border-radius:0 6px 6px 0; font-size:11px; }
  .quick-finding.overlap{border-color:#dc2626}.quick-finding.road{border-color:#2563eb}.quick-finding.reserve{border-color:#16a34a}
  .coverage-note { margin-top:8px; padding:7px 8px; border-radius:7px; background:#fffbeb; color:#92400e; font-size:10px; line-height:1.4; }
  .quick-evidence{margin-top:7px;border:1px solid #e5e7eb;border-radius:7px;padding:7px;background:#f9fafb}.quick-evidence-title{font-size:9px;font-weight:850;text-transform:uppercase;color:#374151;margin-bottom:4px}.quick-source{display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid #e5e7eb;font-size:10px}.quick-source:last-child{border:0}.quick-source span{color:#6b7280;text-align:right}
  .registry-section { padding:16px; }.section-head{display:flex;justify-content:space-between;align-items:end;gap:10px;margin-bottom:10px}.section-head h2{font-size:15px;margin:0}.section-head a{font-size:11px;color:#2563eb}
  .metric-row{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:12px}.metric-row div{border:1px solid #e5e7eb;background:#f9fafb;border-radius:8px;padding:8px}.metric-row b{display:block;font-size:17px}.metric-row span{font-size:9px;color:#6b7280}
  .table-wrap{overflow-x:auto}.pagination{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:11px}.pagination span{font-size:11px;color:#6b7280}.pagination-buttons{display:flex;gap:6px}.pagination button{border:1px solid #d1d5db;background:#fff;border-radius:7px;padding:6px 9px;font-size:11px;font-weight:700;cursor:pointer}.pagination button:disabled{opacity:.4;cursor:default}
  @media (max-width:600px){.hero{padding:18px 14px 15px}.registry-section{padding:14px}.metric-row{grid-template-columns:1fr}.table-wrap{overflow:visible}#panel table,#panel thead,#panel tbody,#panel tr,#panel th,#panel td{display:block}#panel thead{position:absolute;clip:rect(0 0 0 0);clip-path:inset(50%)}#panel .registry-row{border:1px solid #e5e7eb;border-radius:9px;padding:8px 10px;margin-bottom:7px;display:grid;grid-template-columns:1fr auto;gap:5px 12px}#panel .registry-row td{border:0;padding:0}#panel .registry-row td:nth-child(1){font-weight:700}#panel .registry-row td:nth-child(2){text-align:right}#panel .registry-row td:nth-child(3){grid-column:1/-1}#panel .registry-row td:nth-child(4){grid-column:1/-1;color:#6b7280}.demos button,#quick-check,.pagination button,.hero-actions a{min-height:44px;display:inline-flex;align-items:center}.check-row{align-items:flex-start;flex-direction:column}.quick-summary{grid-template-columns:1fr 1fr 1fr}}
</style>
</head>
<body>
${renderTopNav("registry")}
<div class="wrap">
  <div id="map"></div>
  <div id="panel">
    <section class="hero">
      <div class="eyebrow">Land intelligence, starting in Calabar</div>
      <h1>Check land before you buy.</h1>
      <p>Give Dende a survey plan or GPS boundary. See where the land is and what the available plot, road, reserve, and ownership records say about it.</p>
      <div class="hero-actions"><a class="primary" href="/check">Upload survey plan</a><a class="secondary" href="/protect">Protect a plot</a></div>
      <div class="checker">
        <div class="checker-title">Try a boundary check <span>Nothing is registered</span></div>
        <div class="demos"><button data-demo="clean">Clean example</button><button data-demo="overlap">50% overlap</button><button data-demo="conflict">Road + reserve</button><button data-demo="notice">Ownership notice</button></div>
        <textarea id="quick-coords" aria-label="GPS boundary corners" placeholder="latitude, longitude — one corner per line"></textarea>
        <div class="check-row"><button id="quick-check">Run free check</button><span id="quick-status">Paste at least 3 GPS corners.</span></div>
        <div id="quick-result"></div>
      </div>
    </section>
    <section class="registry-section">
      <div class="section-head"><div><div class="eyebrow">Live development registry</div><h2>Explore recorded parcels</h2></div><a href="/sources">View data coverage →</a></div>
      <div class="metric-row"><div><b>${plots.length}</b><span>recorded plots</span></div><div><b>${overlaps.length}</b><span>mapped overlaps</span></div><div><b>${zones.length}</b><span>zone records</span></div></div>
      <div class="sub">Click any map polygon or table row for its full findings.</div>
    ${plots.length === 0 ? '<p class="muted">No plots registered yet. POST a survey scan to <code>/api/plots</code>.</p>' : ""}
    <div class="table-wrap"><table>
      <thead><tr><th>Location</th><th>Area m²</th><th>Findings</th><th>Added</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="pagination" id="registry-pagination"><span id="page-summary"></span><div class="pagination-buttons"><button id="page-prev" type="button">Previous</button><button id="page-next" type="button">Next</button></div></div>
    </section>
  </div>
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const { plots, overlaps, zones } = ${data};

  const rowsPerPage = 10;
  const registryRows = Array.from(document.querySelectorAll(".registry-row"));
  let registryPage = 1;
  const registryPageCount = Math.max(1, Math.ceil(registryRows.length / rowsPerPage));
  function renderRegistryPage() {
    const start = (registryPage - 1) * rowsPerPage;
    registryRows.forEach((row, index) => { row.style.display = index >= start && index < start + rowsPerPage ? "" : "none"; });
    document.getElementById("page-summary").textContent = registryRows.length ? "Showing " + (start + 1) + "–" + Math.min(start + rowsPerPage, registryRows.length) + " of " + registryRows.length : "No records";
    document.getElementById("page-prev").disabled = registryPage === 1;
    document.getElementById("page-next").disabled = registryPage === registryPageCount;
  }
  document.getElementById("page-prev").addEventListener("click", () => { if (registryPage > 1) { registryPage--; renderRegistryPage(); } });
  document.getElementById("page-next").addEventListener("click", () => { if (registryPage < registryPageCount) { registryPage++; renderRegistryPage(); } });
  renderRegistryPage();

  // GeoJSON is [lon, lat]; Leaflet wants [lat, lng].
  function swap(pts) { return pts.map(function (p) { return [p[1], p[0]]; }); }
  function ringsOf(geom) {
    if (!geom) return [];
    if (geom.type === "Polygon") return [geom.coordinates[0]];
    if (geom.type === "MultiPolygon") return geom.coordinates.map(function (poly) { return poly[0]; });
    return [];
  }
  function linePts(geom) {
    if (!geom) return [];
    if (geom.type === "LineString") return geom.coordinates;
    if (geom.type === "MultiLineString") return geom.coordinates[0] || [];
    return [];
  }
  function pointsOf(geom) {
    const rings = ringsOf(geom);
    return rings.length > 0 ? rings[0] : [];
  }

  const map = L.map("map");
  const base = {
    Streets: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }),
    Satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 18, attribution: "Tiles &copy; Esri" })
  };
  base.Streets.addTo(map);
  L.control.layers(base, null, { position: "bottomright", collapsed: false }).addTo(map);

  const bounds = [];
  const quickLayer = L.layerGroup().addTo(map);
  const colors = { active: "#d97706", low_confidence: "#dc2626" };

  // 1. Zones — road corridors first (under everything), then reserves (faint)
  zones.forEach((z) => {
    if (z.layer === "roads") {
      if (z.bufferGeometry) ringsOf(z.bufferGeometry).forEach((ring) => {
        L.polygon(swap(ring), { color: "#2563eb", weight: 1, fillColor: "#60a5fa", fillOpacity: 0.08, opacity: 0.6 }).addTo(map)
          .bindPopup("<b>" + (z.name || "road") + "</b> corridor (" + (z.zoneType || "") + ")");
      });
      L.polyline(swap(linePts(z.geometry)), { color: "#2563eb", weight: 3, opacity: 0.6 }).addTo(map)
        .bindPopup("<b>" + (z.name || "road") + "</b> (" + (z.zoneType || "") + ")");
      linePts(z.geometry).forEach((pt) => bounds.push([pt[1], pt[0]]));
    } else {
      ringsOf(z.geometry).forEach((ring) => {
        L.polygon(swap(ring), { color: "#16a34a", weight: 1, fillColor: "#22c55e", fillOpacity: 0.1 }).addTo(map)
          .bindPopup("<b>" + (z.name || "reserve") + "</b> (" + (z.zoneType || "") + ")");
        swap(ring).forEach((pt) => bounds.push(pt));
      });
    }
  });

  // 2. Plots
  plots.forEach((p, i) => {
    const color = colors[p.status] ?? "#d97706";
    ringsOf(p.geometry).forEach((ring) => {
      const pts = swap(ring);
      const poly = L.polygon(pts, { color, weight: 2.5, fillColor: color, fillOpacity: 0.35, raiseOnHover: true });
      poly.addTo(map);
      poly.on("click", () => { window.location.href = "/api/plots/" + p.id + "/map"; });
      poly.bindPopup("<strong>" + (i + 1) + ". " + p.id.slice(0, 8) + "</strong><br/>" +
        (p.computedAreaSqm ? p.computedAreaSqm.toFixed(1) + " m²<br/>" : "") +
        (p.overlapCount > 0 ? "<span style='color:#b91c1c'><b>" + p.overlapCount + " overlap(s)</b></span><br/>" : "") +
        (p.alertCount > 0 ? "<span style='color:#a16207'><b>" + p.alertCount + " zoning alert(s)</b></span><br/>" : "") +
        "<a href='/api/plots/" + p.id + "/map'>Open details →</a>");
      pts.forEach((pt) => bounds.push(pt));
    });

    const ring = swap(pointsOf(p.geometry));
    ring.slice(0, -1).forEach((pt, k) => {
      const label = (p.rawVertices && p.rawVertices[k] && p.rawVertices[k].beaconId)
        ? p.rawVertices[k].beaconId : "PT-" + (k + 1);
      const icon = L.divIcon({
        className: "",
        html: '<div style="width:20px;height:20px;border-radius:50%;background:' + color + ';color:#fff;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">' + (i + 1) + "</div>",
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      L.marker(pt, { icon }).addTo(map)
        .bindTooltip((i + 1) + "." + label, { permanent: false, direction: "top", offset: [0, -8], className: "marker-label" });
    });
  });

  // 3. Overlap areas (red, on top)
  overlaps.forEach((o) => {
    ringsOf(o.geometry).forEach((ring) => {
      L.polygon(swap(ring), { color: "#dc2626", weight: 2.5, fillColor: "#ef4444", fillOpacity: 0.5 }).addTo(map)
        .bindPopup("<b>Overlap</b> (" + o.status + ")<br/>" + o.intersectionPercent.toFixed(1) + "% — " +
          o.intersectionAreaSqm.toFixed(1) + " m²<br/>plot " + o.plotId.slice(0, 8) +
          " ∩ plot " + o.otherPlotId.slice(0, 8) +
          "<br/><a href='/api/violations/" + o.violationId + "'>violation history →</a>");
      swap(ring).forEach((pt) => bounds.push(pt));
    });
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [40, 40] });
  } else {
    map.setView([9.0, 8.0], 6);
  }

  L.control({ position: "bottomleft" }).onAdd = () => {
    const el = document.createElement("div");
    el.className = "legend";
    el.innerHTML =
      '<div><span class="swatch" style="background:#d97706"></span>plot</div>' +
      '<div><span class="swatch" style="background:#ef4444"></span>overlap</div>' +
      '<div><span class="swatch" style="background:#60a5fa"></span>road corridor</div>' +
      '<div><span class="swatch" style="background:#22c55e"></span>reserve</div>';
    return el;
  };

  // Immediate, check-only homepage experience. No record is persisted here.
  const demos = {
    clean: [[5.01991,8.34991],[5.01991,8.35009],[5.02009,8.35009],[5.02009,8.34991]],
    overlap: [[4.964932,8.324895],[4.964932,8.325075],[4.965112,8.325075],[4.965112,8.324895]],
    conflict: [[5.003491417,8.366768727],[5.003524699,8.366901295],[5.003255837,8.36696346],[5.003222728,8.366831596]],
    notice: [[4.965993,8.318517],[4.965993,8.318697],[4.966173,8.318697],[4.966173,8.318517]]
  };
  const quickCoords = document.getElementById("quick-coords");
  document.querySelectorAll("[data-demo]").forEach((button) => button.addEventListener("click", () => {
    quickCoords.value = demos[button.dataset.demo].map((point) => point.join(", ")).join("\\n");
    runQuickCheck();
  }));
  function safe(value) { return String(value == null ? "" : value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function parseQuickPoints() { return quickCoords.value.split(/\\n/).map((line) => line.trim()).filter(Boolean).map((line) => line.split(/[,;\\t ]+/).map(Number)).filter((point) => point.length >= 2 && point.slice(0,2).every(Number.isFinite)); }
  async function runQuickCheck() {
    const status = document.getElementById("quick-status"), result = document.getElementById("quick-result"), points = parseQuickPoints();
    if (points.length < 3) { status.textContent = "Enter at least 3 valid corners."; return; }
    quickLayer.clearLayers();
    const preview = L.polygon(points, { color:"#f59e0b", weight:4, fillColor:"#fbbf24", fillOpacity:.28, dashArray:"7 5" }).addTo(quickLayer);
    map.fitBounds(preview.getBounds().pad(.65), { maxZoom:18 });
    status.textContent = "Checking available records…"; result.style.display = "none";
    try {
      const response = await fetch("/api/plots/from-coordinates", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ vertices:points.map((point)=>[point[1],point[0]]), crs:"EPSG:4326", register:false }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Check failed");
      const findings = [];
      data.overlaps.forEach((item) => { const notices=(data.overlapOwnershipNotices && data.overlapOwnershipNotices[item.plotId]) || []; findings.push('<div class="quick-finding overlap"><b>'+item.intersectionPercent.toFixed(1)+'% overlap</b> · '+item.intersectionAreaSqm.toFixed(1)+' m² with plot '+safe(item.plotId.slice(0,8))+(notices.length ? '<br/><b style="color:#92400e">'+(notices.some((notice)=>notice.ownershipStatus === "verified") ? "Verified" : "Unverified")+' ownership notice · '+safe(notices[0].submittedAt)+'</b>' : '')+'</div>'); });
      data.zoningAlerts.forEach((item) => findings.push('<div class="quick-finding '+item.layer.slice(0,-1)+'">'+(item.layer === "roads" ? '<b>'+item.distanceM.toFixed(1)+' m from road</b> '+safe(item.zoneName || "") : '<b>'+item.intersectionAreaSqm.toFixed(1)+' m² inside reserve</b> '+safe(item.zoneName || ""))+'</div>'));
      const sources = data.consultedSources || [];
      const sourceRows = sources.map((source) => { const latest=source.imports&&source.imports.length?source.imports[source.imports.length-1]:null; return '<div class="quick-source"><b><a href="/sources/'+encodeURIComponent(source.id)+'">'+safe(source.name)+'</a></b><span>'+safe(source.coverageStatus.replace(/_/g," "))+' · '+safe(source.authorityLevel.replace(/_/g," "))+(latest?'<br/><a href="/sources/'+encodeURIComponent(source.id)+'/imports/'+encodeURIComponent(latest.id)+'">import details</a>':'')+'</span></div>'; }).join("");
      result.innerHTML = '<div class="quick-summary"><div><b>'+data.plotAreaSqm.toFixed(1)+'</b><span>area m²</span></div><div><b>'+data.overlaps.length+'</b><span>overlaps</span></div><div><b>'+data.zoningAlerts.length+'</b><span>zone findings</span></div></div>'+(findings.join("") || '<div class="quick-finding"><b>No conflicts found in available records.</b></div>')+'<div class="quick-evidence"><div class="quick-evidence-title">Data checked ('+sources.length+')</div>'+sourceRows+'</div><div class="coverage-note">A clean result means no conflict was found in these datasets—not that no other record or claim exists. <a href="/sources">Review coverage →</a></div>';
      result.style.display = "block"; status.textContent = "Check complete — not registered.";
    } catch (error) { status.textContent = error.message; }
  }
  document.getElementById("quick-check").addEventListener("click", runQuickCheck);
</script>
</body>
</html>`;
}
