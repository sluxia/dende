import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../src/db";
import { runMigrations } from "../src/migrate";
import { buildApp } from "../src/app";
import { config } from "../src/config";
import { runSpatialChecks } from "../src/spatial";

let available=true;
const app=buildApp();

before(async()=>{try{await pool.query("SELECT 1");await runMigrations();}catch{available=false;}});
after(async()=>{await app.close();await pool.end();});

test("Cross River pilot exposes searchable evidence but no unlocated event is check-enabled",async(t)=>{
  if(!available)return t.skip("PostGIS not reachable");
  const response=await app.inject({method:"GET",url:"/api/research/events"});
  assert.equal(response.statusCode,200);
  const body=response.json() as {events:Array<{headline:string;adminLevel1:string|null;searchStatus:string;checkStatus:string;geometryStatus:string}>};
  assert.ok(body.events.length>=4);
  assert.ok(body.events.some(e=>e.headline.includes("Summit Hills")));
  const crossRiver=body.events.filter(e=>e.adminLevel1==="Cross River");
  assert.ok(crossRiver.every(e=>e.searchStatus==="searchable"));
  assert.ok(crossRiver.every(e=>e.checkStatus==="excluded"));
  assert.ok(crossRiver.every(e=>e.geometryStatus==="unavailable"));
});

test("Akwa Ibom government-mapped pilot activates only the reviewed gazette segment",async(t)=>{
  if(!available)return t.skip("PostGIS not reachable");
  const result=await pool.query<{
    valid:boolean;observations:number;linked:number;check_status:string;geometry_status:string;
    source_status:string;coverage_status:string;feature_count:number;area_sqm:number;
  }>(`SELECT
      ST_IsValid(e.geometry) valid,
      (SELECT count(*)::int FROM intelligence.numeric_observations WHERE external_key LIKE 'akwa-si70-p71-coordinate-%' AND interpretation_status='accepted') observations,
      (SELECT count(*)::int FROM intelligence.geometry_candidate_observations gco JOIN intelligence.geometry_candidates gc ON gc.id=gco.geometry_candidate_id WHERE gc.external_key='akwa-si70-zrw1-register-rows-001-026-partial') linked,
      e.check_status,e.geometry_status,s.status source_status,s.coverage_status,
      (SELECT count(*)::int FROM zones.reserves z WHERE z.source_id=s.id) feature_count,
      ST_Area(ST_Transform(e.geometry,32632)) area_sqm
    FROM intelligence.land_events e
    JOIN provenance.data_sources s ON s.name='Akwa Ibom federal highway statutory rights-of-way'
    WHERE e.external_key='akwa-si70-ikot-ekpene-james-town-row-partial'`);
  assert.equal(result.rows.length,1);
  const row=result.rows[0];
  assert.equal(row.valid,true);
  assert.equal(row.observations,38);
  assert.equal(row.linked,26);
  assert.equal(row.check_status,"eligible");
  assert.equal(row.geometry_status,"derived");
  assert.equal(row.source_status,"partial");
  assert.equal(row.coverage_status,"partial");
  assert.equal(row.feature_count,1);
  assert.ok(Math.abs(row.area_sqm-642624.52)<1);

  const testPlot=await pool.query<{geometry:string}>(`SELECT ST_AsGeoJSON(ST_Buffer(ST_PointOnSurface(geometry)::geography,5)::geometry) geometry FROM zones.reserves WHERE osm_id='FHA-SI70-2019-ZRW1-PARTIAL-001-026'`);
  const checks=await runSpatialChecks(testPlot.rows[0].geometry);
  assert.ok(checks.zoningAlerts.some(a=>a.zoneName?.includes("statutory ROW")));

  const planned=await pool.query<{count:number}>(`SELECT count(*)::int count FROM provenance.data_sources WHERE admin_level_1='Akwa Ibom' AND name IN ('Anua Offot Ifa Ikot Okpon Government Residential Estate layout','Nung Ette / Ikot Ambon / Owot Uta government layout') AND status='planned' AND coverage_status='unavailable' AND access_stage='portal_found'`);
  assert.equal(planned.rows[0].count,2);
});

test("Akwa Ibom general evidence follows mapped discovery and stays out of alerts without geometry",async(t)=>{
  if(!available)return t.skip("PostGIS not reachable");
  const rows=await pool.query<{count:number;eligible:number;with_geometry:number}>(`SELECT
    count(*)::int count,
    count(*) FILTER(WHERE check_status='eligible')::int eligible,
    count(*) FILTER(WHERE geometry IS NOT NULL)::int with_geometry
    FROM intelligence.land_events
    WHERE external_key IN (
      'akwa-tropicana-government-land-82ha','akwa-anua-offot-block-g-revocation',
      'akwa-ekid-itam-3-industrial-revocation','akwa-nsit-ubium-model-farm-50ha',
      'akwa-renewed-hope-estate-additional-50ha','akwa-public-acquisitions-1990-2005')`);
  assert.deepEqual(rows.rows[0],{count:6,eligible:0,with_geometry:0});
  const revocation=await pool.query<{survey_reference:string;plot_reference:string}>(`SELECT survey_reference,plot_reference FROM intelligence.land_events WHERE external_key='akwa-anua-offot-block-g-revocation'`);
  assert.deepEqual(revocation.rows[0],{survey_reference:'AK/U 175',plot_reference:'Plots 1–169, Block G'});
});

