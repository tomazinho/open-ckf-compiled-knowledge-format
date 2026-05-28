#!/usr/bin/env python3
"""
score_outputs.py — Re-score and re-aggregate an existing results.jsonl.

Two common uses:

  1. You ran run_eval.py with heuristic scoring only (cheap) and now want to
     add LLM-as-judge labels without re-calling the evaluated models:

        python scripts/score_outputs.py runs/opus-full/results.jsonl \
            --judge-model openai:gpt-4o-2024-08-06

  2. You just want to re-aggregate an existing results file into summary.csv /
     report.md (e.g. after editing labels by hand):

        python scripts/score_outputs.py runs/opus-full/results.jsonl --aggregate-only

The judge re-scoring needs the original case files to read gold answers and
failure examples, so it loads them from cases/ (or cases_pt-br/ via --lang).

The §8.4 same-family constraint cannot be checked here because the evaluated
model is whatever produced the file; the script warns if the judge family
matches any model_spec found in the results.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from collections import defaultdict
from glob import glob
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from providers import ProviderError, model_family, parse_model_spec  # noqa: E402
from classifier import classify_with_judge  # noqa: E402


def find_root() -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.dirname(here)


def load_cases_index(root: str, lang: str) -> dict:
    subdir = "cases" if lang == "en" else "cases_pt-br"
    idx = {}
    for fp in sorted(glob(os.path.join(root, subdir, "*.json"))):
        with open(fp, "r", encoding="utf-8") as f:
            c = json.load(f)
            idx[c["case_id"]] = c
    return idx


def read_results(path: Path) -> list[dict]:
    out = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out


def scoring_case_for(rec: dict, case: dict) -> dict:
    """Reconstruct the gold the judge should compare against, accounting for
    negative-control queries which use negative_control_gold."""
    if rec.get("query_type") == "negative_control":
        sc = dict(case)
        sc["gold_answer"] = dict(case["gold_answer"])
        ncg = case["controls"]["negative_control_gold"]
        sc["gold_answer"]["minimal"] = ncg
        sc["gold_answer"]["full"] = ncg
        return sc
    return case


def apply_judge(records: list[dict], cases_idx: dict, judge_spec: str) -> int:
    jp, jm = parse_model_spec(judge_spec)
    j_family = model_family(jp, jm)
    seen_families = {model_family(*parse_model_spec(r["model_spec"]))
                     for r in records if "model_spec" in r}
    if j_family in seen_families:
        print(f"WARNING: judge family '{j_family}' matches an evaluated model family "
              f"in this results file. Protocol §8.4 advises an out-of-family judge.",
              file=sys.stderr)

    judged = 0
    for rec in records:
        if rec.get("query_type") == "local_probe":
            continue
        if not rec.get("response_text"):
            continue
        case = cases_idx.get(rec["case_id"])
        if not case:
            print(f"  skip {rec['case_id']}: not found in case index", file=sys.stderr)
            continue
        sc = scoring_case_for(rec, case)
        try:
            j = classify_with_judge(rec["response_text"], sc, jp, jm)
            rec["judge_label"] = j.label
            rec["judge_confidence"] = j.confidence
            rec["judge_rationale"] = j.rationale
            if "heuristic_label" in rec:
                rec["heuristic_judge_agree"] = (rec["heuristic_label"] == j.label)
            judged += 1
        except ProviderError as e:
            rec["judge_error"] = str(e)
    return judged


def aggregate(records: list[dict], out_dir: Path) -> None:
    by_group = defaultdict(lambda: defaultdict(int))
    n_scored = 0
    for rec in records:
        if rec.get("query_type") == "local_probe":
            continue
        n_scored += 1
        key = (rec["model_spec"], rec["condition"], rec["relation_type"],
               rec["complexity_level"], rec.get("source_status", "?"))
        by_group[key]["n"] += 1
        label = rec.get("judge_label") or rec.get("heuristic_label", "other")
        by_group[key][label] += 1

    with open(out_dir / "summary.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["model_spec", "condition", "relation_type", "complexity_level",
                    "source_status", "n", "correct", "composition_hallucination",
                    "wrong_escalation", "refusal", "local_comprehension_failure",
                    "other", "accuracy", "composition_error_rate"])
        for key, c in sorted(by_group.items()):
            n = c["n"]; correct = c.get("correct", 0); comp = c.get("composition_hallucination", 0)
            w.writerow([*key, n, correct, comp, c.get("wrong_escalation", 0),
                        c.get("refusal", 0), c.get("local_comprehension_failure", 0),
                        c.get("other", 0), round(correct / n, 3) if n else 0,
                        round(comp / n, 3) if n else 0])
    print(f"Wrote {out_dir / 'summary.csv'} ({n_scored} scored responses)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("results", help="Path to an existing results.jsonl")
    ap.add_argument("--judge-model", default=None, help="Apply this LLM-as-judge (provider:model_id).")
    ap.add_argument("--aggregate-only", action="store_true", help="Only re-aggregate; do not call any model.")
    ap.add_argument("--lang", choices=["en", "pt-br"], default="en")
    args = ap.parse_args()

    results_path = Path(args.results)
    if not results_path.exists():
        print(f"ERROR: {results_path} not found", file=sys.stderr)
        sys.exit(2)

    records = read_results(results_path)
    print(f"Loaded {len(records)} records from {results_path}")

    if args.judge_model and not args.aggregate_only:
        root = find_root()
        cases_idx = load_cases_index(root, args.lang)
        print(f"Applying judge {args.judge_model} ...")
        n = apply_judge(records, cases_idx, args.judge_model)
        print(f"Judged {n} responses.")
        # Rewrite the results file in place (with judge labels added)
        with open(results_path, "w", encoding="utf-8") as f:
            for rec in records:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        print(f"Updated {results_path} with judge labels.")

    aggregate(records, results_path.parent)


if __name__ == "__main__":
    main()
