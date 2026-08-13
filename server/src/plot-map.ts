/**
 * Renders a self-contained "violations" map for a single registered plot:
 *  - the plot polygon + beacon pins
 *  - overlapping neighbouring plots (dashed) and their intersection area (red)
 *  - road corridors (line + buffer) and reserves (polygons)
 *  - nearest-point lines with distance + beacon reference
 */

import { renderTopNav, TOP_NAV_CSS } from "./nav";
import type { OwnershipEvent, OwnershipNotice } from "./ownership";
import type { ConsultedSource } from "./check-evidence";

interface GeoJson {
  type: string;
  coordinates: unknown;
}

export interface PlotMapPlot {
  id: string;
  status: string;
  method: string | null;
  confidence: number | null;
  crs: string | null;
  computedAreaSqm: number | null;
  printedAreaSqm: number | null;
  sourceFile: string | null;
  createdAt: string;
  geometry: GeoJson;
  rawVertices: Array<{ beaconId: string; easting: number; northing: number }>;
}

export interface PlotMapOverlap {
  violationId: string;
  otherPlotId: string;
  intersectionAreaSqm: number;
  intersectionPercent: number;
  status: string;
  geometry: GeoJson;
  otherGeometry: GeoJson;
  ownershipNotices: OwnershipNotice[];
}

export interface PlotMapAlert {
  violationId: string;
  layer: "roads" | "reserves";
  zoneName: string | null;
  zoneType: string | null;
  status: string;
  distanceM: number | null;
  intersectionAreaSqm: number | null;
  zoneGeometry: GeoJson | null;
  bufferGeometry: GeoJson | null;
  nearestLine: GeoJson | null;
  reference: string | null;
}

