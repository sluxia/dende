import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const ASSET_CLASS = new Set(['forest_reserve','national_park','conservation_area','wetland','waterway_buffer','government_layout','government_estate','industrial_area','agricultural_scheme','public_institution','transport_right_of_way','utility_right_of_way','planning_zone','strategic_land','acquired_land','revoked_land','cadastral_block','other']);
const LEGAL_STATUS = new Set(['reported','declared','gazetted','acquired','revoked','superseded','unknown']);
const GEOMETRY_STATUS = new Set(['unavailable','located','extracting','candidate','valid','rejected']);
const ACQUISITION_STATUS = new Set(['not_started','source_found','file_found','downloaded','access_required','under_review','complete','blocked']);
const VISIBILITY = new Set(['public','internal','hidden']);
const SOURCE_TYPE = new Set(['road','reserve','cadastral','user_plot','survey','other']);
const AUTHORITY_LEVEL = new Set(['official','open_data','commercial','user_submitted','internal_test']);
const SOURCE_STATUS = new Set(['planned','active','partial','stale','test','archived']);
const COVERAGE_STATUS = new Set(['complete','partial','stale','unavailable','test_only']);
const ACCESS_STAGE = new Set(['authority_identified','portal_found','access_required','dataset_found','under_review','usable','unavailable']);

const REQUIRED_ASSET = ['external_key','asset_name','asset_class','legal_status','geometry_status','acquisition_status','risk_priority','alternate_names','visibility'];
const REQUIRED_SOURCE = ['type','name','admin_level_1','authority_level','status','coverage_status','access_stage','access_reviewed_at'];

export class ValidationError extends Error {}

export function validateAssets(assets: unknown): Record<string, unknown>[] {
  if (!Array.isArray(assets)) throw new ValidationError('"assets" must be an array');
  const out: Record<string, unknown>[] = [];
  for (const [i, a] of assets.entries()) {
    if (typeof a !== 'object' || a === null) throw new ValidationError(`assets[${i}] not an object`);
    const row = a as Record<string, unknown>;
    for (const k of REQUIRED_ASSET) {
      if (row[k] === undefined || row[k] === null) throw new ValidationError(`assets[${i}] missing required key "${k}"`);
    }
    for (const k of Object.keys(row)) {
      if (!REQUIRED_ASSET.includes(k) && !['authority_name','admin_level_2','locality','instrument_reference','survey_reference','stated_area_sqm','source_url','file_url','missing_material','next_action','evidence_notes','risk_reason'].includes(k)) {
        throw new ValidationError(`assets[${i}] unknown key "${k}"`);
      }
    }
    if (!ASSET_CLASS.has(String(row.asset_class))) throw new ValidationError(`assets[${i}] bad asset_class "${row.asset_class}"`);
    if (!LEGAL_STATUS.has(String(row.legal_status))) throw new ValidationError(`assets[${i}] bad legal_status "${row.legal_status}"`);
    if (!GEOMETRY_STATUS.has(String(row.geometry_status))) throw new ValidationError(`assets[${i}] bad geometry_status "${row.geometry_status}"`);
    if (!ACQUISITION_STATUS.has(String(row.acquisition_status))) throw new ValidationError(`assets[${i}] bad acquisition_status "${row.acquisition_status}"`);
    if (!VISIBILITY.has(String(row.visibility))) throw new ValidationError(`assets[${i}] bad visibility "${row.visibility}"`);
    if (!Number.isInteger(row.risk_priority) || Number(row.risk_priority) < 1 || Number(row.risk_priority) > 3) {
      throw new ValidationError(`assets[${i}] risk_priority must be 1,2,3`);
    }
    if (row.stated_area_sqm !== undefined && row.stated_area_sqm !== null) {
      const v = Number(row.stated_area_sqm);
      if (!Number.isFinite(v) || v <= 0) throw new ValidationError(`assets[${i}] stated_area_sqm invalid: ${row.stated_area_sqm}`);
    }
    if (!Array.isArray(row.alternate_names)) throw new ValidationError(`assets[${i}] alternate_names must be an array`);
    if (typeof row.asset_name !== 'string' || !row.asset_name.trim()) throw new ValidationError(`assets[${i}] asset_name must be non-empty string`);
    out.push({ ...row, stated_area_sqm: row.stated_area_sqm === undefined || row.stated_area_sqm === null ? null : Number(row.stated_area_sqm) });
  }
  return out;
}

