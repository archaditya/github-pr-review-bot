from ..core.config import settings
from ..schemas.finding import Finding, Severity
from ..schemas.review_response import ReviewResponse

NITPICK_OPTIMIZATION_TERMS = (
    "consider optimizing",
    "redundant decoding",
    "unnecessary cpu overhead",
    "unnecessary overhead",
    "premature optimization",
    "consider caching",
    "avoid re-encoding",
    "avoid redundant",
)

NITPICK_DOCUMENTATION_TERMS = (
    "should be documented",
    "design choice",
    "document clearly",
    "document this",
    "add documentation",
    "consider documenting",
    "add godoc",
    "add comments",
)

NITPICK_OBSERVATION_TERMS = (
    "consider logging",
    "missing log",
    "add log",
    "fail-open",
    "fail open",
    "heuristic",
    "magic number",
    "magic byte",
    "type annotation",
    "type hint",
    "naming convention",
)

SEVERITY_ORDER = {
    Severity.critical: 0,
    Severity.high: 1,
    Severity.medium: 2,
    Severity.low: 3,
    Severity.info: 4,
}


def _calibrate_finding(finding: Finding) -> Finding:
    """Ensures findings adhere to strict severity rules and prevents false alarm inflation."""
    severity = finding.severity
    rationale_lower = (finding.rationale or "").lower()
    confidence_lower = (finding.confidence or "").lower()

    # Rule 1: Low confidence findings cannot be high, critical, or medium
    if confidence_lower == "low":
        if severity in (Severity.critical, Severity.high, Severity.medium):
            severity = Severity.low

    # Rule 2: Optimization suggestions cannot be critical, high, or medium
    if any(term in rationale_lower for term in NITPICK_OPTIMIZATION_TERMS):
        if severity in (Severity.critical, Severity.high, Severity.medium):
            severity = Severity.info

    # Rule 3: Documentation and design choice notes cannot be critical, high, or medium
    if any(term in rationale_lower for term in NITPICK_DOCUMENTATION_TERMS):
        if severity in (Severity.critical, Severity.high, Severity.medium):
            severity = Severity.info

    # Rule 4: Heuristics, fail-open designs, and logging suggestions cannot be critical, high, or medium
    if any(term in rationale_lower for term in NITPICK_OBSERVATION_TERMS):
        if severity in (Severity.critical, Severity.high, Severity.medium):
            severity = Severity.low

    if severity != finding.severity:
        return finding.model_copy(update={"severity": severity})
    return finding


def postprocess_findings(response: ReviewResponse) -> ReviewResponse:
    """
    Defense-in-depth guardrail on top of what the model returns: dedupes identical
    findings, calibrates severities against nitpick inflation, sorts by severity,
    and hard-caps the total findings to at most 3.
    """
    seen: set[tuple] = set()
    deduped: list[Finding] = []

    for raw_finding in response.findings:
        finding = _calibrate_finding(raw_finding)
        key = (finding.file, finding.line, finding.rationale)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(finding)

    # Sort so most critical findings are preserved first, then non-blocking suggestions
    deduped.sort(key=lambda f: SEVERITY_ORDER.get(f.severity, 99))

    # Strict hard cap: never overwhelm the author with more than 3 findings
    cap = min(settings.max_findings, 3)
    return ReviewResponse(
        findings=deduped[:cap],
        truncated=response.truncated,
    )


