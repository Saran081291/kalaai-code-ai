"""Safety guard for generated roasts.

``check_roast`` rejects roasts containing profanity/slurs (English + transliterated Tamil),
personal attacks (intelligence, looks, family, caste, religion, gender ...) or bad lengths.
A punchline over 140 characters is trimmed at a word boundary rather than rejected.

The lists are deliberately conservative: a false positive only costs one regeneration (or
the safe templated fallback), while a false negative ends up on a student's screen.
Common Tanglish verbs that look like slurs in other languages (``panni``, ``pannu``) are
intentionally NOT listed.
"""

import re
from dataclasses import dataclass, field

PUNCHLINE_MAX_CHARS = 140
CONTENT_MIN_WORDS = 40
CONTENT_MAX_WORDS = 400

# Profanity / slurs. Entries are regex fragments matched as whole words, case-insensitively.
# ``\w*`` suffixes catch inflections (e.g. "fucking", "shitty").
_PROFANITY_EN: tuple[str, ...] = (
    r"fu+c?k\w*",
    r"f[u\*]ck\w*",
    r"wtf",
    r"stfu",
    r"shit\w*",
    r"bullshit\w*",
    r"bitch\w*",
    r"bastard\w*",
    r"ass(?:hole|holes|hat|wipe)?",
    r"arse\w*",
    r"dick\w*",
    r"cock\w*",
    r"cunt\w*",
    r"pussy\w*",
    r"piss\w*",
    r"crap\w*",
    r"damn\w*",
    r"goddamn\w*",
    r"hell",
    r"bloody",
    r"bugger\w*",
    r"wank\w*",
    r"twat\w*",
    r"prick\w*",
    r"douche\w*",
    r"jackass\w*",
    r"dumbass\w*",
    r"motherf\w*",
    r"slut\w*",
    r"whor\w*",
    r"hoe",
    r"skank\w*",
    r"retard\w*",
    r"nigg\w*",
    r"fag\w*",
    r"tranny\w*",
    r"chink\w*",
    r"spastic\w*",
    r"spaz\w*",
    r"cripple\w*",
    r"porn\w*",
    r"sex\w*",
    r"nude\w*",
    r"rape\w*",
)

_PROFANITY_TAMIL: tuple[str, ...] = (
    r"otha\w*",
    r"oththa\w*",
    r"ommal\w*",
    r"oombu\w*",
    r"oombi\w*",
    r"punda\w*",
    r"pundai\w*",
    r"thevdiya\w*",
    r"thevidiya\w*",
    r"thevudiya\w*",
    r"dhevdiya\w*",
    r"koothi\w*",
    r"koodhi\w*",
    r"sunni\w*",
    r"baadu",
    r"thayoli\w*",
    r"thaayoli\w*",
    r"kandaroli\w*",
    r"mayir\w*",
    r"mayiru\w*",
    r"myre",
    r"poolu\w*",
    r"sootha\w*",
    r"soothu",
    r"pottai\w*",
    r"porambok\w*",
    r"porukki\w*",
    r"naaye",
    r"naayi",
    r"naai",
    r"panni\s?payal\w*",
    r"paradesi\w*",
    r"kenapayal\w*",
    r"kena\s?koodhi\w*",
    r"loosu\w*",
    r"lusu\w*",
    r"muttaal\w*",
    r"muttal\w*",
    r"mental\w*",
    r"saniyan\w*",
    r"kirukkan\w*",
)

