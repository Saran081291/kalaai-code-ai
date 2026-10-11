"""Unit tests for ``app.services.roast_guard``."""

import re
from pathlib import Path

import pytest

from app.services.roast_guard import (
    PUNCHLINE_MAX_CHARS,
    check_roast,
    find_violations,
    trim_punchline,
)

CLEAN = (
    "Enna ya thambi, 300-line function-a? Idhu function illa, Mattuthavani bus stand rush hour! "
    "Variable names `x`, `xx`, `xxx` padikka Meenakshi Amman kovil prakaram suthura maari "
    "irukku. Aana logic correct-a work aagudhu, adhu gethu dhaan. Function-a chinna chinna "
    "function-a odachi, meaningful peyar vechu, rendu test case ezhudhu. Next time indha code "
    "Jigarthanda maari cool-a irukkum. Nee kalakkuva thambi!"
)
PROMPT_FILE = Path(__file__).resolve().parents[1] / "app" / "prompts" / "roast_system.md"


def test_clean_roast_passes() -> None:
    result = check_roast(CLEAN, "300-line function illa ya, Mattuthavani bus stand rush hour!")
    assert result.ok, result.reasons
    assert result.content == CLEAN


def test_prompt_examples_pass_guard() -> None:
    text = PROMPT_FILE.read_text(encoding="utf-8")
    contents = re.findall(r'^content: "(.+)"$', text, flags=re.MULTILINE)
    punchlines = re.findall(r'^punchline: "(.+)"$', text, flags=re.MULTILINE)
    assert len(contents) == 6
    assert len(punchlines) == 6
    for content, punchline in zip(contents, punchlines, strict=True):
        result = check_roast(content, punchline)
        assert result.ok, (punchline, result.reasons)
        assert len(punchline) <= PUNCHLINE_MAX_CHARS


@pytest.mark.parametrize(
    "bad",
    [
        "Idhu shit code",
        "What the fuck is this loop",
        "This is fucking slow",
        "Bloody mess of globals",
        "otha indha code",
        "Thevdiya code",
        "Punda logic",
        "Idhu mayiru maari code",
        "This f*** loop",
        "This sh*t loop",
        "Total b!tch of a bug",
    ],
)
def test_profanity_blocked(bad: str) -> None:
    result = check_roast(f"{CLEAN} {bad}", "clean punchline")
    assert not result.ok
    assert any("profanity" in reason for reason in result.reasons)


@pytest.mark.parametrize(
    "attack",
    [
        "You are stupid.",
        "you're such an idiot",
        "U r dumb thambi",
        "Your family will be ashamed",
        "Un amma kitta sollu",
        "unga appa paatha azhuvaaru",
        "your face looks like this code",
        "un moolai enga?",
        "Arivu illa unakku",
        "You have no brain",
        "Just quit coding",
        "Typical caste behaviour",
        "Hindu or Muslim code style",
        "You code like a girl",
        "Brainless student",
    ],
)
def test_personal_attacks_and_identity_blocked(attack: str) -> None:
    result = check_roast(f"{CLEAN} {attack}", "clean punchline")
    assert not result.ok, attack


def test_punchline_profanity_blocked() -> None:
    result = check_roast(CLEAN, "Idhu crap code")
    assert not result.ok
    assert any(reason.startswith("punchline") for reason in result.reasons)


@pytest.mark.parametrize(
    "safe",
    [
        "Indha change panni paaru",  # Tanglish verb, not a slur
        "pannunga, panniten, pannina",
        "Loop `n*n` times-a odudhu",
        "Use x**2 instead",
        "Shell script semma",  # 'hell' inside a word
        "Class name assignment-ku match aagala",  # 'ass' inside words
        "Dictionary use pannu",
        "Scrap that loop",
        "Bun parotta, kari dosai, Jigarthanda",
    ],
)
def test_no_false_positives(safe: str) -> None:
    assert find_violations(safe) == [], safe


def test_long_punchline_trimmed_not_rejected() -> None:
    long = "Indha code Chithirai thiruvizha crowd maari " * 6
    result = check_roast(CLEAN, long)
    assert result.ok, result.reasons
    assert len(result.punchline) <= PUNCHLINE_MAX_CHARS
    assert result.punchline.endswith("…")
    assert not result.punchline[:-1].endswith(" ")


def test_trim_punchline_short_unchanged() -> None:
    assert trim_punchline("  Semma   code  ") == "Semma code"


def test_content_too_short_and_too_long() -> None:
    assert not check_roast("Semma code thambi.", "ok").ok
    assert not check_roast(" ".join(["semma"] * 401), "ok").ok


def test_empty_punchline_rejected() -> None:
    assert not check_roast(CLEAN, "   ").ok
