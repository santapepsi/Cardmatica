"""The secret skins (frontend/skin.js, frontend/js/skin-picker.js).

Their stylesheets change the look only while chosen: every rule of a skin
starts with its own [data-skin="…"]. Every page lists them, by versioned
address, in a <template> that the browser does not download.
"""

import re

import pytest

from app.core.config import ROOT

SKINS = ROOT / "frontend" / "skins"
PARTIAL = (ROOT / "frontend" / "pages" / "skins.html").read_text(encoding="utf-8")
LISTED = re.findall(r'href="/frontend/skins/([\w-]+)\.css" data-skin="([\w-]+)"', PARTIAL)


def selectors(css: str):
    """Every selector of the stylesheet, at any depth (@media included)."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    for block in re.findall(r"([^{}]+)\{", css):
        block = " ".join(block.split())
        if block.startswith("@"):
            continue
        # Split the list at its own commas, not those inside :not(a, b).
        depth, start = 0, 0
        for index, char in enumerate(block):
            depth += {"(": 1, ")": -1}.get(char, 0)
            if char == "," and depth == 0:
                yield block[start:index].strip()
                start = index + 1
        yield block[start:].strip()


def test_every_skin_file_is_listed_once_under_its_own_name():
    assert sorted(file for file, _ in LISTED) == sorted(path.stem for path in SKINS.glob("*.css"))
    assert all(file == name for file, name in LISTED)


@pytest.mark.parametrize("path", sorted(SKINS.glob("*.css")), ids=lambda path: path.stem)
def test_a_skin_changes_nothing_until_it_is_chosen(path):
    prefix = f'[data-skin="{path.stem}"]'
    stray = [s for s in selectors(path.read_text(encoding="utf-8")) if not s.startswith(prefix)]
    assert not stray, f"{path.name}: reglas fuera de {prefix}: {stray}"


@pytest.mark.parametrize("page", ["/yugioh", "/privacidad", "/no-existe"])
def test_every_page_lists_the_skins_by_versioned_address(client, page):
    html = client.get(page).text
    assert '<script src="/frontend/skin.js?v=' in html
    for file, _ in LISTED:
        assert re.search(
            rf'<template class="skins">.*href="/frontend/skins/{file}\.css\?v=\w+"', html
        )
    # Before the theme, which reads the skin's colour for the browser bar.
    assert html.index("/frontend/skin.js") < html.index("/frontend/theme.js")
