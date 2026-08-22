from functools import lru_cache
from pathlib import Path

_PROMPTS_DIR = Path(__file__).parent


@lru_cache(maxsize=None)
def load_prompt(name: str) -> str:
    """Loads a prompt template by filename (e.g. "review_system.md"). Cached — these
    files don't change at runtime, only between deploys."""
    return (_PROMPTS_DIR / name).read_text(encoding="utf-8").strip()
