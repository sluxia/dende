import { renderTopNav, TOP_NAV_CSS } from "./nav";

export interface LandEvidenceSummary {
  id: string;
  eventType: string;
  headline: string;
  summary: string;
  effectiveOn: string | null;
  adminLevel1: string | null;
  adminLevel2: string | null;
  locality: string | null;
  layoutName: string | null;
  originalAreaText: string | null;
  evidenceTier: number;
  reviewStatus: string;
  searchStatus: string;
  checkStatus: string;
  geometryStatus: string;
  evidenceCount: number;
  primaryPublisher: string | null;
  primaryDocumentType: string | null;
}

export interface EvidenceDocument {
  id: string;
  title: string;
  publisher: string;
  publisherType: string;
  documentType: string;
  sourceUrl: string;
  publishedOn: string | null;
  retrievedAt: string;
  extractionStatus: string;
  evidenceRole: string;
  locator: string | null;
  supportingExcerpt: string | null;
}

export interface LandEvidenceDetail extends LandEvidenceSummary {
  plotReference: string | null;
  surveyReference: string | null;
  titleReference: string | null;
  courtReference: string | null;
  extractionConfidence: number;
  sensitivity: string;
  createdAt: string;
  documents: EvidenceDocument[];
}

function esc(value: unknown): string {
  return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

const css = `*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f3f4f6;color:#111827}${TOP_NAV_CSS}.page{max-width:1100px;margin:auto;padding:28px 18px 60px}.eyebrow{text-transform:uppercase;letter-spacing:.1em;color:#b45309;font-size:10px;font-weight:850}h1{font-size:29px;margin:5px 0 8px}.lead{max-width:780px;color:#6b7280;line-height:1.55;margin:0}.notice{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:10px;padding:12px 14px;margin:20px 0;font-size:13px;line-height:1.45}.summary{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}.summary div{background:#111827;color:#fff;border-radius:10px;padding:12px 16px;min-width:145px}.summary b{display:block;font-size:21px}.summary span{font-size:10px;color:#9ca3af}.filters{display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap}.filters input,.filters select{min-height:44px;border:1px solid #d1d5db;border-radius:9px;background:#fff;padding:0 12px;font:inherit}.filters input{flex:1;min-width:min(280px,100%)}.list{display:grid;gap:12px}.event{display:block;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;color:inherit;text-decoration:none}.event[hidden]{display:none}.event:hover{border-color:#d97706;box-shadow:0 2px 8px #0000000d}.head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.badges{display:flex;gap:5px;flex-wrap:wrap}.badge{font-size:9px;font-weight:850;text-transform:uppercase;letter-spacing:.04em;padding:4px 7px;border-radius:999px;background:#e5e7eb}.badge.searchable{background:#dbeafe;color:#1d4ed8}.badge.excluded{background:#f3f4f6;color:#4b5563}.event h2{font-size:17px;margin:10px 0 5px}.event p{font-size:13px;color:#6b7280;line-height:1.45;margin:0}.meta{display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;font-size:11px;color:#6b7280}.empty{display:none;color:#6b7280}.back{display:inline-flex;min-height:44px;align-items:center;color:#2563eb;text-decoration:none;font-size:13px}.card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-top:14px}.card h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;margin:0 0 12px}.facts{display:grid;grid-template-columns:155px minmax(0,1fr);gap:8px 14px;margin:0;font-size:13px}.facts dt{color:#6b7280}.facts dd{margin:0;overflow-wrap:anywhere}.document{border-top:1px solid #e5e7eb;padding:12px 0}.document:first-of-type{border:0;padding-top:0}.document a{color:#2563eb;font-weight:700}.document p{font-size:12px;color:#4b5563;line-height:1.5}.tier{font-weight:800}@media(max-width:600px){.page{padding:20px 12px 44px}.summary{display:grid;grid-template-columns:1fr 1fr}.summary div{min-width:0}.filters{display:grid}.head{display:block}.badges{margin-top:8px}.facts{grid-template-columns:1fr;gap:2px}.facts dd{margin-bottom:8px}}`;

export function renderResearchPageHtml(events: LandEvidenceSummary[]): string {
  const searchable=events.filter(e=>e.searchStatus==="searchable").length, checkEnabled=events.filter(e=>e.checkStatus==="eligible").length;
  const cards=events.map(e=>{const search=[e.headline,e.summary,e.eventType,e.adminLevel1,e.adminLevel2,e.locality,e.layoutName,e.primaryPublisher].filter(Boolean).join(" ").toLowerCase();return `<a class="event" href="/research/${esc(e.id)}" data-type="${esc(e.eventType)}" data-search="${esc(search)}"><div class="head"><span class="badge">${esc(e.eventType.replace(/_/g," "))}</span><div class="badges"><span class="badge searchable">${esc(e.searchStatus)}</span><span class="badge ${esc(e.checkStatus)}">checks: ${esc(e.checkStatus)}</span></div></div><h2>${esc(e.headline)}</h2><p>${esc(e.summary)}</p><div class="meta"><span>${esc([e.adminLevel1,e.adminLevel2,e.locality].filter(Boolean).join(" · ")||"Location not resolved")}</span><span>Tier ${e.evidenceTier}</span><span>${e.evidenceCount} source${e.evidenceCount===1?"":"s"}</span><span>${esc(e.geometryStatus)} geometry</span>${e.originalAreaText?`<span>${esc(e.originalAreaText)}</span>`:""}</div></a>`}).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dende — Land evidence</title><style>${css}</style></head><body>${renderTopNav("research")}<main class="page"><div class="eyebrow">Government-mapped coverage first</div><h1>Land evidence</h1><p class="lead">Explore reviewed government maps and plans alongside allocations, acquisitions, returns, title notices, court outcomes and other preserved public records. Evidence can be searchable without being trusted for spatial checks.</p><div class="summary"><div><b>${events.length}</b><span>evidence records</span></div><div><b>${searchable}</b><span>searchable records</span></div><div><b>${checkEnabled}</b><span>check-enabled records</span></div></div><div class="notice"><b>Evidence boundary:</b> A published fact without dependable parcel geometry is contextual evidence, not a map violation. Only reviewed legal or official records with validated derived or authoritative geometry can become check-enabled. Partial mapped coverage is labelled and limited to the coordinates actually reviewed.</div><div class="filters"><input id="q" type="search" aria-label="Search land evidence" placeholder="Search state, place, layout, event or authority…"><select id="type" aria-label="Filter evidence type"><option value="all">All event types</option>${[...new Set(events.map(e=>e.eventType))].map(t=>`<option value="${esc(t)}">${esc(t.replace(/_/g," "))}</option>`).join("")}</select></div><section class="list">${cards}<p class="empty" id="empty">No evidence matches these filters.</p></section></main><script>(()=>{const q=document.getElementById('q'),t=document.getElementById('type'),cards=[...document.querySelectorAll('.event')],empty=document.getElementById('empty');function apply(){const term=q.value.trim().toLowerCase();let n=0;cards.forEach(c=>{const show=(!term||c.dataset.search.includes(term))&&(t.value==='all'||c.dataset.type===t.value);c.hidden=!show;if(show)n++});empty.style.display=n?'none':'block'}q.addEventListener('input',apply);t.addEventListener('change',apply)})()</script></body></html>`;
}

export function renderResearchDetailHtml(event: LandEvidenceDetail): string {
  const docs=event.documents.map(d=>`<div class="document"><a href="${esc(d.sourceUrl)}" rel="noreferrer">${esc(d.title)} →</a><p>${esc(d.publisher)} · ${esc(d.documentType.replace(/_/g," "))} · ${esc(d.evidenceRole)}${d.publishedOn?` · ${esc(d.publishedOn)}`:""}</p>${d.locator?`<p><b>Location:</b> ${esc(d.locator)}</p>`:""}${d.supportingExcerpt?`<p>“${esc(d.supportingExcerpt)}”</p>`:""}</div>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(event.headline)} — Dende</title><style>${css}</style></head><body>${renderTopNav("research")}<main class="page"><a class="back" href="/research">← Historical land evidence</a><div class="eyebrow">${esc(event.eventType.replace(/_/g," "))}</div><h1>${esc(event.headline)}</h1><p class="lead">${esc(event.summary)}</p><div class="notice"><b>Use in Dende:</b> Search status is ${esc(event.searchStatus)}. Spatial-check status is ${esc(event.checkStatus)} because geometry is ${esc(event.geometryStatus)}. This record must not be interpreted as a mapped violation.</div><section class="card"><h2>Extracted fact</h2><dl class="facts"><dt>Evidence tier</dt><dd class="tier">${event.evidenceTier}</dd><dt>Review</dt><dd>${esc(event.reviewStatus)}</dd><dt>Extraction confidence</dt><dd>${Math.round(event.extractionConfidence*100)}%</dd><dt>Effective date</dt><dd>${esc(event.effectiveOn??"Not established")}</dd><dt>Location</dt><dd>${esc([event.adminLevel1,event.adminLevel2,event.locality].filter(Boolean).join(" · ")||"Not resolved")}</dd><dt>Layout</dt><dd>${esc(event.layoutName??"Not recorded")}</dd><dt>Area</dt><dd>${esc(event.originalAreaText??"Not recorded")}</dd><dt>Plot reference</dt><dd>${esc(event.plotReference??"Not recorded")}</dd><dt>Survey reference</dt><dd>${esc(event.surveyReference??"Not recorded")}</dd><dt>Title reference</dt><dd>${esc(event.titleReference??"Not recorded")}</dd><dt>Court reference</dt><dd>${esc(event.courtReference??"Not recorded")}</dd><dt>Geometry</dt><dd>${esc(event.geometryStatus)}</dd></dl></section><section class="card"><h2>Preserved evidence (${event.documents.length})</h2>${docs||'<p class="lead">No evidence document is linked.</p>'}</section></main></body></html>`;
}
