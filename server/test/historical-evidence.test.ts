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
  assert.deepEqual(campaigns.rows.slice(0,3).map(r=>r.external_key),[
    'ng-cross-river-spatial-rerun-v1','ng-akwa-ibom-spatial-rerun-v1','ng-national-spatial-assets-v1'
  ]);
  assert.ok(['inventory','validating','paused'].includes(campaigns.rows[0].status));
  assert.ok(['government_inventory','validation'].includes(campaigns.rows[0].current_stage));
  assert.ok(campaigns.rows.slice(1,3).every(r=>r.status==='queued'));

  const inventory=await pool.query<{count:number;eligible:number;with_geometry:number}>(`SELECT count(*)::int count,count(*) FILTER(WHERE check_status='eligible')::int eligible,count(*) FILTER(WHERE geometry IS NOT NULL)::int with_geometry FROM provenance.spatial_asset_inventory WHERE campaign_id=(SELECT id FROM provenance.spatial_acquisition_campaigns WHERE external_key='ng-cross-river-spatial-rerun-v1')`);
  assert.ok(inventory.rows[0].count>=23);
  assert.equal(inventory.rows[0].eligible,0);
  assert.equal(inventory.rows[0].with_geometry,0);
  assert.rejects(
    pool.query(`INSERT INTO provenance.spatial_asset_inventory(campaign_id,external_key,asset_name,asset_class,country_code,geometry_status,check_status) SELECT id,'test-invalid-eligible','Invalid fixture','other','NG','unavailable','eligible' FROM provenance.spatial_acquisition_campaigns WHERE external_key='ng-cross-river-spatial-rerun-v1'`),
    /check constraint/
  );
});

test("Cross River inventory includes high-risk urban government assets",async(t)=>{
  if(!available)return t.skip("PostGIS not reachable");
  const rows=await pool.query<{external_key:string;risk_priority:number;check_status:string;survey_reference:string|null}>(`SELECT external_key,risk_priority,check_status,survey_reference FROM provenance.spatial_asset_inventory WHERE external_key IN ('crs-asset-tinapa','crs-asset-marina-resort','crs-asset-summit-hills','crs-asset-cicc','crs-asset-summit-hills-monorail-row','crs-asset-calabar-free-trade-zone','crs-asset-obudu-mountain-resort','crs-asset-kwa-falls')`);
  assert.equal(rows.rows.length,8);
  assert.ok(rows.rows.every(r=>r.check_status==='excluded'));
  assert.ok(rows.rows.filter(r=>r.risk_priority===1).length>=6);
  assert.equal(rows.rows.find(r=>r.external_key==='crs-asset-summit-hills')?.survey_reference,'CR/C 1187');
});

test("UNIDO Calabar EPZ plan is production evidence but not invented check geometry",async(t)=>{
  if(!available)return t.skip("PostGIS not reachable");
  const asset=await pool.query<{
    stated_area_sqm:string;acquisition_status:string;processing_status:string;
    geometry_status:string;check_status:string;geometry:boolean;file_url:string|null;
  }>(`SELECT stated_area_sqm::text,acquisition_status,processing_status,geometry_status,
             check_status,geometry IS NOT NULL geometry,file_url
        FROM provenance.spatial_asset_inventory
       WHERE external_key='crs-asset-calabar-free-trade-zone'`);
  assert.deepEqual(asset.rows[0],{
    stated_area_sqm:'1060000',acquisition_status:'downloaded',
    processing_status:'geometry_found',geometry_status:'located',
    check_status:'excluded',geometry:false,
    file_url:'https://downloads.unido.org/ot/49/90/4990556/15001-20000_19569.pdf'
  });

  const observations=await pool.query<{external_key:string;normalized_values:{hectares:number;assigned?:boolean}}>(
    `SELECT external_key,normalized_values FROM intelligence.numeric_observations
      WHERE external_key IN ('crs-calabar-epz-unido-assigned-area-106ha','crs-calabar-epz-unido-proposed-extension-200ha')
      ORDER BY external_key`
  );
  assert.equal(observations.rows.length,2);
  assert.equal(observations.rows.find(r=>r.external_key.endsWith('106ha'))?.normalized_values.hectares,106);
  assert.equal(observations.rows.find(r=>r.external_key.endsWith('200ha'))?.normalized_values.assigned,false);

  const source=await pool.query<{status:string;coverage_status:string;access_stage:string;imports:number}>(
    `SELECT s.status,s.coverage_status,s.access_stage,
            (SELECT count(*)::int FROM provenance.data_imports i WHERE i.source_id=s.id) imports
       FROM provenance.data_sources s
      WHERE s.name='UNIDO Calabar Export Processing Zone feasibility study and plans (1991)'`
  );
  assert.deepEqual(source.rows[0],{status:'partial',coverage_status:'unavailable',access_stage:'usable',imports:1});
});

