# app/services/

Pre/post-processing around the agents — business logic that isn't "call the model" itself.

- `review_service.py` — `postprocess_findings()`: dedupes near-identical findings, hard-caps
  the count returned (`settings.max_findings`) regardless of what the model produced
- `conversation_service.py` — `cap_history()`: bounds how much prior conversation is sent to
  the model on each reply (`settings.max_conversation_history_messages`)
