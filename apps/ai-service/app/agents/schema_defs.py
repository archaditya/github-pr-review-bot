"""
Strict JSON schema used with OpenAI's structured outputs (response_format={"type":
"json_schema", ...}) for the review-generation call. This is the primary guardrail on
output shape — the model is constrained at decode time, not just asked nicely to follow
a format. Pydantic validation in review_agent.py is a second, defense-in-depth layer on
top of this (never trust model output on a single layer of validation alone).
"""

REVIEW_FINDINGS_SCHEMA = {
    "name": "review_findings",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "findings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": "string"},
                        "line": {"type": ["integer", "null"]},
                        "severity": {
                            "type": "string",
                            "enum": ["critical", "high", "medium", "low", "info"],
                        },
                        "rationale": {"type": "string"},
                    },
                    "required": ["file", "line", "severity", "rationale"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["findings"],
        "additionalProperties": False,
    },
}