test("Marina Resort evidence stores state control and a quarantined location point",async(t)=>{
  if(!available)return t.skip("PostGIS not reachable");
  const asset=await pool.query<{acquisition_status:string;processing_status:string;geometry_status:string;check_status:string;geometry:boolean}>(
    `SELECT acquisition_status,processing_status,geometry_status,check_status,geometry IS NOT NULL geometry
       FROM provenance.spatial_asset_inventory WHERE external_key='crs-asset-marina-resort'`
  );
  assert.deepEqual(asset.rows[0],{acquisition_status:'downloaded',processing_status:'geometry_found',geometry_status:'located',check_status:'excluded',geometry:false});

  const point=await pool.query<{normalized_values:{latitude:number;longitude:number;boundaryVertex:boolean}}>(
    `SELECT normalized_values FROM intelligence.numeric_observations WHERE external_key='crs-marina-resort-reference-point-2023'`
  );
  assert.deepEqual(point.rows[0].normalized_values,{latitude:4.966083,longitude:8.318607,role:'location reference',boundaryVertex:false});

  const validation=await pool.query<{outcome:string;observed_values:{featureType:string;buffered:boolean}}>(
    `SELECT outcome,observed_values FROM provenance.spatial_validation_events
      WHERE candidate_reference='AJHTL 2023 Table 1 Point 8'`
  );
  assert.equal(validation.rows[0].outcome,'failed');
  assert.equal(validation.rows[0].observed_values.featureType,'point');
  assert.equal(validation.rows[0].observed_values.buffered,false);
});

test("Obudu resort stays separate from its federal road ROW and Becheve reserve",async(t)=>{
  if(!available)return t.skip("PostGIS not reachable");
  const rows=await pool.query<{external_key:string;asset_class:string;geometry_status:string;check_status:string;geometry:boolean}>(
    `SELECT external_key,asset_class,geometry_status,check_status,geometry IS NOT NULL geometry
       FROM provenance.spatial_asset_inventory
      WHERE external_key IN ('crs-asset-obudu-mountain-resort','crs-asset-obudu-cattle-ranch-road-row','crs-asset-becheve-nature-reserve')
      ORDER BY external_key`
  );
  assert.equal(rows.rows.length,3);
  assert.equal(rows.rows.find(r=>r.external_key.endsWith('road-row'))?.asset_class,'transport_right_of_way');
  assert.equal(rows.rows.find(r=>r.external_key.endsWith('nature-reserve'))?.asset_class,'conservation_area');
  assert.ok(rows.rows.every(r=>r.check_status==='excluded'&&!r.geometry));

  const gazette=await pool.query<{metadata:{beaconCount:number;declaredCrs:string};extraction_status:string}>(
    `SELECT metadata,extraction_status FROM intelligence.document_assets WHERE external_key='ng-2019-obudu-cattle-ranch-road-row-pdf'`
  );
  assert.equal(gazette.rows[0].metadata.beaconCount,262);
  assert.equal(gazette.rows[0].metadata.declaredCrs,'EPSG:32632');
  assert.equal(gazette.rows[0].extraction_status,'review_required');

  const validation=await pool.query<{outcome:string;observed_values:{automatedRowsAccepted:number;geometryCreated:boolean}}>(
    `SELECT outcome,observed_values FROM provenance.spatial_validation_events WHERE candidate_reference='S.I. No. 58 of 2019 / ZRW2-001-ZRW2-262'`
  );
  assert.equal(validation.rows[0].outcome,'inconclusive');
  assert.equal(validation.rows[0].observed_values.automatedRowsAccepted,0);
  assert.equal(validation.rows[0].observed_values.geometryCreated,false);
});

