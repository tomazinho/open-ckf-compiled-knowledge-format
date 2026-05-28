#!/usr/bin/env python3
"""
run_eval.py — Run the composition-hallucination benchmark against one or more models.

Holds informational content constant across three representation conditions
(raw / annotated / compiled) and measures whether accuracy changes. Implements
the protocol's controls: primary query, negative control, and local probes;
retrieval is held constant (full source always in context).

Usage:
    # Estimate cost without calling anything
    python scripts/run_eval.py --models anthropic:claude-opus-4-7 --dry-run

    # Offline pipeline test, no cost, no API key
    python scripts/run_eval.py --models mock:no --output-dir runs/mock --yes

    # Real run: one model, all cases, all conditions, out-of-family judge
    python scripts/run_eval.py --models anthropic:claude-opus-4-7 \
        --judge-model openai:gpt-4o-2024-08-06 \
        --conditions raw annotated compiled \
        --query-types primary negative_control local_probe \
        --output-dir runs/opus-full/

    # Portuguese-Brazilian cases
    python scripts/run_eval.py --models anthropic:claude-opus-4-7 --lang pt-br

See scripts/README.md and docs/SCORING.md for interpretation guidance.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from glob import glob
from pathlib import Path

# Local imports (scripts/ is on sys.path when run as a script)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from providers import (  # noqa: E402
    ModelResponse, ProviderError, call_model, model_family, parse_model_spec,
)
from classifier import (  # noqa: E402
    classify_heuristic, classify_with_judge, labels_agree, _keyword_overlap_score,
)


# Prompt text mirrors docs/PROMPT_SKELETONS.md.
STANDARD_SYSTEM_PROMPT = """You are answering using only the provided source material.
First identify the applicable rule, exception, scope, preconditions, contraindications, temporal dependencies, and sequence requirements.
Then answer the user question.
Cite the source fragments that support the answer.
If the source material is insufficient, say so."""

MINIMAL_SYSTEM_PROMPT = """Using only the provided benchmark context, answer the question in one paragraph.
Do not use outside knowledge."""

PROBE_SYSTEM_PROMPT = """Using only the specified fragment, answer the local probe.
Do not infer from other fragments."""


# Rough public token prices (USD per 1M tokens) for cost estimation only.
APPROX_PRICES_USD_PER_M = {
    "anthropic:claude-opus-4-7":   {"in": 15.00, "out": 75.00},
    "anthropic:claude-opus-4-6":   {"in": 15.00, "out": 75.00},
    "anthropic:claude-sonnet-4-6": {"in":  3.00, "out": 15.00},
    "anthropic:claude-haiku-4-5":  {"in":  1.00, "out":  5.00},
    "openai:gpt-4o":               {"in":  2.50, "out": 10.00},
    "openai:gpt-4o-mini":          {"in":  0.15, "out":  0.60},
    "openai:o3-mini":              {"in":  1.10, "out":  4.40},
    "google:gemini-2.5-pro":       {"in":  1.25, "out": 10.00},
    "google:gemini-2.5-flash":     {"in":  0.30, "out":  2.50},
    "mock:no":                     {"in":  0.00, "out":  0.00},
    "mock:yes":                    {"in":  0.00, "out":  0.00},
}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Run the composition-hallucination benchmark.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--models", nargs="+", required=True,
                   help="Models in 'provider:model_id' form.")
    p.add_argument("--lang", choices=["en", "pt-br"], default="en",
                   help="Case language. 'en' -> cases/, 'pt-br' -> cases_pt-br/. Default: en.")
    p.add_argument("--cases", nargs="+", default=None,
                   help="Override case paths/globs/dirs. Default: derived from --lang.")
    p.add_argument("--conditions", nargs="+", choices=["raw", "annotated", "compiled"],
                   default=["raw", "annotated", "compiled"])
    p.add_argument("--query-types", nargs="+",
                   choices=["primary", "negative_control", "local_probe"],
                   default=["primary"])
    p.add_argument("--prompt-style", choices=["standard", "minimal"], default="standard")
    p.add_argument("--repetitions", type=int, default=1)
    p.add_argument("--temperature", type=float, default=0.0)
    p.add_argument("--max-tokens", type=int, default=2048)
    p.add_argument("--judge-model", default=None,
                   help="Optional LLM-as-judge (provider:model_id), must be out-of-family (§8.4).")
    p.add_argument("--output-dir", default=None)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--yes", action="store_true")
    p.add_argument("--resume", action="store_true")
    return p.parse_args()


def find_root() -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.dirname(here)


def resolve_case_paths(args: argparse.Namespace, root: str) -> list[str]:
    if args.cases:
        return args.cases
    subdir = "cases" if args.lang == "en" else "cases_pt-br"
    return [os.path.join(root, subdir)]


def load_cases(spec: list[str]) -> list[dict]:
    paths = []
    for s in spec:
        if os.path.isdir(s):
            paths.extend(sorted(glob(os.path.join(s, "*.json"))))
        else:
            paths.extend(sorted(glob(s)))
    if not paths:
        print(f"ERROR: no case files matched {spec}", file=sys.stderr)
        sys.exit(2)
    cases = []
    for path in paths:
        with open(path, "r", encoding="utf-8") as f:
            try:
                cases.append(json.load(f))
            except json.JSONDecodeError as e:
                print(f"WARNING: skipping invalid JSON {path}: {e}", file=sys.stderr)
    return cases


def check_judge_family(judge_spec: str | None, eval_specs: list[str]) -> None:
    if not judge_spec:
        return
    j_prov, j_model = parse_model_spec(judge_spec)
    j_family = model_family(j_prov, j_model)
    conflicts = [s for s in eval_specs
                 if model_family(*parse_model_spec(s)) == j_family]
    if conflicts:
        print(f"ERROR: judge '{judge_spec}' shares family '{j_family}' with evaluated "
              f"model(s) {conflicts}. Per protocol §8.4, use an out-of-family judge.",
              file=sys.stderr)
        sys.exit(2)


def system_prompt_for(query_type: str, prompt_style: str) -> str:
    if query_type == "local_probe":
        return PROBE_SYSTEM_PROMPT
    return STANDARD_SYSTEM_PROMPT if prompt_style == "standard" else MINIMAL_SYSTEM_PROMPT


def get_query_text(case: dict, query_type: str, query_index: int) -> str:
    if query_type == "primary":
        return case["query"]
    if query_type == "negative_control":
        nc = case.get("controls", {}).get("negative_control_query")
        if not nc:
            raise ValueError(f"Case {case['case_id']} has no negative_control_query.")
        return nc
    if query_type == "local_probe":
        return case["local_probes"][query_index]["probe"]
    raise ValueError(f"Unknown query_type: {query_type}")


def build_tasks(cases: list[dict], args: argparse.Namespace) -> list[dict]:
    tasks = []
    for case in cases:
        for model_spec in args.models:
            for cond in args.conditions:
                for qtype in args.query_types:
                    indices = (range(len(case.get("local_probes", [])))
                               if qtype == "local_probe" else [0])
                    for qi in indices:
                        for rep in range(args.repetitions):
                            tasks.append({
                                "case_id": case["case_id"], "model_spec": model_spec,
                                "condition": cond, "query_type": qtype,
                                "query_index": qi, "rep": rep,
                            })
    return tasks


def task_key(t: dict) -> str:
    return (f"{t['case_id']}|{t['model_spec']}|{t['condition']}|"
            f"{t['query_type']}|{t['query_index']}|{t['rep']}")


def load_existing_keys(results_path: Path) -> set:
    keys = set()
    if not results_path.exists():
        return keys
    with open(results_path, "r", encoding="utf-8") as f:
        for line in f:
            try:
                rec = json.loads(line)
                keys.add(task_key(rec))
            except (json.JSONDecodeError, KeyError):
                continue
    return keys


def estimate_cost(tasks: list[dict], cases_by_id: dict, args: argparse.Namespace) -> dict:
    by_model = defaultdict(lambda: {"calls": 0, "tin": 0, "tout": 0})
    for t in tasks:
        case = cases_by_id[t["case_id"]]
        context = case["representations"][t["condition"]]
        query = get_query_text(case, t["query_type"], t["query_index"])
        tin = (len(STANDARD_SYSTEM_PROMPT) + len(context) + len(query) + 100) // 4
        by_model[t["model_spec"]]["calls"] += 1
        by_model[t["model_spec"]]["tin"] += tin
        by_model[t["model_spec"]]["tout"] += 200
    if args.judge_model:
        for t in tasks:
            if t["query_type"] == "local_probe":
                continue
            case = cases_by_id[t["case_id"]]
            jin = (len(case["query"]) + len(case["gold_answer"]["full"]) + 2000) // 4
            by_model[args.judge_model]["calls"] += 1
            by_model[args.judge_model]["tin"] += jin
            by_model[args.judge_model]["tout"] += 100

    total = 0.0
    per_model = {}
    for spec, c in by_model.items():
        price_key = spec
        if spec not in APPROX_PRICES_USD_PER_M:
            base = spec.rsplit("-202", 1)[0]
            if base in APPROX_PRICES_USD_PER_M:
                price_key = base
        price = APPROX_PRICES_USD_PER_M.get(price_key, {"in": 5.0, "out": 15.0})
        cost = (c["tin"] * price["in"] + c["tout"] * price["out"]) / 1_000_000
        per_model[spec] = {"calls": c["calls"], "estimated_cost_usd": round(cost, 2)}
        total += cost
    return {"total_estimated_cost_usd": round(total, 2), "per_model": per_model}


def run_one_task(task: dict, case: dict, args: argparse.Namespace) -> dict:
    provider, model_id = parse_model_spec(task["model_spec"])
    context = case["representations"][task["condition"]]
    query = get_query_text(case, task["query_type"], task["query_index"])
    sys_prompt = system_prompt_for(task["query_type"], args.prompt_style)
    user_message = f"SOURCE MATERIAL:\n{context}\n\nQUESTION:\n{query}"

    rec = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "case_id": task["case_id"],
        "relation_type": case["metadata"]["relation_type"],
        "complexity_level": case["metadata"]["complexity_level"],
        "domain": case["metadata"]["domain"],
        "source_status": case["metadata"]["source_status"],
        "model_spec": task["model_spec"],
        "condition": task["condition"],
        "query_type": task["query_type"],
        "query_index": task["query_index"],
        "rep": task["rep"],
        "prompt_style": args.prompt_style,
        "temperature": args.temperature,
        "query_text": query,
    }

    try:
        resp: ModelResponse = call_model(
            provider=provider, model_id=model_id, system_prompt=sys_prompt,
            user_message=user_message, temperature=args.temperature,
            max_tokens=args.max_tokens,
        )
        rec.update({"response_text": resp.text, "tokens_in": resp.tokens_in,
                    "tokens_out": resp.tokens_out,
                    "elapsed_seconds": round(resp.elapsed_seconds, 2), "error": None})
    except ProviderError as e:
        rec.update({"response_text": "", "tokens_in": 0, "tokens_out": 0,
                    "elapsed_seconds": 0, "error": str(e)})
        return rec

    if task["query_type"] == "local_probe":
        expected = case["local_probes"][task["query_index"]]["expected_answer"]
        overlap = _keyword_overlap_score(resp.text, expected)
        rec["local_probe_expected"] = expected
        rec["local_probe_overlap"] = round(overlap, 2)
        rec["heuristic_label"] = "probe_pass" if overlap >= 0.4 else "probe_fail"
        return rec

    scoring_case = case
    if task["query_type"] == "negative_control":
        scoring_case = dict(case)
        scoring_case["gold_answer"] = dict(case["gold_answer"])
        ncg = case["controls"]["negative_control_gold"]
        scoring_case["gold_answer"]["minimal"] = ncg
        scoring_case["gold_answer"]["full"] = ncg

    h = classify_heuristic(resp.text, scoring_case)
    rec.update({"heuristic_label": h.label, "heuristic_confidence": h.confidence,
                "heuristic_rationale": h.rationale})

    if args.judge_model:
        jp, jm = parse_model_spec(args.judge_model)
        try:
            j = classify_with_judge(resp.text, scoring_case, jp, jm)
            rec.update({"judge_label": j.label, "judge_confidence": j.confidence,
                        "judge_rationale": j.rationale,
                        "heuristic_judge_agree": labels_agree(h, j)})
        except ProviderError as e:
            rec.update({"judge_label": None, "judge_error": str(e)})
    return rec


def write_summary(results_path: Path, output_dir: Path) -> None:
    by_group = defaultdict(lambda: defaultdict(int))
    n_scored = 0
    with open(results_path, "r", encoding="utf-8") as f:
        for line in f:
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if rec.get("query_type") == "local_probe":
                continue
            n_scored += 1
            key = (rec["model_spec"], rec["condition"], rec["relation_type"],
                   rec["complexity_level"], rec.get("source_status", "?"))
            by_group[key]["n"] += 1
            label = rec.get("judge_label") or rec.get("heuristic_label", "other")
            by_group[key][label] += 1

    with open(output_dir / "summary.csv", "w", newline="", encoding="utf-8") as f:
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

    # Markdown report: accuracy by model × condition
    agg = defaultdict(lambda: defaultdict(int))
    for key, c in by_group.items():
        for lbl, cnt in c.items():
            agg[(key[0], key[1])][lbl] += cnt
    with open(output_dir / "report.md", "w", encoding="utf-8") as f:
        f.write("# Composition Hallucination Benchmark — Run Report\n\n")
        f.write(f"Scored responses (excluding local probes): {n_scored}\n\n")
        f.write("## Accuracy by model × condition\n\n")
        f.write("| Model | Condition | n | Correct | Comp. err | Wrong esc. | Refusal | Other | Accuracy |\n")
        f.write("|---|---|---|---|---|---|---|---|---|\n")
        for (model, cond), c in sorted(agg.items()):
            n = c["n"]
            acc = round(c.get("correct", 0) / n, 3) if n else 0
            f.write(f"| {model} | {cond} | {n} | {c.get('correct',0)} | "
                    f"{c.get('composition_hallucination',0)} | {c.get('wrong_escalation',0)} | "
                    f"{c.get('refusal',0)} | {c.get('other',0)} | {acc} |\n")
        f.write("\nSee `summary.csv` for the breakdown by relation type, complexity, and source status.\n")
        f.write("See `results.jsonl` for per-response detail.\n")


def main() -> None:
    args = parse_args()
    root = find_root()
    for spec in args.models:
        parse_model_spec(spec)
    if args.judge_model:
        parse_model_spec(args.judge_model)
        check_judge_family(args.judge_model, args.models)

    cases = load_cases(resolve_case_paths(args, root))
    cases_by_id = {c["case_id"]: c for c in cases}
    tasks = build_tasks(cases, args)

    if args.output_dir:
        output_dir = Path(args.output_dir)
    else:
        ts = datetime.now().strftime("%Y%m%d-%H%M%S")
        output_dir = Path(root) / "runs" / f"run-{ts}"
    output_dir.mkdir(parents=True, exist_ok=True)

    cost = estimate_cost(tasks, cases_by_id, args)
    print(f"\nTask count: {len(tasks)}  |  Cases: {len(cases)} ({args.lang})  "
          f"Models: {len(args.models)}  Conditions: {len(args.conditions)}  "
          f"Query types: {len(args.query_types)}  Reps: {args.repetitions}")
    print("\nEstimated cost (rough; verify against current vendor prices):")
    for spec, info in cost["per_model"].items():
        print(f"  {spec:48s} {info['calls']:5d} calls  ~${info['estimated_cost_usd']:.2f}")
    print(f"  {'TOTAL':48s}        ~${cost['total_estimated_cost_usd']:.2f}")
    print(f"\nOutput dir: {output_dir.resolve()}")

    if args.dry_run:
        print("\n[dry-run] exiting without API calls.")
        return
    if not args.yes:
        if input("\nProceed? [y/N] ").strip().lower() != "y":
            print("Aborted.")
            return

    results_path = output_dir / "results.jsonl"
    existing = load_existing_keys(results_path) if args.resume else set()
    if existing:
        print(f"Resume: skipping {len(existing)} tasks already present.")

    start = time.time(); done = skipped = failed = 0
    with open(results_path, "a", encoding="utf-8") as out:
        for i, task in enumerate(tasks):
            if task_key(task) in existing:
                skipped += 1
                continue
            try:
                rec = run_one_task(task, cases_by_id[task["case_id"]], args)
                if rec.get("error"):
                    failed += 1
            except Exception as e:  # noqa: BLE001
                rec = {**task, "error": f"runner exception: {e}", "response_text": ""}
                failed += 1
            out.write(json.dumps(rec, ensure_ascii=False) + "\n")
            out.flush()
            done += 1
            if done % 10 == 0 or i == len(tasks) - 1:
                el = time.time() - start
                print(f"  [{done + skipped}/{len(tasks)}] done={done} "
                      f"skipped={skipped} failed={failed} elapsed={el:.0f}s")

    write_summary(results_path, output_dir)
    print(f"\nWrote {results_path}")
    print(f"Wrote {output_dir / 'summary.csv'} and {output_dir / 'report.md'}")
    print(f"Done in {time.time() - start:.0f}s. Failed calls: {failed}.")


if __name__ == "__main__":
    main()
