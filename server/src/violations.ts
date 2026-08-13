import { query, queryOne } from "./db";
import { OverlapHit, ZoningAlert } from "./spatial";
import { config, RoadClass } from "./config";
import type { ConsultedSource } from "./check-evidence";

export type ViolationKind = "overlap" | "zoning";
export type ViolationStatus = "open" | "acknowledged" | "in_dispute" | "resolved" | "false_positive";
export type ViolationSeverity = "info" | "warning" | "critical";
export type CheckTrigger = "registration" | "recheck" | "zone_reimport";

export interface CheckRunInput {
  plotId: string;
  trigger: CheckTrigger;
  sourceUpload?: string | null;
  parseMethod?: string | null;
  confidence?: number | null;
  plotAreaSqm: number;
  overlaps: OverlapHit[];
  zoningAlerts: ZoningAlert[];
  consultedSources?: ConsultedSource[];
}

/** Records one spatial check execution and returns its id. */
export async function recordCheckRun(input: CheckRunInput): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO registry.check_runs
       (plot_id, trigger, source_upload, parse_method, confidence, plot_area_sqm, "overlaps", zoning_alerts, consulted_sources)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb)
     RETURNING id`,
    [
      input.plotId,
      input.trigger,
      input.sourceUpload ?? null,
      input.parseMethod ?? null,
      input.confidence ?? null,
      input.plotAreaSqm,
      JSON.stringify(input.overlaps),
      JSON.stringify(input.zoningAlerts),
      JSON.stringify(input.consultedSources ?? [])
    ]
  );
  return rows[0].id;
}

export function severityForOverlap(percent: number): ViolationSeverity {
  if (percent >= 75) return "critical";
  if (percent >= 25) return "warning";
  return "info";
}

export function severityForRoad(distanceM: number, zoneType: string | null): ViolationSeverity {
  const buffer = config.roadBuffersMeters[(zoneType ?? "").toLowerCase() as RoadClass] ?? 20;
  return distanceM <= buffer / 2 ? "critical" : "warning";
}

export function severityForReserve(areaSqm: number, plotAreaSqm: number): ViolationSeverity {
  if (plotAreaSqm > 0 && areaSqm / plotAreaSqm >= 0.75) return "critical";
  return "warning";
}

interface ViolationRef {
  kind: ViolationKind;
  otherPlotId: string | null;
  zoneId: number | null;
  zoneLayer: "roads" | "reserves" | null;
  zoneName: string | null;
  zoneType: string | null;
  distanceM: number | null;
  areaSqm: number | null;
  percent: number | null;
  severity: ViolationSeverity;
}

function snapshotOf(ref: ViolationRef, checkRunId: string): Record<string, unknown> {
  return {
    severity: ref.severity,
    distanceM: ref.distanceM,
    areaSqm: ref.areaSqm,
    percent: ref.percent,
    zoneName: ref.zoneName,
    zoneType: ref.zoneType,
    zoneLayer: ref.zoneLayer,
    checkRunId
  };
}

async function insertEvent(
  violationId: string,
  eventType: string,
  actor: string,
  reason: string | null,
  snapshot: Record<string, unknown>,
  checkRunId: string | null
): Promise<void> {
  await query(
    `INSERT INTO registry.violation_events (violation_id, event_type, actor, reason, snapshot, check_run_id)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [violationId, eventType, actor, reason ?? null, JSON.stringify(snapshot), checkRunId]
  );
}

/**
 * Idempotently reconciles the check results into the violations table:
 *  - new finding  → INSERT (status open, severity computed) + `detected` event
 *  - known finding → update current measurements + `measurement_changed` event;
 *                    a resolved/false-positive violation is reopened.
 * Returns the violation ids in the same order as the inputs.
 */