test("spatial worker queue exposes stored assets one at a time while inventory is open",async(t)=>{
  if(!available)return t.skip("PostGIS not reachable");
  config.intelligenceIngestionKey='test-worker-key';
  const response=await app.inject({method:'GET',url:'/api/internal/spatial-assets/queue?limit=1',headers:{'x-dende-ingestion-key':'test-worker-key'}});
  assert.equal(response.statusCode,200);
  const body=response.json() as {inventoryOpen:boolean;assets:Array<{externalKey:string;riskPriority:number;processingStatus:string}>};
  assert.equal(body.inventoryOpen,true);
  assert.equal(body.assets.length,1);
  assert.equal(body.assets[0].riskPriority,1);
  assert.equal(body.assets[0].processingStatus,'queued');
});

test("public asset inventory appears in sources without becoming check eligible",async(t)=>{
  if(!available)return t.skip("PostGIS not reachable");
  const response=await app.inject({method:'GET',url:'/api/sources'});
  assert.equal(response.statusCode,200);
  const body=response.json() as {assets:Array<{name:string;visibility:string;checkStatus:string}>};
  assert.ok(body.assets.length>=49);
  assert.ok(body.assets.some(asset=>asset.name.includes('Tinapa')));
  assert.ok(body.assets.every(asset=>asset.visibility==='public'));
  assert.ok(body.assets.every(asset=>asset.checkStatus==='excluded'));
});

test("point-only protected-area records fail boundary validation",async(t)=>{
  if(!available)return t.skip("PostGIS not reachable");
  const oban=await pool.query<{geometry_status:string;check_status:string;acquisition_status:string;geometry:boolean}>(`SELECT geometry_status,check_status,acquisition_status,geometry IS NOT NULL geometry FROM provenance.spatial_asset_inventory WHERE external_key='crs-asset-crnp-oban'`);
  assert.deepEqual(oban.rows[0],{geometry_status:'unavailable',check_status:'excluded',acquisition_status:'under_review',geometry:false});
  const events=await pool.query<{candidate_reference:string;outcome:string;observed_values:{featureType?:string;gisAreaKm2?:number}}>(`SELECT candidate_reference,outcome,observed_values FROM provenance.spatial_validation_events WHERE asset_id=(SELECT id FROM provenance.spatial_asset_inventory WHERE external_key='crs-asset-crnp-oban') ORDER BY candidate_reference`);
  assert.equal(events.rows.find(r=>r.candidate_reference==='WDPA 40925')?.outcome,'failed');
  assert.equal(events.rows.find(r=>r.candidate_reference==='WDPA 40925')?.observed_values.featureType,'point');
  assert.equal(events.rows.find(r=>r.candidate_reference==='WDPA 40925')?.observed_values.gisAreaKm2,0);
  assert.equal(events.rows.find(r=>r.candidate_reference==='WDPA 20299')?.outcome,'inconclusive');
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
  const assets=await pool.query<{format_family:string;acquisition_status:string;extraction_status:string;metadata:{failure?:string}}>(`SELECT format_family,acquisition_status,extraction_status,metadata FROM intelligence.document_assets`);
  assert.ok(assets.rows.length>=4);
  assert.ok(assets.rows.every(a=>["discovered","queued","downloaded","failed","blocked"].includes(a.acquisition_status)));
  assert.ok(assets.rows.some(a=>a.acquisition_status==="downloaded"&&["text_extracted","complete"].includes(a.extraction_status)));
  assert.ok(assets.rows.every(a=>["pending","text_extracted","ocr_required","ocr_complete","review_required","complete","failed"].includes(a.extraction_status)));
  assert.ok(assets.rows.filter(a=>a.acquisition_status==="failed").every(a=>Boolean(a.metadata.failure)));
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
