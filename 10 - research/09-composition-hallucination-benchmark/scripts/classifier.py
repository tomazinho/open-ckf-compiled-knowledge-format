"""
Response classification for the composition-hallucination benchmark.

Two classifiers are provided:

  1. HEURISTIC classifier: pure rule-based. Looks at the leading Yes/No,
     keyword overlap with the gold minimal answer, and keyword overlap
     with documented failure examples. Fast, deterministic, and easily
     auditable, but limited to binary-ish cases and prone to false
     positives.

  2. JUDGE classifier (LLM-as-judge): asks a separate model to label
     a response as correct, composition_hallucination, wrong_escalation,
     refusal, or other, given the gold answer and failure examples.

Both classifiers return the same Classification structure so the
runner can record both labels per response and report agreement.

The benchmark protocol (Tomazinho 2026, §8.4) requires that the judge
model not be from the same family as the evaluated model when avoidable;
the runner enforces this before calling.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, asdict
from typing import Optional

from providers import call_model


# Label space — must match §8.3 of the paper.
LABELS = [
    "correct",
    "composition_hallucination",
    "wrong_escalation",
    "refusal",
    "local_comprehension_failure",
    "other",
]


@dataclass
class Classification:
    label: str
    confidence: str   # 'high', 'medium', 'low'
    rationale: str
    classifier: str   # 'heuristic' or 'judge:<model>'

    def to_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------------------
# HEURISTIC
# ---------------------------------------------------------------------------

_YES_TOKENS = {"yes", "yep", "yeah", "correct", "sim", "affirmative"}
_NO_TOKENS = {"no", "nope", "incorrect", "não", "nao", "negative"}
_REFUSAL_PATTERNS = [
    r"\bi (cannot|can'?t|am not able to|am unable to)\b",
    r"\bi (would|should) not\b.*\b(advise|advice|determine|evaluate)\b",
    r"\bplease (consult|refer to|contact)\b",
    r"\bi don'?t have (enough|sufficient)\b",
    r"\bwithout (more|additional|seeing|reviewing)\b",
]


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def _first_polarity(text: str) -> Optional[str]:
    """Detect Yes/No at the start of the response, if present."""
    head = _normalize(text)[:200]
    # strip common preambles
    head = re.sub(r"^(answer|response|reply|short answer)\s*[:\-]\s*", "", head)
    # check first few tokens
    tokens = re.findall(r"\b[a-záàâãéêíóôõúç]+\b", head[:80])
    for tok in tokens[:5]:
        if tok in _YES_TOKENS:
            return "yes"
        if tok in _NO_TOKENS:
            return "no"
    return None


def _looks_like_refusal(text: str) -> bool:
    norm = _normalize(text)
    for pat in _REFUSAL_PATTERNS:
        if re.search(pat, norm):
            return True
    # Very short responses are often refusals
    if len(norm) < 40 and any(tok in norm for tok in {"cannot", "can't", "unable"}):
        return True
    return False


def _keyword_overlap_score(response: str, target: str, top_k: int = 6) -> float:
    """
    Crude lexical overlap: fraction of distinctive content tokens from
    `target` that also appear in `response`. Stopwords filtered.
    """
    STOP = {
        "the", "a", "an", "of", "to", "in", "for", "with", "on", "at",
        "by", "is", "are", "was", "were", "be", "been", "being",
        "and", "or", "but", "if", "then", "than", "as", "this", "that",
        "it", "its", "his", "her", "their", "your", "you", "we", "they",
        "i", "from", "into", "out", "must", "should", "may", "can",
        "will", "would", "could", "do", "does", "did", "have", "has", "had",
        "not", "no", "yes",
    }
    def tokens(s: str) -> list[str]:
        return [t for t in re.findall(r"\b[a-z0-9$%\.]+\b", s.lower()) if t not in STOP and len(t) > 2]
    target_toks = list(dict.fromkeys(tokens(target)))[:top_k * 2]
    if not target_toks:
        return 0.0
    response_toks = set(tokens(response))
    hits = sum(1 for t in target_toks if t in response_toks)
    return hits / max(len(target_toks), 1)


def _wrong_escalation_signals(text: str) -> bool:
    """Detect mentions of escalation paths that are typically over-cautious."""
    norm = _normalize(text)
    escalation_terms = [
        "board of directors", "ceo", "cto", "legal department", "legal team",
        "external counsel", "compliance committee", "audit committee",
        "vice president", "external lawyer", "outside counsel",
        "data protection officer",
    ]
    return any(term in norm for term in escalation_terms)


def classify_heuristic(response_text: str, case: dict) -> Classification:
    """
    Heuristic classification using lexical signals from the case's
    gold_answer and failure_examples.
    """
    # 1) Refusal first — strongest negative signal
    if _looks_like_refusal(response_text):
        return Classification(
            label="refusal",
            confidence="medium",
            rationale="Response matches refusal patterns ('I cannot...', 'without seeing...', etc.).",
            classifier="heuristic",
        )

    gold_minimal = case["gold_answer"]["minimal"]
    gold_polarity = _first_polarity(gold_minimal)
    response_polarity = _first_polarity(response_text)

    overlap = _keyword_overlap_score(response_text, gold_minimal)

    # 2) For binary questions where gold starts with Yes/No, polarity is decisive
    if gold_polarity and response_polarity:
        if response_polarity == gold_polarity and overlap > 0.25:
            return Classification(
                label="correct",
                confidence="high" if overlap > 0.45 else "medium",
                rationale=f"Polarity matches gold ({gold_polarity}) and keyword overlap {overlap:.2f}.",
                classifier="heuristic",
            )
        if response_polarity != gold_polarity:
            # Wrong polarity — check if it's wrong_escalation vs composition_hallucination
            if _wrong_escalation_signals(response_text):
                return Classification(
                    label="wrong_escalation",
                    confidence="medium",
                    rationale="Polarity opposite to gold AND response mentions over-cautious escalation paths.",
                    classifier="heuristic",
                )
            return Classification(
                label="composition_hallucination",
                confidence="medium",
                rationale=f"Polarity opposite to gold (got '{response_polarity}', expected '{gold_polarity}').",
                classifier="heuristic",
            )

    # 3) Non-binary or ambiguous polarity — fall back to overlap + escalation signals
    if overlap > 0.45 and not _wrong_escalation_signals(response_text):
        return Classification(
            label="correct",
            confidence="low",
            rationale=f"Non-binary case; keyword overlap with gold is {overlap:.2f}.",
            classifier="heuristic",
        )

    if _wrong_escalation_signals(response_text):
        return Classification(
            label="wrong_escalation",
            confidence="low",
            rationale="Response mentions over-cautious escalation paths and does not closely match gold.",
            classifier="heuristic",
        )

    return Classification(
        label="other",
        confidence="low",
        rationale=f"Heuristic could not confidently classify (overlap {overlap:.2f}, polarities {gold_polarity}/{response_polarity}).",
        classifier="heuristic",
    )


# ---------------------------------------------------------------------------
# LLM-AS-JUDGE
# ---------------------------------------------------------------------------

JUDGE_SYSTEM_PROMPT = """You are an impartial evaluator scoring model responses for a composition-hallucination benchmark.

