"""Tiptap JSON → Markdown / plain text, used by the download endpoint.

The Markdown output uses the same syntax the frontend importer understands (GFM tables, task
lists, fenced code with a language, ~~strike~~, links), so an exported document re-imports with
the same structure. Underline has no Markdown syntax and is exported as plain text.
"""

import re
from typing import Any

Node = dict[str, Any]

# Characters that could otherwise be read as Markdown syntax inside text.
_MD_SPECIAL = re.compile(r"([\\`*_\[\]<>~|])")
# Line starts that would turn a paragraph into a heading/list/quote.
_BLOCK_START = re.compile(r"^(\s*)([#>+-]|\d+[.)])(?=\s|$)")


def _children(node: Node) -> list[Node]:
    content = node.get("content")
    return content if isinstance(content, list) else []


def _escape_md(text: str) -> str:
    return _MD_SPECIAL.sub(r"\\\1", text)


# ---- Markdown: inline ----------------------------------------------------------------------------

_MARK_ORDER = ["link", "bold", "italic", "strike"]
_OPEN = {"bold": "**", "italic": "*", "strike": "~~"}


def _mark_key(mark: Node) -> str:
    if mark.get("type") == "link":
        return f"link:{(mark.get('attrs') or {}).get('href', '')}"
    return str(mark.get("type"))


def _inline_md(nodes: list[Node]) -> str:
    """Serialize inline nodes, opening/closing marks only where they change (no '****')."""
    out: list[str] = []
    stack: list[Node] = []  # currently open marks, outermost first
    pending_space = ""

    def close_to(depth: int) -> None:
        while len(stack) > depth:
            mark = stack.pop()
            if mark.get("type") == "link":
                out.append(f"]({(mark.get('attrs') or {}).get('href', '')})")
            else:
                out.append(_OPEN[mark["type"]])

    for node in nodes:
        if node.get("type") == "hardBreak":
            close_to(0)
            out.append(pending_space + "\\\n")
            pending_space = ""
            continue
        if node.get("type") != "text":
            continue
        raw = node.get("text") or ""
        marks = [m for m in node.get("marks") or [] if isinstance(m, dict)]
        types = {m.get("type") for m in marks}

        if "code" in types:
            close_to(0)
            fence = "``" if "`" in raw else "`"
            pad = " " if raw.startswith("`") or raw.endswith("`") else ""
            out.append(pending_space + f"{fence}{pad}{raw}{pad}{fence}")
            pending_space = ""
            continue

        wanted = sorted(
            (m for m in marks if m.get("type") in _MARK_ORDER),
            key=lambda m: _MARK_ORDER.index(m["type"]),
        )
        # Keep the longest common prefix of open marks; close the rest.
        keep = 0
        while keep < len(stack) and keep < len(wanted) and _mark_key(stack[keep]) == _mark_key(wanted[keep]):
            keep += 1

        # Leading/trailing spaces go outside emphasis markers ("** x**" isn't valid Markdown).
        stripped = raw.strip(" ")
        lead = raw[: len(raw) - len(raw.lstrip(" "))]
        trail = raw[len(raw.rstrip(" ")) :] if stripped else ""
        if not stripped:
            pending_space += raw
            continue

        close_to(keep)
        out.append(pending_space + lead)
        pending_space = ""
        for mark in wanted[keep:]:
            out.append("[" if mark.get("type") == "link" else _OPEN[mark["type"]])
            stack.append(mark)
        out.append(_escape_md(stripped))
        pending_space = trail

    close_to(0)
    out.append(pending_space)
    return "".join(out)


def _block_line_md(text: str) -> str:
    """Escape a paragraph that would otherwise start a heading/list/quote."""
    return _BLOCK_START.sub(lambda m: m.group(1) + "\\" + m.group(2), text, count=1)


# ---- Markdown: blocks ----------------------------------------------------------------------------


def _indent(text: str, prefix: str) -> str:
    return "\n".join(prefix + line if line else line for line in text.split("\n"))


