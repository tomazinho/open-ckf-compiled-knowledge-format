#!/usr/bin/env python3
"""
build_jsonl.py — Rebuild derived data artifacts from the canonical case files.

Regenerates, deterministically, from cases/ and cases_pt-br/:
    data/cases.jsonl
    data/cases_pt-br.jsonl
    data/case_index.csv
    data/dataset_summary.json

Usage:
    python scripts/build_jsonl.py
    python scripts/build_jsonl.py --root . --version 0.5.0

The canonical sources of truth are the per-case JSON files. These derived
artifacts are conveniences for HuggingFace loading and quick inspection and
should never be hand-edited.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from collections import Counter
from datetime import date
from glob import glob


def find_root(explicit: str | None) -> str:
    if explicit:
        return os.path.abspath(explicit)
    here = os.path.dirname(os.path.abspath(__file__))
    candidate = os.path.dirname(here)
    if os.path.exists(os.path.join(candidate, "schema", "case_schema.json")):
        return candidate
    return os.getcwd()


def load_case_files(directory: str) -> list[tuple[str, dict]]:
    out = []
    for fp in sorted(glob(os.path.join(directory, "*.json"))):
        with open(fp, "r", encoding="utf-8") as f:
            out.append((os.path.basename(fp), json.load(f)))
    return out


def write_jsonl(cases: list[tuple[str, dict]], out_path: str) -> int:
    with open(out_path, "w", encoding="utf-8") as f:
        for _, case in cases:
            f.write(json.dumps(case, ensure_ascii=False) + "\n")
    return len(cases)


def build_index(en_cases: list[tuple[str, dict]], root: str, out_path: str) -> None:
    pt_stems = {os.path.basename(f).replace(".json", "")
                for f in glob(os.path.join(root, "cases_pt-br", "*.json"))}
    ckf_stems = {os.path.basename(f).replace(".ckf.json", "")
                 for f in glob(os.path.join(root, "ckf", "cases", "*.ckf.json"))}

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "filename", "case_id", "domain", "relation_type", "complexity_level",
            "source_status", "has_pt_br", "has_ckf_export", "source_title",
        ])
        for filename, case in en_cases:
            stem = filename.replace(".json", "")
            md = case["metadata"]
            prov = case.get("provenance", {}) or {}
            w.writerow([
                filename,
                case["case_id"],
                md["domain"],
                md["relation_type"],
                md["complexity_level"],
                md["source_status"],
                "yes" if stem in pt_stems else "no",
                "yes" if stem in ckf_stems else "no",
                prov.get("source_title", ""),
            ])


def build_summary(en_cases: list[tuple[str, dict]], root: str, out_path: str,
                  version: str) -> dict:
    by_domain = Counter()
    by_relation = Counter()
    by_complexity = Counter()
    by_source = Counter()
    for _, case in en_cases:
        md = case["metadata"]
        by_domain[md["domain"]] += 1
        by_relation[md["relation_type"]] += 1
        by_complexity[str(md["complexity_level"])] += 1
        by_source[md["source_status"]] += 1

    pt_count = len(glob(os.path.join(root, "cases_pt-br", "*.json")))
    ckf_count = len(glob(os.path.join(root, "ckf", "cases", "*.ckf.json")))

    summary = {
        "version": version,
        "total_cases": len(en_cases),
        "canonical_language": "en",
        "parallel_languages": ["pt-BR"] if pt_count else [],
        "ckf_compatible_exports": ckf_count,
        "python_runner_included": True,
        "by_domain": dict(sorted(by_domain.items())),
        "by_relation_type": dict(sorted(by_relation.items())),
        "by_complexity_level": dict(sorted(by_complexity.items())),
        "by_source_status": dict(sorted(by_source.items())),
        "updated": date.today().isoformat(),
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
        f.write("\n")
    return summary


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=None)
    ap.add_argument("--version", default=None,
                    help="Version string to stamp into dataset_summary.json. "
                         "If omitted, read from data/dataset_summary.json or default.")
    args = ap.parse_args()

    root = find_root(args.root)
    data_dir = os.path.join(root, "data")
    os.makedirs(data_dir, exist_ok=True)

    en_cases = load_case_files(os.path.join(root, "cases"))
    if not en_cases:
        print(f"ERROR: no cases found in {os.path.join(root, 'cases')}", file=sys.stderr)
        sys.exit(2)

    version = args.version
    if version is None:
        try:
            version = json.load(open(os.path.join(data_dir, "dataset_summary.json")))["version"]
        except (FileNotFoundError, KeyError, json.JSONDecodeError):
            version = "0.0.0-draft"

    n_en = write_jsonl(en_cases, os.path.join(data_dir, "cases.jsonl"))
    print(f"Wrote data/cases.jsonl ({n_en} cases)")

    pt_dir = os.path.join(root, "cases_pt-br")
    if os.path.isdir(pt_dir):
        pt_cases = load_case_files(pt_dir)
        if pt_cases:
            n_pt = write_jsonl(pt_cases, os.path.join(data_dir, "cases_pt-br.jsonl"))
            print(f"Wrote data/cases_pt-br.jsonl ({n_pt} cases)")

    build_index(en_cases, root, os.path.join(data_dir, "case_index.csv"))
    print("Wrote data/case_index.csv")

    summary = build_summary(en_cases, root, os.path.join(data_dir, "dataset_summary.json"), version)
    print("Wrote data/dataset_summary.json")
    print(f"\nDistribution (version {version}):")
    print(f"  total: {summary['total_cases']}  "
          f"domains: {len(summary['by_domain'])}  "
          f"relations: {len(summary['by_relation_type'])}")


if __name__ == "__main__":
    main()