export function validateSources(sources: unknown): Record<string, unknown>[] {
  if (!Array.isArray(sources)) throw new ValidationError('"target_sources" must be an array');
  const out: Record<string, unknown>[] = [];
  for (const [i, s] of sources.entries()) {
    if (typeof s !== 'object' || s === null) throw new ValidationError(`target_sources[${i}] not an object`);
    const row = s as Record<string, unknown>;
    for (const k of REQUIRED_SOURCE) {
      if (row[k] === undefined || row[k] === null) throw new ValidationError(`target_sources[${i}] missing required key "${k}"`);
    }
    for (const k of Object.keys(row)) {
      if (!REQUIRED_SOURCE.includes(k) && !['provider','admin_level_2','format','source_url','license','access_method','access_contact','access_notes','description'].includes(k)) {
        throw new ValidationError(`target_sources[${i}] unknown key "${k}"`);
      }
    }
    if (!SOURCE_TYPE.has(String(row.type))) throw new ValidationError(`target_sources[${i}] bad type "${row.type}"`);
    if (!AUTHORITY_LEVEL.has(String(row.authority_level))) throw new ValidationError(`target_sources[${i}] bad authority_level "${row.authority_level}"`);
    if (!SOURCE_STATUS.has(String(row.status))) throw new ValidationError(`target_sources[${i}] bad status "${row.status}"`);
    if (!COVERAGE_STATUS.has(String(row.coverage_status))) throw new ValidationError(`target_sources[${i}] bad coverage_status "${row.coverage_status}"`);
    if (!ACCESS_STAGE.has(String(row.access_stage))) throw new ValidationError(`target_sources[${i}] bad access_stage "${row.access_stage}"`);
    if (typeof row.name !== 'string' || !row.name.trim()) throw new ValidationError(`target_sources[${i}] name must be non-empty string`);
    out.push(row);
  }
  return out;
}

export function validateOutput(data: unknown): { state: string; assets: Record<string, unknown>[]; sources: Record<string, unknown>[] } {
  if (typeof data !== 'object' || data === null) throw new ValidationError('output must be a JSON object');
  const d = data as Record<string, unknown>;
  const state = String(d.state ?? '').trim();
  if (!state) throw new ValidationError('missing "state"');
  const assets = validateAssets(d.assets);
  const sources = validateSources(d.target_sources);
  const seen = new Set<string>();
  for (const a of assets) {
    const key = String(a.external_key);
    if (!/^[a-z]{2,6}-asset-[a-z0-9-]+$/.test(key)) throw new ValidationError(`bad external_key "${key}" (expected {state}-asset-slug)`);
    if (!key.startsWith(`${state}-asset-`)) throw new ValidationError(`external_key "${key}" does not start with "${state}-asset-"`);
    if (seen.has(key)) throw new ValidationError(`duplicate external_key "${key}"`);
    seen.add(key);
  }
  return { state, assets, sources };
}