export interface PlotMapData {
  plot: PlotMapPlot;
  ownershipNotices: OwnershipNotice[];
  ownershipHistory: Record<string, OwnershipEvent[]>;
  consultedSources: ConsultedSource[];
  overlaps: PlotMapOverlap[];
  alerts: PlotMapAlert[];
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderPlotMapHtml(data: PlotMapData): string {
  const payload = JSON.stringify(data).replace(/</g, "\\u003c");

  const statusBadge = (status: string) =>
    `<span class="badge st-${esc(status)}">${esc(status)}</span>`;

  const overlapRows = data.overlaps
    .map(
      (o) => `<a class="finding-card overlap-card" href="/api/violations/${o.violationId}">
        <div class="finding-head">
          <span class="finding-kind"><span class="finding-icon">!</span> Plot overlap</span>
          ${statusBadge(o.status)}
        </div>
        <div class="finding-metric overlap-metric">${o.intersectionPercent.toFixed(1)}%</div>
        <div class="finding-detail"><b>${o.intersectionAreaSqm.toFixed(1)} m²</b> shared with plot <code>${esc(o.otherPlotId.slice(0, 8))}</code></div>
        ${o.ownershipNotices.length ? `<div class="ownership-flag"><a href="/ownership-notices/${esc(o.ownershipNotices[0].id)}">${o.ownershipNotices.some((notice) => notice.ownershipStatus === "verified") ? "Verified ownership notice" : "Unverified ownership notice"} · submitted ${esc(o.ownershipNotices[0].submittedAt)}</a></div>` : ""}
        <div class="finding-cta">View violation history <span aria-hidden="true">→</span></div>
      </a>`
    )
    .join("");

  const alertRows = data.alerts
    .map((a) => {
      const isRoad = a.layer === "roads";
      const ref = a.reference ? `<span class="badge ref">beacon ${esc(a.reference)}</span>` : "";
      const metric = isRoad
        ? `${a.distanceM != null ? a.distanceM.toFixed(1) : "?"}<span>m away</span>`
        : `${a.intersectionAreaSqm != null ? a.intersectionAreaSqm.toFixed(1) : "?"}<span>m² inside</span>`;
      return `      <a class="finding-card ${isRoad ? "road-card" : "reserve-card"}" href="/api/violations/${a.violationId}">
        <div class="finding-head">
          <span class="finding-kind"><span class="finding-icon">${isRoad ? "R" : "Z"}</span> ${isRoad ? "Road corridor" : "Protected reserve"}</span>
          ${statusBadge(a.status)}
        </div>
        <div class="finding-metric">${metric}</div>
        <div class="finding-detail"><b>${esc(a.zoneName ?? "Unknown zone")}</b> · ${esc(a.zoneType ?? (isRoad ? "road" : "reserve"))} ${ref}</div>
        <div class="finding-cta">View violation history <span aria-hidden="true">→</span></div>
      </a>`;
    })
    .join("");

  const otherLinks = data.overlaps
    .map(
      (o) =>
        `<a href="/api/plots/${o.otherPlotId}/map">overlapping plot ${esc(o.otherPlotId.slice(0, 8))}</a>`
    )
    .join(" · ");
  const ownershipTimeline = data.ownershipNotices.flatMap((notice) => (data.ownershipHistory[notice.id] ?? []).map((event) => ({notice,event}))).sort((a,b) => a.event.createdAt.localeCompare(b.event.createdAt)).map(({notice,event}) => `<li><span class="history-dot"></span><div><b>${esc(event.eventType.replace(/_/g," "))}</b><small>${esc(event.createdAt)} · notice ${esc(notice.id.slice(0,8))}</small>${event.reason ? `<p>${esc(event.reason)}</p>` : ""}</div></li>`).join("");
  const evidenceRows = data.consultedSources.map((source) => {
    const newest = source.imports[source.imports.length - 1];
    return `<div class="evidence-row"><div><a href="/sources/${esc(source.id)}"><b>${esc(source.name)}</b></a><span>${esc(source.geography)} · ${esc(source.authorityLevel.replace(/_/g, " "))}</span></div><span class="coverage coverage-${esc(source.coverageStatus)}">${esc(source.coverageStatus.replace(/_/g, " "))}</span>${newest ? `<small><a href="/sources/${esc(source.id)}/imports/${esc(newest.id)}">Imported ${esc(newest.importedAt)}</a> · ${source.imports.length} version${source.imports.length === 1 ? "" : "s"}</small>` : `<small>${source.unversionedFeatureCount} live record${source.unversionedFeatureCount === 1 ? "" : "s"} without an import version</small>`}</div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Plot ${esc(data.plot.id.slice(0, 8))} — Violations</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body { margin: 0; height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f3f4f6; }
  ${TOP_NAV_CSS}
  .wrap { display: grid; grid-template-columns: 1fr 400px; height: calc(100vh - 48px); height: calc(100dvh - 48px); }
  @media (max-width: 1000px) { .wrap { grid-template-columns: 1fr; grid-template-rows:minmax(300px,48dvh) auto;height:auto;min-height:calc(100dvh - 48px) } #panel{overflow:visible} }
  #map { height: 100%; width: 100%; }
  #panel { background: #fff; overflow-y: auto; padding: 14px 16px; box-sizing: border-box; }
  #panel h1 { font-size: 17px; margin: 0 0 2px; }
  #panel .sub { font-size: 12px; color: #6b7280; margin-bottom: 10px; }
  #panel h2 { font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: #6b7280; margin: 14px 0 6px; }
  .finding-card { --accent:#6b7280; --tint:#f9fafb; display:block; position:relative; border:1px solid #e5e7eb; border-left:5px solid var(--accent); border-radius:10px; padding:11px 12px 10px; margin-bottom:9px; background:linear-gradient(135deg,var(--tint),#fff 58%); color:#111827; font-size:12px; text-decoration:none; box-shadow:0 1px 2px rgba(17,24,39,.04); transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease; }
  .finding-card:hover { transform:translateY(-1px); border-color:var(--accent); box-shadow:0 6px 16px rgba(17,24,39,.10); }
  .finding-card:focus-visible { outline:3px solid color-mix(in srgb,var(--accent) 25%,transparent); outline-offset:2px; }
  .finding-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .finding-kind { display:flex; align-items:center; gap:7px; font-weight:750; }
  .finding-icon { width:20px; height:20px; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; background:var(--accent); color:#fff; font-size:10px; font-weight:800; }
  .finding-metric { margin:9px 0 2px; color:var(--accent); font-size:25px; line-height:1; font-weight:850; letter-spacing:-.025em; }
  .finding-metric span { margin-left:5px; color:#4b5563; font-size:12px; font-weight:650; letter-spacing:0; }
  .finding-detail { color:#4b5563; line-height:1.45; }
  .finding-detail code { background:rgba(255,255,255,.8); border:1px solid #e5e7eb; padding:1px 4px; border-radius:4px; color:#111827; }
  .finding-cta { margin-top:9px; padding-top:8px; border-top:1px solid color-mix(in srgb,var(--accent) 18%,#e5e7eb); color:var(--accent); font-weight:700; display:flex; justify-content:space-between; }
  .finding-card:hover .finding-cta span { transform:translateX(2px); }
  .finding-cta span { transition:transform .15s ease; }
  .ownership-flag { margin-top:7px; border-radius:6px; padding:6px 8px; background:#fef3c7; color:#92400e; font-weight:700; }
  .ownership-history{list-style:none;margin:6px 0 0;padding:0}.ownership-history li{display:flex;gap:8px;padding:6px 0;border-bottom:1px solid #e5e7eb;font-size:11px}.ownership-history li:last-child{border:0}.ownership-history small{display:block;color:#6b7280;margin-top:2px}.ownership-history p{margin:3px 0 0;color:#4b5563}.history-dot{width:9px;height:9px;margin-top:3px;border-radius:50%;background:#d97706;flex:none}
  .evidence-box{border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;padding:10px}.evidence-row{display:grid;grid-template-columns:1fr auto;gap:2px 8px;padding:7px 0;border-bottom:1px solid #e5e7eb;font-size:11px}.evidence-row:last-child{border-bottom:0}.evidence-row b,.evidence-row span{display:block}.evidence-row>div>span,.evidence-row small{color:#6b7280}.evidence-row small{grid-column:1/-1}.coverage{padding:2px 6px;border-radius:999px;font-size:9px;font-weight:800;text-transform:uppercase}.coverage-test_only{background:#fee2e2;color:#b91c1c}.coverage-partial,.coverage-stale{background:#fef3c7;color:#92400e}.coverage-complete{background:#dcfce7;color:#15803d}.coverage-unavailable{background:#e5e7eb;color:#4b5563}.evidence-note{font-size:11px;line-height:1.4;color:#92400e;background:#fffbeb;padding:8px;border-radius:7px;margin-top:8px}
  .overlap-card { --accent:#dc2626; --tint:#fef2f2; }
  .road-card { --accent:#2563eb; --tint:#eff6ff; }
  .reserve-card { --accent:#16a34a; --tint:#f0fdf4; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: 700; margin-top: 4px; }
  .badge.ref { background: #eef2ff; color: #4338ca; }
  .badge.blue { background: #dbeafe; color: #1d4ed8; }
  .badge.green { background: #dcfce7; color: #15803d; }
  .badge.st-open { background: #fee2e2; color: #b91c1c; }
  .badge.st-acknowledged { background: #fef3c7; color: #b45309; }
  .badge.st-in_dispute { background: #fce7f3; color: #be185d; }
  .badge.st-resolved { background: #dcfce7; color: #15803d; }
  .badge.st-false_positive { background: #e5e7eb; color: #4b5563; }
  .plot-summary td { padding: 2px 0; font-size: 12px; }
  .plot-summary td:first-child { color: #6b7280; padding-right: 10px; }
  .legend { background: #fff; padding: 6px 10px; border-radius: 6px; font-size: 11px; box-shadow: 0 1px 4px rgba(0,0,0,.2); }
  .legend div { display: flex; align-items: center; gap: 6px; margin: 2px 0; }
  .swatch { width: 14px; height: 14px; display: inline-block; border-radius: 3px; flex: none; }
  .distance-label { background: #fff; border: 1px solid #dc2626; color: #b91c1c; border-radius: 4px; padding: 1px 5px; font-size: 11px; font-weight: 700; box-shadow: 0 1px 3px rgba(0,0,0,.3); white-space: nowrap; }
  .pin { width: 22px; height: 22px; border-radius: 50%; background: #d97706; color: #fff; font-weight: 700; font-size: 11px; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.4); }
  .pin.red { background: #dc2626; }
  .overlap-tag { background: #dc2626; color: #fff; border-radius: 10px; padding: 1px 6px; font-size: 10px; font-weight: 700; box-shadow: 0 1px 3px rgba(0,0,0,.3); white-space: nowrap; }
  .plot-label { background: #d97706; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; border: 1px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.35); white-space: nowrap; }
  .zoom-plot { background: #fff; border-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,.3); }
  .zoom-plot a { display: block; font-size: 12px; padding: 6px 10px; color: #111827; text-decoration: none; }
  .zoom-plot a:hover { background: #f3f4f6; }
  .leaflet-control-layers { font-size: 12px; }
  .leaflet-control-layers-base label { margin-bottom: 2px !important; }
  @media(max-width:600px){#panel{padding:13px 12px}.finding-card{min-height:44px}.finding-detail code,.ownership-flag,.sub{overflow-wrap:anywhere}}
</style>
</head>
<body>
${renderTopNav("registry")}
<div class="wrap">
  <div id="map"></div>
  <div id="panel">
    <h1>Plot ${esc(data.plot.id.slice(0, 8))}</h1>
    <div class="sub">${esc(data.plot.sourceFile ?? "")} · registered ${esc(data.plot.createdAt ?? "")}</div>
    <table class="plot-summary">
      <tr><td>Status</td><td><b>${esc(data.plot.status)}</b></td></tr>
      <tr><td>Method</td><td>${esc(data.plot.method ?? "—")} (${data.plot.confidence != null ? data.plot.confidence.toFixed(0) + "%" : "—"})</td></tr>
      <tr><td>CRS</td><td>${esc(data.plot.crs ?? "—")}</td></tr>
      <tr><td>Area</td><td><b>${data.plot.computedAreaSqm != null ? data.plot.computedAreaSqm.toFixed(1) : "—"} m²</b>
        ${data.plot.printedAreaSqm != null ? `(printed ${data.plot.printedAreaSqm.toFixed(1)} m², ${data.plot.computedAreaSqm != null ? Math.abs(data.plot.computedAreaSqm - data.plot.printedAreaSqm) / data.plot.printedAreaSqm * 100 : 0}%)` : ""}</td></tr>
    </table>
    ${data.ownershipNotices.map((notice) => `<div class="ownership-flag"><a href="/ownership-notices/${esc(notice.id)}"><b>${notice.ownershipStatus === "verified" ? "Verified ownership" : "Unverified ownership"}</b><br/>Notice submitted ${esc(notice.submittedAt)}${notice.submitterName ? ` by ${esc(notice.submitterName)}` : ""} · manage or challenge →</a></div>`).join("")}
    ${data.ownershipNotices.length ? `<h2>Ownership history</h2><ul class="ownership-history">${ownershipTimeline || '<li>No history recorded for this legacy notice.</li>'}</ul>` : ""}

    <h2>Overlaps (${data.overlaps.length})</h2>
    ${overlapRows || '<p class="sub">No overlaps detected.</p>'}
    ${otherLinks ? `<div class="sub">${otherLinks}</div>` : ""}

    <h2>Zoning violations (${data.alerts.length})</h2>
    ${alertRows || '<p class="sub">No zoning violations.</p>'}

    <h2>Data checked (${data.consultedSources.length})</h2>
    <div class="evidence-box">${evidenceRows || '<p class="sub">No source evidence was recorded for this legacy check.</p>'}</div>
    <div class="evidence-note">A clean result means no conflict was found in these datasets. It is not proof that no other record or claim exists. <a href="/sources">Review coverage →</a></div>

    <p style="margin-top:12px"><a href="/">← all plots</a></p>
  </div>
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const D = ${payload};

  // GeoJSON is [lon, lat]; Leaflet wants [lat, lng].
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

  const map = L.map("map");
  const base = {
    Streets: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }),
    Satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 18, attribution: "Tiles &copy; Esri" })
  };
  base.Streets.addTo(map);
  L.control.layers(base, null, { position: "bottomright", collapsed: false }).addTo(map);

  // Pane order: zones (overlay 400) < this plot (500) < overlap area (560) < pins (600).
  const plotPane = map.createPane("plotPane");
  plotPane.style.zIndex = 500;
  const overlapPane = map.createPane("overlapPane");
  overlapPane.style.zIndex = 560;

  const plotPoints = [];

  // 1. Context: road corridors + lines, reserves (faint, so the basemap shows through)
  D.alerts.forEach((a) => {
    if (a.layer === "roads") {
      if (a.bufferGeometry) ringsOf(a.bufferGeometry).forEach((ring) => {
        L.polygon(swap(ring), { color: "#2563eb", weight: 1, fillColor: "#60a5fa", fillOpacity: 0.08, opacity: 0.6 })
          .addTo(map).bindPopup("<b>Corridor</b>: " + (a.zoneName || "road") + " (" + (a.zoneType || "") + ")");
      });
      L.polyline(swap(linePts(a.zoneGeometry)), { color: "#2563eb", weight: 3, opacity: 0.6 })
        .addTo(map).bindPopup("<b>" + (a.zoneName || "road") + "</b> (" + (a.zoneType || "") + ")");
    } else {
      ringsOf(a.zoneGeometry).forEach((ring) => {
        L.polygon(swap(ring), { color: "#16a34a", weight: 1, fillColor: "#22c55e", fillOpacity: 0.1 })
          .addTo(map).bindPopup("<b>" + (a.zoneName || "reserve") + "</b> (" + (a.zoneType || "") + ")");
      });
    }
  });

  // 2. Overlapping neighbour plots (dashed outline, faint)
  D.overlaps.forEach((o) => {
    ringsOf(o.otherGeometry).forEach((ring) => {
      L.polygon(swap(ring), { color: "#9ca3af", weight: 1.5, dashArray: "4 4", fill: false, opacity: 0.9 })
        .addTo(map).bindPopup("Plot " + o.otherPlotId.slice(0, 8) + " (overlaps)");
    });
  });

  // 3. This plot — halo + strong fill, drawn above the zones
  const plotRings = ringsOf(D.plot.geometry);
  plotRings.forEach((ring) => {
    const pts = swap(ring);
    plotPoints.push.apply(plotPoints, pts);
    L.polygon(pts, { color: "#f59e0b", weight: 9, opacity: 0.3, fill: false }).addTo(map);
    L.polygon(pts, { color: "#d97706", weight: 4, fillColor: "#f59e0b", fillOpacity: 0.4, pane: "plotPane" })
      .addTo(map).bindPopup("<b>This plot</b><br/>" +
        (D.plot.computedAreaSqm ? D.plot.computedAreaSqm.toFixed(1) + " m²" : "") +
        (D.plot.printedAreaSqm ? " (printed " + D.plot.printedAreaSqm.toFixed(1) + ")" : ""));
  });

  // 4. Overlap intersections (red, above the plot fill)
  D.overlaps.forEach((o) => {
    ringsOf(o.geometry).forEach((ring) => {
      const pts = swap(ring);
      plotPoints.push.apply(plotPoints, pts);
      L.polygon(pts, { color: "#dc2626", weight: 2.5, fillColor: "#ef4444", fillOpacity: 0.55, pane: "overlapPane" })
        .addTo(map).bindPopup("<b>Overlap " + o.intersectionPercent.toFixed(1) + "%</b><br/>" +
          o.intersectionAreaSqm.toFixed(1) + " m² shared with " + o.otherPlotId.slice(0, 8));
      L.marker(L.latLngBounds(pts).getCenter(), {
        icon: L.divIcon({ className: "", html: '<div class="overlap-tag">' + o.intersectionPercent.toFixed(0) + "%</div>", iconSize: [0, 0] })
      }).addTo(map);
    });
  });

  // 5. Nearest-point lines + distance labels
  D.alerts.forEach((a) => {
    if (!a.nearestLine) return;
    const pts = swap(linePts(a.nearestLine));
    if (pts.length < 2) return;
    const d = a.distanceM;
    const label = a.layer === "roads"
      ? (d != null ? d.toFixed(1) + " m" : "")
      : (a.intersectionAreaSqm != null ? a.intersectionAreaSqm.toFixed(0) + " m²" : "");
    L.polyline(pts, { color: "#dc2626", weight: 2, dashArray: "6 4", opacity: 0.9 }).addTo(map);
    if (label) {
      const mid = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
      L.marker(mid, { icon: L.divIcon({ className: "", html: '<div class="distance-label">' + label + "</div>", iconSize: [0, 0] }) }).addTo(map);
    }
  });

  // 6. Beacon pins
  const ring0 = swap(plotRings[0] || []);
  D.plot.rawVertices.forEach((v, k) => {
    const pt = ring0[Math.min(k, ring0.length - 1)];
    if (!pt) return;
    const red = D.alerts.some((a) => a.reference === v.beaconId);
    const icon = L.divIcon({ className: "", html: '<div class="pin' + (red ? " red" : "") + '">' + (k + 1) + "</div>", iconSize: [22, 22], iconAnchor: [11, 11] });
    L.marker(pt, { icon }).addTo(map)
      .bindTooltip((k + 1) + ". " + v.beaconId + (red ? " — VIOLATION" : ""), { permanent: false, direction: "top", offset: [0, -10] });
  });

  // 7. Fit to the plot with surrounding context visible, plus a re-center control
  const plotBounds = L.latLngBounds(plotPoints);
  const fitToPlot = function () {
    if (plotBounds.isValid()) map.fitBounds(plotBounds.pad(0.5), { padding: [60, 60], maxZoom: 18 });
  };
  fitToPlot();
  if (!plotBounds.isValid()) map.setView([9.0, 8.0], 6);

  const zoomToPlot = L.control({ position: "topright" });
  zoomToPlot.onAdd = function () {
    const el = document.createElement("div");
    el.className = "zoom-plot";
    el.innerHTML = '<a href="#" title="Zoom to plot" role="button" aria-label="Zoom to plot">This plot</a>';
    el.addEventListener("click", function (e) { e.preventDefault(); fitToPlot(); });
    return el;
  };
  zoomToPlot.addTo(map);

  L.control({ position: "bottomleft" }).onAdd = () => {
    const el = document.createElement("div");
    el.className = "legend";
    el.innerHTML =
      '<div><span class="swatch" style="background:#d97706"></span>this plot</div>' +
      '<div><span class="swatch" style="background:#ef4444"></span>overlap area</div>' +
      '<div><span class="swatch" style="background:#9ca3af;border:1px dashed #6b7280"></span>overlapping plot</div>' +
      '<div><span class="swatch" style="background:#60a5fa"></span>road corridor</div>' +
      '<div><span class="swatch" style="background:#22c55e"></span>reserve</div>' +
      '<div><span class="swatch" style="background:#dc2626;height:2px"></span>nearest point</div>';
    return el;
  };
</script>
</body>
</html>`;
}
