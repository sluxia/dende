import Fastify, { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { config, RoadClass } from "./config";
import { query, queryOne, ping } from "./db";
import { registerPlot, registerPlotFromCoordinates, RegistrationError, saveUpload } from "./registration";
import { runSpatialChecks } from "./spatial";
import { recordCheckRun, upsertViolations, setViolationStatus, addViolationNote } from "./violations";
import { renderViolationPageHtml, ViolationEvent, CheckRun } from "./violation-page";
import { renderViewerHtml, ViewerPlot, ViewerOverlap } from "./viewer";
import { fetchZoneLayers } from "./zones";
import { renderInputPageHtml } from "./input-page";
import { renderSourcesPageHtml, SourceSummary, SpatialAssetSummary } from "./sources-page";
import { renderProtectPageHtml } from "./protect-page";
import { ImportDetail, renderImportDetailHtml, renderSourceDetailHtml, SourceDetail } from "./source-detail-page";
import { createOwnershipNotice, noticesForPlots, ownershipHistoryForNotices, createOwnershipRequest, publicRequestsForNotice, withdrawOwnershipNotice, OwnershipNotice } from "./ownership";
import { renderOwnershipPageHtml } from "./ownership-page";
import { collectConsultedSources, ConsultedSource } from "./check-evidence";
import { EvidenceDocument, LandEvidenceDetail, LandEvidenceSummary, renderResearchDetailHtml, renderResearchPageHtml } from "./research-page";
import { CRS_NAMES } from "@sluxia/dende-core";
import { ingestAnalysis, AnalysisIngestionInput } from "./analysis-ingestion";
import { createEvidenceReport, fetchEvidenceReport, renderEvidenceReportHtml } from "./reports";
import { createAccount, loginAccount, currentAccount, logoutAccount, parseSessionCookie, sessionCookie, clearSessionCookie, issueChallenge, verifyEmail, resetPassword } from "./accounts";
import { renderAccountPage, renderAuthPage } from "./account-page";
import { renderTopNav, TOP_NAV_CSS } from "./nav";
import { renderRecoveryRequestPage, renderTokenPage } from "./recovery-page";
import { createOrganization, organizationsForUser, inviteMember, acceptInvitation, transferPlotToOrganization } from "./organizations";
import { staffProfile, systemAccessFor, SystemPermission } from "./staff-auth";
import { completeReservation, creditsForUser, releaseExpiredReservations, reserveUserCredits } from "./credits";
import { publicCatalog } from "./catalog";
import { acceptedLocales, messagesForLocale, resolveLocale, updateUserPreferences } from "./localization";
import { createPricedOrder, ordersForUser } from "./commerce";
import {
  PlotMapAlert,
  PlotMapData,
  PlotMapOverlap,
  renderPlotMapHtml
} from "./plot-map";

interface PlotRow {
  id: string;
  status: string;
  method: string | null;
  confidence: number | null;
  crs: string | null;
  computed_area_sqm: number | null;
  printed_area_sqm: number | null;
  source_file: string | null;
  created_at: string;
  geometry: { type: string; coordinates: unknown };
  raw_vertices: Array<{ beaconId: string; easting: number; northing: number }> | null;
}

function toPlotGeoJson(row: PlotRow) {
  return {
    id: row.id,
    status: row.status,
    method: row.method,
    confidence: row.confidence,
    crs: row.crs,
    computedAreaSqm: row.computed_area_sqm,
    printedAreaSqm: row.printed_area_sqm,
    sourceFile: row.source_file,
    createdAt: row.created_at,
    geometry: row.geometry
  };
}

function isGeoJsonGeometry(value: unknown): value is { type: "Polygon" | "MultiPolygon"; coordinates: unknown } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { type?: unknown; coordinates?: unknown };
  return (
    (v.type === "Polygon" || v.type === "MultiPolygon") &&
    Array.isArray(v.coordinates) &&
    v.coordinates.length > 0
  );
}

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.register(multipart, {
    limits: { fileSize: config.maxUploadBytes, files: 1 }
  });

  app.addHook("onError", async (request, reply, error) => {
    if (error instanceof RegistrationError) {
      reply.code(error.statusCode).send({ error: error.message });
      return;
    }
  });

  app.get("/api/health", async () => {
    await ping();
    return { status: "ok", database: "up" };
  });

  const requireInternal = async (request: Parameters<typeof systemAccessFor>[0], reply: { code: (status: number) => { send: (body: unknown) => unknown } },permission:SystemPermission):Promise<boolean> => {
    const access=await systemAccessFor(request,permission);
    if(access.allowed)return true;
    reply.code(access.statusCode??403).send({error:access.error});
    return false;
  };

  /** Worker queue: assets discovered across every enabled file family but not yet acquired. */
  app.get("/api/internal/intelligence/assets/queue", async (request, reply) => {
    if(!await requireInternal(request,reply,"intelligence.write"))return;
    const assets = await query(
      `SELECT a.external_key AS "assetExternalKey",a.file_url AS "fileUrl",a.discovered_from_url AS "discoveredFromUrl",
              a.filename,a.format_family AS "formatFamily",a.file_extension AS "fileExtension",a.media_type AS "mediaType",
              a.acquisition_status AS "acquisitionStatus",a.extraction_status AS "extractionStatus",a.metadata
         FROM intelligence.document_assets a
        JOIN intelligence.discovery_profiles p ON p.format_family=a.format_family AND p.enabled
        WHERE a.acquisition_status IN ('discovered','queued')
        ORDER BY p.priority,a.discovered_at
        LIMIT 50`
    );
    return { assets };
  });

  /** Geometry-first campaign queue. Inventory closes before workers claim one asset at a time. */
  app.get<{Querystring:{campaign?:string;limit?:string}}>("/api/internal/spatial-assets/queue", async (request, reply) => {
    if(!await requireInternal(request,reply,"intelligence.write"))return;
    const campaign=request.query.campaign??'ng-cross-river-spatial-rerun-v1';
    const limit=Math.max(1,Math.min(25,Number(request.query.limit)||1));
    const campaignRow=await queryOne<{status:string;current_stage:string}>(`SELECT status,current_stage FROM provenance.spatial_acquisition_campaigns WHERE external_key=$1`,[campaign]);
    if(!campaignRow)return reply.code(404).send({error:'Campaign not found'});
    const assets=await query(
      `SELECT a.external_key AS "externalKey",a.asset_name AS "assetName",a.alternate_names AS "alternateNames",
              a.asset_class AS "assetClass",a.authority_name AS "authorityName",a.admin_level_2 AS "adminLevel2",a.locality,
              a.legal_status AS "legalStatus",a.source_url AS "sourceUrl",a.risk_priority AS "riskPriority",
              a.risk_reason AS "riskReason",a.processing_status AS "processingStatus",a.acquisition_status AS "acquisitionStatus",
              a.missing_material AS "missingMaterial",a.next_action AS "nextAction"
         FROM provenance.spatial_asset_inventory a
         JOIN provenance.spatial_acquisition_campaigns c ON c.id=a.campaign_id
        WHERE c.external_key=$1 AND a.processing_status='queued'
        ORDER BY a.risk_priority,a.created_at,a.asset_name LIMIT $2`,[campaign,limit]);
    return {campaign,status:campaignRow.status,currentStage:campaignRow.current_stage,inventoryOpen:campaignRow.current_stage==='government_inventory',assets};
  });

  /** Discovery intake used by a crawler/research worker; storing a URL does not make it evidence. */
  app.post("/api/internal/intelligence/assets/discover", async (request, reply) => {
    if(!await requireInternal(request,reply,"intelligence.write"))return;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const required = ["externalKey","fileUrl","formatFamily"] as const;
    for (const field of required) if (typeof body[field] !== "string" || !(body[field] as string).trim()) return reply.code(400).send({ error: `${field} is required.` });
    const profile = await queryOne<{id:string}>(`SELECT id FROM intelligence.discovery_profiles WHERE format_family=$1 AND enabled`,[body.formatFamily]);
    if (!profile) return reply.code(400).send({ error: "Unsupported or disabled formatFamily." });
    const row = await queryOne<{id:string;external_key:string}>(
      `INSERT INTO intelligence.document_assets(external_key,discovered_from_url,file_url,filename,format_family,file_extension,media_type,metadata)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT(external_key) DO UPDATE SET
         discovered_from_url=COALESCE(intelligence.document_assets.discovered_from_url,EXCLUDED.discovered_from_url),
         metadata=intelligence.document_assets.metadata || EXCLUDED.metadata
       RETURNING id,external_key`,
      [body.externalKey,(body.discoveredFromUrl as string|undefined)??null,body.fileUrl,(body.filename as string|undefined)??null,body.formatFamily,(body.fileExtension as string|undefined)??null,(body.mediaType as string|undefined)??null,JSON.stringify(body.metadata??{})]
    );
    return reply.code(201).send({ id: row!.id, assetExternalKey: row!.external_key });
  });

  /** Records acquisition without accepting file bytes; durable object storage remains the worker's responsibility. */
  app.patch<{Params:{externalKey:string}}>("/api/internal/intelligence/assets/:externalKey/acquisition", async (request, reply) => {
    if(!await requireInternal(request,reply,"intelligence.write"))return;
    const body = (request.body ?? {}) as Record<string, unknown>;
    if (!['queued','downloaded','failed','blocked'].includes(String(body.status))) return reply.code(400).send({ error: "Invalid acquisition status." });
    const row = await queryOne<{id:string}>(
      `UPDATE intelligence.document_assets SET acquisition_status=$2,checksum_sha256=COALESCE($3,checksum_sha256),
              storage_uri=COALESCE($4,storage_uri),byte_size=COALESCE($5,byte_size),media_type=COALESCE($6,media_type),
              acquired_at=CASE WHEN $2='downloaded' THEN now() ELSE acquired_at END,
              metadata=metadata || $7::jsonb
        WHERE external_key=$1 RETURNING id`,
      [request.params.externalKey,body.status,(body.checksumSha256 as string|undefined)??null,(body.storageUri as string|undefined)??null,(body.byteSize as number|undefined)??null,(body.mediaType as string|undefined)??null,JSON.stringify(body.metadata??{})]
    );
    if (!row) return reply.code(404).send({ error: "Asset not found" });
    return { ok:true };
  });

  /** Receives a completed, versioned model analysis and persists every coordinate with provenance. */
  app.post("/api/internal/intelligence/analyses", async (request, reply) => {
    if(!await requireInternal(request,reply,"intelligence.write"))return;
    try {
      const result = await ingestAnalysis(request.body as AnalysisIngestionInput);
      return reply.code(result.created ? 201 : 200).send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysis ingestion failed";
      if (message === "Asset not found") return reply.code(404).send({ error: message });
      return reply.code(400).send({ error: message });
    }
  });

  /** Human-review queue. Candidates remain excluded from spatial checks until explicitly validated. */
  app.get("/api/internal/intelligence/review-queue", async (request, reply) => {
    if(!await requireInternal(request,reply,"intelligence.review"))return;
    const candidates = await query(
      `SELECT gc.id,gc.external_key AS "externalKey",gc.method,gc.source_crs AS "sourceCrs",gc.confidence,
              gc.validation_status AS "validationStatus",gc.check_eligible AS "checkEligible",
              CASE WHEN gc.geometry IS NULL THEN NULL ELSE ST_AsGeoJSON(gc.geometry)::jsonb END AS geometry,
              ar.external_key AS "analysisExternalKey",a.external_key AS "assetExternalKey",a.file_url AS "fileUrl",
              count(gco.numeric_observation_id)::int AS "observationCount"
         FROM intelligence.geometry_candidates gc
         JOIN intelligence.geometry_candidate_observations gco ON gco.geometry_candidate_id=gc.id
         JOIN intelligence.numeric_observations no ON no.id=gco.numeric_observation_id
         JOIN intelligence.analysis_runs ar ON ar.id=no.analysis_run_id
         JOIN intelligence.document_assets a ON a.id=ar.asset_id
        WHERE gc.validation_status='unreviewed'
        GROUP BY gc.id,ar.external_key,a.external_key,a.file_url
        ORDER BY gc.created_at`
    );
    return { candidates };
  });

  /** Interactive registry viewer — every registered plot on one map. */
  app.get("/", async (request, reply) => {
    const rows = await query<{
      id: string;
      status: string;
      method: string | null;
      confidence: number | null;
      crs: string | null;
      computed_area_sqm: number | null;
      source_file: string | null;
      record_type: string;
      center_lat: number;
      center_lon: number;
      created_at: string;
      raw_vertices: ViewerPlot["rawVertices"];
      geometry: { type: string; coordinates: unknown };
      overlap_count: number;
      alert_count: number;
    }>(
      `SELECT p.id, p.status, p.method, p.confidence, p.crs, p.computed_area_sqm,
              p.source_file, p.record_type,
              ST_Y(ST_PointOnSurface(p.geometry)) AS center_lat,
              ST_X(ST_PointOnSurface(p.geometry)) AS center_lon,
              p.created_at, p.raw_vertices,
              ST_AsGeoJSON(p.geometry)::jsonb AS geometry,
              (SELECT count(*)::int FROM registry.violations v
                WHERE v.plot_id = p.id AND v.kind = 'overlap' AND v.status <> 'false_positive') AS overlap_count,
              (SELECT count(*)::int FROM registry.violations v
                WHERE v.plot_id = p.id AND v.kind = 'zoning' AND v.status <> 'false_positive') AS alert_count
         FROM registry.plots p
         ORDER BY p.created_at DESC`
    );
    const [overlaps, zones] = await Promise.all([
      query<{
        plot_id: string;
        other_plot_id: string;
        intersection_area_sqm: number;
        intersection_percent: number;
        violation_id: string;
        status: string;
        geometry: { type: string; coordinates: unknown };
      }>(
        `SELECT v.plot_id, v.other_plot_id,
                v.current_area_sqm AS intersection_area_sqm,
                v.current_percent AS intersection_percent,
                v.id AS violation_id, v.status,
                ST_AsGeoJSON(ST_Intersection(p.geometry, q.geometry))::jsonb AS geometry
           FROM registry.violations v
           JOIN registry.plots p ON p.id = v.plot_id
           JOIN registry.plots q ON q.id = v.other_plot_id
          WHERE v.kind = 'overlap' AND v.status <> 'false_positive'`
      ),
      fetchZoneLayers()
    ]);

    const html = renderViewerHtml(
      rows.map((r) => ({
        id: r.id,
        status: r.status,
        method: r.method,
        confidence: r.confidence,
        crs: r.crs,
        computedAreaSqm: r.computed_area_sqm,
        sourceFile: r.source_file,
        recordType: r.record_type,
        centerLat: r.center_lat,
        centerLon: r.center_lon,
        createdAt: r.created_at,
        geometry: r.geometry,
        rawVertices: r.raw_vertices,
        overlapCount: r.overlap_count,
        alertCount: r.alert_count
      })),
      overlaps.map((o): ViewerOverlap => ({
        plotId: o.plot_id,
        otherPlotId: o.other_plot_id,
        intersectionAreaSqm: o.intersection_area_sqm,
        intersectionPercent: o.intersection_percent,
        violationId: o.violation_id,
        status: o.status,
        geometry: o.geometry
      })),
      zones
    );
    reply.header("content-type", "text/html; charset=utf-8");
    return reply.send(html);
  });

  /**
   * Register a plot from an uploaded survey plan scan. Runs the full parser
   * pipeline, persists the plot, then reports overlap + zoning checks.
   * ?allowLowConfidence=true registers best-effort (failed) parses.
   */
  app.post("/api/plots", async (request, reply) => {
    const account=await currentAccount(parseSessionCookie(request.headers.cookie));
    if(!account)return reply.code(401).send({error:"Sign in to scan and check a survey plan."});
    if(account.emailVerificationStatus!=="verified")return reply.code(403).send({error:"Verify your email before running a scan check."});
    const idempotencyKey=String(request.headers["idempotency-key"]??"").trim();
    if(!idempotencyKey)return reply.code(400).send({error:"An Idempotency-Key header is required."});
    const { allowLowConfidence } = request.query as { allowLowConfidence?: string };
    if (!request.isMultipart()) {
      return reply.code(400).send({ error: "Expected multipart/form-data upload." });
    }
    let data;
    try {
      data = await request.file();
    } catch {
      return reply.code(400).send({ error: "Could not read multipart upload." });
    }
    if (!data) {
      return reply.code(400).send({ error: "Multipart field 'image' is required." });
    }
    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
    } catch {
      return reply.code(413).send({ error: `Upload exceeds the ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB limit.` });
    }
    if (buffer.length === 0) {
      return reply.code(400).send({ error: "Uploaded file is empty." });
    }
    const filePath = await saveUpload(buffer, data.filename ?? "scan.png");

    let reservation:{id:string;quantity:number;productKey:string};
    try{reservation=await reserveUserCredits({userId:account.id,productKey:"survey-plan-scan-check",relatedReference:data.filename??undefined,idempotencyKey:`scan:${account.id}:${idempotencyKey}`});}
    catch(error){return reply.code(error instanceof Error&&error.message==="Insufficient credits."?402:403).send({error:error instanceof Error?error.message:"Credit reservation failed."});}
    let result;
    try {
      result = await registerPlot(filePath, {
        sourceFile: data.filename ?? null,
        allowLowConfidence: allowLowConfidence === "true",
        ownerUserId: account?.id ?? null
      });
    } catch (error) {
      await completeReservation(reservation.id,"release",`release:${reservation.id}`);
      if (error instanceof RegistrationError) {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
    await completeReservation(reservation.id,"consume",`consume:${reservation.id}`);
    return reply.code(201).send({...result,creditCharge:{quantity:reservation.quantity,productKey:reservation.productKey}});
  });

  /** Runs overlap + zoning checks against an already-converted GeoJSON geometry. */
  app.post("/api/plots/validate", async (request, reply) => {
    const body = request.body as { geometry?: unknown } | unknown;
    const geometry =
      (typeof body === "object" && body !== null && (body as { geometry?: unknown }).geometry) ?? body;
    if (!isGeoJsonGeometry(geometry)) {
      return reply
        .code(400)
        .send({ error: "Body must be a Polygon/MultiPolygon GeoJSON geometry or { geometry: ... }." });
    }
    const checks = await runSpatialChecks(JSON.stringify(geometry));
    return { ...checks, consultedSources: await collectConsultedSources() };
  });

  /**
   * Checks and optionally registers a plot entered as boundary-corner
   * coordinates. Body: { vertices: [[x,y], ...], crs, register?, label? }.
   * Vertices are [easting, northing] in `crs` (for WGS84 GPS input that is
   * [longitude, latitude] with crs "EPSG:4326"). When register=true the plot
   * is persisted exactly like an image-scan registration.
   */
  app.post("/api/plots/from-coordinates", async (request, reply) => {
    const account=await currentAccount(parseSessionCookie(request.headers.cookie));
    const body = (request.body ?? {}) as {
      vertices?: unknown;
      crs?: unknown;
      register?: unknown;
      label?: unknown;
      protect?: unknown;
      submitterName?: unknown;
      contactReference?: unknown;
      statement?: unknown;
      visibility?: unknown;
    };
    const crs = typeof body.crs === "string" && body.crs in CRS_NAMES ? body.crs : null;
    if (!crs) {
      return reply.code(400).send({ error: `crs must be one of: ${Object.keys(CRS_NAMES).join(", ")}` });
    }
    if (!Array.isArray(body.vertices) || body.vertices.length < 3) {
      return reply.code(400).send({ error: "vertices must be an array of at least 3 [x, y] pairs." });
    }
    const vertices = body.vertices.map((v) => {
      if (Array.isArray(v) && v.length >= 2 && v.slice(0, 2).every((n) => typeof n === "number")) {
        return [v[0], v[1]] as [number, number];
      }
      return null;
    });
    if (vertices.some((v) => v === null)) {
      return reply.code(400).send({ error: "Each vertex must be an [x, y] pair of numbers." });
    }

    const isProtection=body.protect===true;
    let reservation:{id:string;quantity:number;productKey:string}|null=null;
    if(!isProtection){
      if(!account)return reply.code(401).send({error:"Sign in to run a preliminary plot check."});
      if(account.emailVerificationStatus!=="verified")return reply.code(403).send({error:"Verify your email before running a plot check."});
      const idempotencyKey=String(request.headers["idempotency-key"]??"").trim();
      if(!idempotencyKey)return reply.code(400).send({error:"An Idempotency-Key header is required."});
      try{reservation=await reserveUserCredits({userId:account.id,productKey:"manual-preliminary-check",relatedReference:typeof body.label==="string"?body.label:undefined,idempotencyKey:`manual:${account.id}:${idempotencyKey}`});}
      catch(error){return reply.code(error instanceof Error&&error.message==="Insufficient credits."?402:403).send({error:error instanceof Error?error.message:"Credit reservation failed."});}
    }

    try {
      const result = await registerPlotFromCoordinates(
        vertices as [number, number][],
        crs as never,
        {
          register: body.register === true || body.register === "true",
          label: typeof body.label === "string" && body.label.length > 0 ? body.label : undefined,
          recordType: body.protect === true ? "ownership_notice" : "manual_submission",
          ownerUserId: account?.id ?? null
        }
      );
      let ownershipNotice = null;
      if (body.protect === true && result.plot) {
        const visibility = ["public", "limited", "private"].includes(String(body.visibility))
          ? String(body.visibility) as "public" | "limited" | "private"
          : "public";
        ownershipNotice = await createOwnershipNotice({
          plotId: result.plot.id,
          submitterName: typeof body.submitterName === "string" ? body.submitterName.slice(0, 160) : null,
          contactReference: typeof body.contactReference === "string" ? body.contactReference.slice(0, 240) : null,
          statement: typeof body.statement === "string" ? body.statement.slice(0, 1000) : null,
          visibility,
          ownerUserId: account?.id ?? null
        });
      }
      const overlapOwnershipNotices = await noticesForPlots(result.overlaps.map((overlap) => overlap.plotId));
      if(reservation)await completeReservation(reservation.id,"consume",`consume:${reservation.id}`);
      return reply.code(result.registered ? 201 : 200).send({
        ...result,
        ownershipNotice,
        overlapOwnershipNotices,
        creditCharge:reservation?{quantity:reservation.quantity,productKey:reservation.productKey}:null
      });
    } catch (error) {
      if(reservation)await completeReservation(reservation.id,"release",`release:${reservation.id}`);
      if (error instanceof RegistrationError) {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });

  /** Interactive input page: upload a survey plan scan or enter coordinates. */
  app.get("/check", async (request, reply) => {
    const zones = await fetchZoneLayers();
    const html = renderInputPageHtml(zones);
    reply.header("content-type", "text/html; charset=utf-8");
    return reply.send(html);
  });

  async function fetchSourceSummaries(): Promise<SourceSummary[]> {
    const rows = await query<{
      id: string; type: string; name: string; provider: string | null;
      country_code: string | null; admin_level_1: string | null; admin_level_2: string | null;
      format: string | null; authority_level: string; status: string; coverage_status: string; access_stage: string; access_method: string | null; access_reviewed_at: string | null; source_url: string | null;
      license: string | null; description: string | null; feature_count: number;
      import_count: number; last_imported_at: string | null;
    }>(`SELECT s.id, s.type, s.name, s.provider, s.country_code, s.admin_level_1,
               s.admin_level_2, s.format, s.authority_level, s.status, s.coverage_status, s.access_stage,
               s.access_method, s.access_reviewed_at::text, s.source_url,
               s.license, s.description,
               CASE s.type
                 WHEN 'road' THEN (SELECT count(*)::int FROM zones.roads r WHERE r.source_id = s.id)
                 WHEN 'reserve' THEN (SELECT count(*)::int FROM zones.reserves r WHERE r.source_id = s.id)
                 ELSE (SELECT count(*)::int FROM registry.plots p WHERE p.source_id = s.id)
               END AS feature_count,
               (SELECT count(*)::int FROM provenance.data_imports i WHERE i.source_id = s.id) AS import_count,
               (SELECT max(i.imported_at)::text FROM provenance.data_imports i WHERE i.source_id = s.id) AS last_imported_at
          FROM provenance.data_sources s
         ORDER BY s.country_code NULLS LAST, s.admin_level_1 NULLS LAST, s.type, s.name`);
    return rows.map((row) => ({
      id: row.id, type: row.type, name: row.name, provider: row.provider,
      countryCode: row.country_code, adminLevel1: row.admin_level_1, adminLevel2: row.admin_level_2,
      format: row.format, authorityLevel: row.authority_level, status: row.status, coverageStatus: row.coverage_status, accessStage: row.access_stage, accessMethod: row.access_method, accessReviewedAt: row.access_reviewed_at,
      sourceUrl: row.source_url, license: row.license, description: row.description,
      featureCount: row.feature_count, importCount: row.import_count, lastImportedAt: row.last_imported_at
    }));
  }

  async function fetchVisibleSpatialAssets(): Promise<SpatialAssetSummary[]> {
    const rows = await query<{id:string;asset_name:string;asset_class:string;authority_name:string|null;admin_level_1:string|null;admin_level_2:string|null;locality:string|null;processing_status:string;geometry_status:string;check_status:string;visibility:string;source_url:string|null}>(
      `SELECT id,asset_name,asset_class,authority_name,admin_level_1,admin_level_2,locality,
              processing_status,geometry_status,check_status,visibility,source_url
         FROM provenance.spatial_asset_inventory
        WHERE visibility='public'
        ORDER BY admin_level_1 NULLS LAST,risk_priority,asset_class,asset_name`
    );
    return rows.map(row=>({id:row.id,name:row.asset_name,assetClass:row.asset_class,authorityName:row.authority_name,adminLevel1:row.admin_level_1,adminLevel2:row.admin_level_2,locality:row.locality,processingStatus:row.processing_status,geometryStatus:row.geometry_status,checkStatus:row.check_status,visibility:row.visibility,sourceUrl:row.source_url}));
  }

  app.get("/api/sources", async () => ({ sources: await fetchSourceSummaries(), assets: await fetchVisibleSpatialAssets() }));

  app.get("/sources", async (_request, reply) => {
    reply.header("content-type", "text/html; charset=utf-8");
    return reply.send(renderSourcesPageHtml(await fetchSourceSummaries(), await fetchVisibleSpatialAssets()));
  });

  async function fetchLandEvidence(): Promise<LandEvidenceSummary[]> {
    const rows=await query<{id:string;event_type:string;headline:string;summary:string;effective_on:string|null;admin_level_1:string|null;admin_level_2:string|null;locality:string|null;layout_name:string|null;original_area_text:string|null;evidence_tier:number;review_status:string;search_status:string;check_status:string;geometry_status:string;evidence_count:number;primary_publisher:string|null;primary_document_type:string|null}>(
      `SELECT e.id,e.event_type,e.headline,e.summary,e.effective_on::text,e.admin_level_1,e.admin_level_2,e.locality,e.layout_name,e.original_area_text,e.evidence_tier,e.review_status,e.search_status,e.check_status,e.geometry_status,
              count(ev.id)::int AS evidence_count,
              (array_agg(d.publisher ORDER BY ev.created_at) FILTER(WHERE d.id IS NOT NULL))[1] AS primary_publisher,
              (array_agg(d.document_type ORDER BY ev.created_at) FILTER(WHERE d.id IS NOT NULL))[1] AS primary_document_type
         FROM intelligence.land_events e
         LEFT JOIN intelligence.event_evidence ev ON ev.event_id=e.id
         LEFT JOIN intelligence.documents d ON d.id=ev.document_id
        WHERE e.sensitivity='public' AND e.search_status='searchable'
        GROUP BY e.id ORDER BY e.effective_on DESC NULLS LAST,e.created_at DESC`);
    return rows.map(r=>({id:r.id,eventType:r.event_type,headline:r.headline,summary:r.summary,effectiveOn:r.effective_on,adminLevel1:r.admin_level_1,adminLevel2:r.admin_level_2,locality:r.locality,layoutName:r.layout_name,originalAreaText:r.original_area_text,evidenceTier:r.evidence_tier,reviewStatus:r.review_status,searchStatus:r.search_status,checkStatus:r.check_status,geometryStatus:r.geometry_status,evidenceCount:r.evidence_count,primaryPublisher:r.primary_publisher,primaryDocumentType:r.primary_document_type}));
  }

  async function fetchLandEvidenceDetail(id:string):Promise<LandEvidenceDetail|null>{
    const row=await queryOne<{id:string;event_type:string;headline:string;summary:string;effective_on:string|null;admin_level_1:string|null;admin_level_2:string|null;locality:string|null;layout_name:string|null;original_area_text:string|null;evidence_tier:number;review_status:string;search_status:string;check_status:string;geometry_status:string;evidence_count:number;primary_publisher:string|null;primary_document_type:string|null;plot_reference:string|null;survey_reference:string|null;title_reference:string|null;court_reference:string|null;extraction_confidence:number;sensitivity:string;created_at:string}>(
      `SELECT e.id,e.event_type,e.headline,e.summary,e.effective_on::text,e.admin_level_1,e.admin_level_2,e.locality,e.layout_name,e.original_area_text,e.evidence_tier,e.review_status,e.search_status,e.check_status,e.geometry_status,e.plot_reference,e.survey_reference,e.title_reference,e.court_reference,e.extraction_confidence::float,e.sensitivity,e.created_at::text,
              count(ev.id)::int AS evidence_count,
              (array_agg(d.publisher ORDER BY ev.created_at) FILTER(WHERE d.id IS NOT NULL))[1] AS primary_publisher,
              (array_agg(d.document_type ORDER BY ev.created_at) FILTER(WHERE d.id IS NOT NULL))[1] AS primary_document_type
         FROM intelligence.land_events e LEFT JOIN intelligence.event_evidence ev ON ev.event_id=e.id LEFT JOIN intelligence.documents d ON d.id=ev.document_id
        WHERE e.id=$1 AND e.sensitivity='public' AND e.search_status='searchable' GROUP BY e.id`,[id]);
    if(!row)return null;
    const documents=await query<{id:string;title:string;publisher:string;publisher_type:string;document_type:string;source_url:string;published_on:string|null;retrieved_at:string;extraction_status:string;evidence_role:string;locator:string|null;supporting_excerpt:string|null}>(
      `SELECT d.id,d.title,d.publisher,d.publisher_type,d.document_type,d.source_url,d.published_on::text,d.retrieved_at::text,d.extraction_status,ev.evidence_role,ev.locator,ev.supporting_excerpt FROM intelligence.event_evidence ev JOIN intelligence.documents d ON d.id=ev.document_id WHERE ev.event_id=$1 ORDER BY ev.created_at`,[id]);
    const base:LandEvidenceSummary={id:row.id,eventType:row.event_type,headline:row.headline,summary:row.summary,effectiveOn:row.effective_on,adminLevel1:row.admin_level_1,adminLevel2:row.admin_level_2,locality:row.locality,layoutName:row.layout_name,originalAreaText:row.original_area_text,evidenceTier:row.evidence_tier,reviewStatus:row.review_status,searchStatus:row.search_status,checkStatus:row.check_status,geometryStatus:row.geometry_status,evidenceCount:row.evidence_count,primaryPublisher:row.primary_publisher,primaryDocumentType:row.primary_document_type};
    return {...base,plotReference:row.plot_reference,surveyReference:row.survey_reference,titleReference:row.title_reference,courtReference:row.court_reference,extractionConfidence:row.extraction_confidence,sensitivity:row.sensitivity,createdAt:row.created_at,documents:documents.map((d):EvidenceDocument=>({id:d.id,title:d.title,publisher:d.publisher,publisherType:d.publisher_type,documentType:d.document_type,sourceUrl:d.source_url,publishedOn:d.published_on,retrievedAt:d.retrieved_at,extractionStatus:d.extraction_status,evidenceRole:d.evidence_role,locator:d.locator,supportingExcerpt:d.supporting_excerpt}))};
  }

  app.get("/api/research/events",async()=>({events:await fetchLandEvidence()}));
  app.get("/research",async(_request,reply)=>{reply.header("content-type","text/html; charset=utf-8");return reply.send(renderResearchPageHtml(await fetchLandEvidence()));});
  app.get<{Params:{id:string}}>("/research/:id",async(request,reply)=>{if(!validUuid(request.params.id))return reply.code(404).send({error:"Evidence record not found."});const event=await fetchLandEvidenceDetail(request.params.id);if(!event)return reply.code(404).send({error:"Evidence record not found."});reply.header("content-type","text/html; charset=utf-8");return reply.send(renderResearchDetailHtml(event));});

  const validUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  const requestAccount=(request:{headers:{cookie?:string}})=>currentAccount(parseSessionCookie(request.headers.cookie));
  const authMessages=async(request:{headers:{"accept-language"?:string}})=>{const context=await resolveLocale({requested:acceptedLocales(request.headers["accept-language"])});return{...context,messages:await messagesForLocale(context.locale,["auth.signup.heading","auth.signup.lead","auth.signup.submit","auth.login.heading","auth.login.lead","auth.login.submit"])};};
  app.get("/signup",async(request,reply)=>{const localized=await authMessages(request);reply.header("content-type","text/html; charset=utf-8");return reply.send(renderAuthPage("signup",localized.messages,localized.locale));});
  app.get("/login",async(request,reply)=>{const localized=await authMessages(request);reply.header("content-type","text/html; charset=utf-8");return reply.send(renderAuthPage("login",localized.messages,localized.locale));});
  app.get("/forgot-password",async(_request,reply)=>{reply.header("content-type","text/html; charset=utf-8");return reply.send(renderRecoveryRequestPage());});
  app.get("/verify-email",async(request,reply)=>{const token=String((request.query as {token?:string}).token??"");reply.header("content-type","text/html; charset=utf-8");return reply.send(renderTokenPage("verify",token));});
  app.get("/reset-password",async(request,reply)=>{const token=String((request.query as {token?:string}).token??"");reply.header("content-type","text/html; charset=utf-8");return reply.send(renderTokenPage("reset",token));});
  app.get("/account",async(request,reply)=>{const user=await requestAccount(request);if(!user)return reply.redirect("/login");const credits=await creditsForUser(user.id);reply.header("content-type","text/html; charset=utf-8");return reply.send(renderAccountPage(user,credits?.balance??null));});
  app.get("/api/account/me",async(request,reply)=>{const user=await requestAccount(request);return user?reply.send({user}):reply.code(401).send({error:"Not signed in."});});
  app.get("/api/account/credits",async(request,reply)=>{const user=await requestAccount(request);if(!user)return reply.code(401).send({error:"Not signed in."});const credits=await creditsForUser(user.id);return reply.send(credits??{walletId:null,balance:null,eligibility:"Verify an email identity to receive introductory credits."});});
  app.get("/api/catalog",async(request,reply)=>{const q=request.query as {market?:string;locale?:string};const headerLocale=String(request.headers["accept-language"]??"").split(",")[0].trim();const requestedLocale=q.locale??(headerLocale||undefined);const catalog=await publicCatalog((q.market??"NG").toUpperCase(),requestedLocale);return catalog?reply.send(catalog):reply.code(404).send({error:"Active market not found."});});
  app.get("/api/localization/context",async(request,reply)=>{const user=await requestAccount(request);const q=request.query as {market?:string;organizationId?:string};try{return reply.send(await resolveLocale({marketKey:(q.market??"NG").toUpperCase(),requested:acceptedLocales(request.headers["accept-language"]),userId:user?.id,organizationId:q.organizationId}));}catch(error){return reply.code(404).send({error:error instanceof Error?error.message:"Localization context unavailable."});}});
  app.patch("/api/account/preferences",async(request,reply)=>{const user=await requestAccount(request);if(!user)return reply.code(401).send({error:"Not signed in."});const body=(request.body??{}) as {locale?:unknown;timezone?:unknown};if(body.locale!==undefined&&typeof body.locale!=="string"||body.timezone!==undefined&&typeof body.timezone!=="string")return reply.code(400).send({error:"locale and timezone must be strings."});try{return reply.send({preferences:await updateUserPreferences(user.id,{locale:body.locale as string|undefined,timezone:body.timezone as string|undefined})});}catch(error){return reply.code(400).send({error:error instanceof Error?error.message:"Preference update failed."});}});
  app.get("/api/account/orders",async(request,reply)=>{const user=await requestAccount(request);return user?reply.send({orders:await ordersForUser(user.id)}):reply.code(401).send({error:"Not signed in."});});
  app.post("/api/orders",async(request,reply)=>{const user=await requestAccount(request);if(!user)return reply.code(401).send({error:"Sign in before creating an order."});if(user.emailVerificationStatus!=="verified")return reply.code(403).send({error:"Verify your email before creating an order."});const key=String(request.headers["idempotency-key"]??"").trim(),body=(request.body??{}) as {productKey?:unknown;market?:unknown};if(!key||typeof body.productKey!=="string")return reply.code(400).send({error:"productKey and an Idempotency-Key header are required."});const context=await resolveLocale({marketKey:typeof body.market==="string"?body.market:"NG",userId:user.id,requested:acceptedLocales(request.headers["accept-language"])});try{return reply.code(201).send({order:await createPricedOrder({userId:user.id,productKey:body.productKey,marketKey:typeof body.market==="string"?body.market:"NG",locale:context.locale,idempotencyKey:`order:${user.id}:${key}`})});}catch(error){return reply.code(422).send({error:error instanceof Error?error.message:"Order creation failed."});}});
  app.get("/api/internal/staff/me",async(request,reply)=>{if(!await requireInternal(request,reply,"internal.read"))return;const user=await requestAccount(request);if(!user)return reply.code(400).send({error:"Worker credentials do not have an account profile."});return reply.send({user,staff:await staffProfile(user.id)});});
  app.post("/api/internal/credits/release-expired",async(request,reply)=>{if(!await requireInternal(request,reply,"credits.manage"))return;const limit=Number((request.body as {limit?:unknown}|null)?.limit);return reply.send(await releaseExpiredReservations({limit:Number.isFinite(limit)?limit:100}));});
  app.post("/api/account/signup",async(request,reply)=>{const b=(request.body??{}) as Record<string,unknown>;if(typeof b.email!=="string"||typeof b.password!=="string")return reply.code(400).send({error:"Email and password are required."});try{const token=await createAccount({email:b.email,password:b.password,displayName:typeof b.displayName==="string"?b.displayName:null,userAgent:request.headers["user-agent"]??null,ipAddress:request.ip});reply.header("set-cookie",sessionCookie(token,request.protocol==="https"));return reply.code(201).send({ok:true});}catch(e){return reply.code(400).send({error:e instanceof Error?e.message:"Account creation failed."});}});
  app.post("/api/account/login",async(request,reply)=>{const b=(request.body??{}) as Record<string,unknown>;if(typeof b.email!=="string"||typeof b.password!=="string")return reply.code(400).send({error:"Email and password are required."});const token=await loginAccount(b.email,b.password,request.headers["user-agent"]??null,request.ip);if(!token)return reply.code(401).send({error:"Invalid email or password."});reply.header("set-cookie",sessionCookie(token,request.protocol==="https"));return reply.send({ok:true});});
  app.post("/api/account/logout",async(request,reply)=>{await logoutAccount(parseSessionCookie(request.headers.cookie));reply.header("set-cookie",clearSessionCookie(request.protocol==="https"));return reply.send({ok:true});});
  app.post("/api/account/verification/request",async(request,reply)=>{const user=await requestAccount(request);if(!user)return reply.code(401).send({error:"Sign in first."});try{return reply.send(await issueChallenge({type:"verify_identity",userId:user.id,origin:`${request.protocol}://${request.headers.host}`}));}catch(e){return reply.code(429).send({error:e instanceof Error?e.message:"Try again later."});}});
  app.post("/api/account/verify",async(request,reply)=>{const token=(request.body as {token?:unknown})?.token;if(typeof token!=="string"||!await verifyEmail(token))return reply.code(400).send({error:"This verification link is invalid or expired."});return reply.send({ok:true});});
  app.post("/api/account/recovery/request",async(request,reply)=>{const email=(request.body as {email?:unknown})?.email;if(typeof email!=="string")return reply.code(400).send({error:"Email is required."});try{return reply.send(await issueChallenge({type:"recover_account",email,origin:`${request.protocol}://${request.headers.host}`}));}catch{return reply.send({accepted:true,developmentUrl:null});}});
  app.post("/api/account/recovery/reset",async(request,reply)=>{const b=(request.body??{}) as {token?:unknown;password?:unknown};if(typeof b.token!=="string"||typeof b.password!=="string")return reply.code(400).send({error:"Token and new password are required."});try{if(!await resetPassword(b.token,b.password))return reply.code(400).send({error:"This recovery link is invalid or expired."});reply.header("set-cookie",clearSessionCookie(request.protocol==="https"));return reply.send({ok:true});}catch(e){return reply.code(400).send({error:e instanceof Error?e.message:"Reset failed."});}});

  app.post<{Params:{id:string}}>("/api/plots/:id/reports",async(request,reply)=>{if(!validUuid(request.params.id))return reply.code(404).send({error:"Plot not found."});const account=await requestAccount(request);const plot=await queryOne<{owner_user_id:string|null}>(`SELECT owner_user_id FROM registry.plots WHERE id=$1`,[request.params.id]);if(!plot)return reply.code(404).send({error:"Plot not found."});if(plot.owner_user_id&&plot.owner_user_id!==account?.id)return reply.code(403).send({error:"Only the record owner can generate a new report."});const report=await createEvidenceReport(request.params.id,account?.id??null);if(!report)return reply.code(422).send({error:"A completed check is required before generating a report."});if(String(request.headers.accept??"").includes("text/html"))return reply.redirect(`/reports/${report.id}`);return reply.code(201).send({report,url:`/reports/${report.id}`,downloadUrl:`/reports/${report.id}/download`});});
  app.get("/api/account/records",async(request,reply)=>{const user=await requestAccount(request);if(!user)return reply.code(401).send({error:"Not signed in."});const [plots,reports,notices]=await Promise.all([query(`SELECT id,status,record_type,computed_area_sqm,created_at::text FROM registry.plots WHERE owner_user_id=$1 ORDER BY created_at DESC`,[user.id]),query(`SELECT id,report_number,plot_id,generated_at::text FROM registry.evidence_reports WHERE owner_user_id=$1 ORDER BY generated_at DESC`,[user.id]),query(`SELECT id,plot_id,ownership_status,verification_level,status,submitted_at::text FROM registry.ownership_notices WHERE owner_user_id=$1 ORDER BY submitted_at DESC`,[user.id])]);return reply.send({plots,reports,ownershipNotices:notices});});
  app.get("/api/account/organizations",async(request,reply)=>{const user=await requestAccount(request);return user?reply.send({organizations:await organizationsForUser(user.id)}):reply.code(401).send({error:"Not signed in."});});
  app.post("/api/account/organizations",async(request,reply)=>{const user=await requestAccount(request);if(!user)return reply.code(401).send({error:"Not signed in."});const name=(request.body as {name?:unknown})?.name;if(typeof name!=="string"||name.trim().length<2)return reply.code(400).send({error:"Organization name is required."});return reply.code(201).send({organization:await createOrganization(user.id,name)});});
  app.post<{Params:{id:string}}>("/api/organizations/:id/invitations",async(request,reply)=>{const user=await requestAccount(request);if(!user)return reply.code(401).send({error:"Not signed in."});const b=(request.body??{}) as {email?:unknown;role?:unknown};if(typeof b.email!=="string"||typeof b.role!=="string")return reply.code(400).send({error:"Email and role are required."});try{const item=await inviteMember(user.id,request.params.id,b.email,b.role,`${request.protocol}://${request.headers.host}`);return item?reply.code(201).send({invitation:item}):reply.code(403).send({error:"Permission denied."});}catch{return reply.code(400).send({error:"Invalid invitation role or email."});}});
  app.post("/api/organization-invitations/accept",async(request,reply)=>{const user=await requestAccount(request);if(!user)return reply.code(401).send({error:"Sign in first."});const token=(request.body as {token?:unknown})?.token;if(typeof token!=="string")return reply.code(400).send({error:"Invitation token is required."});const organizationId=await acceptInvitation(user.id,token);return organizationId?reply.send({ok:true,organizationId}):reply.code(400).send({error:"Invitation is invalid, expired, or intended for another email."});});
  app.post<{Params:{id:string}}>("/api/plots/:id/transfer-to-organization",async(request,reply)=>{const user=await requestAccount(request);if(!user)return reply.code(401).send({error:"Not signed in."});const b=(request.body??{}) as {organizationId?:unknown;reason?:unknown};if(typeof b.organizationId!=="string"||typeof b.reason!=="string"||!b.reason.trim())return reply.code(400).send({error:"organizationId and reason are required."});return await transferPlotToOrganization(user.id,request.params.id,b.organizationId,b.reason)?reply.send({ok:true}):reply.code(403).send({error:"Only the individual owner with organization resource permission can transfer this plot."});});
  app.get("/organizations",async(request,reply)=>{const user=await requestAccount(request);if(!user)return reply.redirect("/login");const orgs=await organizationsForUser(user.id);reply.header("content-type","text/html; charset=utf-8");return reply.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Organizations — Dende</title><style>${TOP_NAV_CSS}body{margin:0;background:#f4f5f2;font-family:system-ui}.page{max-width:720px;margin:40px auto;padding:16px}.card{background:white;padding:24px;border-radius:14px}input,button{padding:10px}button{background:#193f2b;color:white;border:0;border-radius:7px}</style></head><body>${renderTopNav("account")}<main class="page"><section class="card"><h1>Organizations</h1><ul>${orgs.map((o:any)=>`<li><b>${o.name}</b> · ${o.role}</li>`).join("")||"<li>No organizations yet.</li>"}</ul><form id="new-org"><input name="name" required placeholder="Organization name"><button>Create organization</button><span role="status"></span></form></section></main><script>document.getElementById('new-org').onsubmit=async e=>{e.preventDefault();const f=e.target,r=await fetch('/api/account/organizations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:f.name.value})}),j=await r.json();if(r.ok)location.reload();else f.querySelector('[role=status]').textContent=j.error};</script></body></html>`);});
  app.get("/operator",async(request,reply)=>{if(!await requireInternal(request,reply,"internal.read"))return;const user=await requestAccount(request);if(!user)return reply.code(400).send({error:"The operator page requires a staff account session."});const staff=await staffProfile(user.id);reply.header("content-type","text/html; charset=utf-8");return reply.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Operator access — Dende</title><style>${TOP_NAV_CSS}body{margin:0;background:#f4f5f2;color:#17211b;font-family:system-ui}.page{max-width:820px;margin:40px auto;padding:16px}.card{background:#fff;padding:24px;border-radius:14px;box-shadow:0 8px 24px #17211b12}.pill{display:inline-block;margin:3px;padding:6px 9px;border-radius:999px;background:#e8f1eb;font-size:13px}.expiry{color:#66736b;font-size:13px}a{color:#17603a}</style></head><body>${renderTopNav("account")}<main class="page"><section class="card"><p class="expiry">Privileged Dende access</p><h1>${user.displayName||user.email}</h1><h2>Active assignments</h2>${staff.assignments.map(a=>`<p><b>${a.role}</b> <span class="expiry">${a.expiresAt?`expires ${a.expiresAt}`:"no expiry set"}</span></p>`).join("")}<h2>Permissions</h2><p>${staff.permissions.map(p=>`<span class="pill">${p}</span>`).join("")}</p><p class="expiry">Every allowed and denied privileged request is recorded. Worker automation remains separately authenticated.</p></section></main></body></html>`);});
  app.get("/account/records",async(request,reply)=>{const user=await requestAccount(request);if(!user)return reply.redirect("/login");const [plots,reports,notices]=await Promise.all([query<any>(`SELECT id,status,record_type,computed_area_sqm,created_at::text FROM registry.plots WHERE owner_user_id=$1 ORDER BY created_at DESC`,[user.id]),query<any>(`SELECT id,report_number,plot_id,generated_at::text FROM registry.evidence_reports WHERE owner_user_id=$1 ORDER BY generated_at DESC`,[user.id]),query<any>(`SELECT id,plot_id,ownership_status,status,submitted_at::text FROM registry.ownership_notices WHERE owner_user_id=$1 ORDER BY submitted_at DESC`,[user.id])]);const rows=[...plots.map(p=>`<li><a href="/api/plots/${p.id}/map">Plot ${p.id.slice(0,8)}</a> · ${p.record_type} · ${Number(p.computed_area_sqm??0).toFixed(1)} m²</li>`),...reports.map(r=>`<li><a href="/reports/${r.id}">${r.report_number}</a> · evidence report</li>`),...notices.map(n=>`<li><a href="/ownership-notices/${n.id}">Ownership notice ${n.id.slice(0,8)}</a> · ${n.status}</li>`)];reply.header("content-type","text/html; charset=utf-8");return reply.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My records — Dende</title><style>${TOP_NAV_CSS}body{margin:0;background:#f4f5f2;font-family:system-ui}.page{max-width:760px;margin:40px auto;padding:16px}.card{background:#fff;padding:24px;border-radius:14px}li{padding:10px 0;border-bottom:1px solid #ddd}</style></head><body>${renderTopNav("account")}<main class="page"><section class="card"><h1>My records</h1><p>Only records created while signed in appear here. Legacy anonymous records remain unclaimed.</p><ul>${rows.join("")||"<li>No account-owned records yet.</li>"}</ul></section></main></body></html>`);});
  app.get<{Params:{id:string}}>("/reports/:id",async(request,reply)=>{if(!validUuid(request.params.id))return reply.code(404).send({error:"Report not found."});const report=await fetchEvidenceReport(request.params.id);if(!report)return reply.code(404).send({error:"Report not found."});reply.header("content-type","text/html; charset=utf-8");return reply.send(renderEvidenceReportHtml(report));});
  app.get<{Params:{id:string}}>("/reports/:id/download",async(request,reply)=>{if(!validUuid(request.params.id))return reply.code(404).send({error:"Report not found."});const report=await fetchEvidenceReport(request.params.id);if(!report)return reply.code(404).send({error:"Report not found."});reply.header("content-type","application/json; charset=utf-8");reply.header("content-disposition",`attachment; filename="${report.reportNumber}.json"`);return reply.send(report);});
  async function fetchSourceDetail(id: string): Promise<SourceDetail | null> {
    const row = await queryOne<{
      id:string;type:string;name:string;provider:string|null;country_code:string|null;admin_level_1:string|null;admin_level_2:string|null;format:string|null;source_url:string|null;license:string|null;authority_level:string;status:string;coverage_status:string;access_stage:string;access_method:string|null;access_notes:string|null;access_contact:string|null;access_reviewed_at:string|null;description:string|null;created_at:string;updated_at:string;feature_count:number;
    }>(`SELECT s.id,s.type,s.name,s.provider,s.country_code,s.admin_level_1,s.admin_level_2,s.format,s.source_url,s.license,s.authority_level,s.status,s.coverage_status,s.access_stage,s.access_method,s.access_notes,s.access_contact,s.access_reviewed_at::text,s.description,s.created_at::text,s.updated_at::text,
              CASE s.type WHEN 'road' THEN (SELECT count(*)::int FROM zones.roads r WHERE r.source_id=s.id) WHEN 'reserve' THEN (SELECT count(*)::int FROM zones.reserves r WHERE r.source_id=s.id) ELSE (SELECT count(*)::int FROM registry.plots p WHERE p.source_id=s.id) END AS feature_count
         FROM provenance.data_sources s WHERE s.id=$1`,[id]);
    return row ? {id:row.id,type:row.type,name:row.name,provider:row.provider,countryCode:row.country_code,adminLevel1:row.admin_level_1,adminLevel2:row.admin_level_2,format:row.format,sourceUrl:row.source_url,license:row.license,authorityLevel:row.authority_level,status:row.status,coverageStatus:row.coverage_status,accessStage:row.access_stage,accessMethod:row.access_method,accessNotes:row.access_notes,accessContact:row.access_contact,accessReviewedAt:row.access_reviewed_at,description:row.description,createdAt:row.created_at,updatedAt:row.updated_at,featureCount:row.feature_count} : null;
  }
  async function fetchSourceImports(sourceId: string): Promise<ImportDetail[]> {
    const rows = await query<{id:string;source_id:string;filename:string|null;file_type:string|null;checksum:string|null;record_count:number|null;imported_by:string;status:string;error_summary:string|null;imported_at:string;linked_feature_count:number}>(
      `SELECT i.id,i.source_id,i.filename,i.file_type,i.checksum,i.record_count,i.imported_by,i.status,i.error_summary,i.imported_at::text,
              ((SELECT count(*) FROM registry.plots p WHERE p.import_id=i.id)+(SELECT count(*) FROM zones.roads r WHERE r.import_id=i.id)+(SELECT count(*) FROM zones.reserves r WHERE r.import_id=i.id))::int AS linked_feature_count
         FROM provenance.data_imports i WHERE i.source_id=$1 ORDER BY i.imported_at DESC`,[sourceId]);
    return rows.map(row=>({id:row.id,sourceId:row.source_id,filename:row.filename,fileType:row.file_type,checksum:row.checksum,recordCount:row.record_count,linkedFeatureCount:row.linked_feature_count,importedBy:row.imported_by,status:row.status,errorSummary:row.error_summary,importedAt:row.imported_at}));
  }

  app.get<{ Params: { id: string } }>("/sources/:id", async (request, reply) => {
    if (!validUuid(request.params.id)) return reply.code(404).send({ error: "Source not found." });
    const source = await fetchSourceDetail(request.params.id);
    if (!source) return reply.code(404).send({ error: "Source not found." });
    reply.header("content-type", "text/html; charset=utf-8");
    return reply.send(renderSourceDetailHtml(source, await fetchSourceImports(source.id)));
  });

  app.get<{ Params: { sourceId: string; importId: string } }>("/sources/:sourceId/imports/:importId", async (request, reply) => {
    if (!validUuid(request.params.sourceId) || !validUuid(request.params.importId)) return reply.code(404).send({ error: "Import not found." });
    const source = await fetchSourceDetail(request.params.sourceId);
    if (!source) return reply.code(404).send({ error: "Source not found." });
    const item = (await fetchSourceImports(source.id)).find((entry) => entry.id === request.params.importId);
    if (!item) return reply.code(404).send({ error: "Import not found." });
    reply.header("content-type", "text/html; charset=utf-8");
    return reply.send(renderImportDetailHtml(source, item));
  });

  app.get("/protect", async (_request, reply) => {
    reply.header("content-type", "text/html; charset=utf-8");
    return reply.send(renderProtectPageHtml());
  });

  /** Public/limited ownership notices. Private contact references are never returned. */
  app.get("/api/ownership-notices", async (request) => {
    const { plot_id, status } = request.query as { plot_id?: string; status?: string };
    const params: unknown[] = [];
    const where = ["n.visibility <> 'private'"];
    if (plot_id) { params.push(plot_id); where.push(`n.plot_id = $${params.length}`); }
    if (status) { params.push(status); where.push(`n.ownership_status = $${params.length}`); }
    const notices = await query(
      `SELECT n.id, n.plot_id, n.submitter_name, n.statement, n.ownership_status,
              n.verification_level, n.visibility, n.status, n.submitted_at,
              n.verified_at, n.expires_at,
              ST_AsGeoJSON(p.geometry)::jsonb AS geometry
         FROM registry.ownership_notices n
         JOIN registry.plots p ON p.id = n.plot_id
        WHERE ${where.join(" AND ")}
        ORDER BY n.submitted_at DESC`,
      params
    );
    return { notices };
  });

  app.get<{ Params: { id: string } }>("/api/ownership-notices/:id/history", async (request, reply) => {
    if (!validUuid(request.params.id)) return reply.code(404).send({ error: "Ownership notice not found." });
    const notice = await queryOne<{ id:string; visibility:string }>(`SELECT id,visibility FROM registry.ownership_notices WHERE id=$1`,[request.params.id]);
    if (!notice || notice.visibility === "private") return reply.code(404).send({ error: "Ownership notice not found." });
    const history = await ownershipHistoryForNotices([notice.id]);
    return reply.send({ noticeId: notice.id, events: history[notice.id] ?? [] });
  });

  async function fetchPublicNotice(id:string):Promise<OwnershipNotice|null>{
    const row=await queryOne<{id:string;plot_id:string;submitter_name:string|null;statement:string|null;ownership_status:OwnershipNotice["ownershipStatus"];verification_level:OwnershipNotice["verificationLevel"];visibility:OwnershipNotice["visibility"];status:OwnershipNotice["status"];submitted_at:string;verified_at:string|null}>(
      `SELECT id,plot_id,submitter_name,statement,ownership_status,verification_level,visibility,status,submitted_at::text,verified_at::text FROM registry.ownership_notices WHERE id=$1 AND visibility<>'private'`,[id]);
    return row?{id:row.id,plotId:row.plot_id,submitterName:row.submitter_name,statement:row.statement,ownershipStatus:row.ownership_status,verificationLevel:row.verification_level,visibility:row.visibility,status:row.status,submittedAt:row.submitted_at,verifiedAt:row.verified_at}:null;
  }
  app.get<{Params:{id:string}}>("/ownership-notices/:id",async(request,reply)=>{if(!validUuid(request.params.id))return reply.code(404).send({error:"Ownership notice not found."});const notice=await fetchPublicNotice(request.params.id);if(!notice)return reply.code(404).send({error:"Ownership notice not found."});const history=await ownershipHistoryForNotices([notice.id]);reply.header("content-type","text/html; charset=utf-8");return reply.send(renderOwnershipPageHtml(notice,history[notice.id]??[],await publicRequestsForNotice(notice.id)));});
  app.post<{Params:{id:string}}>("/api/ownership-notices/:id/requests",async(request,reply)=>{if(!validUuid(request.params.id)||!await fetchPublicNotice(request.params.id))return reply.code(404).send({error:"Ownership notice not found."});const body=(request.body??{}) as {requestType?:unknown;requesterName?:unknown;contactReference?:unknown;reason?:unknown};if(body.requestType!=="challenge"&&body.requestType!=="correction")return reply.code(400).send({error:"requestType must be challenge or correction."});const contact=typeof body.contactReference==="string"?body.contactReference.trim():"",reason=typeof body.reason==="string"?body.reason.trim():"";if(!contact||!reason)return reply.code(400).send({error:"Private contact and reason are required."});const result=await createOwnershipRequest({noticeId:request.params.id,requestType:body.requestType,requesterName:typeof body.requesterName==="string"?body.requesterName.slice(0,160):null,contactReference:contact.slice(0,240),reason:reason.slice(0,1500)});return reply.code(201).send({request:result});});
  app.post<{Params:{id:string}}>("/api/ownership-notices/:id/withdraw",async(request,reply)=>{const body=(request.body??{}) as {managementKey?:unknown;reason?:unknown};const key=typeof body.managementKey==="string"?body.managementKey:"";if(!key)return reply.code(400).send({error:"Management key is required."});const ok=await withdrawOwnershipNotice(request.params.id,key,typeof body.reason==="string"?body.reason.slice(0,500):null);if(!ok)return reply.code(403).send({error:"Invalid management key or this legacy notice has no management key."});return reply.send({ok:true,status:"withdrawn"});});

  /** Lists registered plots; optional bbox=minLng,minLat,maxLng,maxLat filter. */
  app.get("/api/plots", async (request, reply) => {
    const { bbox } = request.query as { bbox?: string };
    const rows = await query<PlotRow>(
      `SELECT id, status, method, confidence, crs, computed_area_sqm, printed_area_sqm,
              source_file, created_at, ST_AsGeoJSON(geometry)::jsonb AS geometry
         FROM registry.plots
         ${bbox ? `WHERE geometry && ST_MakeEnvelope($1, $2, $3, $4, 4326)` : ""}
         ORDER BY created_at DESC`,
      bbox ? bbox.split(",").map((v) => Number(v)) : []
    );
    return reply.send({ plots: rows.map(toPlotGeoJson) });
  });

  app.get<{ Params: { id: string } }>("/api/plots/:id", async (request, reply) => {
    const row = await queryOne<PlotRow>(
      `SELECT id, status, method, confidence, crs, computed_area_sqm, printed_area_sqm,
              source_file, created_at, raw_vertices, ST_AsGeoJSON(geometry)::jsonb AS geometry
         FROM registry.plots WHERE id = $1`,
      [request.params.id]
    );
    if (!row) return reply.code(404).send({ error: "Plot not found." });

    const violations = await query<{
      id: string;
      kind: string;
      status: string;
      severity: string;
      other_plot_id: string | null;
      zone_name: string | null;
      zone_type: string | null;
      current_distance_m: number | null;
      current_area_sqm: number | null;
      current_percent: number | null;
      first_detected_at: string;
      last_checked_at: string | null;
      resolved_at: string | null;
    }>(
      `SELECT id, kind, status, severity, other_plot_id, zone_name, zone_type,
              current_distance_m, current_area_sqm, current_percent,
              first_detected_at, last_checked_at, resolved_at
         FROM registry.violations
        WHERE plot_id = $1 AND status <> 'false_positive'
        ORDER BY severity DESC, first_detected_at ASC`,
      [row.id]
    );

    const notices = await noticesForPlots([row.id]);
    const plotNotices = notices[row.id] ?? [];
    return reply.send({
      plot: { ...toPlotGeoJson(row), rawVertices: row.raw_vertices },
      violations,
      ownershipNotices: plotNotices,
      ownershipHistory: await ownershipHistoryForNotices(plotNotices.map((notice) => notice.id))
    });
  });

  /** Self-contained "violations" map: overlap areas, road/reserve zones, beacon references. */
  app.get<{ Params: { id: string } }>("/api/plots/:id/map", async (request, reply) => {
    const row = await queryOne<PlotRow>(
      `SELECT id, status, method, confidence, crs, computed_area_sqm, printed_area_sqm,
              source_file, created_at, raw_vertices, ST_AsGeoJSON(geometry)::jsonb AS geometry
         FROM registry.plots WHERE id = $1`,
      [request.params.id]
    );
    if (!row) return reply.code(404).send({ error: "Plot not found." });
    if (!row.raw_vertices || row.raw_vertices.length < 3 || !row.crs) {
      return reply.code(422).send({ error: "Plot has no renderable vertices/CRS." });
    }

    const srid = Number(row.crs.replace("EPSG:", "")) || 4326;

    const [overlapRows, alertRows] = await Promise.all([
      query<{
        violation_id: string;
        other_plot_id: string;
        intersection_area_sqm: number;
        intersection_percent: number;
        status: string;
        geometry: { type: string; coordinates: unknown };
        other_geometry: { type: string; coordinates: unknown };
      }>(
        `SELECT v.id AS violation_id, v.other_plot_id, v.current_area_sqm AS intersection_area_sqm,
                v.current_percent AS intersection_percent, v.status,
                ST_AsGeoJSON(ST_Intersection(p.geometry, q.geometry))::jsonb AS geometry,
                ST_AsGeoJSON(q.geometry)::jsonb AS other_geometry
           FROM registry.violations v
           JOIN registry.plots p ON p.id = v.plot_id
           JOIN registry.plots q ON q.id = v.other_plot_id
          WHERE v.kind = 'overlap' AND v.plot_id = $1 AND v.status <> 'false_positive'
          ORDER BY v.current_area_sqm DESC`,
        [row.id]
      ),
      query<{
        violation_id: string;
        zone_id: number | null;
        zone_layer: "roads" | "reserves";
        zone_name: string | null;
        zone_type: string | null;
        current_distance_m: number | null;
        current_area_sqm: number | null;
        status: string;
        zone_geometry: { type: string; coordinates: unknown } | null;
        nearest_line: { type: string; coordinates: unknown } | null;
        plot_side_point: { type: string; coordinates: [number, number] } | null;
      }>(
        `SELECT v.id AS violation_id, v.zone_id, v.zone_layer, v.zone_name, v.zone_type,
                v.current_distance_m, v.current_area_sqm, v.status,
                ST_AsGeoJSON(COALESCE(r.geometry, r2.geometry))::jsonb AS zone_geometry,
                ST_AsGeoJSON(ST_ShortestLine(p.geometry, COALESCE(r.geometry, r2.geometry)))::jsonb AS nearest_line,
                ST_AsGeoJSON(ST_Transform(ST_StartPoint(ST_ShortestLine(p.geometry, COALESCE(r.geometry, r2.geometry))), $2::int))::jsonb AS plot_side_point
           FROM registry.violations v
           JOIN registry.plots p ON p.id = v.plot_id
           LEFT JOIN zones.roads r ON v.zone_layer = 'roads' AND r.id = v.zone_id
           LEFT JOIN zones.reserves r2 ON v.zone_layer = 'reserves' AND r2.id = v.zone_id
          WHERE v.kind = 'zoning' AND v.plot_id = $1 AND v.status <> 'false_positive'
          ORDER BY v.created_at ASC`,
        [row.id, srid]
      )
    ]);

    const overlaps: PlotMapOverlap[] = overlapRows.map((o) => ({
      violationId: o.violation_id,
      otherPlotId: o.other_plot_id,
      intersectionAreaSqm: o.intersection_area_sqm,
      intersectionPercent: o.intersection_percent,
      status: o.status,
      geometry: o.geometry,
      otherGeometry: o.other_geometry,
      ownershipNotices: []
    }));
    const noticeMap = await noticesForPlots([row.id, ...overlapRows.map((overlap) => overlap.other_plot_id)]);
    const ownershipHistory = await ownershipHistoryForNotices(Object.values(noticeMap).flat().map((notice) => notice.id));

    const alerts: PlotMapAlert[] = await Promise.all(
      alertRows.map(async (a) => {
        let bufferGeometry: { type: string; coordinates: unknown } | null = null;
        if (a.zone_layer === "roads" && a.zone_id != null) {
          const buffer = await queryOne<{ buffer_geometry: { type: string; coordinates: unknown } | null }>(
            `SELECT ST_AsGeoJSON(ST_Transform(ST_Buffer(geometry::geography, $2)::geometry, 4326))::jsonb AS buffer_geometry
               FROM zones.roads WHERE id = $1 LIMIT 1`,
            [a.zone_id, config.roadBuffersMeters[(a.zone_type ?? "").toLowerCase() as RoadClass] ?? 20]
          );
          bufferGeometry = buffer?.buffer_geometry ?? null;
        }
        let reference: string | null = null;
        if (a.plot_side_point && row.raw_vertices) {
          const [x, y] = a.plot_side_point.coordinates;
          let best: string | null = null;
          let bestDist = Infinity;
          for (const v of row.raw_vertices) {
            const d = (v.easting - x) ** 2 + (v.northing - y) ** 2;
            if (d < bestDist) {
              bestDist = d;
              best = v.beaconId;
            }
          }
          reference = best;
        }
        return {
          violationId: a.violation_id,
          layer: a.zone_layer,
          zoneName: a.zone_name,
          zoneType: a.zone_type,
          status: a.status,
          distanceM: a.current_distance_m,
          intersectionAreaSqm: a.current_area_sqm,
          zoneGeometry: a.zone_geometry,
          bufferGeometry,
          nearestLine: a.nearest_line,
          reference
        };
      })
    );

    const latestEvidence = await queryOne<{ consulted_sources: ConsultedSource[]; report_id:string|null }>(
      `SELECT c.consulted_sources,(SELECT id FROM registry.evidence_reports r WHERE r.check_run_id=c.id ORDER BY generated_at DESC LIMIT 1) report_id FROM registry.check_runs c WHERE c.plot_id = $1 ORDER BY c.ran_at DESC LIMIT 1`,
      [row.id]
    );
    const html = renderPlotMapHtml({
      plot: {
        id: row.id,
        status: row.status,
        method: row.method,
        confidence: row.confidence,
        crs: row.crs,
        computedAreaSqm: row.computed_area_sqm,
        printedAreaSqm: row.printed_area_sqm,
        sourceFile: row.source_file,
        createdAt: row.created_at,
        geometry: row.geometry,
        rawVertices: row.raw_vertices
      },
      ownershipNotices: noticeMap[row.id] ?? [],
      ownershipHistory,
      consultedSources: latestEvidence?.consulted_sources ?? [],
      latestReportId: latestEvidence?.report_id ?? null,
      overlaps: overlaps.map((overlap) => ({
        ...overlap,
        ownershipNotices: noticeMap[overlap.otherPlotId] ?? []
      })),
      alerts
    } satisfies PlotMapData);
    reply.header("content-type", "text/html; charset=utf-8");
    return reply.send(html);
  });

  /** Lists violations (cases), optionally filtered by kind/status/plot_id. */
  app.get("/api/violations", async (request, reply) => {
    const { kind, status, plot_id } = request.query as { kind?: string; status?: string; plot_id?: string };
    const where: string[] = ["v.status <> 'false_positive'"];
    const params: unknown[] = [];
    if (kind) {
      params.push(kind);
      where.push(`v.kind = $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`v.status = $${params.length}`);
    }
    if (plot_id) {
      params.push(plot_id);
      where.push(`v.plot_id = $${params.length}`);
    }
    const rows = await query(
      `SELECT v.id, v.kind, v.status, v.severity, v.plot_id, v.other_plot_id,
              v.zone_id, v.zone_layer, v.zone_name, v.zone_type,
              v.current_distance_m, v.current_area_sqm, v.current_percent,
              v.first_detected_at, v.last_checked_at, v.resolved_at,
              p.method AS plot_method, p.source_file AS plot_source_file,
              COALESCE(r.source_url, r2.source_url) AS zone_source_url,
              COALESCE(r.imported_at, r2.imported_at) AS zone_imported_at
         FROM registry.violations v
         JOIN registry.plots p ON p.id = v.plot_id
         LEFT JOIN zones.roads r ON v.zone_layer = 'roads' AND r.id = v.zone_id
         LEFT JOIN zones.reserves r2 ON v.zone_layer = 'reserves' AND r2.id = v.zone_id
        WHERE ${where.join(" AND ")}
        ORDER BY v.severity DESC, v.first_detected_at DESC`,
      params
    );
    return reply.send({ violations: rows });
  });

  /** Full violation case (with current zone provenance) + its event timeline. */
  app.get<{ Params: { id: string } }>("/api/violations/:id", async (request, reply) => {
    const violation = await queryOne<{
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
    }>(
      `SELECT v.*, p.method AS plot_method, p.source_file AS plot_source_file, p.crs AS plot_crs,
              COALESCE(r.source_url, r2.source_url) AS zone_source_url,
              COALESCE(r.imported_at, r2.imported_at) AS zone_imported_at
         FROM registry.violations v
         JOIN registry.plots p ON p.id = v.plot_id
         LEFT JOIN zones.roads r ON v.zone_layer = 'roads' AND r.id = v.zone_id
         LEFT JOIN zones.reserves r2 ON v.zone_layer = 'reserves' AND r2.id = v.zone_id
        WHERE v.id = $1`,
      [request.params.id]
    );
    if (!violation) return reply.code(404).send({ error: "Violation not found." });

    const events = await query<ViolationEvent>(
      `SELECT id, event_type, actor, reason, snapshot, check_run_id, created_at
         FROM registry.violation_events
        WHERE violation_id = $1
        ORDER BY created_at ASC`,
      [request.params.id]
    );
    const checkRuns = await query<CheckRun>(
      `SELECT id, trigger, source_upload, parse_method, confidence, plot_area_sqm, "overlaps", zoning_alerts, ran_at
         FROM registry.check_runs
        WHERE plot_id = $1
        ORDER BY ran_at ASC`,
      [violation.plot_id]
    );
    if (String(request.headers.accept ?? "").includes("text/html")) {
      reply.header("content-type", "text/html; charset=utf-8");
      return reply.send(renderViolationPageHtml({ violation, events, checkRuns }));
    }
    return reply.send({ violation, events, checkRuns });
  });

  /** Event timeline for a violation. */
  app.get<{ Params: { id: string } }>("/api/violations/:id/events", async (request, reply) => {
    const events = await query(
      `SELECT id, event_type, actor, reason, snapshot, check_run_id, created_at
         FROM registry.violation_events
        WHERE violation_id = $1
        ORDER BY created_at ASC`,
      [request.params.id]
    );
    return reply.send({ events });
  });

  /** Changes a violation's lifecycle status (actor + reason recorded as an event). */
  app.patch<{ Params: { id: string } }>("/api/violations/:id", async (request, reply) => {
    const { status, actor, reason } = (request.body ?? {}) as {
      status?: string;
      actor?: string;
      reason?: string;
    };
    if (!status || !["open", "acknowledged", "in_dispute", "resolved", "false_positive"].includes(status)) {
      return reply.code(400).send({ error: "status must be one of open|acknowledged|in_dispute|resolved|false_positive" });
    }
    if (!actor || typeof actor !== "string") {
      return reply.code(400).send({ error: "actor is required." });
    }
    try {
      await setViolationStatus(request.params.id, status as never, actor, reason ?? null);
    } catch (error) {
      if (error instanceof Error && error.message === "Violation not found.") {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
    return reply.send({ ok: true });
  });

  /** Adds a note to a violation's timeline. */
  app.post<{ Params: { id: string } }>("/api/violations/:id/notes", async (request, reply) => {
    const { note, actor } = (request.body ?? {}) as { note?: string; actor?: string };
    if (!note || typeof note !== "string") {
      return reply.code(400).send({ error: "note is required." });
    }
    if (!actor || typeof actor !== "string") {
      return reply.code(400).send({ error: "actor is required." });
    }
    try {
      await addViolationNote(request.params.id, note, actor);
    } catch (error) {
      if (error instanceof Error && error.message === "Violation not found.") {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
    return reply.send({ ok: true });
  });

  /** Re-runs the spatial checks for a stored plot and appends history. */
  app.post<{ Params: { id: string } }>("/api/plots/:id/recheck", async (request, reply) => {
    const row = await queryOne<PlotRow>(
      `SELECT id, ST_AsGeoJSON(geometry)::jsonb AS geometry FROM registry.plots WHERE id = $1`,
      [request.params.id]
    );
    if (!row) return reply.code(404).send({ error: "Plot not found." });

    const checks = await runSpatialChecks(JSON.stringify(row.geometry), row.id);
    const consultedSources = await collectConsultedSources();
    const checkRunId = await recordCheckRun({
      plotId: row.id,
      trigger: "recheck",
      plotAreaSqm: checks.plotAreaSqm,
      overlaps: checks.overlaps,
      zoningAlerts: checks.zoningAlerts,
      consultedSources
    });
    const violationIds = await upsertViolations(
      row.id,
      checkRunId,
      checks.overlaps,
      checks.zoningAlerts,
      checks.plotAreaSqm
    );
    return reply.send({
      checkRunId,
      plotAreaSqm: checks.plotAreaSqm,
      overlaps: checks.overlaps,
      zoningAlerts: checks.zoningAlerts,
      violations: violationIds,
      consultedSources
    });
  });

  app.get("/api/zones/summary", async () => {    const [roads, reserves, meta] = await Promise.all([
      queryOne<{ count: string }>("SELECT count(*) AS count FROM zones.roads"),
      queryOne<{ count: string }>("SELECT count(*) AS count FROM zones.reserves"),
      query<{ layer: string; source_url: string | null; imported_at: string; row_count: number | null }>(
        `SELECT layer, source_url, imported_at, row_count FROM zones.meta ORDER BY imported_at DESC`
      )
    ]);
    return {
      roads: Number(roads?.count ?? 0),
      reserves: Number(reserves?.count ?? 0),
      imports: meta
    };
  });

  return app;
}
