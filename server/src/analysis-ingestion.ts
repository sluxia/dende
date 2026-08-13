import { pool } from "./db";

const OBSERVATION_TYPES = new Set(["coordinate_pair","latitude_longitude","bearing_distance","area","beacon","plot_number","survey_number","title_number","date","other"]);
const ANALYSIS_TYPES = new Set(["land_document","survey_plan","layout_plan","map","tabular_coordinates","general_discovery"]);
const METHODS = new Set(["coordinate_table","bearing_traverse","geocoded_extent","digitized_plan","linked_dataset"]);

export interface AnalysisObservationInput {
  externalKey: string;
  type: string;
  pageNumber?: number | null;
  locator?: string | null;
  rawText: string;
  values: Record<string, unknown>;
  unit?: string | null;
  crsCandidates?: string[];
  confidence: number;
}

export interface GeometryCandidateInput {
  externalKey: string;
  method: string;
  sourceCrs?: string | null;
  /** GeoJSON already transformed to WGS84. Original/source CRS is recorded separately. */
  geometryWgs84?: { type: "Polygon" | "MultiPolygon"; coordinates: unknown } | null;
  observationExternalKeys: string[];
  confidence: number;
  closureErrorM?: number | null;
  areaDifferencePercent?: number | null;
  landEventId?: string | null;
}

export interface AnalysisIngestionInput {
  assetExternalKey: string;
  analysisExternalKey: string;
  extractionExternalKey: string;
  analysisType: string;
  provider: string;
  model: string;
  modelVersion?: string | null;
  promptVersion: string;
  schemaVersion: "land-analysis/v1";
  inputChecksum?: string | null;
  rawResponse: unknown;
  structuredOutput: {
    observations: AnalysisObservationInput[];
    geometryCandidates?: GeometryCandidateInput[];
    documentFacts?: Record<string, unknown>;
    warnings?: string[];
  };
  confidence?: number | null;
  usageMetadata?: Record<string, unknown>;
  diagnostics?: Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}
