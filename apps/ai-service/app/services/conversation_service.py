from ..core.config import settings
from ..schemas.conversation_request import ConversationTurn


def cap_history(history: list[ConversationTurn]) -> list[ConversationTurn]:
    """
    Input-shaping guardrail: bounds how much prior conversation is sent to the model on
    each reply, regardless of how long the thread has grown — keeps cost/latency
    predictable and avoids the context window filling with old turns that add little
    value to the current question.
    """
    if len(history) <= settings.max_conversation_history_messages:
        return history
    return history[-settings.max_conversation_history_messages :]