def _list_md(node: Node, ordered: bool = False, task: bool = False) -> str:
    start = (node.get("attrs") or {}).get("start") or 1
    items = []
    for index, item in enumerate(_children(node)):
        if ordered:
            marker = f"{start + index}. "
        elif task:
            checked = bool((item.get("attrs") or {}).get("checked"))
            marker = f"- [{'x' if checked else ' '}] "
        else:
            marker = "- "
        blocks = [_block_md(child) for child in _children(item)]
        first = blocks[0] if blocks else ""
        rest = "\n".join(_indent(b, " " * len(marker if not task else "- ")) for b in blocks[1:] if b)
        items.append(marker + first + ("\n" + rest if rest else ""))
    return "\n".join(items)


def _table_md(node: Node) -> str:
    rows = []
    for row in _children(node):
        cells = []
        for cell in _children(row):
            parts = [_inline_md(_children(p)) for p in _children(cell)]
            cells.append(" ".join(p for p in parts if p).replace("\n", " ") or " ")
        rows.append(cells)
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    rows = [r + [" "] * (width - len(r)) for r in rows]
    lines = ["| " + " | ".join(rows[0]) + " |", "|" + "|".join([" --- "] * width) + "|"]
    lines += ["| " + " | ".join(r) + " |" for r in rows[1:]]
    return "\n".join(lines)


def _block_md(node: Node) -> str:
    kind = node.get("type")
    if kind == "paragraph":
        return _block_line_md(_inline_md(_children(node)))
    if kind == "heading":
        level = min(max(int((node.get("attrs") or {}).get("level") or 1), 1), 6)
        return "#" * level + " " + _inline_md(_children(node))
    if kind == "bulletList":
        return _list_md(node)
    if kind == "orderedList":
        return _list_md(node, ordered=True)
    if kind == "taskList":
        return _list_md(node, task=True)
    if kind == "blockquote":
        inner = "\n\n".join(b for b in (_block_md(c) for c in _children(node)))
        return "\n".join(f"> {line}" if line else ">" for line in inner.split("\n"))
    if kind == "codeBlock":
        code = "".join(c.get("text") or "" for c in _children(node))
        fence = "````" if "```" in code else "```"
        language = (node.get("attrs") or {}).get("language") or ""
        return f"{fence}{language}\n{code}\n{fence}"
    if kind == "horizontalRule":
        return "---"
    if kind == "table":
        return _table_md(node)
    # Unknown block: fall back to its text.
    return _escape_md(to_text({"type": "doc", "content": [node]}))


def to_markdown(doc: Node) -> str:
    blocks = [_block_md(child) for child in _children(doc)]
    return "\n\n".join(blocks).strip("\n") + "\n"


# ---- Plain text ------------------------------------------------------------------------------------


def _inline_text(nodes: list[Node]) -> str:
    return "".join(
        "\n" if n.get("type") == "hardBreak" else (n.get("text") or "") for n in nodes if isinstance(n, dict)
    )


def _list_text(node: Node, ordered: bool = False, task: bool = False) -> str:
    start = (node.get("attrs") or {}).get("start") or 1
    items = []
    for index, item in enumerate(_children(node)):
        if ordered:
            marker = f"{start + index}. "
        elif task:
            marker = "[x] " if (item.get("attrs") or {}).get("checked") else "[ ] "
        else:
            marker = "• "
        blocks = [_block_text(child) for child in _children(item)]
        first = blocks[0] if blocks else ""
        rest = "\n".join(_indent(b, "    ") for b in blocks[1:] if b)
        items.append(marker + first + ("\n" + rest if rest else ""))
    return "\n".join(items)


def _block_text(node: Node) -> str:
    kind = node.get("type")
    if kind in ("paragraph", "heading"):
        return _inline_text(_children(node))
    if kind == "bulletList":
        return _list_text(node)
    if kind == "orderedList":
        return _list_text(node, ordered=True)
    if kind == "taskList":
        return _list_text(node, task=True)
    if kind == "blockquote":
        inner = "\n\n".join(_block_text(c) for c in _children(node))
        return _indent(inner, "    ")
    if kind == "codeBlock":
        return "".join(c.get("text") or "" for c in _children(node))
    if kind == "horizontalRule":
        return "-" * 40
    if kind == "table":
        return "\n".join(
            "\t".join(" ".join(_inline_text(_children(p)) for p in _children(cell)) for cell in _children(row))
            for row in _children(node)
        )
    return "\n".join(_block_text(c) for c in _children(node)) or _inline_text(_children(node))


def to_text(doc: Node) -> str:
    return "\n\n".join(_block_text(child) for child in _children(doc)).strip("\n") + "\n"
