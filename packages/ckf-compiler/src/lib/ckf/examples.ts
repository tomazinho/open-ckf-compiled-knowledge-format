// Curated source texts used by /compiler/demo, /docs/examples and the CKF
// MCP `ckf.example` tool. Each example is hand-written to maximise coverage
// of the CKF v0.2 schema (entities, concepts, principles, procedures,
// if_then_rules, heuristics, qa_pairs, contradictions / edge_cases) so the
// heuristic compiler produces a rich, representative package.

export const LEARNING_EXAMPLE = `Learning improves when students actively retrieve information instead of passively rereading. Retrieval practice strengthens memory traces by forcing the brain to reconstruct knowledge. Spaced repetition is the deliberate scheduling of review at increasing intervals — typically 1 day, 3 days, 7 days, 21 days — to fight the forgetting curve described by Hermann Ebbinghaus. Sleep supports consolidation, while distraction reduces attention and weakens encoding. The hippocampus replays daytime activations during slow-wave sleep, transferring memories into long-term cortical storage.

Teachers should design study sessions in four steps. First, set a clear learning objective. Second, present new material in short blocks of 15 to 20 minutes. Third, interleave related topics instead of blocking them. Fourth, end every block with a low-stakes quiz that surfaces gaps.

If a concept is reviewed only once, it tends to fade within 48 hours, because memory traces decay without reactivation. If the spacing interval is too long, retrieval becomes effortful and accuracy drops below 60 percent. If students confuse fluency with mastery, they overestimate their readiness and reduce study time prematurely. When students sleep fewer than six hours after learning, consolidation drops sharply and the next-day quiz score falls by roughly 20 percent.

A useful heuristic: if you can teach a concept aloud without notes in under two minutes, you have probably mastered the surface layer. Another heuristic: if a quiz score is below 70 percent, schedule the next review within 24 hours, not later.

Avoid cramming the night before exams, because consolidation requires sleep. Avoid passive rereading as the primary study technique — it produces fluency without retention. Never replace retrieval practice with highlighting; highlighting feels productive but does not strengthen memory.

A common edge case appears with motor skills: pure spacing helps less than massed practice in the first session, then spacing dominates afterwards. A contradiction in the literature: some studies show interleaving hurts immediate test performance even while it improves long-term retention, so short-term feedback can mislead instructors.

Question: How long should a spaced repetition interval be? Answer: Start at 1 day, then double the interval after each successful recall, capping at 6 months for stable knowledge.

Question: Why is sleep more important than extra study hours? Answer: Because consolidation, not exposure, converts fragile traces into durable memory; without sleep, additional exposure yields diminishing returns.`;

export const BUSINESS_EXAMPLE = `Sustainable business growth depends on understanding the customer's underlying job to be done (JTBD), not only the product features. The North Star Metric is the single number that best captures the value delivered to customers — for Airbnb it is nights booked, for Slack it is messages sent per active team. Unit economics, expressed as the ratio of customer lifetime value (LTV) to customer acquisition cost (CAC), must be calculated before scaling marketing spend, because growth without margin amplifies losses. A healthy SaaS business targets an LTV / CAC ratio above three and a CAC payback period under twelve months.

Leaders should run quarterly business reviews in five steps. First, restate the North Star Metric and the current value. Second, review unit economics by cohort. Third, examine activation, retention and expansion funnels. Fourth, decide which two initiatives to double down on. Fifth, decide which initiative to kill.

If CAC exceeds LTV, expansion destroys value and the team must pause paid acquisition. If churn is rising for two consecutive quarters, the company should revisit onboarding and activation before optimising acquisition. If a pricing change drops conversion by more than 15 percent, roll back within seven days unless retention improves materially. When a sales team consistently closes poor-fit customers, support load rises and downstream churn follows within one to two renewal cycles.

A useful heuristic: if your top 10 percent of customers generate more than 50 percent of revenue, your pricing is probably under-segmented. Another heuristic: a feature requested by fewer than three paying customers in a quarter should not enter the roadmap.

Pricing should reflect the value delivered, not internal costs alone. Avoid discounting as a default response to slow sales, because it trains the market to wait for promotions and erodes brand perception. Never sacrifice gross margin to win logos that will not expand. Strong brands tend to compound over time when they consistently deliver on a clear promise.

Edge case: in network-effect businesses, early-stage CAC may legitimately exceed LTV because each new customer increases the value of the existing base; standard unit economics under-measure this. Contradiction worth flagging: classic growth playbooks tell founders to optimise acquisition first, while modern PLG playbooks insist activation and retention should be solved first — both can be right depending on stage.

Question: When should a startup stop optimising acquisition? Answer: When weekly active retention plateaus below the category benchmark and onboarding completion is under 50 percent — the leaky bucket must be fixed first.

Question: What separates a strategy from a list of goals? Answer: A strategy names a constraint and chooses which customers, problems and channels to ignore; a goal list does not.`;

