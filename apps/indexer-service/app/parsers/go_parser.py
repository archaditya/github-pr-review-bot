"""
Go parser using tree-sitter.
Extracts functions, types (structs/interfaces), methods, imports, and calls.
"""

import logging

import tree_sitter_go as ts_go
from tree_sitter import Language, Parser, Node

from .base_parser import BaseParser, ParseResult
from ..graph.graph_writer import SymbolNode, SymbolEdge
from ..graph.schema import NodeLabel, EdgeType, Confidence

logger = logging.getLogger(__name__)

GO_LANGUAGE = Language(ts_go.language())


class GoParser(BaseParser):
    """Extracts symbols and relationships from Go files."""

    def __init__(self) -> None:
        self._parser = Parser(GO_LANGUAGE)

    def parse(self, source_code: str, file_path: str, repo_id: str) -> ParseResult:
        result = ParseResult(file_path=file_path, language="go")

        try:
            tree = self._parser.parse(source_code.encode("utf-8"))
        except Exception as exc:
            result.errors.append(f"parse error: {exc}")
            return result

        root = tree.root_node
        self._extract_functions(root, source_code, file_path, repo_id, result)
        self._extract_types(root, source_code, file_path, repo_id, result)
        self._extract_imports(root, source_code, file_path, repo_id, result)
        self._extract_calls(root, source_code, file_path, repo_id, result)

        return result

    def _extract_functions(
        self, root: Node, source: str, file_path: str, repo_id: str, result: ParseResult
    ) -> None:
        """Extract top-level function declarations."""
        for node in self._walk_type(root, "function_declaration"):
            name_node = node.child_by_field_name("name")
            if not name_node:
                continue
            name = self._node_text(name_node, source)
            fqn = self.make_fqn(file_path, name)
            params = self._extract_params(node, source)

            result.symbols.append(SymbolNode(
                label=NodeLabel.FUNCTION,
                repo_id=repo_id,
                file_path=file_path,
                name=name,
                fqn=fqn,
                start_line=node.start_point[0] + 1,
                end_line=node.end_point[0] + 1,
                language="go",
                props={"params": params, "is_method": False, "is_async": False},
            ))

        # Method declarations (func (r *Receiver) Method() {...})
        for node in self._walk_type(root, "method_declaration"):
            name_node = node.child_by_field_name("name")
            if not name_node:
                continue
            name = self._node_text(name_node, source)

            # Extract receiver type
            receiver_node = node.child_by_field_name("receiver")
            receiver_type = ""
            if receiver_node:
                for type_id in self._walk_type(receiver_node, "type_identifier"):
                    receiver_type = self._node_text(type_id, source)
                    break

            fqn = self.make_fqn(file_path, receiver_type, name) if receiver_type else self.make_fqn(file_path, name)
            params = self._extract_params(node, source)

            result.symbols.append(SymbolNode(
                label=NodeLabel.FUNCTION,
                repo_id=repo_id,
                file_path=file_path,
                name=name,
                fqn=fqn,
                start_line=node.start_point[0] + 1,
                end_line=node.end_point[0] + 1,
                language="go",
                props={"params": params, "is_method": True, "is_async": False, "receiver": receiver_type},
            ))

            if receiver_type:
                type_fqn = self.make_fqn(file_path, receiver_type)
                result.edges.append(SymbolEdge(
                    edge_type=EdgeType.CONTAINS,
                    source_fqn=type_fqn,
                    target_fqn=fqn,
                    source_label=NodeLabel.CLASS,
                    target_label=NodeLabel.FUNCTION,
                    confidence=Confidence.EXTRACTED,
                    repo_id=repo_id,
                ))

    def _extract_types(
        self, root: Node, source: str, file_path: str, repo_id: str, result: ParseResult
    ) -> None:
        """Extract type declarations (struct and interface)."""
        for node in self._walk_type(root, "type_declaration"):
            for spec in self._walk_type(node, "type_spec"):
                name_node = spec.child_by_field_name("name")
                type_node = spec.child_by_field_name("type")
                if not name_node or not type_node:
                    continue
                name = self._node_text(name_node, source)
                fqn = self.make_fqn(file_path, name)

                if type_node.type == "struct_type":
                    result.symbols.append(SymbolNode(
                        label=NodeLabel.CLASS,
                        repo_id=repo_id,
                        file_path=file_path,
                        name=name,
                        fqn=fqn,
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                        language="go",
                    ))
                elif type_node.type == "interface_type":
                    result.symbols.append(SymbolNode(
                        label=NodeLabel.INTERFACE,
                        repo_id=repo_id,
                        file_path=file_path,
                        name=name,
                        fqn=fqn,
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                        language="go",
                    ))

    def _extract_imports(
        self, root: Node, source: str, file_path: str, repo_id: str, result: ParseResult
    ) -> None:
        """Extract Go import statements."""
        for node in self._walk_type(root, "import_declaration"):
            for spec in self._walk_type(node, "import_spec"):
                path_node = spec.child_by_field_name("path")
                if path_node:
                    import_path = self._node_text(path_node, source).strip('"')
                    result.edges.append(SymbolEdge(
                        edge_type=EdgeType.IMPORTS,
                        source_fqn=file_path,
                        target_fqn=f"__import__::{import_path}",
                        source_label=NodeLabel.FILE,
                        target_label=NodeLabel.FILE,
                        confidence=Confidence.EXTRACTED,
                        repo_id=repo_id,
                        props={"import_path": import_path},
                    ))

    def _extract_calls(
        self, root: Node, source: str, file_path: str, repo_id: str, result: ParseResult
    ) -> None:
        """Extract function calls within function bodies."""
        scopes: list[tuple[str, Node]] = []

        for fn in self._walk_type(root, "function_declaration"):
            name_node = fn.child_by_field_name("name")
            if name_node:
                scopes.append((self.make_fqn(file_path, self._node_text(name_node, source)), fn))

        for method in self._walk_type(root, "method_declaration"):
            name_node = method.child_by_field_name("name")
            receiver_node = method.child_by_field_name("receiver")
            if name_node:
                receiver_type = ""
                if receiver_node:
                    for type_id in self._walk_type(receiver_node, "type_identifier"):
                        receiver_type = self._node_text(type_id, source)
                        break
                m_name = self._node_text(name_node, source)
                fqn = self.make_fqn(file_path, receiver_type, m_name) if receiver_type else self.make_fqn(file_path, m_name)
                scopes.append((fqn, method))

        for scope_fqn, scope_node in scopes:
            for call in self._walk_type(scope_node, "call_expression"):
                fn_node = call.child_by_field_name("function")
                if not fn_node:
                    continue
                callee = self._node_text(fn_node, source)
                if callee in ("fmt.Println", "fmt.Printf", "fmt.Sprintf", "log.Println", "log.Printf"):
                    continue

                result.edges.append(SymbolEdge(
                    edge_type=EdgeType.CALLS,
                    source_fqn=scope_fqn,
                    target_fqn=f"__unresolved__::{callee}",
                    source_label=NodeLabel.FUNCTION,
                    target_label=NodeLabel.FUNCTION,
                    confidence=Confidence.INFERRED,
                    repo_id=repo_id,
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

    @staticmethod
    def _extract_params(node: Node, source: str) -> str:
        params_node = node.child_by_field_name("parameters")
        if params_node:
            text = source[params_node.start_byte:params_node.end_byte]
            return text.strip("()")
        return ""