# Identity words a roast must never mention (caste, religion, gender identity, region slurs).
_IDENTITY_WORDS: tuple[str, ...] = (
    r"caste\w*",
    r"jaathi\w*",
    r"jathi\w*",
    r"jaati\w*",
    r"religio\w*",
    r"madham",
    # Family words are off-limits even without a possessive ("kudumbam kooda moka la irukkum").
    r"kudumb\w*",
    r"kudumpam\w*",
    r"hindu\w*",
    r"muslim\w*",
    r"islam\w*",
    r"christian\w*",
    r"jain\w*",
    r"sikh\w*",
    r"buddhist\w*",
    r"brahmin\w*",
    r"iyer\w*",
    r"iyengar\w*",
    r"dalit\w*",
    r"paraiya\w*",
    r"pallar\w*",
    r"chakkiliya\w*",
    r"thevar\w*",
    r"nadar\w*",
    r"gounder\w*",
    r"vanniya\w*",
    r"chettiar\w*",
    r"untouchab\w*",
    r"lower\s+caste",
    r"upper\s+caste",
    r"gay",
    r"lesbian\w*",
    r"transgender\w*",
    r"homosexual\w*",
    r"homo",
    r"girly",
    r"like\s+a\s+girl",
    r"ponnu\s+maari",
    r"pombala\s+maari",
    r"gramathaan\w*",
    r"kattumirandi\w*",
    r"villager\w*",
    r"north\s+indian\w*",
    r"vadakkan\w*",
)

# Personal attacks: insults aimed at the person rather than the code.
_PERSONAL_ATTACK_PATTERNS: tuple[str, ...] = (
    # "you are stupid", "you're such an idiot", "u r dumb"
    r"\b(?:you|u)(?:'re|\s+are|\s+r|\s+look|\s+sound)\s+(?:so\s+|such\s+an?\s+|an?\s+|really\s+"
    r"|totally\s+|very\s+|just\s+)?(?:stupid|dumb|idiot\w*|moron\w*|useless|worthless|brainless"
    r"|clueless|hopeless|pathetic|loser\w*|fool\w*|clown\w*|ugly|fat|lazy|slow|incompetent"
    r"|failure|disgrace|joke|trash|garbage|waste)\b",
    r"\b(?:stupid|dumb|idiot\w*|moron\w*|brainless|useless|worthless|pathetic|ugly|lazy)\s+"
    r"(?:student|kid|boy|girl|guy|person|fellow|developer|coder|programmer|thambi|annae|payyan"
    r"|paiyan|ponnu)\b",
    r"\b(?:idiot|moron|imbecile|loser|dimwit|nitwit|halfwit|blockhead|numbskull|bonehead)s?\b",
    r"\b(?:your|ur|un|unga|ungal|unnoda|ungaloda)\s+(?:family|mom|mum|mother|dad|father|amma"
    r"|appa|parents?|wife|husband|girlfriend|boyfriend|sister|brother|akka|thangachi|thangai"
    r"|paati|thatha|veetla|veettula|kudumbam|ooru|caste|religion|jaathi|kulam|race|gender"
    r"|skin|colou?r)\b",
    r"\b(?:your|ur|un|unga|ungal|unnoda)\s+(?:face|looks?|body|weight|hair|teeth|voice|accent"
    r"|brain|iq|intelligence|moonji|mugam|mandai|moolai|thalai|udambu|mudi|kural)\b",
    r"\b(?:no|zero|illadha|illatha)\s+(?:brain|brains|iq|common\s+sense|arivu|moolai|budhi)\b",
    r"\b(?:arivu|moolai|budhi|buddhi)\s+(?:illa|illadha|illatha|kammi|konjam\s+kooda\s+illa)\w*",
    r"\barivilla\w*",
    r"\b(?:go\s+die|kill\s+yourself|kys|drop\s+out|quit\s+coding|give\s+up\s+coding"
    r"|never\s+code\s+again|sethu\s+po|saavu|poi\s+saavu)\b",
    r"\b(?:you|u)\s+(?:should|must)\s+(?:quit|give\s+up|drop\s+out)\b",
    r"\b(?:shut\s+up|vaaya\s+moodu)\b",
)


def _word_pattern(fragments: tuple[str, ...]) -> re.Pattern[str]:
    """Compile whole-word alternatives into one case-insensitive pattern."""
    return re.compile(r"\b(?:" + "|".join(fragments) + r")\b", re.IGNORECASE)


