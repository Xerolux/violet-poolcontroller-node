import ast
import json
import re
import subprocess
import sys
from pathlib import Path


def evaluate(node: ast.AST, values: dict[str, object]) -> object:
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Name):
        return values[node.id]
    if isinstance(node, ast.Dict):
        return {
            str(evaluate(key, values)): evaluate(value, values)
            for key, value in zip(node.keys, node.values, strict=True)
            if key is not None
        }
    if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
        return [evaluate(element, values) for element in node.elts]
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
        return -evaluate(node.operand, values)
    raise ValueError(type(node).__name__)


def assignments(path: Path) -> dict[str, object]:
    module = ast.parse(path.read_text(encoding="utf-8"))
    values: dict[str, object] = {}
    for statement in module.body:
        name: str | None = None
        value: ast.AST | None = None
        if isinstance(statement, ast.Assign) and len(statement.targets) == 1:
            target = statement.targets[0]
            if isinstance(target, ast.Name):
                name, value = target.id, statement.value
        elif isinstance(statement, ast.AnnAssign) and isinstance(statement.target, ast.Name):
            name, value = statement.target.id, statement.value
        if name is None or value is None:
            continue
        try:
            values[name] = evaluate(value, values)
        except (KeyError, TypeError, ValueError):
            continue
    return values


root = Path(sys.argv[1]).resolve()
package = root / "violet_poolcontroller_api"
classes: dict[str, ast.ClassDef] = {}
for module_path in package.glob("*.py"):
    module = ast.parse(module_path.read_text(encoding="utf-8"))
    for node in module.body:
        if isinstance(node, ast.ClassDef):
            classes[node.name] = node

client = classes["VioletPoolAPI"]
members: list[str] = []
visited_classes: set[str] = set()


def collect_members(class_node: ast.ClassDef) -> None:
    if class_node.name in visited_classes:
        return
    visited_classes.add(class_node.name)
    for node in class_node.body:
        if (
            isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
            and (not node.name.startswith("_") or node.name == "__init__")
            and node.name not in members
        ):
            members.append(node.name)
    for base in class_node.bases:
        if isinstance(base, ast.Name) and base.id in classes:
            collect_members(classes[base.id])


collect_members(client)

init_values = assignments(package / "__init__.py")
constant_values = assignments(package / "const_api.py")
pyproject = (root / "pyproject.toml").read_text(encoding="utf-8")
version_match = re.search(r'^version\s*=\s*"([^"]+)"', pyproject, flags=re.MULTILINE)
commit = subprocess.run(
    ["git", "-C", str(root), "rev-parse", "HEAD"],
    check=True,
    capture_output=True,
    text=True,
).stdout.strip()

contract = {
    "commit": commit,
    "version": version_match.group(1) if version_match else None,
    "clientMembers": members,
    "publicExports": init_values["__all__"],
    "endpoints": {
        name: value
        for name, value in constant_values.items()
        if name.startswith("API_") and isinstance(value, str) and value.startswith("/")
    },
    "actions": {
        name: value
        for name, value in constant_values.items()
        if name.startswith("ACTION_") and isinstance(value, str)
    },
    "errorCodes": constant_values["ERROR_CODES"],
}
print(json.dumps(contract, ensure_ascii=False, sort_keys=True))
