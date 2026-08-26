"""
Node and edge type definitions for the code knowledge graph.
These constants are the contract between parsers, graph_writer, and query clients.

Node labels and relationship types follow Neo4j naming conventions:
- Node labels: PascalCase
- Relationship types: UPPER_SNAKE_CASE
"""

from enum import Enum


class NodeLabel(str, Enum):
    """Every node in the graph carries exactly one of these labels."""
    FILE = "File"
    MODULE = "Module"
    CLASS = "Class"
    FUNCTION = "Function"
    INTERFACE = "Interface"
    VARIABLE = "Variable"
    API_ENDPOINT = "APIEndpoint"


class EdgeType(str, Enum):
    """Relationship types stored on graph edges."""
    DEFINED_IN = "DEFINED_IN"
    IMPORTS = "IMPORTS"
    EXPORTS = "EXPORTS"
    CALLS = "CALLS"
    EXTENDS = "EXTENDS"
    IMPLEMENTS = "IMPLEMENTS"
    RETURNS_TYPE = "RETURNS_TYPE"
    PARAM_TYPE = "PARAM_TYPE"
    REFERENCES = "REFERENCES"
    CONTAINS = "CONTAINS"
    HANDLES_ROUTE = "HANDLES_ROUTE"


class Confidence(str, Enum):
    """
    How certain are we about a relationship?
    Borrowed from Graphify — provenance matters for downstream reasoning.
    """
    EXTRACTED = "EXTRACTED"   # Directly from AST, 100% certain
    INFERRED = "INFERRED"    # Derived from heuristics (e.g., name-matching call targets)
    AMBIGUOUS = "AMBIGUOUS"  # Best-effort, uncertain mapping


# Files/directories to skip during indexing — deterministic ignore list
IGNORED_DIRS = frozenset({
    "node_modules", ".git", "dist", "build", "coverage", "__pycache__",
    ".next", ".nuxt", ".venv", "venv", "env", ".env", "vendor",
    ".pytest_cache", ".mypy_cache", ".tox", "eggs", "*.egg-info",
    ".idea", ".vscode", ".DS_Store",
})

IGNORED_EXTENSIONS = frozenset({
    ".lock", ".sum", ".min.js", ".min.css", ".map",
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp",
    ".woff", ".woff2", ".ttf", ".eot",
    ".pdf", ".zip", ".tar", ".gz", ".br",
    ".pyc", ".pyo", ".so", ".dll", ".exe",
    ".db", ".sqlite", ".sqlite3",
})

# Language extension mapping
LANGUAGE_MAP: dict[str, str] = {
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".py": "python",
    ".go": "go",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
}
