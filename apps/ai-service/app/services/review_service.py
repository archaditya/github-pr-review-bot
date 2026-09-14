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


def _calibrate_finding(finding: Finding) -> Finding:
    """Ensures findings adhere to strict severity rules and prevents false alarm inflation."""
    severity = finding.severity
    rationale_lower = (finding.rationale or "").lower()
    confidence_lower = (finding.confidence or "").lower()

    # Rule 1: Low confidence findings cannot be high or critical
    if confidence_lower == "low":
        if severity in (Severity.critical, Severity.high):
            severity = Severity.low
        elif severity == Severity.medium:
            severity = Severity.low

    # Rule 2: Optimization suggestions cannot be critical, high, or medium
    if any(term in rationale_lower for term in NITPICK_OPTIMIZATION_TERMS):
        if severity in (Severity.critical, Severity.high, Severity.medium):
            severity = Severity.info

    # Rule 3: Documentation and design choice notes cannot be critical, high, or medium
    if any(term in rationale_lower for term in NITPICK_DOCUMENTATION_TERMS):
        if severity in (Severity.critical, Severity.high, Severity.medium):
            severity = Severity.info

    if severity != finding.severity:
        return finding.model_copy(update={"severity": severity})
    return finding


def postprocess_findings(response: ReviewResponse) -> ReviewResponse:
    """
    Defense-in-depth guardrail on top of what the model returns: dedupes identical
    findings, calibrates severities against nitpick inflation, and hard-caps the
    number of findings returned.
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

    return ReviewResponse(
        findings=deduped[: settings.max_findings],
        truncated=response.truncated,
    )

