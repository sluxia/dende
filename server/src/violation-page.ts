/**
 * Renders the full-history page for a single violation: case header, zone /
 * other-plot context, measurement history from check runs, the immutable
 * event timeline, and lifecycle actions (status + notes).
 */

import { renderTopNav, TOP_NAV_CSS } from "./nav";

interface GeoJson {
  type: string;
  coordinates: unknown;
}

export interface ViolationEvent {
  id: number;
  event_type: string;
  actor: string;
  reason: string | null;
  snapshot: Record<string, unknown>;
  check_run_id: string | null;
  created_at: string;
}

export interface CheckRun {
  id: string;
  trigger: string;
  source_upload: string | null;
  parse_method: string | null;
  confidence: number | null;
  plot_area_sqm: number | null;
  overlaps: unknown;
  zoning_alerts: unknown;
  ran_at: string;
}

export interface ViolationDetail {
  violation: {
    id: string;
    kind: string;
    status: string;
    severity: string;
    plot_id: string;
    other_plot_id: string | null;
    zone_id: number | null;
    zone_layer: string | null;
    zone_name: string | null;
    zone_type: string | null;
    current_distance_m: number | null;
    current_area_sqm: number | null;
    current_percent: number | null;
    first_detected_at: string;
    last_checked_at: string | null;
    resolved_at: string | null;
    resolution: string | null;
    plot_method: string | null;
    plot_source_file: string | null;
    plot_crs: string | null;
    zone_source_url: string | null;
    zone_imported_at: string | null;
  };
  events: ViolationEvent[];
  checkRuns: CheckRun[];
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

const SEVERITY_COLORS: Record<string, string> = { critical: "#dc2626", warning: "#d97706", info: "#2563eb" };
const STATUS_COLORS: Record<string, string> = {
  open: "#dc2626",
  acknowledged: "#b45309",
  in_dispute: "#be185d",
  resolved: "#15803d",
  false_positive: "#4b5563"
};
const EVENT_LABELS: Record<string, string> = {
  detected: "Detected",
  measurement_changed: "Measurement changed",
  status_changed: "Status changed",
  zone_changed: "Zone changed",
  note: "Note"
};

export function renderViolationPageHtml(data: ViolationDetail): string {
  const v = data.violation;
  const payload = JSON.stringify(data).replace(/</g, "\\u003c");

  const measure = (() => {
    if (v.kind === "overlap") {
      return `${v.current_percent != null ? v.current_percent.toFixed(1) + "%" : "?"} — ${v.current_area_sqm != null ? v.current_area_sqm.toFixed(1) + " m²" : "?"}`;
    }
    if (v.zone_layer === "roads") {
      return v.current_distance_m != null ? `${v.current_distance_m.toFixed(1)} m from road centerline` : "—";
    }
    return v.current_area_sqm != null ? `${v.current_area_sqm.toFixed(1)} m² inside reserve` : "—";
  })();

  const zoneCard = v.kind === "zoning" ? `<div class="card zone-card">
      <div class="card-title">Zone — ${esc(v.zone_name ?? "unknown")}</div>
      <table class="kv">
        <tr><td>Layer</td><td>${esc(v.zone_layer ?? "—")}</td></tr>
        <tr><td>Class</td><td>${esc(v.zone_type ?? "—")}</td></tr>
        <tr><td>Zone id</td><td><code>${v.zone_id ?? "unresolved"}</code></td></tr>
        <tr><td>Source</td><td>${esc(v.zone_source_url ?? "—")}</td></tr>
        <tr><td>Imported</td><td>${fmtDate(v.zone_imported_at)}</td></tr>
      </table>
    </div>` : `<div class="card zone-card">
      <div class="card-title">Overlapping plot</div>
      <table class="kv">
        <tr><td>Plot id</td><td><code>${esc(v.other_plot_id ?? "—")}</code></td></tr>
      </table>
      ${v.other_plot_id ? `<a href="/api/plots/${v.other_plot_id}/map">open overlapping plot →</a>` : ""}
    </div>`;

  const runRows = data.checkRuns
    .map((r, i) => {
      const alerts = (r.zoning_alerts as Array<{ distanceM?: number; intersectionAreaSqm?: number; percent?: number }> | null) ?? [];
      const overlaps = (r.overlaps as Array<{ intersectionPercent?: number; intersectionAreaSqm?: number }> | null) ?? [];
      let measurement = "—";
      if (v.kind === "overlap" && overlaps[0]) {
        measurement = `${overlaps[0].intersectionPercent?.toFixed(1)}% / ${overlaps[0].intersectionAreaSqm?.toFixed(1)} m²`;
      } else if (v.zone_layer === "roads" && alerts[0]) {
        measurement = `${alerts[0].distanceM?.toFixed(1)} m`;
      } else if (alerts[0]) {
        measurement = `${alerts[0].intersectionAreaSqm?.toFixed(1)} m²`;
      }
      return `<tr>
        <td data-label="Check">#${i + 1}</td>
        <td data-label="When">${fmtDate(r.ran_at)}</td>
        <td data-label="Trigger"><span class="chip">${esc(r.trigger)}</span></td>
        <td data-label="Parse">${esc(r.parse_method ?? "—")} ${r.confidence != null ? r.confidence.toFixed(0) + "%" : ""}</td>
        <td data-label="Measurement">${measurement}</td>
      </tr>`;
    })
    .join("");

  const eventRows = data.events
    .map((e) => {
      const snap = e.snapshot ?? {};
      const bits: string[] = [];
      if (snap.severity) bits.push(`severity: ${esc(snap.severity)}`);
      if (snap.status) bits.push(`status: ${esc(snap.status)}`);
      if (snap.distanceM != null) bits.push(`distance: ${Number(snap.distanceM).toFixed(1)} m`);
      if (snap.areaSqm != null) bits.push(`area: ${Number(snap.areaSqm).toFixed(1)} m²`);
      if (snap.percent != null) bits.push(`share: ${Number(snap.percent).toFixed(1)}%`);
      const checkLink = e.check_run_id ? `<code>check ${esc(String(e.check_run_id).slice(0, 8))}</code>` : "";
      return `<li class="event ev-${esc(e.event_type)}">
        <div class="event-head"><b>${esc(EVENT_LABELS[e.event_type] ?? e.event_type)}</b>
          <span class="muted">${fmtDate(e.created_at)}</span></div>
        <div class="event-actor">by ${esc(e.actor)}${checkLink ? " · " + checkLink : ""}</div>
        ${e.reason ? `<div class="event-reason">${esc(e.reason)}</div>` : ""}
        ${bits.length ? `<div class="event-snap">${bits.map((b) => `<span class="chip">${b}</span>`).join(" ")}</div>` : ""}
      </li>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Violation ${esc(v.id.slice(0, 8))} — Full history</title>
<style>
  * { box-sizing:border-box; } html, body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f3f4f6; }
  ${TOP_NAV_CSS}
  .wrap { max-width: 960px; margin: 0 auto; padding: 20px 16px 60px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #6b7280; font-size: 13px; margin-bottom: 16px; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; }
  .card-title { font-weight: 700; font-size: 13px; letter-spacing: .03em; text-transform: uppercase; color: #374151; margin-bottom: 8px; }
  .head { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 6px; }
  .big { font-size: 24px; font-weight: 800; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; color: #fff; }
  .chip { display: inline-block; padding: 0 7px; border-radius: 8px; background: #f3f4f6; border: 1px solid #e5e7eb; font-size: 11px; font-weight: 600; color: #374151; margin: 1px 2px 1px 0; }
  table.kv { border-collapse: collapse; font-size: 13px; }
  table.kv td { padding: 3px 14px 3px 0; }
  table.kv td:first-child { color: #6b7280; }
  table.hist { border-collapse: collapse; width: 100%; font-size: 12px; }
  table.hist th, table.hist td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #eee; }
  ul.timeline { list-style: none; margin: 0; padding: 0; }
  ul.timeline li { border-left: 3px solid #e5e7eb; padding: 0 0 14px 14px; margin-left: 6px; position: relative; }
  ul.timeline li::before { content: ""; position: absolute; left: -8px; top: 3px; width: 13px; height: 13px; border-radius: 50%; background: #e5e7eb; }
  ul.timeline li.ev-detected { border-left-color: #dc2626; }
  ul.timeline li.ev-detected::before { background: #dc2626; }
  ul.timeline li.ev-measurement_changed { border-left-color: #2563eb; }
  ul.timeline li.ev-measurement_changed::before { background: #2563eb; }
  ul.timeline li.ev-status_changed { border-left-color: #d97706; }
  ul.timeline li.ev-status_changed::before { background: #d97706; }
  ul.timeline li.ev-zone_changed { border-left-color: #16a34a; }
  ul.timeline li.ev-zone_changed::before { background: #16a34a; }
  ul.timeline li.ev-note::before { background: #9ca3af; }
  .event-head { font-size: 13px; }
  .event-actor { font-size: 11px; color: #6b7280; margin-top: 1px; }
  .event-reason { font-size: 12px; margin-top: 3px; }
  .event-snap { margin-top: 4px; }
  .muted { color: #6b7280; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
  .actions button { border: 1px solid #d1d5db; background: #fff; border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
  .actions button:hover { background: #f3f4f6; }
  .note-form { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
  .note-form input[type=text] { flex: 1; min-width: 200px; border: 1px solid #d1d5db; border-radius: 8px; padding: 7px 10px; font-size: 12px; }
  .note-form input[type=submit] { border: 1px solid #111827; background: #111827; color: #fff; border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
  a { color: #2563eb; }
  @media(max-width:600px){.wrap{padding:16px 12px 44px}h1{font-size:18px;overflow-wrap:anywhere}.sub,code{overflow-wrap:anywhere}.card{padding:12px;margin-bottom:12px}.actions button,.note-form input{min-height:44px}.note-form{display:grid;grid-template-columns:1fr}.note-form input[type=text]{min-width:0;width:100%}.note-form input[type=submit]{width:100%}table.hist,table.hist tbody,table.hist tr,table.hist td{display:block}table.hist thead{position:absolute;clip:rect(0 0 0 0);clip-path:inset(50%)}table.hist tr{border:1px solid #e5e7eb;border-radius:8px;padding:7px 9px;margin-bottom:7px}table.hist td{display:flex;justify-content:space-between;gap:12px;border:0;padding:3px 0;text-align:right}table.hist td::before{content:attr(data-label);font-weight:700;color:#6b7280;text-align:left}.actions{display:grid;grid-template-columns:1fr 1fr}.actions button{width:100%}}
</style>
</head>
<body>
${renderTopNav("registry")}
<div class="wrap">
  <h1>Violation <code>${esc(v.id)}</code></h1>
  <div class="sub">${esc(v.kind === "overlap" ? "plot overlap" : "zoning violation")} · plot
    <a href="/api/plots/${v.plot_id}/map">${esc(v.plot_source_file ?? v.plot_id.slice(0, 8))}</a>
    (${esc(v.plot_method ?? "?")} parse · ${esc(v.plot_crs ?? "?")})</div>

  <div class="card">
    <div class="head">
      <span class="badge" style="background:${esc(SEVERITY_COLORS[v.severity] ?? "#6b7280")}">${esc(v.severity)}</span>
      <span class="badge" style="background:${esc(STATUS_COLORS[v.status] ?? "#6b7280")}">${esc(v.status)}</span>
      <span class="big">${esc(measure)}</span>
    </div>
    <table class="kv">
      <tr><td>First detected</td><td>${fmtDate(v.first_detected_at)}</td></tr>
      <tr><td>Last checked</td><td>${fmtDate(v.last_checked_at)}</td></tr>
      <tr><td>Resolved</td><td>${fmtDate(v.resolved_at)}</td></tr>
      ${v.resolution ? `<tr><td>Resolution</td><td>${esc(v.resolution)}</td></tr>` : ""}
    </table>
    <div class="actions">
      <button data-status="acknowledged">Acknowledge</button>
      <button data-status="in_dispute">In dispute</button>
      <button data-status="resolved">Resolve</button>
      <button data-status="false_positive">False positive</button>
      <button data-status="open">Reopen</button>
    </div>
    <form class="note-form" id="note-form">
      <input type="text" name="actor" placeholder="Your name" required />
      <input type="text" name="note" placeholder="Add a note / reason…" required />
      <input type="submit" value="Add note" />
    </form>
  </div>

  ${zoneCard}

  <div class="card">
    <div class="card-title">Measurement history (${data.checkRuns.length} check runs)</div>
    <table class="hist">
      <thead><tr><th>#</th><th>When</th><th>Trigger</th><th>Parse</th><th>Measurement</th></tr></thead>
      <tbody>${runRows || '<tr><td colspan="5" class="muted">No check runs recorded.</td></tr>'}</tbody>
    </table>
  </div>

  <div class="card">
    <div class="card-title">Timeline (${data.events.length} events)</div>
    <ul class="timeline">${eventRows || '<li class="muted">No events recorded.</li>'}</ul>
  </div>

  <p class="sub"><a href="/api/plots/${v.plot_id}/map">← back to plot</a> · <a href="/">all plots</a></p>
</div>
<script>
  const V = ${payload};
  const btn = (status) => document.querySelector('button[data-status="' + status + '"]');
  for (const b of document.querySelectorAll("button[data-status]")) {
    b.addEventListener("click", async () => {
      await fetch("/api/violations/" + V.violation.id, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: b.dataset.status, actor: "ui-operator", reason: "Status changed from the violation page" })
      });
      location.reload();
    });
  }
  document.getElementById("note-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const actor = e.target.actor.value, note = e.target.note.value;
    await fetch("/api/violations/" + V.violation.id + "/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actor, note })
    });
    location.reload();
  });
</script>
</body>
</html>`;
}