export async function upsertViolations(
  plotId: string,
  checkRunId: string,
  overlaps: OverlapHit[],
  zoningAlerts: ZoningAlert[],
  plotAreaSqm: number
): Promise<string[]> {
  const refs: ViolationRef[] = [
    ...overlaps.map(
      (o): ViolationRef => ({
        kind: "overlap",
        otherPlotId: o.plotId,
        zoneId: null,
        zoneLayer: null,
        zoneName: null,
        zoneType: null,
        distanceM: null,
        areaSqm: o.intersectionAreaSqm,
        percent: o.intersectionPercent,
        severity: severityForOverlap(o.intersectionPercent)
      })
    ),
    ...zoningAlerts.map(
      (a): ViolationRef => ({
        kind: "zoning",
        otherPlotId: null,
        zoneId: a.zoneId,
        zoneLayer: a.layer,
        zoneName: a.zoneName,
        zoneType: a.zoneType,
        distanceM: a.distanceM,
        areaSqm: a.intersectionAreaSqm,
        percent: null,
        severity:
          a.layer === "roads"
            ? severityForRoad(a.distanceM ?? Number.POSITIVE_INFINITY, a.zoneType)
            : severityForReserve(a.intersectionAreaSqm ?? 0, plotAreaSqm)
      })
    )
  ];

  const ids: string[] = [];
  for (const ref of refs) {
    const existing =
      ref.kind === "overlap"
        ? await queryOne<{ id: string; status: string }>(
            `SELECT id, status FROM registry.violations
              WHERE kind = 'overlap' AND plot_id = $1 AND other_plot_id = $2`,
            [plotId, ref.otherPlotId]
          )
        : await queryOne<{ id: string; status: string }>(
            `SELECT id, status FROM registry.violations
              WHERE kind = 'zoning' AND plot_id = $1
                AND zone_id IS NOT DISTINCT FROM $2
                AND zone_layer IS NOT DISTINCT FROM $3`,
            [plotId, ref.zoneId, ref.zoneLayer]
          );

    if (existing) {
      await query(
        `UPDATE registry.violations
            SET current_distance_m = $1, current_area_sqm = $2, current_percent = $3,
                severity = $4, last_checked_at = now(),
                status = CASE WHEN status IN ('resolved', 'false_positive') THEN 'open' ELSE status END,
                updated_at = now()
          WHERE id = $5`,
        [ref.distanceM, ref.areaSqm, ref.percent, ref.severity, existing.id]
      );
      await insertEvent(
        existing.id,
        "measurement_changed",
        "system:recheck",
        "Measurements updated after re-check",
        snapshotOf(ref, checkRunId),
        checkRunId
      );
      if (existing.status === "resolved" || existing.status === "false_positive") {
        await insertEvent(
          existing.id,
          "status_changed",
          "system:recheck",
          "Reopened: violation detected again",
          { status: "open" },
          null
        );
      }
      ids.push(existing.id);
    } else {
      const rows = await query<{ id: string }>(
        `INSERT INTO registry.violations
           (kind, plot_id, other_plot_id, zone_id, zone_layer, zone_name, zone_type,
            status, severity, current_distance_m, current_area_sqm, current_percent,
            first_detected_at, last_checked_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8, $9, $10, $11, now(), now())
         RETURNING id`,
        [
          ref.kind,
          plotId,
          ref.otherPlotId,
          ref.zoneId,
          ref.zoneLayer,
          ref.zoneName,
          ref.zoneType,
          ref.severity,
          ref.distanceM,
          ref.areaSqm,
          ref.percent
        ]
      );
      await insertEvent(
        rows[0].id,
        "detected",
        "system:registration",
        "Violation detected at plot registration",
        snapshotOf(ref, checkRunId),
        checkRunId
      );
      ids.push(rows[0].id);
    }
  }
  return ids;
}

export async function setViolationStatus(
  violationId: string,
  status: ViolationStatus,
  actor: string,
  reason?: string | null
): Promise<void> {
  const row = await queryOne<{ id: string }>(
    `UPDATE registry.violations
        SET status = $1, updated_at = now(),
            resolved_at = CASE WHEN $1 IN ('resolved', 'false_positive') THEN now() ELSE NULL END,
            resolution = $2
      WHERE id = $3
      RETURNING id`,
    [status, reason ?? null, violationId]
  );
  if (!row) throw new Error("Violation not found.");
  await insertEvent(
    violationId,
    "status_changed",
    actor,
    reason ?? `Status changed to ${status}`,
    { status },
    null
  );
}

export async function addViolationNote(
  violationId: string,
  note: string,
  actor: string
): Promise<void> {
  await insertEvent(violationId, "note", actor, note, {}, null);
}