_PROFANITY_RE = _word_pattern(_PROFANITY_EN + _PROFANITY_TAMIL)
_IDENTITY_RE = _word_pattern(_IDENTITY_WORDS)
_ATTACK_RES = tuple(re.compile(p, re.IGNORECASE) for p in _PERSONAL_ATTACK_PATTERNS)
# Censored swearing such as "f***", "sh*t", "b!tch", "f***ing". Matches shorter than
# _CENSORED_MIN_CHARS are ignored so code like ``n*n`` or ``x**2`` is not flagged.
_CENSORED_RE = re.compile(r"\b[a-z]{1,3}(?:[\*\#\@\$!]+[a-z]{1,5}\b|\*{2,}(?!\w))", re.IGNORECASE)
_CENSORED_MIN_CHARS = 4
_WORD_RE = re.compile(r"\S+")
# Roasts must be Tanglish (Tamil words in English letters); Tamil script is a style-guide breach.
_TAMIL_BLOCK_START, _TAMIL_BLOCK_END = 0x0B80, 0x0BFF  # Unicode "Tamil" block
_TAMIL_SCRIPT_RE = re.compile(f"[{chr(_TAMIL_BLOCK_START)}-{chr(_TAMIL_BLOCK_END)}]+")


@dataclass(frozen=True)
class GuardResult:
    """Outcome of :func:`check_roast`.

    ``content``/``punchline`` hold the (possibly trimmed) values to store when ``ok``.
    """

    ok: bool
    reasons: list[str] = field(default_factory=list)
    content: str = ""
    punchline: str = ""


def trim_punchline(punchline: str, limit: int = PUNCHLINE_MAX_CHARS) -> str:
    """Collapse whitespace and trim to ``limit`` chars at a word boundary (adds an ellipsis)."""
    text = " ".join(punchline.split())
    if len(text) <= limit:
        return text
    cut = text[: limit - 1]
    if " " in cut:
        cut = cut.rsplit(" ", 1)[0]
    cut = cut.rstrip(" ,;:-—")
    return f"{cut}…"


def word_count(text: str) -> int:
    """Count whitespace-separated words."""
    return len(_WORD_RE.findall(text))


def find_violations(text: str) -> list[str]:
    """Return human-readable reasons why ``text`` is unsafe (empty list = clean)."""
    reasons: list[str] = []
    for match in _PROFANITY_RE.finditer(text):
        reasons.append(f"profanity: {match.group(0).lower()!r}")
    for match in _IDENTITY_RE.finditer(text):
        reasons.append(f"identity reference: {match.group(0).lower()!r}")
    for pattern in _ATTACK_RES:
        for match in pattern.finditer(text):
            reasons.append(f"personal attack: {match.group(0).lower()!r}")
    for match in _TAMIL_SCRIPT_RE.finditer(text):
        reasons.append(f"non-Tanglish script: {match.group(0)!r}")
        break
    for match in _CENSORED_RE.finditer(text):
        if len(match.group(0)) < _CENSORED_MIN_CHARS:
            continue
        reasons.append(f"censored profanity: {match.group(0).lower()!r}")
    return reasons


def check_roast(content: str, punchline: str) -> GuardResult:
    """Validate a generated roast.

    Args:
        content: Roast body (plain text).
        punchline: One-liner for share cards.

    Returns:
        ``GuardResult`` with ``ok=False`` and reasons when the roast must be regenerated;
        on success, the cleaned content and (trimmed) punchline.
    """
    clean_content = content.strip()
    clean_punchline = trim_punchline(punchline)
    reasons: list[str] = []

    words = word_count(clean_content)
    if words < CONTENT_MIN_WORDS:
        reasons.append(f"content too short ({words} words, min {CONTENT_MIN_WORDS})")
    if words > CONTENT_MAX_WORDS:
        reasons.append(f"content too long ({words} words, max {CONTENT_MAX_WORDS})")
    if not clean_punchline:
        reasons.append("punchline is empty")

    reasons.extend(find_violations(clean_content))
    reasons.extend(f"punchline {r}" for r in find_violations(clean_punchline))

    # De-duplicate while keeping order.
    unique_reasons = list(dict.fromkeys(reasons))
    return GuardResult(
        ok=not unique_reasons,
        reasons=unique_reasons,
        content=clean_content,
        punchline=clean_punchline,
    )


__all__ = [
    "CONTENT_MAX_WORDS",
    "CONTENT_MIN_WORDS",
    "PUNCHLINE_MAX_CHARS",
    "GuardResult",
    "check_roast",
    "find_violations",
    "trim_punchline",
    "word_count",
]
