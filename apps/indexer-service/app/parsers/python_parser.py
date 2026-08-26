"""
Python parser using tree-sitter.
Extracts functions, classes, methods, imports, decorators, and calls.
"""

import logging

import tree_sitter_python as ts_py
from tree_sitter import Language, Parser, Node

from .base_parser import BaseParser, ParseResult
from ..graph.graph_writer import SymbolNode, SymbolEdge
from ..graph.schema import NodeLabel, EdgeType, Confidence

logger = logging.getLogger(__name__)

PY_LANGUAGE = Language(ts_py.language())


class PythonParser(BaseParser):
    """Extracts symbols and relationships from Python files."""

    def __init__(self) -> None:
        self._parser = Parser(PY_LANGUAGE)

    def parse(self, source_code: str, file_path: str, repo_id: str) -> ParseResult:
        result = ParseResult(file_path=file_path, language="python")

        try:
            tree = self._parser.parse(source_code.encode("utf-8"))
        except Exception as exc:
            result.errors.append(f"parse error: {exc}")
            return result

        root = tree.root_node
        self._extract_functions(root, source_code, file_path, repo_id, result)
        self._extract_classes(root, source_code, file_path, repo_id, result)
        self._extract_imports(root, source_code, file_path, repo_id, result)
        self._extract_calls(root, source_code, file_path, repo_id, result)
        self._extract_variables(root, source_code, file_path, repo_id, result)
        self._extract_decorators(root, source_code, file_path, repo_id, result)

        return result

    def _extract_functions(
        self, root: Node, source: str, file_path: str, repo_id: str, result: ParseResult
    ) -> None:
        """Extract top-level function definitions (not methods — those are in _extract_classes)."""
        for node in root.children:
            if node.type == "decorated_definition":
                inner = node.child_by_field_name("definition")
                if inner and inner.type == "function_definition":
                    self._add_function(inner, source, file_path, repo_id, result, is_method=False)
            elif node.type == "function_definition":
                self._add_function(node, source, file_path, repo_id, result, is_method=False)

    def _extract_classes(
        self, root: Node, source: str, file_path: str, repo_id: str, result: ParseResult
    ) -> None:
        """Extract class definitions and their methods."""
        class_nodes = [n for n in root.children if n.type == "class_definition"]
        # Also handle decorated classes
        for n in root.children:
            if n.type == "decorated_definition":
                inner = n.child_by_field_name("definition")
                if inner and inner.type == "class_definition":
                    class_nodes.append(inner)

        for node in class_nodes:
            name_node = node.child_by_field_name("name")
            if not name_node:
                continue
            class_name = self._node_text(name_node, source)
            class_fqn = self.make_fqn(file_path, class_name)

            result.symbols.append(SymbolNode(
                label=NodeLabel.CLASS,
                repo_id=repo_id,
                file_path=file_path,
                name=class_name,
                fqn=class_fqn,
                start_line=node.start_point[0] + 1,
                end_line=node.end_point[0] + 1,
                language="python",
            ))

            # Superclasses
            superclasses = node.child_by_field_name("superclasses")
            if superclasses:
                for arg in self._walk_type(superclasses, "identifier"):
                    super_name = self._node_text(arg, source)
                    if super_name in ("ABC", "object", "BaseModel", "Enum"):
                        continue  # Skip common base classes
                    result.edges.append(SymbolEdge(
                        edge_type=EdgeType.EXTENDS,
                        source_fqn=class_fqn,
                        target_fqn=f"__unresolved__::{super_name}",
                        source_label=NodeLabel.CLASS,
                        target_label=NodeLabel.CLASS,
                        confidence=Confidence.INFERRED,
                        repo_id=repo_id,
                    ))

            # Methods
            body = node.child_by_field_name("body")
            if body:
                for method_node in body.children:
                    actual_method = method_node
                    if method_node.type == "decorated_definition":
                        actual_method = method_node.child_by_field_name("definition")
                    if actual_method and actual_method.type == "function_definition":
                        self._add_function(
                            actual_method, source, file_path, repo_id, result,
                            is_method=True, class_name=class_name,
                        )
                        m_name_node = actual_method.child_by_field_name("name")
                        if m_name_node:
                            m_name = self._node_text(m_name_node, source)
                            m_fqn = self.make_fqn(file_path, class_name, m_name)
                            result.edges.append(SymbolEdge(
                                edge_type=EdgeType.CONTAINS,
                                source_fqn=class_fqn,
                                target_fqn=m_fqn,
                                source_label=NodeLabel.CLASS,
                                target_label=NodeLabel.FUNCTION,
                                confidence=Confidence.EXTRACTED,
                                repo_id=repo_id,
                            ))

    def _add_function(
        self, node: Node, source: str, file_path: str, repo_id: str,
        result: ParseResult, is_method: bool = False, class_name: str = "",
    ) -> None:
        name_node = node.child_by_field_name("name")
        if not name_node:
            return
        name = self._node_text(name_node, source)
        fqn = self.make_fqn(file_path, class_name, name) if class_name else self.make_fqn(file_path, name)
        params = self._extract_params(node, source)
        is_async = self._node_text(node, source).strip().startswith("async")

        result.symbols.append(SymbolNode(
            label=NodeLabel.FUNCTION,
            repo_id=repo_id,
            file_path=file_path,
            name=name,
            fqn=fqn,
            start_line=node.start_point[0] + 1,
            end_line=node.end_point[0] + 1,
            language="python",
            props={"params": params, "is_async": is_async, "is_method": is_method},
        ))

    def _extract_imports(
        self, root: Node, source: str, file_path: str, repo_id: str, result: ParseResult
    ) -> None:
        """Extract import and from...import statements."""
        for node in self._walk_type(root, "import_statement"):
            for name_node in self._walk_type(node, "dotted_name"):
                import_path = self._node_text(name_node, source)
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

        for node in self._walk_type(root, "import_from_statement"):
            module_node = node.child_by_field_name("module_name")
            if module_node:
                import_path = self._node_text(module_node, source)
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
        """Extract function calls within function/method bodies."""
        scopes: list[tuple[str, Node]] = []

        # Top-level functions
        for fn in root.children:
            actual = fn
            if fn.type == "decorated_definition":
                actual = fn.child_by_field_name("definition")
            if actual and actual.type == "function_definition":
                name_node = actual.child_by_field_name("name")
                if name_node:
                    scopes.append((self.make_fqn(file_path, self._node_text(name_node, source)), actual))

        # Class methods
        for cls in root.children:
            if cls.type == "decorated_definition":
                cls = cls.child_by_field_name("definition")
            if not cls or cls.type != "class_definition":
                continue
            cls_name_node = cls.child_by_field_name("name")
            if not cls_name_node:
                continue
            cls_name = self._node_text(cls_name_node, source)
            body = cls.child_by_field_name("body")
            if body:
                for m in body.children:
                    actual_m = m
                    if m.type == "decorated_definition":
                        actual_m = m.child_by_field_name("definition")
                    if actual_m and actual_m.type == "function_definition":
                        m_name_node = actual_m.child_by_field_name("name")
                        if m_name_node:
                            m_name = self._node_text(m_name_node, source)
                            scopes.append((self.make_fqn(file_path, cls_name, m_name), actual_m))

        for scope_fqn, scope_node in scopes:
            for call in self._walk_type(scope_node, "call"):
                fn_node = call.child_by_field_name("function")
                if not fn_node:
                    continue
                callee = self._node_text(fn_node, source)
                if callee in ("print", "len", "range", "str", "int", "float", "list", "dict", "set", "super"):
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

    def _extract_variables(
        self, root: Node, source: str, file_path: str, repo_id: str, result: ParseResult
    ) -> None:
        """Extract module-level variable assignments."""
        for node in root.children:
            if node.type != "expression_statement":
                continue
            expr = node.children[0] if node.children else None
            if not expr or expr.type != "assignment":
                continue
            left = expr.child_by_field_name("left")
            if left and left.type == "identifier":
                name = self._node_text(left, source)
                if name.startswith("_"):
                    continue
                fqn = self.make_fqn(file_path, name)
                result.symbols.append(SymbolNode(
                    label=NodeLabel.VARIABLE,
                    repo_id=repo_id,
                    file_path=file_path,
                    name=name,
                    fqn=fqn,
                    start_line=node.start_point[0] + 1,
                    end_line=node.end_point[0] + 1,
                    language="python",
                    props={"kind": "assignment"},
                ))

    def _extract_decorators(
        self, root: Node, source: str, file_path: str, repo_id: str, result: ParseResult
    ) -> None:
        """Detect FastAPI/Flask route decorators as API endpoints."""
        route_decorators = {"get", "post", "put", "patch", "delete", "options", "head"}

        for node in self._walk_type(root, "decorated_definition"):
            for decorator in self._walk_type(node, "decorator"):
                dec_text = self._node_text(decorator, source)
                # Match @router.get("/path") or @app.post("/path")
                for method in route_decorators:
                    pattern = f".{method}("
                    if pattern in dec_text:
                        # Extract path from decorator arguments
                        for call in self._walk_type(decorator, "call"):
                            args = call.child_by_field_name("arguments")
                            if args and args.named_child_count > 0:
                                path_arg = args.named_children[0]
                                path_val = self._node_text(path_arg, source).strip("'\"")
                                definition = node.child_by_field_name("definition")
                                handler_name = ""
                                if definition:
                                    handler_name_node = definition.child_by_field_name("name")
                                    if handler_name_node:
                                        handler_name = self._node_text(handler_name_node, source)

                                result.symbols.append(SymbolNode(
                                    label=NodeLabel.API_ENDPOINT,
                                    repo_id=repo_id,
                                    file_path=file_path,
                                    name=f"{method.upper()} {path_val}",
                                    fqn=self.make_fqn(file_path, f"route:{method.upper()}:{path_val}"),
                                    start_line=node.start_point[0] + 1,
                                    end_line=node.end_point[0] + 1,
                                    language="python",
                                    props={
                                        "method": method.upper(),
                                        "path_pattern": path_val,
                                        "handler_fqn": self.make_fqn(file_path, handler_name) if handler_name else "",
                                    },
                                ))
                        break

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
