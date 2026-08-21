# app/agents/ — the review harness

Where "agent" behavior actually lives: prompt templates, tool/function-calling schema
definitions, and the orchestration loop that calls the OpenAI SDK (incl. structured outputs).

Planned:
- `review_agent.py` — takes a `ReviewContext`, returns raw structured findings
- `conversation_agent.py` — takes a `ConversationContext` (original review + message history),
  returns a reply that stays grounded in the original findings/diff rather than re-reviewing
  from scratch (ADR-009)
- `prompts/` — versioned prompt templates, kept out of Python code so they're easy to iterate
  on and diff in review
- `tools.py` — function-calling tool definitions
