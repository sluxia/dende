#!/usr/bin/env python3
import argparse, json, sys
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker

ROOT=Path(__file__).resolve().parents[1]
PROJECT=ROOT.parents[2]

def load(p):
    with p.open(encoding="utf-8") as f: return json.load(f)

def check(data,schema,label):
    errors=sorted(Draft202012Validator(load(schema),format_checker=FormatChecker()).iter_errors(data),key=lambda e:list(e.path))
    for e in errors: print(f"{label}: {list(e.path)}: {e.message}",file=sys.stderr)
    return not errors

def main():
    p=argparse.ArgumentParser();p.add_argument("--approved",type=Path,required=True);p.add_argument("--workspace",type=Path,required=True);a=p.parse_args();ok=True
    approved=load(a.approved); manifest=load(a.workspace/"manifest.json")
    ok=check(approved,ROOT.parent/"sourcer/references/approved-asset.schema.json","approved") and ok
    ok=check(manifest,ROOT/"references/acquisition-manifest.schema.json","manifest") and ok
    if approved.get("assetExternalKey") != manifest.get("assetExternalKey"): print("identity: assetExternalKey mismatch",file=sys.stderr);ok=False
    if approved.get("runKey") != manifest.get("runKey"): print("identity: runKey mismatch",file=sys.stderr);ok=False
    if approved.get("jurisdiction") != manifest.get("jurisdiction"): print("identity: target jurisdiction mismatch",file=sys.stderr);ok=False
    targets={x["url"] for x in approved.get("retrievalTargets",[])}
    files=manifest.get("files",[]); keys=[x.get("fileKey") for x in files]
    if len(keys)!=len(set(keys)): print("manifest: duplicate fileKey",file=sys.stderr);ok=False
    for f in files:
        if f.get("approvedUrl") not in targets: print(f"manifest: unapproved file {f.get('fileKey')}",file=sys.stderr);ok=False
        if f.get("relationship")=="unrelated_example" and f.get("supportsTargetBoundary"): print(f"manifest: unrelated file supports target boundary: {f.get('fileKey')}",file=sys.stderr);ok=False
        if f.get("requiresVisualInspection") and f.get("visualInspection",{}).get("status")!="completed": pass
    analysis_path=a.workspace/"analysis.json"
    if analysis_path.exists():
        analysis=load(analysis_path);ok=check(analysis,PROJECT/"docs/schemas/land-analysis-v1.schema.json","analysis") and ok
        if analysis.get("assetExternalKey")!=approved.get("assetExternalKey"):print("analysis: assetExternalKey mismatch",file=sys.stderr);ok=False
        observations=analysis.get("structuredOutput",{}).get("observations",[])
        sources=analysis.get("diagnostics",{}).get("observationSources",{})
        fmap={x.get("fileKey"):x for x in files}
        for obs in observations:
            key=obs.get("externalKey");src=sources.get(key)
            if not src: print(f"analysis: missing observationSources entry for {key}",file=sys.stderr);ok=False;continue
            if src.get("fileKey") not in fmap: print(f"analysis: unknown source file for {key}",file=sys.stderr);ok=False
            else:
                f=fmap[src["fileKey"]];sj=f.get("sourceJurisdiction") or {}
                if src.get("relationship")!=f.get("relationship") or src.get("supportsTargetBoundary")!=f.get("supportsTargetBoundary"):
                    print(f"analysis: source relationship mismatch for {key}",file=sys.stderr);ok=False
                if sj and (src.get("countryCode")!=sj.get("countryCode") or src.get("adminLevel1")!=sj.get("adminLevel1")):
                    print(f"analysis: source jurisdiction mismatch for {key}",file=sys.stderr);ok=False
        for candidate in analysis.get("structuredOutput",{}).get("geometryCandidates",[]):
            if manifest.get("relevanceAssessment",{}).get("decision")!="relevant":print(f"candidate {candidate.get('externalKey')}: manifest is not relevant",file=sys.stderr);ok=False
            for key in candidate.get("observationExternalKeys",[]):
                src=sources.get(key,{}); f=fmap.get(src.get("fileKey"),{})
                if not src.get("supportsTargetBoundary") or not f.get("supportsTargetBoundary"):print(f"candidate {candidate.get('externalKey')}: unrelated observation {key}",file=sys.stderr);ok=False
                sj=f.get("sourceJurisdiction")
                if sj and (sj.get("countryCode")!=approved["jurisdiction"]["countryCode"] or sj.get("adminLevel1")!=approved["jurisdiction"]["adminLevel1"]):print(f"candidate {candidate.get('externalKey')}: jurisdiction mismatch for {key}",file=sys.stderr);ok=False
                if f.get("requiresVisualInspection") and f.get("visualInspection",{}).get("status")!="completed":print(f"candidate {candidate.get('externalKey')}: visual inspection incomplete",file=sys.stderr);ok=False
    if not ok:return 1
    print("evidence acquisition contract passed");return 0

if __name__=="__main__":raise SystemExit(main())
