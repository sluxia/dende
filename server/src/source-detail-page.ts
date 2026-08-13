import { renderTopNav, TOP_NAV_CSS } from "./nav";

export interface SourceDetail {
  id: string;
  type: string;
  name: string;
  provider: string | null;
  countryCode: string | null;
  adminLevel1: string | null;
  adminLevel2: string | null;
  format: string | null;
  sourceUrl: string | null;
  license: string | null;
  authorityLevel: string;
  status: string;
  coverageStatus: string;
  accessStage: string;
  accessMethod: string | null;
  accessNotes: string | null;
  accessContact: string | null;
  accessReviewedAt: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  featureCount: number;
}

export interface ImportDetail {
  id: string;
  sourceId: string;
  filename: string | null;
  fileType: string | null;
  checksum: string | null;
  recordCount: number | null;
  linkedFeatureCount: number;
  importedBy: string;
  status: string;
  errorSummary: string | null;
  importedAt: string;
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const pageCss = `
  *{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f3f4f6;color:#111827}${TOP_NAV_CSS}
  .page{max-width:960px;margin:0 auto;padding:26px 18px 60px}.back{display:inline-flex;min-height:44px;align-items:center;color:#2563eb;font-size:13px;text-decoration:none}.eyebrow{font-size:10px;font-weight:850;letter-spacing:.1em;text-transform:uppercase;color:#d97706}h1{font-size:28px;margin:4px 0 5px;overflow-wrap:anywhere}.lead{color:#6b7280;line-height:1.5;margin:0 0 18px}.head-row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.badges{display:flex;gap:6px;flex-wrap:wrap}.badge{display:inline-flex;padding:4px 8px;border-radius:999px;background:#e5e7eb;color:#374151;font-size:10px;font-weight:800;text-transform:uppercase}.badge.test_only{background:#fee2e2;color:#b91c1c}.badge.partial,.badge.stale{background:#fef3c7;color:#92400e}.badge.complete{background:#dcfce7;color:#15803d}.card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-top:14px}.card h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#374151;margin:0 0 11px}.facts{display:grid;grid-template-columns:150px minmax(0,1fr);gap:8px 14px;margin:0;font-size:13px}.facts dt{color:#6b7280}.facts dd{margin:0;overflow-wrap:anywhere}.imports{display:grid;gap:8px}.import-row{display:grid;grid-template-columns:1fr auto;gap:4px 12px;padding:11px;border:1px solid #e5e7eb;border-radius:9px;color:#111827;text-decoration:none}.import-row:hover{border-color:#d97706}.import-row b{overflow-wrap:anywhere}.import-row span,.import-row small{color:#6b7280}.import-row small{grid-column:1/-1}.notice{background:#fffbeb;color:#92400e;border:1px solid #fde68a;border-radius:9px;padding:10px 12px;font-size:12px;line-height:1.45}.external{display:inline-flex;align-items:center;min-height:44px;color:#2563eb}.checksum{font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
  @media(max-width:600px){.page{padding:18px 12px 44px}h1{font-size:24px}.card{padding:13px}.facts{grid-template-columns:1fr;gap:2px}.facts dd{margin-bottom:8px}.import-row{grid-template-columns:1fr}.import-row small{grid-column:1}}
`;

export function renderSourceDetailHtml(source: SourceDetail, imports: ImportDetail[]): string {
  const geography = [source.countryCode, source.adminLevel1, source.adminLevel2].filter(Boolean).join(" · ") || "Coverage not specified";
  const isTarget = source.accessStage !== "usable";
  const importRows = imports.map((item) => `<a class="import-row" href="/sources/${esc(source.id)}/imports/${esc(item.id)}"><b>${esc(item.filename ?? "Unnamed import")}</b><span>${esc(item.status)}</span><small>${esc(item.fileType ?? "unknown format")} · imported ${esc(item.importedAt)} · ${item.linkedFeatureCount} linked records</small></a>`).join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(source.name)} — Dende source</title><style>${pageCss}</style></head><body>${renderTopNav("sources")}<main class="page"><a class="back" href="/sources">← Coverage and acquisition</a><div class="head-row"><div><div class="eyebrow">${isTarget ? "Target authority" : "Dataset provenance"}</div><h1>${esc(source.name)}</h1><p class="lead">${esc(source.description ?? "No description recorded.")}</p></div><div class="badges"><span class="badge">${esc(source.type)}</span><span class="badge ${esc(source.coverageStatus)}">${esc(source.accessStage.replace(/_/g, " "))}</span></div></div>${isTarget ? '<div class="notice"><b>No usable dataset:</b> This record identifies an authority or service portal only. It is not consulted by Dende checks.</div>' : ""}<section class="card"><h2>${isTarget ? "Authority and access details" : "Dataset details"}</h2><dl class="facts"><dt>Provider</dt><dd>${esc(source.provider ?? "Unknown")}</dd><dt>Authority</dt><dd>${esc(source.authorityLevel.replace(/_/g, " "))}</dd><dt>Geography</dt><dd>${esc(geography)}</dd><dt>Access stage</dt><dd>${esc(source.accessStage.replace(/_/g, " "))}</dd>${isTarget ? `<dt>Access route</dt><dd>${esc(source.accessMethod ?? "Research pending")}</dd><dt>Contact</dt><dd>${esc(source.accessContact ?? "Not yet recorded")}</dd><dt>Audit findings</dt><dd>${esc(source.accessNotes ?? "Access audit not yet completed")}</dd><dt>Last reviewed</dt><dd>${esc(source.accessReviewedAt ?? "Not yet audited")}</dd>` : ""}<dt>Format</dt><dd>${isTarget ? "Not yet acquired" : esc(source.format ?? "Not recorded")}</dd><dt>License</dt><dd>${esc(source.license ?? "Not recorded")}</dd><dt>Lifecycle</dt><dd>${esc(source.status)}</dd><dt>Coverage</dt><dd>${esc(source.coverageStatus.replace(/_/g, " "))}</dd><dt>Linked records</dt><dd>${source.featureCount}</dd><dt>Last updated</dt><dd>${esc(source.updatedAt)}</dd></dl>${source.sourceUrl ? `<a class="external" href="${esc(source.sourceUrl)}" rel="noreferrer">${isTarget ? "Open authority or service website" : "Open original source"} →</a>` : ""}</section><section class="card"><h2>Import history (${imports.length})</h2><div class="imports">${importRows || `<p class="lead">${isTarget ? "No dataset has been acquired or imported from this authority." : "No versioned imports are recorded. Some live records may be unversioned."}</p>`}</div></section><div class="notice"><b>Interpretation:</b> ${isTarget ? "Identification is the first acquisition step, not evidence of data coverage." : "Check results only make claims against the imported or live records disclosed here."}</div></main></body></html>`;
}

export function renderImportDetailHtml(source: SourceDetail, item: ImportDetail): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(item.filename ?? "Import")} — Dende import</title><style>${pageCss}</style></head><body>${renderTopNav("sources")}<main class="page"><a class="back" href="/sources/${esc(source.id)}">← ${esc(source.name)}</a><div class="eyebrow">Immutable import record</div><h1>${esc(item.filename ?? "Unnamed import")}</h1><p class="lead">A recorded version of ${esc(source.name)} consulted by Dende checks.</p><section class="card"><h2>Import details</h2><dl class="facts"><dt>Dataset</dt><dd><a href="/sources/${esc(source.id)}">${esc(source.name)}</a></dd><dt>Status</dt><dd>${esc(item.status)}</dd><dt>File type</dt><dd>${esc(item.fileType ?? "Not recorded")}</dd><dt>Declared records</dt><dd>${item.recordCount ?? "Not recorded"}</dd><dt>Currently linked</dt><dd>${item.linkedFeatureCount}</dd><dt>Imported by</dt><dd>${esc(item.importedBy)}</dd><dt>Imported at</dt><dd>${esc(item.importedAt)}</dd><dt>Checksum</dt><dd class="checksum">${esc(item.checksum ?? "Not recorded")}</dd><dt>Diagnostics</dt><dd>${esc(item.errorSummary ?? "No errors recorded")}</dd></dl></section><div class="notice">This page identifies the exact import version. Historical check evidence retains its own snapshot even if the source metadata changes later.</div></main></body></html>`;
}
