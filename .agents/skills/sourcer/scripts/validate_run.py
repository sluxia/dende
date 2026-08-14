#!/usr/bin/env python3
import argparse, json, sys
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]

def load(path):
    with path.open(encoding="utf-8") as f: return json.load(f)

def validate(instance, schema_path, label):
    errors = sorted(Draft202012Validator(load(schema_path), format_checker=FormatChecker()).iter_errors(instance), key=lambda e: list(e.path))
    for error in errors: print(f"{label}: {list(error.path)}: {error.message}", file=sys.stderr)
    return not errors

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--run", type=Path)
    p.add_argument("--research-root", type=Path, default=Path("tmp/research"))
    p.add_argument("--check-lock", action="store_true")
    p.add_argument("--state")
    a=p.parse_args(); ok=True
    if a.check_lock:
        for run_dir in a.research_root.glob("*"):
            if not run_dir.is_dir(): continue
            state_file=run_dir/"run-state.json"
            if not state_file.exists() and ((run_dir/"query-log.json").exists() or (run_dir/"inventory-working.json").exists()):
                print(f"legacy run requires an explicit run-state.json: {run_dir}",file=sys.stderr);ok=False;continue
            if not state_file.exists(): continue
            state=load(state_file)
            if state.get("status")=="active" and state.get("stateKey") != a.state:
                print(f"active jurisdiction lock: {state_file} ({state.get('stateKey')})", file=sys.stderr); ok=False
    if a.run:
        for required in ("run-state.json","query-log.json"):
            if not (a.run/required).exists(): print(f"run: missing {required}",file=sys.stderr);ok=False
        if not ok:return 1
        state=load(a.run/"run-state.json")
        ok=validate(state, ROOT/"references/run-state.schema.json", "run-state") and ok
        log=load(a.run/"query-log.json")
        ok=validate(log, ROOT/"references/query-log.schema.json", "query-log") and ok
        numbers=[x.get("query_number") for x in log]
        if numbers != list(range(1,22)):
            print("query-log: query_number must be exactly 1..21 in order", file=sys.stderr); ok=False
        counts=state.get("assetCounts",{})
        if counts.get("researching",0)==0 and state.get("currentAssetExternalKey") is not None:
            print("run-state: currentAssetExternalKey requires researching=1", file=sys.stderr); ok=False
        if counts.get("researching",0)==1 and not state.get("currentAssetExternalKey"):
            print("run-state: researching=1 requires currentAssetExternalKey", file=sys.stderr); ok=False
        final_path=a.run/"final-output.json"
        if final_path.exists():
            total=len(load(final_path).get("assets",[]))
            classified=sum(counts.get(k,0) for k in ("inventoried","researching","blocked","completed"))
            if total!=classified:
                print(f"run-state: assetCounts total {classified} does not match final inventory {total}",file=sys.stderr);ok=False
        for handoff in (a.run/"handoffs").glob("*-approved.json") if (a.run/"handoffs").exists() else []:
            ok=validate(load(handoff),ROOT/"references/approved-asset.schema.json",str(handoff)) and ok
    if not (a.check_lock or a.run): p.error("use --check-lock and/or --run")
    if not ok: return 1
    print("sourcer run contract passed"); return 0

if __name__ == "__main__": raise SystemExit(main())
