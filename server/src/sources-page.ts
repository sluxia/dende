import { renderTopNav, TOP_NAV_CSS } from "./nav";

export interface SourceSummary {
  id: string;
  type: string;
  name: string;
  provider: string | null;
  countryCode: string | null;
  adminLevel1: string | null;
  adminLevel2: string | null;
  format: string | null;
  authorityLevel: string;
  status: string;
  coverageStatus: string;
  accessStage: string;
  accessMethod: string | null;
  accessReviewedAt: string | null;
  sourceUrl: string | null;
  license: string | null;
  description: string | null;
  featureCount: number;
  importCount: number;
  lastImportedAt: string | null;
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderSourcesPageHtml(sources: SourceSummary[]): string {
  const totalFeatures = sources.reduce((sum, source) => sum + source.featureCount, 0);
  const countries = new Set(sources.map((source) => source.countryCode).filter(Boolean)).size;
  const datasets = sources.filter((source) => source.accessStage === "usable");
  const targets = sources.filter((source) => source.accessStage !== "usable");
  const available = datasets.length;
  const jurisdictions = new Set(sources.map((source) => source.adminLevel1).filter(Boolean)).size;
  const renderCard = (source: SourceSummary) => {
    const geography = [source.countryCode, source.adminLevel1, source.adminLevel2].filter(Boolean).join(" · ") || "Unspecified coverage";
    const searchable = [source.name, source.provider, source.adminLevel1, source.adminLevel2, source.type].filter(Boolean).join(" ").toLowerCase();
    const availability = source.accessStage === "usable" ? "available" : "target";
    const stageLabel = source.accessStage.replace(/_/g, " ");
    return `<article class="source-card" data-availability="${availability}" data-search="${esc(searchable)}">
      <div class="source-head"><span class="type type-${esc(source.type)}">${esc(source.type)}</span><span class="status status-${esc(source.accessStage)}">${esc(stageLabel)}</span></div>
      <h2>${esc(source.name)}</h2>
      <p class="provider">${esc(source.provider ?? "Unknown provider")}</p>
      <div class="metrics"><div><b>${source.featureCount}</b><span>records</span></div><div><b>${source.importCount}</b><span>imports</span></div></div>
      <dl>
        <dt>Coverage</dt><dd>${esc(geography)}</dd>
        <dt>Authority</dt><dd>${esc(source.authorityLevel.replace(/_/g, " "))}</dd>
        <dt>${availability === "target" ? "Access" : "Format"}</dt><dd>${availability === "target" ? esc(source.accessMethod ?? "Research pending") : esc(source.format ?? "—")}</dd>
        <dt>${availability === "target" ? "Reviewed" : "Last import"}</dt><dd>${esc(availability === "target" ? source.accessReviewedAt ?? "Not yet audited" : source.lastImportedAt ?? "—")}</dd>
        <dt>License</dt><dd>${esc(source.license ?? "Not recorded")}</dd>
      </dl>
      ${source.description ? `<p class="description">${esc(source.description)}</p>` : ""}
      <a href="/sources/${esc(source.id)}">View provenance and imports →</a>
      ${source.sourceUrl ? `<a href="${esc(source.sourceUrl)}" rel="noreferrer">Original source →</a>` : ""}
    </article>`;
  };
  const datasetCards = datasets.map(renderCard).join("");
  const targetCards = targets.map(renderCard).join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Dende — Data sources</title><style>
  *{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f3f4f6;color:#111827}${TOP_NAV_CSS}
  .page{max-width:1180px;margin:0 auto;padding:26px 18px 60px}.eyebrow{text-transform:uppercase;letter-spacing:.1em;color:#d97706;font-size:11px;font-weight:800}.intro h1{font-size:28px;margin:5px 0 7px}.intro p{max-width:740px;color:#6b7280;line-height:1.5;margin:0}.summary{display:flex;gap:12px;margin:22px 0;flex-wrap:wrap}.summary div{background:#111827;color:#fff;padding:13px 18px;border-radius:10px;min-width:145px}.summary b{display:block;font-size:22px}.summary span{font-size:11px;color:#9ca3af}.notice{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:11px 14px;color:#92400e;font-size:13px;margin-bottom:18px}.filters{display:flex;gap:10px;margin:0 0 22px;flex-wrap:wrap}.filters input,.filters select{min-height:44px;border:1px solid #d1d5db;border-radius:9px;background:#fff;padding:0 12px;font:inherit}.filters input{flex:1;min-width:min(260px,100%)}.group{margin-top:24px}.group-title{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:10px}.group-title h2{margin:0;font-size:20px}.group-title p{margin:0;color:#6b7280;font-size:12px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:14px}.source-card{min-width:0;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.04)}.source-card[hidden],.group[hidden]{display:none}.source-head{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.type,.status{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:3px 8px;border-radius:999px;background:#e5e7eb}.type-road{background:#dbeafe;color:#1d4ed8}.type-reserve{background:#dcfce7;color:#15803d}.type-survey,.type-user_plot{background:#fef3c7;color:#b45309}.status-usable{background:#dcfce7;color:#15803d}.status-portal_found{background:#dbeafe;color:#1d4ed8}.status-authority_identified,.status-access_required{background:#f3f4f6;color:#4b5563}.source-card h2{font-size:17px;margin:12px 0 2px}.provider{font-size:12px;color:#6b7280;margin:0 0 13px}.metrics{display:flex;gap:10px;margin-bottom:13px;flex-wrap:wrap}.metrics div{background:#f9fafb;border:1px solid #f3f4f6;border-radius:8px;padding:8px 11px;min-width:82px}.metrics b{display:block;font-size:18px}.metrics span{font-size:10px;color:#6b7280}.source-card dl{display:grid;grid-template-columns:82px minmax(0,1fr);gap:6px;margin:0;font-size:12px}.source-card dt{color:#9ca3af}.source-card dd{margin:0;overflow-wrap:anywhere}.description{font-size:12px;color:#6b7280;line-height:1.45;border-top:1px solid #f3f4f6;padding-top:10px}.source-card a{font-size:12px;color:#2563eb;overflow-wrap:anywhere}.empty{display:none;color:#6b7280}@media(max-width:600px){.page{padding:20px 12px 44px}.intro h1{font-size:25px}.summary{display:grid;grid-template-columns:1fr 1fr;margin:16px 0}.summary div{min-width:0;padding:12px}.filters{display:grid}.group-title{display:block}.group-title p{margin-top:4px}.source-card a{display:inline-flex;align-items:center;min-height:44px}}
  </style></head><body>${renderTopNav("sources")}<main class="page"><section class="intro"><div class="eyebrow">Transparency & provenance</div><h1>Coverage and acquisition</h1><p>Available datasets are records Dende can actually consult. Target authorities identify where future data may come from; a website or service portal alone is not treated as a dataset.</p></section><div class="summary"><div><b>${available}</b><span>available datasets</span></div><div><b>${targets.length}</b><span>target authorities</span></div><div><b>${jurisdictions}</b><span>states and FCT mapped</span></div><div><b>${totalFeatures}</b><span>active spatial records</span></div></div><div class="notice"><b>Acquisition gate:</b> Target authorities remain excluded from every check until Dende obtains an actual dataset, confirms permission and metadata, validates it, records an import, and deliberately marks it usable.</div><div class="filters"><input id="source-search" type="search" placeholder="Search state, authority, or dataset…" aria-label="Search sources"><select id="availability" aria-label="Filter by source kind"><option value="all">All entries</option><option value="available">Available datasets</option><option value="target">Target authorities</option></select></div><section class="group" data-group="available"><div class="group-title"><div><div class="eyebrow">Used in checks</div><h2>Available datasets</h2></div><p>Imported or live spatial records currently available to Dende</p></div><div class="grid">${datasetCards || "<p>No usable datasets recorded yet.</p>"}</div></section><section class="group" data-group="target"><div class="group-title"><div><div class="eyebrow">Acquisition pipeline</div><h2>Target authorities</h2></div><p>Authorities and portals identified for future data access</p></div><div class="grid">${targetCards || "<p>No target authorities recorded yet.</p>"}</div></section><p class="empty" id="empty">No entries match these filters.</p></main><script>(()=>{const q=document.getElementById('source-search'),f=document.getElementById('availability'),cards=[...document.querySelectorAll('.source-card')],groups=[...document.querySelectorAll('.group')],empty=document.getElementById('empty');function apply(){const term=q.value.trim().toLowerCase(),kind=f.value;let total=0;cards.forEach(card=>{const show=(!term||card.dataset.search.includes(term))&&(kind==='all'||card.dataset.availability===kind);card.hidden=!show;if(show)total++;});groups.forEach(group=>{group.hidden=!group.querySelector('.source-card:not([hidden])')});empty.style.display=total?'none':'block'}q.addEventListener('input',apply);f.addEventListener('change',apply)})()</script></body></html>`;
}