export function toSqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${String(v).replace(/'/g, "''")}'`;
}

export function toSqlArray(arr: unknown[]): string {
  if (arr.length === 0) return `ARRAY[]::text[]`;
  const lit = arr.map((x) => toSqlLiteral(x)).join(',');
  return `ARRAY[${lit}]`;
}

export function generateMigration(state: string, assets: Record<string, unknown>[], sources: Record<string, unknown>[], sequence = 7): string {
  const stateKey = state.toLowerCase().replace(/[^a-z]/g, '');
  const campaign = `ng-${stateKey}-spatial-v1`;
  const assetCols = ['external_key','asset_name','alternate_names','asset_class','authority_name','admin_level_2','locality','legal_status','instrument_reference','survey_reference','stated_area_sqm','source_url','file_url','geometry_status','acquisition_status','missing_material','next_action','evidence_notes','risk_priority','risk_reason','visibility'];
  const assetRows = assets.map((a) => `(${assetCols.map((c) => {
    const v = a[c];
    if (c === 'alternate_names') return toSqlArray((v as unknown[]) ?? []);
    return toSqlLiteral(v ?? null);
  }).join(',')})`).join(',\n  ');
  const sourceCols = ['type','name','provider','admin_level_1','admin_level_2','format','source_url','license','authority_level','status','coverage_status','access_stage','access_method','access_contact','access_notes','access_reviewed_at','description'];
  const sourceRows = sources.map((s) => `(${sourceCols.map((c) => toSqlLiteral(s[c] ?? null)).join(',')})`).join(',\n  ');

  return `-- Up Migration

WITH src AS (
  INSERT INTO provenance.data_sources (${sourceCols.map((c) => `"${c}"`).join(', ')})
  VALUES
  ${sourceRows}
  RETURNING id, name
),
camp AS (
  INSERT INTO provenance.spatial_acquisition_campaigns
    (external_key, country_code, admin_level_1, scope, procedure_version, sequence_number, status, current_stage, started_at)
  SELECT '${campaign}', 'NG', '${state}', 'state', '1.0', ${sequence}, 'inventory', 'authoritative_sources', now()
  ON CONFLICT (external_key) DO UPDATE SET updated_at = now()
  RETURNING id, external_key
)
INSERT INTO provenance.spatial_asset_inventory (
  campaign_id, external_key, asset_name, alternate_names, asset_class,
  authority_name, country_code, admin_level_1, admin_level_2, locality,
  legal_status, instrument_reference, survey_reference, stated_area_sqm,
  source_url, file_url, geometry_status, check_status, acquisition_status,
  missing_material, next_action, evidence_notes, risk_priority, risk_reason,
  processing_status, visibility
)
SELECT c.id, v.external_key, v.asset_name, v.alternate_names, v.asset_class,
  v.authority_name, 'NG', '${state}', v.admin_level_2, v.locality,
  v.legal_status, v.instrument_reference, v.survey_reference, v.stated_area_sqm,
  v.source_url, v.file_url, v.geometry_status, 'excluded', v.acquisition_status,
  v.missing_material, v.next_action, v.evidence_notes, v.risk_priority, v.risk_reason,
  'queued', v.visibility
FROM camp c
JOIN (VALUES
  ${assetRows}
) AS v(${assetCols.join(', ')}) ON true;

-- Down Migration
DELETE FROM provenance.spatial_asset_inventory
WHERE campaign_id = (SELECT id FROM provenance.spatial_acquisition_campaigns WHERE external_key = '${campaign}');
DELETE FROM provenance.spatial_acquisition_campaigns WHERE external_key = '${campaign}';
`;
}

function main(): void {
  const file = process.argv[2];
  const outPrefix = process.argv[3];
  if (!file || !outPrefix) {
    console.error('usage: tsx scripts/ingest-research-output.ts <agent-output.json> <out-prefix>');
    process.exit(1);
  }
  const raw = readFileSync(file, 'utf8').trim();
  const cleaned = raw.replace(/^```(json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const data = JSON.parse(cleaned) as unknown;
  const { state, assets, sources } = validateOutput(data);
  const migration = generateMigration(state, assets, sources);
  const outFile = `${outPrefix}-ingest-${state.toLowerCase()}.sql`;
  writeFileSync(outFile, migration);
  console.log(`validated ${assets.length} assets, ${sources.length} sources for ${state}`);
  console.log(`wrote ${basename(outFile)}`);
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/ingest-research-output.ts');
if (isMain) {
  void main();
}
