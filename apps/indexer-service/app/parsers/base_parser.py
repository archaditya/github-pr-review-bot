"""
Abstract base parser. Every language parser implements this interface.
Parsers are deterministic — no LLM, no network calls, pure AST extraction.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from ..graph.graph_writer import SymbolNode, SymbolEdge


@dataclass
class ParseResult:
    """Output of parsing a single file."""
    file_path: str
    language: str
    symbols: list[SymbolNode] = field(default_factory=list)
    edges: list[SymbolEdge] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


class BaseParser(ABC):
    """
    Contract for language-specific parsers.
    Each parser receives raw source code and file path, returns symbols + edges.
    """

    @abstractmethod
    def parse(self, source_code: str, file_path: str, repo_id: str) -> ParseResult:
        """
        Parse source code and extract symbols + relationships.

        Args:
            source_code: Raw file content as string
            file_path: Relative path within the repository (e.g., "src/services/user.service.js")
            repo_id: Repository UUID for namespacing in the graph

        Returns:
            ParseResult with extracted symbols and edges
        """

    @staticmethod
    def make_fqn(file_path: str, *parts: str) -> str:
        """
        Build a fully-qualified name for a symbol.
        Example: make_fqn("src/services/user.js", "UserService", "create") → "src/services/user.js::UserService.create"
        """
        suffix = ".".join(p for p in parts if p)
        return f"{file_path}::{suffix}" if suffix else file_path
