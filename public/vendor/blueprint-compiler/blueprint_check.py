"""Syntax-only Blueprint check driver for the browser tier (BLP-L001).

Runs blueprint-compiler's real tokenizer and parse tree over a .blp source
and reports the parse errors. It deliberately does NOT call `to_ast()`
validation: that pass resolves `using Gtk 4.0;` imports through GObject
introspection typelibs, which do not exist in the browser. So this is a
*syntax check*, nothing more — full GIR validation (unknown classes, bad
property names/types, signals) only happens where blueprint-compiler runs
with typelibs: the blueprint-export CI job and local host compiles.
"""

import json

from blueprintcompiler import parse_tree, tokenizer, utils
from blueprintcompiler.errors import CompileError, CompilerBugError
from blueprintcompiler.language import UI


def _pos(source, idx):
    """1-based (line, column) for a character offset."""
    line, col = utils.idx_to_pos(idx + 1, source)
    return (line + 1, col + 1)


def check_blueprint(source):
    """Return a list of {message, line, col, endLine, endCol} syntax errors."""
    try:
        tokens = tokenizer.tokenize(source)
        ctx = parse_tree.ParseContext(tokens, source)
        parse_tree.AnyOf(UI).parse(ctx)
        errors = list(ctx.errors)
    except CompilerBugError:
        return [
            {
                "message": "internal parser error",
                "line": 1,
                "col": 1,
                "endLine": 1,
                "endCol": 1,
            }
        ]
    except CompileError as error:
        errors = [error]

    out = []
    seen = set()
    for error in errors:
        if error.range is not None:
            line, col = _pos(source, error.range.start)
            end_line, end_col = _pos(source, error.range.end)
        else:
            line = col = end_line = end_col = 1
        key = (error.message, line, col)
        if key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "message": error.message,
                "line": line,
                "col": col,
                "endLine": end_line,
                "endCol": end_col,
            }
        )
    return out


def check_json(source):
    """JSON entry point used from JavaScript."""
    return json.dumps(check_blueprint(source))
