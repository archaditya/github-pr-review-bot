# ADR-009: Single summary comment, with conversational follow-up support

## Status
Accepted

## Context
Review findings ko PR pe post karne ke do tareeke the: per-finding inline comments (file+line
specific), ya ek single summary comment (saare findings ek jagah, bullet form). Decision:
**single summary comment** for MVP — kam GitHub API calls, cleaner PR thread, aur implementation
simpler.

Lekin sirf "post and forget" kaafi nahi — agar contributor bot ke summary comment pe reply
kare ("yeh finding galat hai", "iska matlab samjhao", "kya yeh critical hai?"), bot ko wahi
respond karna chahiye — jaise ek human reviewer thread mein reply karta hai.

**Important GitHub API constraint**: the summary comment is posted via the **Issues API**
(`POST /repos/{owner}/{repo}/issues/{pr_number}/comments`) since it's not tied to a specific
diff line. Issues-API comments do **not** support native threaded replies (unlike PR *review*
comments on a diff line, which support `in_reply_to`). A user "replying" to the bot's comment
is, from GitHub's perspective, just another top-level comment on the same PR — there's no
structural parent/child link.

## Decision

1. **Posting**: one `ReviewComment` (role: `summary`) per `ReviewJob`, posted via
   `integrations/github/comment-client.js`. Its `github_comment_id` is stored — this is the
   anchor the conversation is built around.

2. **Detecting a reply is meant for the bot** (MVP trigger rule, since native threading isn't
   available): a new `issue_comment.created` webhook event is treated as directed at the bot
   **only if** the comment body explicitly `@mentions` the bot's GitHub App bot-user handle
   (e.g. `@archadi-bot`). No other heuristic (comment ordering, time window, etc.) is used for
   MVP — mention-only is unambiguous and needs no tuning.

   This rule lives in one place — `services/conversation.service.js` — so it can be relaxed
   later (e.g. also inferring intent from unaddressed comments) without touching webhook
   plumbing.

3. **Responding**: a separate Inngest function (`jobs/handle-comment-reply.job.js`), triggered
   by a `pr/comment.received` event (emitted from `webhook.service.js` when the rule above
   matches), builds context from: the original `ReviewJob`'s findings + diff, plus the PR's
   comment history so far, and calls `ai-service` (`POST /conversation/reply` — a second,
   still-stateless endpoint, distinct from `/review/generate`) to generate a reply. The reply is
   posted as a new Issues-API comment (again, not a native thread — but written to read as a
   direct response, e.g. quoting what it's replying to).

4. **Persistence**: new entity `ConversationMessage` (see updated data model) — every bot/user
   message tied to a `ReviewJob`, in chronological order, used to build the context window for
   the next reply so the bot doesn't lose earlier thread context.

## Alternatives considered

- **Inline comments instead of summary**: rejected for MVP — more GitHub API calls, harder to
  build a coherent "conversation" around N separate comment threads vs. one anchor point.
- **Wait for GitHub to support Issues-API threading**: not something we control; the mention/
  window-based heuristic is the pragmatic MVP path and is isolated to one service file so it's
  cheap to replace later (e.g. if GitHub ships native threading, or if we switch the summary to
  a PR *review* comment on a synthetic "top of diff" line to get `in_reply_to` support).
- **No conversational support (pure one-shot post)**: rejected — explicitly requested; a static
  summary with no way to ask "why" is a weaker product than what CodeRabbit-style tools offer.

## Consequences

- (+) Fewer GitHub API calls than inline-per-finding, simpler comment model
- (+) Conversational capability adds real product value (matches the "just like CodeRabbit"
  goal) without needing inline-comment threading machinery
- (–) The mention-based trigger requires the user to remember to `@mention` the bot — a reply
  without the mention is silently ignored (by design, for MVP predictability). Revisit if usage
  data shows this creates friction (e.g. add a one-line hint in the summary comment itself:
  "reply with @archadi-bot to ask about this review")
- (–) `ai-service` gains a second endpoint (`/conversation/reply`) — still stateless (all context
  passed in per-call), so ADR-003's boundary holds, but the contract surface grows