You will be given:
  - A query asked of a model
  - The gold answer (correct) for that query
  - Examples of typical wrong answers, labeled by failure category
  - The model's actual response

Your job is to assign exactly ONE label to the model's response from this set:

  - correct: The response reaches the same conclusion as the gold answer. Wording need not be identical, but the operative conclusion (e.g. allow/deny, approver, value, sequence) must match the gold's operative conclusion. Minor omissions of secondary details do not by themselves make a response incorrect; missing the central operative conclusion does.

  - composition_hallucination: The response is incompatible with the gold answer because it failed to compose two or more fragments through a required relation (exception, override, scope, precondition, sequence, contraindication, temporal dependency, or exception-of-exception). The response may cite real text from the source and still reach the wrong conclusion because it ignored a relation that changes applicability.

  - wrong_escalation: The response is incorrect because it escalates to a stricter authority, requirement, or stakeholder that the source material does not require (e.g. demanding Board approval, Legal review, or CTO sign-off when the policy says manager-level is sufficient).

  - refusal: The response declines to answer despite the source material containing sufficient information to answer.

  - local_comprehension_failure: The response misunderstands a single fragment of the source material in isolation (not a failure of composing fragments, but a failure of reading any one fragment correctly).

  - other: The response is wrong for a reason that doesn't fit the above (formatting failure, off-topic answer, hallucinated content not in source, etc.).