export const CLINICAL_EXAMPLE = `Sepsis triage in the emergency department combines vital signs, the qSOFA score and lactate measurement. The qSOFA score adds one point for each of: systolic blood pressure below 100 mmHg, respiratory rate of 22 or above, and altered mental status (Glasgow Coma Scale under 15). A qSOFA of 2 or more in a patient with suspected infection identifies a high mortality risk.

The Hour-1 sepsis bundle, defined by the Surviving Sepsis Campaign, has five steps. First, measure serum lactate. Second, obtain blood cultures before antibiotics. Third, administer broad-spectrum antibiotics within 60 minutes. Fourth, begin 30 mL/kg crystalloid for hypotension or lactate above 4 mmol/L. Fifth, start vasopressors if mean arterial pressure stays below 65 mmHg despite fluids — norepinephrine is first-line.

If serum lactate is above 2 mmol/L, repeat lactate within 2 hours to confirm clearance. If blood pressure remains low after the 30 mL/kg fluid bolus, start norepinephrine at 0.05 mcg/kg/min and titrate to MAP at least 65 mmHg. If procalcitonin trends down for 72 hours and cultures are negative, consider de-escalating antibiotics. When patients have a history of congestive heart failure, the 30 mL/kg fluid target should be reassessed at 500 mL increments to avoid pulmonary oedema.

Useful heuristic: if a patient looks worse than the numbers suggest, trust the bedside impression — early sepsis often outruns vital-sign abnormalities. Another heuristic: any febrile, tachycardic patient on immunosuppression is sepsis until proven otherwise.

Avoid delaying antibiotics while waiting for imaging in suspected septic shock. Never use hydroxyethyl starch for resuscitation — it increases mortality and renal failure. Always document the time of antibiotic administration; it drives every downstream quality metric.

Edge case: pregnant patients have physiologically higher heart rates and lower blood pressure, so the qSOFA threshold over-triggers; use the obstetric modified early warning score instead. Contradiction in the literature: aggressive early fluids improve some septic shock outcomes but worsen others in patients with ARDS — individualisation matters.

Question: What is the first-line vasopressor in septic shock? Answer: Norepinephrine, titrated to a mean arterial pressure of at least 65 mmHg.

Question: When can antibiotics be safely de-escalated? Answer: When cultures are negative at 48 to 72 hours, procalcitonin is trending down, and the patient is clinically improving.`;

