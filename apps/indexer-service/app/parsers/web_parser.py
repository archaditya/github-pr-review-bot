"""
HTML/CSS parser — lightweight structural extraction.
Not AST-heavy like JS/Python, but captures file-level metadata, IDs, classes,
and link/script references that matter for understanding a web project's structure.
"""

import logging
import re

import tree_sitter_html as ts_html
import tree_sitter_css as ts_css
from tree_sitter import Language, Parser, Node

from .base_parser import BaseParser, ParseResult
from ..graph.graph_writer import SymbolNode, SymbolEdge
from ..graph.schema import NodeLabel, EdgeType, Confidence

logger = logging.getLogger(__name__)

HTML_LANGUAGE = Language(ts_html.language())
CSS_LANGUAGE = Language(ts_css.language())


class WebParser(BaseParser):
    """Extracts structural information from HTML and CSS files."""

    def __init__(self) -> None:
        self._html_parser = Parser(HTML_LANGUAGE)
        self._css_parser = Parser(CSS_LANGUAGE)

    def parse(self, source_code: str, file_path: str, repo_id: str) -> ParseResult:
        if file_path.endswith((".css",)):
            return self._parse_css(source_code, file_path, repo_id)
        return self._parse_html(source_code, file_path, repo_id)

    def _parse_html(self, source_code: str, file_path: str, repo_id: str) -> ParseResult:
        result = ParseResult(file_path=file_path, language="html")

        try:
            tree = self._html_parser.parse(source_code.encode("utf-8"))
        except Exception as exc:
            result.errors.append(f"parse error: {exc}")
            return result

        root = tree.root_node
        self._extract_html_references(root, source_code, file_path, repo_id, result)
        return result

    def _parse_css(self, source_code: str, file_path: str, repo_id: str) -> ParseResult:
        result = ParseResult(file_path=file_path, language="css")

        try:
            tree = self._css_parser.parse(source_code.encode("utf-8"))
        except Exception as exc:
            result.errors.append(f"parse error: {exc}")
            return result

        root = tree.root_node
        self._extract_css_selectors(root, source_code, file_path, repo_id, result)
        return result

    def _extract_html_references(
        self, root: Node, source: str, file_path: str, repo_id: str, result: ParseResult
    ) -> None:
        """Extract script src, link href, and img src as IMPORTS edges."""
        for element in self._walk_type(root, "element"):
            start_tag = None
            for child in element.children:
                if child.type == "start_tag":
                    start_tag = child
                    break
            if not start_tag:
                continue

            tag_name_node = start_tag.child_by_field_name("tag_name") or (
                start_tag.children[0] if start_tag.children else None
            )
            if not tag_name_node:
                continue
            tag_name = self._node_text(tag_name_node, source).lower()

            if tag_name in ("script", "link", "img"):
                for attr in self._walk_type(start_tag, "attribute"):
                    attr_name_node = attr.child_by_field_name("attribute_name") or (
                        attr.children[0] if attr.children else None
                    )
                    attr_val_node = attr.child_by_field_name("attribute_value") or (
                        attr.children[1] if len(attr.children) > 1 else None
                    )
                    if not attr_name_node or not attr_val_node:
                        continue
                    attr_name = self._node_text(attr_name_node, source).lower()
                    if attr_name in ("src", "href"):
                        ref = self._node_text(attr_val_node, source).strip("'\"")
                        if ref and not ref.startswith(("http://", "https://", "//", "data:", "#")):
                            result.edges.append(SymbolEdge(
                                edge_type=EdgeType.IMPORTS,
                                source_fqn=file_path,
                                target_fqn=f"__import__::{ref}",
                                source_label=NodeLabel.FILE,
                                target_label=NodeLabel.FILE,
                                confidence=Confidence.EXTRACTED,
                                repo_id=repo_id,
                                props={"import_path": ref, "tag": tag_name},
                            ))

    def _extract_css_selectors(
        self, root: Node, source: str, file_path: str, repo_id: str, result: ParseResult
    ) -> None:
        """Extract CSS rule sets as variables (class/id selectors)."""
        for rule in self._walk_type(root, "rule_set"):
            selectors_node = None
            for child in rule.children:
                if child.type == "selectors":
                    selectors_node = child
                    break
            if not selectors_node:
                continue
            selector_text = self._node_text(selectors_node, source).strip()
            if not selector_text or len(selector_text) > 200:
                continue

            result.symbols.append(SymbolNode(
                label=NodeLabel.VARIABLE,
                repo_id=repo_id,
                file_path=file_path,
                name=selector_text,
                fqn=self.make_fqn(file_path, f"css:{selector_text}"),
                start_line=rule.start_point[0] + 1,
                end_line=rule.end_point[0] + 1,
                language="css",
                props={"kind": "css_rule"},
            ))

    # ── Helpers ──

    @staticmethod
    def _node_text(node: Node, source: str) -> str:
        return source[node.start_byte:node.end_byte]

    @staticmethod
    def _walk_type(root: Node, node_type: str) -> list[Node]:
        found: list[Node] = []
        stack = [root]
        while stack:
            node = stack.pop()
            if node.type == node_type:
                found.append(node)
            stack.extend(reversed(node.children))
        return found