function confidence(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${field} must be between 0 and 1`);
  return value;
}

export function validateAnalysisInput(input: AnalysisIngestionInput): void {
  text(input.assetExternalKey,"assetExternalKey"); text(input.analysisExternalKey,"analysisExternalKey"); text(input.extractionExternalKey,"extractionExternalKey");
  text(input.provider,"provider"); text(input.model,"model"); text(input.promptVersion,"promptVersion");
  if(input.schemaVersion!=="land-analysis/v1") throw new Error("Unsupported schemaVersion");
  if(!ANALYSIS_TYPES.has(input.analysisType)) throw new Error("Unsupported analysisType");
  if(typeof input.structuredOutput!=="object"||input.structuredOutput===null) throw new Error("structuredOutput is required");
  if(!Array.isArray(input.structuredOutput.observations)) throw new Error("structuredOutput.observations must be an array");
  if(input.confidence!=null) confidence(input.confidence,"confidence");
  const keys=new Set<string>();
  for(const [index,item] of input.structuredOutput.observations.entries()){
    text(item.externalKey,`observations[${index}].externalKey`); text(item.rawText,`observations[${index}].rawText`);
    if(keys.has(item.externalKey)) throw new Error(`Duplicate observation externalKey: ${item.externalKey}`); keys.add(item.externalKey);
    if(!OBSERVATION_TYPES.has(item.type)) throw new Error(`Unsupported observation type: ${item.type}`);
    if(typeof item.values!=="object"||item.values===null||Array.isArray(item.values)) throw new Error(`observations[${index}].values must be an object`);
    confidence(item.confidence,`observations[${index}].confidence`);
    if(item.crsCandidates&&!item.crsCandidates.every(v=>typeof v==="string"&&v.length>0)) throw new Error(`observations[${index}].crsCandidates is invalid`);
  }
  for(const candidate of input.structuredOutput.geometryCandidates??[]){
    text(candidate.externalKey,"geometryCandidates.externalKey");
    if(!METHODS.has(candidate.method)) throw new Error(`Unsupported geometry method: ${candidate.method}`);
    confidence(candidate.confidence,"geometryCandidates.confidence");
    if(!candidate.observationExternalKeys.length) throw new Error("Geometry candidate must reference observations");
    if(candidate.observationExternalKeys.some(k=>!keys.has(k))) throw new Error("Geometry candidate references an unknown observation");
    if(candidate.geometryWgs84&&candidate.geometryWgs84.type!=="Polygon"&&candidate.geometryWgs84.type!=="MultiPolygon") throw new Error("Candidate geometry must be Polygon or MultiPolygon");
  }
}

export async function ingestAnalysis(input: AnalysisIngestionInput): Promise<{analysisRunId:string;observationIds:string[];geometryCandidateIds:string[];created:boolean}> {
  validateAnalysisInput(input);
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const existing=await client.query<{id:string}>(`SELECT id FROM intelligence.analysis_runs WHERE external_key=$1`,[input.analysisExternalKey]);
    if(existing.rows[0]){await client.query("COMMIT");return {analysisRunId:existing.rows[0].id,observationIds:[],geometryCandidateIds:[],created:false};}
    const asset=await client.query<{id:string}>(`SELECT id FROM intelligence.document_assets WHERE external_key=$1`,[input.assetExternalKey]);
    if(!asset.rows[0]) throw new Error("Asset not found");
    const extraction=await client.query<{id:string}>(`INSERT INTO intelligence.extraction_runs(asset_id,external_key,extractor,extractor_version,run_status,diagnostics,completed_at) VALUES($1,$2,$3,$4,'complete',$5,now()) RETURNING id`,[asset.rows[0].id,input.extractionExternalKey,`ai:${input.provider}`,input.modelVersion??input.model,JSON.stringify(input.diagnostics??{})]);
    const analysis=await client.query<{id:string}>(`INSERT INTO intelligence.analysis_runs(asset_id,external_key,analysis_type,provider,model,model_version,prompt_version,schema_version,input_checksum,status,raw_response,structured_output,confidence,usage_metadata,diagnostics,completed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'complete',$10,$11,$12,$13,$14,now()) RETURNING id`,[asset.rows[0].id,input.analysisExternalKey,input.analysisType,input.provider,input.model,input.modelVersion??null,input.promptVersion,input.schemaVersion,input.inputChecksum??null,JSON.stringify(input.rawResponse??{}),JSON.stringify(input.structuredOutput??{}),input.confidence??null,JSON.stringify(input.usageMetadata??{}),JSON.stringify(input.diagnostics??{})]);
    const observationIds:string[]=[]; const observationMap=new Map<string,string>();
    for(const item of input.structuredOutput.observations){
      const row=await client.query<{id:string}>(`INSERT INTO intelligence.numeric_observations(extraction_run_id,analysis_run_id,external_key,observation_type,page_number,locator,raw_text,normalized_values,unit,crs_candidates,extraction_confidence,interpretation_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'unreviewed') RETURNING id`,[extraction.rows[0].id,analysis.rows[0].id,item.externalKey,item.type,item.pageNumber??null,item.locator??null,item.rawText,JSON.stringify(item.values),item.unit??null,item.crsCandidates??[],item.confidence]);
      observationIds.push(row.rows[0].id); observationMap.set(item.externalKey,row.rows[0].id);
    }
    const geometryCandidateIds:string[]=[];
    for(const candidate of input.structuredOutput.geometryCandidates??[]){
      const geo=candidate.geometryWgs84?JSON.stringify(candidate.geometryWgs84):null;
      const row=await client.query<{id:string}>(`INSERT INTO intelligence.geometry_candidates(land_event_id,external_key,method,source_crs,geometry,closure_error_m,area_difference_percent,confidence,validation_status,check_eligible) VALUES($1,$2,$3,$4,CASE WHEN $5::text IS NULL THEN NULL ELSE ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($5),4326)) END,$6,$7,$8,'unreviewed',false) RETURNING id`,[candidate.landEventId??null,candidate.externalKey,candidate.method,candidate.sourceCrs??null,geo,candidate.closureErrorM??null,candidate.areaDifferencePercent??null,candidate.confidence]);
      geometryCandidateIds.push(row.rows[0].id);
      for(const [sequence,key] of candidate.observationExternalKeys.entries()) await client.query(`INSERT INTO intelligence.geometry_candidate_observations(geometry_candidate_id,numeric_observation_id,sequence_number) VALUES($1,$2,$3)`,[row.rows[0].id,observationMap.get(key),sequence+1]);
    }
    await client.query(`UPDATE intelligence.document_assets SET extraction_status='review_required' WHERE id=$1`,[asset.rows[0].id]);
    await client.query("COMMIT");
    return {analysisRunId:analysis.rows[0].id,observationIds,geometryCandidateIds,created:true};
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
