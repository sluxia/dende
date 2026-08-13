import { query } from "./db";

export type CoverageStatus = "complete" | "partial" | "stale" | "unavailable" | "test_only";

export interface ConsultedImport {
  id: string;
  filename: string | null;
  fileType: string | null;
  status: string;
  importedAt: string;
  featureCount: number;
}

export interface ConsultedSource {
  id: string;
  type: string;
  name: string;
  provider: string | null;
  authorityLevel: string;
  coverageStatus: CoverageStatus;
  geography: string;
  imports: ConsultedImport[];
  unversionedFeatureCount: number;
}

interface EvidenceRow {
  id: string;
  type: string;
  name: string;
  provider: string | null;
  authority_level: string;
  coverage_status: CoverageStatus;
  country_code: string | null;
  admin_level_1: string | null;
  admin_level_2: string | null;
  import_id: string | null;
  filename: string | null;
  file_type: string | null;
  import_status: string | null;
  imported_at: string | null;
  feature_count: number;
}

/**
 * Snapshots every populated source/import represented in the tables queried by
 * the spatial checker. This intentionally records source metadata at check time
 * so later source edits cannot rewrite the evidence attached to an old result.
 */
export async function collectConsultedSources(): Promise<ConsultedSource[]> {
  const rows = await query<EvidenceRow>(
    `WITH feature_refs AS (
       SELECT source_id, import_id, count(*)::int AS feature_count
         FROM registry.plots WHERE source_id IS NOT NULL GROUP BY source_id, import_id
       UNION ALL
       SELECT source_id, import_id, count(*)::int AS feature_count
         FROM zones.roads WHERE source_id IS NOT NULL GROUP BY source_id, import_id
       UNION ALL
       SELECT source_id, import_id, count(*)::int AS feature_count
         FROM zones.reserves WHERE source_id IS NOT NULL GROUP BY source_id, import_id
     ), grouped AS (
       SELECT source_id, import_id, sum(feature_count)::int AS feature_count
         FROM feature_refs GROUP BY source_id, import_id
     )
     SELECT s.id, s.type, s.name, s.provider, s.authority_level, s.coverage_status,
            s.country_code, s.admin_level_1, s.admin_level_2,
            i.id AS import_id, i.filename, i.file_type, i.status AS import_status,
            i.imported_at::text, g.feature_count
       FROM grouped g
       JOIN provenance.data_sources s ON s.id = g.source_id
       LEFT JOIN provenance.data_imports i ON i.id = g.import_id
      WHERE s.status <> 'planned' AND s.coverage_status <> 'unavailable'
      ORDER BY s.type, s.name, i.imported_at NULLS LAST`
  );

  const grouped = new Map<string, ConsultedSource>();
  for (const row of rows) {
    let source = grouped.get(row.id);
    if (!source) {
      source = {
        id: row.id,
        type: row.type,
        name: row.name,
        provider: row.provider,
        authorityLevel: row.authority_level,
        coverageStatus: row.coverage_status,
        geography: [row.country_code, row.admin_level_1, row.admin_level_2].filter(Boolean).join(" · ") || "Coverage not specified",
        imports: [],
        unversionedFeatureCount: 0
      };
      grouped.set(row.id, source);
    }
    if (row.import_id && row.imported_at) {
      source.imports.push({
        id: row.import_id,
        filename: row.filename,
        fileType: row.file_type,
        status: row.import_status ?? "unknown",
        importedAt: row.imported_at,
        featureCount: row.feature_count
      });
    } else {
      source.unversionedFeatureCount += row.feature_count;
    }
  }
  return [...grouped.values()];
}
