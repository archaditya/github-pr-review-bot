"""
JavaScript/TypeScript parser using tree-sitter.
Extracts functions, classes, methods, imports, exports, calls, and Express routes.
Handles both JS and TS (TSX included) through separate tree-sitter grammars.
"""

import logging

import tree_sitter_javascript as ts_js
import tree_sitter_typescript as ts_ts
from tree_sitter import Language, Parser, Node

from .base_parser import BaseParser, ParseResult
from ..graph.graph_writer import SymbolNode, SymbolEdge
from ..graph.schema import NodeLabel, EdgeType, Confidence

logger = logging.getLogger(__name__)

JS_LANGUAGE = Language(ts_js.language())
TS_LANGUAGE = Language(ts_ts.language_typescript())
TSX_LANGUAGE = Language(ts_ts.language_tsx())


class JavaScriptParser(BaseParser):
    """Extracts symbols and relationships from JavaScript/TypeScript files."""

    def __init__(self) -> None:
        self._js_parser = Parser(JS_LANGUAGE)
        self._ts_parser = Parser(TS_LANGUAGE)
        self._tsx_parser = Parser(TSX_LANGUAGE)

    def _get_parser(self, file_path: str) -> Parser:
        if file_path.endswith((".ts",)):
            return self._ts_parser
        if file_path.endswith((".tsx",)):
            return self._tsx_parser
        return self._js_parser

    def parse(self, source_code: str, file_path: str, repo_id: str) -> ParseResult:
        result = ParseResult(file_path=file_path, language="javascript")
        parser = self._get_parser(file_path)

        try:
            tree = parser.parse(source_code.encode("utf-8"))
        except Exception as exc:
            result.errors.append(f"parse error: {exc}")
            return result

        root = tree.root_node
        self._extract_functions(root, source_code, file_path, repo_id, result)
        self._extract_classes(root, source_code, file_path, repo_id, result)
        self._extract_imports(root, source_code, file_path, repo_id, result)
        self._extract_exports(root, source_code, file_path, repo_id, result)
        self._extract_calls(root, source_code, file_path, repo_id, result)
        self._extract_variables(root, source_code, file_path, repo_id, result)
        self._extract_express_routes(root, source_code, file_path, repo_id, result)

        return result

    def _extract_functions(
        self, root: Node, source: str, file_path: str, repo_id: str, result: ParseResult
    ) -> None:
        """Extract top-level function declarations and arrow functions assigned to variables."""
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
                language="javascript",
                props={"params": params, "is_async": self._is_async(node, source), "is_method": False},
            ))

        # Arrow functions: const foo = (...) => { ... }
        for node in self._walk_type(root, "lexical_declaration"):
            for decl in self._walk_type(node, "variable_declarator"):
                name_node = decl.child_by_field_name("name")
                value_node = decl.child_by_field_name("value")
                if not name_node or not value_node:
                    continue
                if value_node.type != "arrow_function":
                    continue
                name = self._node_text(name_node, source)
                fqn = self.make_fqn(file_path, name)
                params = self._extract_params(value_node, source)

                result.symbols.append(SymbolNode(
                    label=NodeLabel.FUNCTION,
                    repo_id=repo_id,
                    file_path=file_path,
                    name=name,
                    fqn=fqn,
                    start_line=node.start_point[0] + 1,
                    end_line=node.end_point[0] + 1,
                    language="javascript",
                    props={"params": params, "is_async": self._is_async(value_node, source), "is_method": False},
                ))

    def _extract_classes(
        self, root: Node, source: str, file_path: str, repo_id: str, result: ParseResult
    ) -> None:
        """Extract class declarations and their methods."""
        for node in self._walk_type(root, "class_declaration"):
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
                language="javascript",
            ))

            # Superclass (extends)
            super_node = node.child_by_field_name("superclass") or node.child_by_field_name("heritage")
            if super_node:
                super_name = self._node_text(super_node, source)
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
                for method in self._walk_type(body, "method_definition"):
                    m_name_node = method.child_by_field_name("name")
                    if not m_name_node:
                        continue
                    m_name = self._node_text(m_name_node, source)
                    m_fqn = self.make_fqn(file_path, class_name, m_name)
                    params = self._extract_params(method, source)

                    result.symbols.append(SymbolNode(
                        label=NodeLabel.FUNCTION,
                        repo_id=repo_id,
                        file_path=file_path,
                        name=m_name,
                        fqn=m_fqn,
                        start_line=method.start_point[0] + 1,
                        end_line=method.end_point[0] + 1,
                        language="javascript",
                        props={"params": params, "is_async": self._is_async(method, source), "is_method": True},
                    ))

                    # CONTAINS edge: Class → Method
                    result.edges.append(SymbolEdge(
                        edge_type=EdgeType.CONTAINS,
                        source_fqn=class_fqn,
                        target_fqn=m_fqn,
                        source_label=NodeLabel.CLASS,
                        target_label=NodeLabel.FUNCTION,
                        confidence=Confidence.EXTRACTED,
                        repo_id=repo_id,
                    ))

    def _extract_imports(
        self, root: Node, source: str, file_path: str, repo_id: str, result: ParseResult
    ) -> None:
        """Extract import/require statements as IMPORTS edges between files."""
        # ES module imports
        for node in self._walk_type(root, "import_statement"):
            src_node = node.child_by_field_name("source")
            if src_node:
                import_path = self._node_text(src_node, source).strip("'\"")
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

        # CommonJS require
        for node in self._walk_type(root, "call_expression"):
            fn_node = node.child_by_field_name("function")
            if fn_node and self._node_text(fn_node, source) == "require":
                args = node.child_by_field_name("arguments")
                if args and args.named_child_count > 0:
                    arg = args.named_children[0]
                    import_path = self._node_text(arg, source).strip("'\"")
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

    def _extract_exports(
        self, root: Node, source: str, file_path: str, repo_id: str, result: ParseResult
    ) -> None:
        """Extract export statements."""
        for node in self._walk_type(root, "export_statement"):
            decl = node.child_by_field_name("declaration")
            if decl:
                name_node = decl.child_by_field_name("name")
                if name_node:
                    name = self._node_text(name_node, source)
                    fqn = self.make_fqn(file_path, name)
                    result.edges.append(SymbolEdge(
                        edge_type=EdgeType.EXPORTS,
                        source_fqn=file_path,
                        target_fqn=fqn,
                        source_label=NodeLabel.FILE,
                        target_label=NodeLabel.FUNCTION,
                        confidence=Confidence.EXTRACTED,
                        repo_id=repo_id,
                    ))

    def _extract_calls(
        self, root: Node, source: str, file_path: str, repo_id: str, result: ParseResult
    ) -> None:
        """
        Extract function calls. Maps call expressions to CALLS edges.
        Only extracts calls within function/method bodies to establish caller→callee relationships.
        """
        # Find all function/method scopes first
        scopes: list[tuple[str, Node]] = []
        for fn in self._walk_type(root, "function_declaration"):
            name_node = fn.child_by_field_name("name")
            if name_node:
                scopes.append((self.make_fqn(file_path, self._node_text(name_node, source)), fn))

        for cls in self._walk_type(root, "class_declaration"):
            cls_name_node = cls.child_by_field_name("name")
            if not cls_name_node:
                continue
            cls_name = self._node_text(cls_name_node, source)
            body = cls.child_by_field_name("body")
            if body:
                for method in self._walk_type(body, "method_definition"):
                    m_name_node = method.child_by_field_name("name")
                    if m_name_node:
                        m_name = self._node_text(m_name_node, source)
                        scopes.append((self.make_fqn(file_path, cls_name, m_name), method))

        for scope_fqn, scope_node in scopes:
            for call in self._walk_type(scope_node, "call_expression"):
                fn_node = call.child_by_field_name("function")
                if not fn_node:
                    continue
                callee_name = self._node_text(fn_node, source)
                # Skip built-in/common noise
                if callee_name in ("require", "console.log", "console.error", "console.warn"):
                    continue

                result.edges.append(SymbolEdge(
                    edge_type=EdgeType.CALLS,
                    source_fqn=scope_fqn,
                    target_fqn=f"__unresolved__::{callee_name}",
                    source_label=NodeLabel.FUNCTION,
                    target_label=NodeLabel.FUNCTION,
                    confidence=Confidence.INFERRED,
                    repo_id=repo_id,
                ))

    def _extract_variables(
        self, root: Node, source: str, file_path: str, repo_id: str, result: ParseResult
    ) -> None:
        """Extract top-level const/let/var declarations (non-arrow-function)."""
        for node in root.children:
            if node.type not in ("lexical_declaration", "variable_declaration"):
                continue
            for decl in self._walk_type(node, "variable_declarator"):
                name_node = decl.child_by_field_name("name")
                value_node = decl.child_by_field_name("value")
                if not name_node:
                    continue
                # Skip if value is arrow function — already handled
                if value_node and value_node.type == "arrow_function":
                    continue
                name = self._node_text(name_node, source)
                kind_text = self._node_text(node, source).split()[0] if node.children else "const"
                fqn = self.make_fqn(file_path, name)

                result.symbols.append(SymbolNode(
                    label=NodeLabel.VARIABLE,
                    repo_id=repo_id,
                    file_path=file_path,
                    name=name,
                    fqn=fqn,
                    start_line=node.start_point[0] + 1,
                    end_line=node.end_point[0] + 1,
                    language="javascript",
                    props={"kind": kind_text},
                ))

    def _extract_express_routes(
        self, root: Node, source: str, file_path: str, repo_id: str, result: ParseResult
    ) -> None:
        """
        Detect Express-style route definitions:
        router.get('/path', handler), app.post('/path', handler), etc.
        """
        http_methods = {"get", "post", "put", "patch", "delete", "options", "head"}
        for call in self._walk_type(root, "call_expression"):
            fn_node = call.child_by_field_name("function")
            if not fn_node or fn_node.type != "member_expression":
                continue
            prop = fn_node.child_by_field_name("property")
            if not prop:
                continue
            method_name = self._node_text(prop, source)
            if method_name not in http_methods:
                continue

            args = call.child_by_field_name("arguments")
            if not args or args.named_child_count < 1:
                continue
            path_arg = args.named_children[0]
            path_pattern = self._node_text(path_arg, source).strip("'\"")

            result.symbols.append(SymbolNode(
                label=NodeLabel.API_ENDPOINT,
                repo_id=repo_id,
                file_path=file_path,
                name=f"{method_name.upper()} {path_pattern}",
                fqn=self.make_fqn(file_path, f"route:{method_name.upper()}:{path_pattern}"),
                start_line=call.start_point[0] + 1,
                end_line=call.end_point[0] + 1,
                language="javascript",
                props={"method": method_name.upper(), "path_pattern": path_pattern},
            ))

    # ── Helpers ──

    @staticmethod
    def _node_text(node: Node, source: str) -> str:
        return source[node.start_byte:node.end_byte]

    @staticmethod
    def _walk_type(root: Node, node_type: str) -> list[Node]:
        """Walk tree and collect all nodes of a given type."""
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
        """Extract parameter list as a string."""
        params_node = node.child_by_field_name("parameters")
        if params_node:
            text = source[params_node.start_byte:params_node.end_byte]
            return text.strip("()")
        return ""

    @staticmethod
    def _is_async(node: Node, source: str) -> bool:
        """Check if a function/method is async."""
        text = source[node.start_byte:min(node.start_byte + 10, len(source))]
        return text.strip().startswith("async")