export const LEGAL_EXAMPLE = `Under the General Data Protection Regulation (GDPR), a "data controller" is the natural or legal person who determines the purposes and means of processing personal data. A "data processor" processes personal data on behalf of the controller. A "data subject" is the identified or identifiable person to whom the data relates. The Supervisory Authority is the independent public body responsible for monitoring application of the Regulation in each Member State.

Article 6 establishes that processing is lawful only if at least one of six legal bases applies: consent, contract, legal obligation, vital interests, public task, or legitimate interest. Consent must be freely given, specific, informed and unambiguous. Where processing is based on consent, the controller must be able to demonstrate that the data subject has consented.

A controller must notify a personal data breach to the competent Supervisory Authority within 72 hours of becoming aware of it, unless the breach is unlikely to result in a risk to the rights and freedoms of natural persons. The controller must inform affected data subjects without undue delay when the breach is likely to result in a high risk.

If a processor engages another processor (a sub-processor) without prior written authorisation of the controller, the original processor remains fully liable. If a transfer of personal data outside the European Economic Area lacks an adequacy decision, the parties must implement appropriate safeguards such as Standard Contractual Clauses. If a data subject withdraws consent, the controller must stop the consent-based processing without affecting the lawfulness of prior processing.

Useful heuristic: if you cannot articulate the specific purpose of a data collection in one sentence, that purpose is probably not specific enough to ground lawful consent. Another heuristic: when in doubt between consent and legitimate interest, prefer the legal basis that gives the data subject the most control — usually consent for marketing, legitimate interest for fraud prevention.

Avoid bundling consent with the acceptance of terms of service; that bundled consent is generally not freely given. Never retain personal data longer than necessary for the stated purpose; storage limitation is a core principle. Always document the chosen legal basis in the Record of Processing Activities (Article 30).

Edge case: scientific research benefits from broader processing rules under Article 89, provided appropriate safeguards exist. Contradiction worth flagging: Article 22 restricts solely automated decisions, but many AI-assisted decisions remain "automated in practice" while keeping a token human reviewer — courts disagree on whether this satisfies the safeguard.

Question: Within how long must a controller report a personal data breach? Answer: Within 72 hours of becoming aware, to the competent Supervisory Authority, unless the breach is unlikely to result in risk to data subjects.

Question: Is legitimate interest a valid basis for marketing to existing customers? Answer: It can be, but only after a documented balancing test and provided the data subject has an easy opt-out.`;

export const ENGINEERING_EXAMPLE = `An incident is any unplanned event that degrades the availability, latency, error rate or correctness of a production service. Severity is classified into SEV-1 (full outage or data loss), SEV-2 (major degradation for many users), SEV-3 (partial degradation for some users) and SEV-4 (minor issue, no user impact). The Incident Commander coordinates response; the Communications Lead handles status updates; the Scribe records the timeline.

The on-call response procedure has six steps. First, acknowledge the page within 5 minutes. Second, open the incident channel and assign the Incident Commander. Third, declare severity and post the first status update within 10 minutes. Fourth, stabilise — roll back the most recent change or shed load before deep diagnosis. Fifth, communicate every 30 minutes until resolution. Sixth, schedule a blameless postmortem within 5 business days.

If p99 latency exceeds the SLO by 50 percent for 5 consecutive minutes, page the on-call engineer for that service. If error rate exceeds 1 percent of requests for 2 minutes, escalate to SEV-2. If the issue began within 30 minutes of a deploy, the first hypothesis is a regression — roll back before debugging. If a rollback does not resolve the issue within 10 minutes, expand the suspect set to dependencies and infrastructure changes.

Useful heuristic: prefer rolling back a recent change over root-causing during an active incident — mean time to recovery beats mean time to understand. Another heuristic: if three responders are debating the cause, you need a decision, not more data — the Incident Commander picks one path and runs it.

Avoid pushing fixes directly to production during a SEV-1 — fixes must still go through canary deploys unless the alternative is data loss. Never silence an alert during an incident; if the alert is noisy, file a follow-up to fix it after the incident. Always preserve logs and metrics for at least 30 days after a SEV-1 for postmortem analysis.

Edge case: incidents caused by upstream provider outages may have no available rollback or fix — the correct response is to fail over to a degraded mode and over-communicate to users. Contradiction worth flagging: classic SRE practice favours automated remediation, but automated remediations have themselves caused outages by masking the underlying problem until it grew catastrophic.

Question: What is the first action after acknowledging an alert? Answer: Open the incident channel, assign an Incident Commander, and post the first status update within 10 minutes.

Question: When should you roll back versus patch forward? Answer: Roll back when the issue began within 30 minutes of a deploy and the previous release was healthy; patch forward only when rollback is impossible or would cause worse harm.`;