test("spatial acquisition campaigns enforce geometry-first execution order",async(t)=>{
  if(!available)return t.skip("PostGIS not reachable");
  const campaigns=await pool.query<{external_key:string;sequence_number:number;status:string;current_stage:string}>(`SELECT external_key,sequence_number,status,current_stage FROM provenance.spatial_acquisition_campaigns ORDER BY sequence_number`);
  assert.deepEqual(campaigns.rows.map(r=>r.external_key),[
    'ng-cross-river-spatial-rerun-v1','ng-akwa-ibom-spatial-rerun-v1','ng-national-spatial-assets-v1'
  ]);
  assert.equal(campaigns.rows[0].status,'inventory');
  assert.equal(campaigns.rows[0].current_stage,'government_inventory');
  assert.ok(campaigns.rows.slice(1).every(r=>r.status==='queued'));

  const inventory=await pool.query<{count:number;eligible:number;with_geometry:number}>(`SELECT count(*)::int count,count(*) FILTER(WHERE check_status='eligible')::int eligible,count(*) FILTER(WHERE geometry IS NOT NULL)::int with_geometry FROM provenance.spatial_asset_inventory WHERE campaign_id=(SELECT id FROM provenance.spatial_acquisition_campaigns WHERE external_key='ng-cross-river-spatial-rerun-v1')`);
  assert.deepEqual(inventory.rows[0],{count:13,eligible:0,with_geometry:0});
  assert.rejects(
    pool.query(`INSERT INTO provenance.spatial_asset_inventory(campaign_id,external_key,asset_name,asset_class,country_code,geometry_status,check_status) SELECT id,'test-invalid-eligible','Invalid fixture','other','NG','unavailable','eligible' FROM provenance.spatial_acquisition_campaigns WHERE external_key='ng-cross-river-spatial-rerun-v1'`),
    /check constraint/
  );
});

test("document evidence and review history are append-only",async(t)=>{
  if(!available)return t.skip("PostGIS not reachable");
  await assert.rejects(pool.query(`UPDATE intelligence.documents SET title='rewritten' WHERE external_key='crs-stat-yearbook-2024'`),/append-only/);
  await assert.rejects(pool.query(`DELETE FROM intelligence.review_events WHERE land_event_id=(SELECT id FROM intelligence.land_events WHERE external_key='crs-summit-hills-nkonib-return')`),/append-only/);
});

test("database rejects check eligibility without reviewed high-grade geometric evidence",async(t)=>{
  if(!available)return t.skip("PostGIS not reachable");
  await assert.rejects(pool.query(`UPDATE intelligence.land_events SET check_status='eligible' WHERE external_key='crs-summit-hills-nkonib-return'`),/check constraint/);
});

test("seed contract is idempotent and source keys remain unique",async(t)=>{
  if(!available)return t.skip("PostGIS not reachable");
  const before=await pool.query<{documents:number;events:number}>(`SELECT (SELECT count(*)::int FROM intelligence.documents WHERE external_key LIKE 'crs-%') documents,(SELECT count(*)::int FROM intelligence.land_events WHERE external_key LIKE 'crs-%') events`);
  await runMigrations();
  const afterRows=await pool.query<{documents:number;events:number}>(`SELECT (SELECT count(*)::int FROM intelligence.documents WHERE external_key LIKE 'crs-%') documents,(SELECT count(*)::int FROM intelligence.land_events WHERE external_key LIKE 'crs-%') events`);
  assert.deepEqual(afterRows.rows[0],before.rows[0]);
});

test("discovery supports at least six file families and quarantines numeric extraction",async(t)=>{
  if(!available)return t.skip("PostGIS not reachable");
  const profiles=await pool.query<{format_family:string;extensions:string[];extraction_route:string}>(`SELECT format_family,extensions,extraction_route FROM intelligence.discovery_profiles WHERE enabled ORDER BY priority,id`);
  assert.ok(profiles.rows.length>=6);
  assert.ok(["pdf","image","word","spreadsheet","delimited","geospatial","html","archive"].every(f=>profiles.rows.some(p=>p.format_family===f)));
  assert.ok(profiles.rows.find(p=>p.format_family==="geospatial")!.extensions.includes("kml"));
  const assets=await pool.query<{format_family:string;acquisition_status:string;extraction_status:string}>(`SELECT format_family,acquisition_status,extraction_status FROM intelligence.document_assets`);
  assert.ok(assets.rows.length>=4);
  assert.ok(assets.rows.every(a=>["discovered","downloaded"].includes(a.acquisition_status)));
  assert.ok(assets.rows.some(a=>a.acquisition_status==="downloaded"&&["text_extracted","complete"].includes(a.extraction_status)));
  assert.ok(assets.rows.every(a=>["pending","text_extracted","review_required","complete"].includes(a.extraction_status)));
});

