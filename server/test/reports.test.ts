import test from "node:test";
import assert from "node:assert/strict";
import { renderEvidenceReportHtml } from "../src/reports";

test("permanent report view exposes identity, limitations, sources and integrity hash",()=>{
  const html=renderEvidenceReportHtml({
    id:"11111111-1111-4111-8111-111111111111",reportNumber:"DENDE-2026-ABC123",plotId:"22222222-2222-4222-8222-222222222222",checkRunId:"33333333-3333-4333-8333-333333333333",reportVersion:"1.0",locale:"en-NG",generatedAt:"2026-08-13T12:00:00Z",contentHash:"abc123",
    snapshot:{disclaimer:"Automated land-risk screening, not proof of title or legal certification.",coverageStatement:"No conflict in available data only.",plot:{id:"22222222-2222-4222-8222-222222222222",crs:"EPSG:4326"},check:{ranAt:"2026-08-13T11:59:00Z",trigger:"registration",parseMethod:"manual",plotAreaSqm:500,overlaps:[],zoningAlerts:[]},consultedSources:[{name:"Test reserve layer",geography:"Cross River",authorityLevel:"reference",coverageStatus:"partial"}]}
  });
  assert.match(html,/DENDE-2026-ABC123/);assert.match(html,/No conflict found/);assert.match(html,/not proof of title/);assert.match(html,/Test reserve layer/);assert.match(html,/SHA-256 abc123/);assert.match(html,/Download evidence JSON/);
});
