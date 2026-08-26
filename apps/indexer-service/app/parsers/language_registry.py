"""
Maps file extensions to their corresponding parser implementation.
Central registry — adding a new language means adding one entry here
and creating its parser class.
"""

import logging
from pathlib import Path

from .base_parser import BaseParser
from .javascript_parser import JavaScriptParser
from .python_parser import PythonParser
from .go_parser import GoParser
from .web_parser import WebParser
from ..graph.schema import LANGUAGE_MAP

logger = logging.getLogger(__name__)

# Singleton parser instances — parsers are stateless and thread-safe
_parsers: dict[str, BaseParser] = {}


def _get_parsers() -> dict[str, BaseParser]:
    """Lazily initialize parser instances."""
    global _parsers
    if not _parsers:
        js_parser = JavaScriptParser()
        py_parser = PythonParser()
        go_parser = GoParser()
        web_parser = WebParser()

        _parsers = {
            "javascript": js_parser,
            "typescript": js_parser,
            "tsx": js_parser,
            "python": py_parser,
            "go": go_parser,
            "html": web_parser,
            "css": web_parser,
        }
    return _parsers


def get_parser_for_file(file_path: str) -> BaseParser | None:
    """
    Return the appropriate parser for a file, or None if the language is unsupported.
    Lookup is by file extension using LANGUAGE_MAP from schema.py.
    """
    ext = Path(file_path).suffix.lower()
    language = LANGUAGE_MAP.get(ext)
    if not language:
        return None

    parsers = _get_parsers()
    return parsers.get(language)


def get_language_for_file(file_path: str) -> str | None:
    """Return the language name for a file path, or None if unsupported."""
    ext = Path(file_path).suffix.lower()
    return LANGUAGE_MAP.get(ext)


def get_supported_extensions() -> set[str]:
    """Return the set of file extensions we can parse."""
    return set(LANGUAGE_MAP.keys())
