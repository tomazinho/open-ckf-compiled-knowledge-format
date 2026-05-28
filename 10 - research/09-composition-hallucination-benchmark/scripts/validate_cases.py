#!/usr/bin/env python3
"""
validate_cases.py — Validate benchmark case files against the JSON Schema and
check cross-language / CKF parity.

Usage:
    python scripts/validate_cases.py
    python scripts/validate_cases.py --root .            # repo root (default: auto-detect)
    python scripts/validate_cases.py --strict-ckf        # also validate CKF exports structurally

Exit code 0 if everything validates and parity holds; non-zero otherwise.
This script has no third-party dependencies beyond `jsonschema`.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from glob import glob


def find_root(explicit: str | None) -> str:
    if explicit:
        return os.path.abspath(explicit)
    # Auto-detect: walk up from this file until we find schema/case_schema.json
    here = os.path.dirname(os.path.abspath(__file__))
    candidate = os.path.dirname(here)  # parent of scripts/
    if os.path.exists(os.path.join(candidate, "schema", "case_schema.json")):
        return candidate
    return os.getcwd()


def load_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_against_schema(root: str) -> tuple[bool, list[str]]:
    try:
        import jsonschema
    except ImportError:
        print("ERROR: jsonschema not installed. Run: pip install jsonschema", file=sys.stderr)
        sys.exit(2)

    schema = load_json(os.path.join(root, "schema", "case_schema.json"))
    errors: list[str] = []

    for subdir in ("cases", "cases_pt-br"):
        d = os.path.join(root, subdir)
        if not os.path.isdir(d):
            continue
        files = sorted(glob(os.path.join(d, "*.json")))
        ok = 0
        for fp in files:
            case = load_json(fp)
            try:
                jsonschema.validate(case, schema)
                ok += 1
            except jsonschema.ValidationError as e:
                errors.append(f"{subdir}/{os.path.basename(fp)}: {e.message}")
        print(f"  {subdir}: {ok}/{len(files)} valid")

    return (len(errors) == 0), errors


def check_parity(root: str) -> tuple[bool, list[str]]:
    issues: list[str] = []

    def ids_in(subdir: str, suffix: str = ".json") -> set[str]:
        d = os.path.join(root, subdir)
        if not os.path.isdir(d):
            return set()
        out = set()
        for fp in sorted(glob(os.path.join(d, f"*{suffix}"))):
            try:
                out.add(load_json(fp)["case_id"])
            except (KeyError, json.JSONDecodeError):
                # fall back to filename stem
                out.add(os.path.basename(fp).split(".")[0])
        return out

    en = ids_in("cases")
    pt = ids_in("cases_pt-br")
    if pt and en != pt:
        issues.append(f"EN/PT-BR case_id mismatch: EN-only={en - pt}, PT-only={pt - en}")

    # CKF parity by filename stem (CKF uses .ckf.json and may have different case_id casing)
    ckf_dir = os.path.join(root, "ckf", "cases")
    if os.path.isdir(ckf_dir):
        ckf_stems = {os.path.basename(f).replace(".ckf.json", "")
                     for f in glob(os.path.join(ckf_dir, "*.ckf.json"))}
        en_stems = {os.path.basename(f).replace(".json", "")
                    for f in glob(os.path.join(root, "cases", "*.json"))}
        if ckf_stems and ckf_stems != en_stems:
            issues.append(f"EN/CKF filename mismatch: EN-only={en_stems - ckf_stems}, "
                          f"CKF-only={ckf_stems - en_stems}")

    return (len(issues) == 0), issues


def check_local_probes(root: str) -> list[str]:
    """Soft check: every case should have >= 2 local probes (per protocol §7.2)."""
    warnings: list[str] = []
    for fp in sorted(glob(os.path.join(root, "cases", "*.json"))):
        case = load_json(fp)
        n = len(case.get("local_probes", []))
        if n < 2:
            warnings.append(f"{os.path.basename(fp)}: only {n} local probe(s) (protocol recommends >= 2)")
    return warnings


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=None, help="Repository root. Auto-detected by default.")
    ap.add_argument("--strict-ckf", action="store_true",
                    help="Reserved: validate CKF exports structurally (CKF has its own mapping schema).")
    args = ap.parse_args()

    root = find_root(args.root)
    print(f"Repository root: {root}\n")

    print("Schema validation:")
    schema_ok, schema_errors = validate_against_schema(root)
    for e in schema_errors:
        print(f"  FAIL: {e}")

    print("\nParity checks:")
    parity_ok, parity_issues = check_parity(root)
    if parity_ok:
        print("  EN / PT-BR / CKF parity: OK")
    else:
        for i in parity_issues:
            print(f"  FAIL: {i}")

    print("\nLocal-probe coverage:")
    probe_warnings = check_local_probes(root)
    if not probe_warnings:
        print("  All cases have >= 2 local probes.")
    else:
        for w in probe_warnings:
            print(f"  WARN: {w}")

    print()
    if schema_ok and parity_ok:
        print("RESULT: PASS")
        sys.exit(0)
    else:
        print("RESULT: FAIL")
        sys.exit(1)


if __name__ == "__main__":
    main()
