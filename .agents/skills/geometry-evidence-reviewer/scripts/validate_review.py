#!/usr/bin/env python3
import argparse,json,subprocess,sys
from pathlib import Path
from jsonschema import Draft202012Validator,FormatChecker

ROOT=Path(__file__).resolve().parents[1]

def load(p):
    with p.open(encoding="utf-8") as f:return json.load(f)

def schema_check(data,path,label):
    errors=sorted(Draft202012Validator(load(path),format_checker=FormatChecker()).iter_errors(data),key=lambda e:list(e.path))
    for e in errors:print(f"{label}: {list(e.path)}: {e.message}",file=sys.stderr)
    return not errors

def main():
    p=argparse.ArgumentParser();p.add_argument("--approved",type=Path,required=True);p.add_argument("--acquisition",type=Path,required=True);p.add_argument("--review",type=Path,required=True);a=p.parse_args();ok=True
    acquisition_validator=ROOT.parent/"evidence-acquirer/scripts/validate_acquisition.py"
    result=subprocess.run([sys.executable,str(acquisition_validator),"--approved",str(a.approved),"--workspace",str(a.acquisition)],capture_output=True,text=True)
    if result.returncode:print(result.stderr or result.stdout,file=sys.stderr);ok=False
    approved=load(a.approved);analysis=load(a.acquisition/"analysis.json");review=load(a.review/"review.json")
    ok=schema_check(review,ROOT/"references/review-v1.schema.json","review") and ok
    if review.get("assetExternalKey")!=approved.get("assetExternalKey") or review.get("assetExternalKey")!=analysis.get("assetExternalKey"):print("review: asset identity mismatch",file=sys.stderr);ok=False
    if review.get("inputAnalysisExternalKey")!=analysis.get("analysisExternalKey"):print("review: analysis identity mismatch",file=sys.stderr);ok=False
    if review.get("inputChecksumSha256")!=analysis.get("inputChecksum"):print("review: input checksum mismatch",file=sys.stderr);ok=False
    candidates={x.get("externalKey"):x for x in analysis.get("structuredOutput",{}).get("geometryCandidates",[])}
    if review.get("candidateExternalKey") not in candidates:print("review: candidate not found in analysis",file=sys.stderr);ok=False
    gates=review.get("gates",[]);names=[x.get("gate") for x in gates]
    expected={"provenance","asset_identity","observation_fidelity","crs_semantics","construction","geometric_validity","closure_topology","area_agreement","geographic_plausibility","instrument_currency","coverage_activation"}
    if set(names)!=expected or len(names)!=len(expected):print("review: gates must contain each mandatory gate exactly once",file=sys.stderr);ok=False
    identity=review.get("identity",{})
    if not all(identity.get(x) is True for x in ("assetMatches","jurisdictionMatches","candidateSourcesSupportTarget")) and review.get("decision")!="rejected":
        print("review: failed asset identity requires rejected decision",file=sys.stderr);ok=False
    if review.get("decision")=="accepted" and any(x.get("status") in ("failed","ambiguous") for x in gates):print("review: accepted decision has failed/ambiguous gate",file=sys.stderr);ok=False
    if review.get("activationRecommended"):
        prereq=review.get("activationPrerequisites",{})
        if not all(prereq.values()):print("review: activation recommended without all prerequisites",file=sys.stderr);ok=False
        if review.get("coverage",{}).get("status")!="full":print("review: activation recommendation requires full coverage",file=sys.stderr);ok=False
    if not ok:return 1
    print("geometry evidence review contract passed");return 0

if __name__=="__main__":raise SystemExit(main())
