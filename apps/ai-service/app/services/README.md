# app/services/

Business logic that sits between the raw agent output and the final API response: dedup
overlapping findings, map model severity language to the fixed `ReviewComment` severity enum,
and enforce the output actually matches what `api` expects before returning it.

Planned: `review_service.py`.
