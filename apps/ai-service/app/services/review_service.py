from ..core.config import settings
from ..schemas.finding import Finding
from ..schemas.review_response import ReviewResponse


def postprocess_findings(response: ReviewResponse) -> ReviewResponse:
    """
    Defense-in-depth guardrail on top of what the model returns: dedupes identical
    findings (models occasionally repeat a point) and hard-caps the number of findings
    returned, regardless of how many the model reports — protects apps/api and the
    eventual GitHub comment body from an unbounded response.
    """
    seen: set[tuple] = set()
    deduped: list[Finding] = []

    for finding in response.findings:
        key = (finding.file, finding.line, finding.rationale)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(finding)

    return ReviewResponse(
        findings=deduped[: settings.max_findings],
        truncated=response.truncated,
    )