Output STRICTLY in this JSON format with no additional commentary:

{"label": "<one of the labels above>", "confidence": "<high|medium|low>", "rationale": "<one or two sentences>"}"""


def _build_judge_user_message(response_text: str, case: dict) -> str:
    fe = case.get("failure_examples", {})
    parts = []
    parts.append("QUERY:")
    parts.append(case["query"])
    parts.append("")
    parts.append("GOLD ANSWER (full):")
    parts.append(case["gold_answer"]["full"])
    parts.append("")
    parts.append("GOLD ANSWER (minimal):")
    parts.append(case["gold_answer"]["minimal"])
    parts.append("")
    if fe.get("composition_hallucination"):
        parts.append("Examples of composition_hallucination for this case:")
        for ex in fe["composition_hallucination"][:3]:
            parts.append(f"  - {ex}")
        parts.append("")
    if fe.get("wrong_escalation"):
        parts.append("Examples of wrong_escalation for this case:")
        for ex in fe["wrong_escalation"][:2]:
            parts.append(f"  - {ex}")
        parts.append("")
    if fe.get("refusal"):
        parts.append("Examples of refusal for this case:")
        for ex in fe["refusal"][:2]:
            parts.append(f"  - {ex}")
        parts.append("")
    parts.append("MODEL RESPONSE TO CLASSIFY:")
    parts.append(response_text)
    parts.append("")
    parts.append("Output JSON only.")
    return "\n".join(parts)


def classify_with_judge(
    response_text: str,
    case: dict,
    judge_provider: str,
    judge_model_id: str,
) -> Classification:
    """
    Call a separate model to classify the response. Returns Classification
    with classifier=f'judge:{judge_provider}:{judge_model_id}'.
    """
    user_message = _build_judge_user_message(response_text, case)
    judge_resp = call_model(
        provider=judge_provider,
        model_id=judge_model_id,
        system_prompt=JUDGE_SYSTEM_PROMPT,
        user_message=user_message,
        temperature=0.0,
        max_tokens=400,
    )
    text = judge_resp.text.strip()
    # Try to parse JSON from the judge output
    label, confidence, rationale = _parse_judge_json(text)
    classifier_tag = f"judge:{judge_provider}:{judge_model_id}"
    return Classification(
        label=label,
        confidence=confidence,
        rationale=rationale,
        classifier=classifier_tag,
    )


def _parse_judge_json(text: str) -> tuple[str, str, str]:
    """Best-effort extraction of {label, confidence, rationale} from judge output."""
    # Strip code fences
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip())
    cleaned = re.sub(r"\s*```\s*$", "", cleaned)
    # Try direct parse
    try:
        obj = json.loads(cleaned)
        label = str(obj.get("label", "other")).strip().lower()
        if label not in LABELS:
            label = "other"
        confidence = str(obj.get("confidence", "low")).strip().lower()
        if confidence not in {"high", "medium", "low"}:
            confidence = "low"
        rationale = str(obj.get("rationale", ""))[:500]
        return label, confidence, rationale
    except json.JSONDecodeError:
        # Try to find a JSON object inside the text
        match = re.search(r"\{[^{}]*\}", cleaned, re.DOTALL)
        if match:
            try:
                obj = json.loads(match.group(0))
                label = str(obj.get("label", "other")).strip().lower()
                if label not in LABELS:
                    label = "other"
                confidence = str(obj.get("confidence", "low")).strip().lower()
                rationale = str(obj.get("rationale", ""))[:500]
                return label, confidence, rationale
            except json.JSONDecodeError:
                pass
    return "other", "low", f"Judge returned unparseable output: {text[:200]}"


# ---------------------------------------------------------------------------
# AGREEMENT
# ---------------------------------------------------------------------------

def labels_agree(c1: Classification, c2: Classification) -> bool:
    return c1.label == c2.label
