"""Production must not start while the test package is imported."""

from __future__ import annotations


def fixtures_loaded(modules: list[str] | tuple[str, ...]) -> bool:
    return any(name == "tests" or name.startswith("tests.") for name in modules)