export const SCIENTIFIC_EXAMPLE = `Reinforcement Learning from Human Feedback (RLHF) is a training pipeline in which a large language model is first pretrained on text, then fine-tuned on demonstrations, and finally optimised against a reward model trained on human preference comparisons. The reward model is typically a transformer that takes a prompt and two candidate completions and predicts which one humans prefer. Proximal Policy Optimization (PPO) is the most common reinforcement learning algorithm used in this stage.

The canonical RLHF procedure proceeds in four steps. First, collect a dataset of high-quality demonstrations from human writers. Second, supervise fine-tune the base model on these demonstrations. Third, collect pairwise preference comparisons over model outputs and train a reward model. Fourth, optimise the policy against the reward model with PPO while regularising against the supervised model using a KL divergence penalty.

If the KL penalty is too low, the policy diverges from the supervised model and produces high-reward but low-quality outputs — a failure mode known as reward hacking. If the KL penalty is too high, the policy barely moves and most reinforcement learning gains are lost. If the preference dataset is small, the reward model is high-variance and the policy overfits to its idiosyncrasies. When the reward model is updated mid-training without recalibrating the reference policy, the KL term becomes meaningless and training collapses.

Useful heuristic: monitor the KL divergence between policy and reference model continuously — sharp jumps usually precede reward hacking. Another heuristic: a reward model with calibration error above 10 percent on a held-out preference set is not yet reliable enough for RL fine-tuning.

Avoid using a single annotator per preference comparison; inter-annotator agreement under 70 percent is a red flag. Never train the reward model and the policy on the same prompts in the same iteration; the policy will simply memorise the reward model's quirks. Always report KL divergence and reward in the same plot — one without the other is uninterpretable.

Limitation: human preferences over short completions do not reliably transfer to long-form outputs, so models tuned with RLHF tend to be sycophantic and verbose. Contradiction worth flagging: some recent work shows Direct Preference Optimization (DPO) matches or beats RLHF without a separate reward model, but other work shows RLHF still wins on hard reasoning benchmarks — the field has not converged.

Question: Why is the KL divergence penalty included in PPO during RLHF? Answer: To keep the optimised policy close to the supervised model, preventing reward hacking and preserving fluency.

Question: What is reward hacking in RLHF? Answer: When the policy finds outputs that maximise the reward model's score but humans actually dislike — a sign the reward model is being exploited rather than followed.`;

export type CkfExample = {
  id: "learning" | "business" | "clinical" | "legal" | "engineering" | "scientific";
  label: string;
  labelPt: string;
  sourceType: string;
  text: string;
};

export const EXAMPLES: CkfExample[] = [
  { id: "learning",    label: "Learning science",   labelPt: "Ciência da aprendizagem", sourceType: "Article",  text: LEARNING_EXAMPLE },
  { id: "business",    label: "Business strategy",  labelPt: "Estratégia de negócios",  sourceType: "Strategy", text: BUSINESS_EXAMPLE },
  { id: "clinical",    label: "Clinical protocol",  labelPt: "Protocolo clínico",       sourceType: "Protocol", text: CLINICAL_EXAMPLE },
  { id: "legal",       label: "Legal / GDPR",       labelPt: "Jurídico / LGPD-GDPR",    sourceType: "Policy",   text: LEGAL_EXAMPLE },
  { id: "engineering", label: "Engineering runbook",labelPt: "Runbook de engenharia",   sourceType: "Runbook",  text: ENGINEERING_EXAMPLE },
  { id: "scientific",  label: "Scientific paper",   labelPt: "Paper científico",        sourceType: "Paper",    text: SCIENTIFIC_EXAMPLE },
];