test("Cross River expanded discovery pass persists more than the original four events",async(t)=>{
  if(!available)return t.skip("PostGIS not reachable");
  const counts=await pool.query<{events:number;documents:number;eligible:number}>(`SELECT
    (SELECT count(*)::int FROM intelligence.land_events WHERE external_key LIKE 'crs-%') events,
    (SELECT count(*)::int FROM intelligence.documents WHERE external_key LIKE 'crs-%') documents,
    (SELECT count(*)::int FROM intelligence.land_events WHERE external_key LIKE 'crs-%' AND check_status='eligible') eligible`);
  assert.ok(counts.rows[0].events>=19);
  assert.ok(counts.rows[0].documents>=19);
  assert.equal(counts.rows[0].eligible,0);
  const observations=await pool.query<{count:number}>(`SELECT count(*)::int count FROM intelligence.numeric_observations WHERE external_key IN ('crs-2024-q4-50k-ha-area','crs-2026-budget-50k-ha-area') AND interpretation_status='accepted'`);
  assert.equal(observations.rows[0].count,2);
});

test("AI analysis contract stores source JSON, coordinate provenance and quarantined geometry",async(t)=>{
  if(!available)return t.skip("PostGIS not reachable");
  config.intelligenceIngestionKey="test-worker-key";
  const observations=[
    ["a",4.9621,8.3261],["b",4.9621,8.3271],["c",4.9631,8.3271],["d",4.9631,8.3261]
  ].map(([key,latitude,longitude],index)=>({
    externalKey:`contract-v1-coordinate-${key}`,
    type:"latitude_longitude",
    pageNumber:12,
    locator:`table-2/row-${index+1}`,
    rawText:`${latitude}, ${longitude}`,
    values:{latitude,longitude},
    unit:"decimal_degrees",
    crsCandidates:["EPSG:4326"],
    confidence:0.91
  }));
  const payload={
    assetExternalKey:"crs-facts-figures-2024-pdf",
    analysisExternalKey:"test-land-analysis-contract-v1",
    extractionExternalKey:"test-land-extraction-contract-v1",
    analysisType:"tabular_coordinates",
    provider:"contract-test",
    model:"fixture",
    promptVersion:"v1",
    schemaVersion:"land-analysis/v1",
    rawResponse:{source:"unaltered provider response fixture"},
    confidence:0.91,
    structuredOutput:{
      observations,
      documentFacts:{locality:"Calabar"},
      geometryCandidates:[{
        externalKey:"test-land-geometry-contract-v1",
        method:"coordinate_table",
        sourceCrs:"EPSG:4326",
        geometryWgs84:{type:"Polygon",coordinates:[[[8.3261,4.9621],[8.3271,4.9621],[8.3271,4.9631],[8.3261,4.9631],[8.3261,4.9621]]]},
        observationExternalKeys:observations.map(o=>o.externalKey),
        confidence:0.9
      }]
    }
  };
  const response=await app.inject({method:"POST",url:"/api/internal/intelligence/analyses",headers:{"x-dende-ingestion-key":"test-worker-key"},payload});
  assert.ok([200,201].includes(response.statusCode),response.body);
  const stored=await pool.query<{raw_response:{source:string};structured_output:{observations:unknown[]}}>(`SELECT raw_response,structured_output FROM intelligence.analysis_runs WHERE external_key='test-land-analysis-contract-v1'`);
  assert.equal(stored.rows[0].raw_response.source,"unaltered provider response fixture");
  assert.equal(stored.rows[0].structured_output.observations.length,4);
  const coordinates=await pool.query<{count:number}>(`SELECT count(*)::int count FROM intelligence.numeric_observations WHERE analysis_run_id=(SELECT id FROM intelligence.analysis_runs WHERE external_key='test-land-analysis-contract-v1') AND observation_type='latitude_longitude' AND page_number=12`);
  assert.equal(coordinates.rows[0].count,4);
  const candidate=await pool.query<{validation_status:string;check_eligible:boolean;geometry:boolean}>(`SELECT validation_status,check_eligible,geometry IS NOT NULL geometry FROM intelligence.geometry_candidates WHERE external_key='test-land-geometry-contract-v1'`);
  assert.deepEqual(candidate.rows[0],{validation_status:"unreviewed",check_eligible:false,geometry:true});
  const review=await app.inject({method:"GET",url:"/api/internal/intelligence/review-queue",headers:{"x-dende-ingestion-key":"test-worker-key"}});
  assert.equal(review.statusCode,200);
  assert.ok((review.json() as {candidates:Array<{externalKey:string}>}).candidates.some(c=>c.externalKey==="test-land-geometry-contract-v1"));
});

test("intelligence worker endpoints fail closed without the shared credential",async(t)=>{
  if(!available)return t.skip("PostGIS not reachable");
  const response=await app.inject({method:"GET",url:"/api/internal/intelligence/assets/queue"});
  assert.equal(response.statusCode,401);
});
