"""Madurai roast (Claude call #2): prompt building, guard, fallback, regeneration.

The roast is built from the review only (summary, score, top issues, top strengths) - never
from raw code. Every generated roast passes through ``roast_guard``; a failing roast is
regenerated once and then replaced by a safe hand-written template, so the roast guard never
fails the pipeline. AI service errors (network/config) still propagate to the caller.
"""

import logging
from dataclasses import dataclass

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.config import settings
from app.exceptions import ConflictError
from app.models import Review, Roast
from app.models.enums import IssueSeverity, SpiceLevel
from app.schemas.roast import AIRoastOutput
from app.services import ai_client
from app.services.review_service import SEVERITY_RANK, load_prompt
from app.services.roast_guard import check_roast, find_violations, trim_punchline

logger = logging.getLogger(__name__)

MAX_REGENERATIONS = 2
MAX_GENERATION_ATTEMPTS = 2
TOP_ISSUES = 5
TOP_STRENGTHS = 2
ROAST_MAX_TOKENS = 8_000
ROAST_TOOL_NAME = "submit_roast"
ROAST_TOOL_DESCRIPTION = (
    "the Madurai Tanglish roast: `content` (80-220 words, ends with one encouraging line) "
    "and `punchline` (one-liner, at most 140 characters)."
)
ROAST_INPUT_SCHEMA: dict[str, object] = {
    "type": "object",
    "properties": {
        "content": {"type": "string", "description": "The roast, 80-220 words, plain text."},
        "punchline": {"type": "string", "description": "Standalone one-liner, <= 140 chars."},
    },
    "required": ["content", "punchline"],
}

GENERIC_FINDING = "konjam cleanup thevai-nu review solludhu"
_ISSUE_SNIPPET_CHARS = 110


@dataclass(frozen=True)
class RoastText:
    """Final roast text ready to persist."""

    content: str
    punchline: str
    is_fallback: bool


# ---------------------------------------------------------------------------
# Prompt building
# ---------------------------------------------------------------------------


def _sorted_issues(review: Review) -> list[dict[str, object]]:
    """Issues ordered most-severe first (stable within a severity)."""

    def rank(issue: dict[str, object]) -> int:
        try:
            return SEVERITY_RANK[IssueSeverity(str(issue.get("severity")))]
        except ValueError:
            return len(SEVERITY_RANK)

    return sorted(review.issues or [], key=rank)


def _max_score(review: Review) -> int:
    return review.submission.assignment.max_score


def build_roast_user_content(review: Review, spice_level: SpiceLevel) -> str:
    """Build the roast request (review data only, no raw code)."""
    assignment = review.submission.assignment
    issue_lines = [
        f"- [{issue.get('severity')}/{issue.get('category')}] "
        f"{issue.get('file')}"
        f"{':' + str(issue.get('line')) if issue.get('line') else ''} - {issue.get('message')}"
        for issue in _sorted_issues(review)[:TOP_ISSUES]
    ]
    strength_lines = [f"- {s}" for s in list(review.strengths or [])[:TOP_STRENGTHS]]
    return (
        "<roast_request>\n"
        f"spice_level: {spice_level.value}\n"
        f"assignment_title: {assignment.title}\n"
        f"score: {review.effective_score}/{assignment.max_score}\n"
        f"review_summary: {review.summary}\n"
        "top_issues:\n" + ("\n".join(issue_lines) or "- (no issues reported)") + "\n"
        "top_strengths:\n" + ("\n".join(strength_lines) or "- (none listed)") + "\n"
        "</roast_request>\n\n"
        f"Write a {spice_level.value} spice Madurai Tanglish roast of this code, following "
        "all the hard rules."
    )


# ---------------------------------------------------------------------------
# Safe templated fallback
# ---------------------------------------------------------------------------

_FALLBACK_TEMPLATES: dict[SpiceLevel, tuple[tuple[str, str], ...]] = {
    SpiceLevel.mild: (
        (
            "Thambi, {score}/{max_score} vaangirukka, nalla start dhaan! Review-la oru "
            'vishayam sonnanga: "{issue}". Idhu Jigarthanda-la ice konjam kammi aana maari '
            "- taste irukku, aana full feel varala. Indha point-a fix pannitu, rendu moonu "
            "test case serthu, code-a innoru thadava padichu paaru. Chinna chinna "
            "improvement dhaan, aana result vera level-a irukkum. Semma pogudhu thambi, "
            "next version-la nee kalakkiduva!",
            "Jigarthanda-la ice konjam kammi - taste irukku, full feel-ku oru fix dhaan baaki!",
        ),
        (
            "Annae, code-a paathen, {score}/{max_score} - gethu-ku romba pakkathula "
            'irukkeenga! Aana review oru point-a highlight panniruku: "{issue}". Bun parotta '
            "nalla irukku, salna mattum konjam thanni-a irukku maari oru feeling. Adha sari "
            "panna, un code Meenakshi Amman kovil gopuram maari neat-a nikkum. Konjam "
            "polish, konjam testing - adhu podhum. Nambikkai-a continue pannunga, "
            "neenga nichayam kalakkuveenga!",
            "Bun parotta super, salna mattum konjam thanni - oru fix-la full meals ready!",
        ),
    ),
    SpiceLevel.medium: (
        (
            "Enna ya idhu, {score}/{max_score}-aa? Review paatha udane oru vishayam kannula "
            'pattuchu: "{issue}". Idhu Mattuthavani bus stand-la bus number paakama '
            "eriyura maari - poyidum, aana enga poyi nikkum nu yaarukkum theriyadhu! Logic-la "
            "potential irukku, adhu theriyudhu. Indha issue-a first fix pannu, apparam code-a "
            "chinna chinna function-a odachi, test ezhudhu. Appo un code sothappama "
            "smooth-a odum. Nee pannuva thambi, full confidence irukku!",
            "Bus number paakama Mattuthavani-la eriyura code - poyidum, enga nikkum nu theriyadhu!",
        ),
        (
            "Thambi, {score}/{max_score} - mokka illa, aana gethu-vum illa, middle-la "
            'nikkudhu! Review solludhu: "{issue}". Idhu Chithirai thiruvizha crowd-la '
            "wallet-a back pocket-la vechu nadakkura maari - ippo varaikkum safe, aana "
            "eppo venaalum sothappidum. Indha point-a sari pannu, edge case-ellam yosichi "
            "test pannu. Konjam effort pottaa indha code vera level-ku poidum. "
            "Adichu thookku thambi, unnaala mudiyum!",
            "Thiruvizha crowd-la back pocket wallet maari code - "
            "ippo safe, eppo venaalum sothappum!",
        ),
    ),
    SpiceLevel.mass: (
        (
            "Dei thambi, kelu! {score}/{max_score} vaangitu style-a nikkuriya? Review oru "
            'dialogue adichirukku: "{issue}". Idhu Chithirai ther-a handbrake pottu '
            "izhukkura maari - sathham semma, aana ther nagaradhu! Indha issue-a fix pannu, "
            "duplicate-a kuraichu, test pottu, code-a clean pannu. Appo un code Madurai "
            "mass entry kudukkum, theatre-la whistle parakkum! Unnaala mudiyum thambi, "
            "adichu thookku!",
            "Chithirai ther-a handbrake pottu izhukkura code - sathham semma, ther nagaradhu!",
        ),
        (
            "Annae, ready-a? {score}/{max_score}! Review-la oru periya point irukku: "
            '"{issue}". Indha code Vaigai aathula summer-la padagu vidra confidence-la '
            "ezhudhirukku - dhairiyam gethu, aana thanni enga ya? Indha issue-a sari pannu, "
            "error handling podu, test ezhudhu. Appo un code kari dosai maari layer layer-a "
            "strong-a irukkum, ellarum vaaya polandhu paapanga! Semma potential irukku, "
            "kalakku thambi!",
            "Summer Vaigai-la padagu vidra confidence code - dhairiyam gethu, aana thanni enga ya?",
        ),
    ),
}


def _issue_snippet(review: Review) -> str:
    """Return the top issue message, shortened and checked for safety."""
    issues = _sorted_issues(review)
    if not issues:
        return GENERIC_FINDING
    message = " ".join(str(issues[0].get("message") or "").split()).replace('"', "'")
    if not message:
        return GENERIC_FINDING
    if len(message) > _ISSUE_SNIPPET_CHARS:
        message = message[: _ISSUE_SNIPPET_CHARS - 1].rsplit(" ", 1)[0] + "…"
    if find_violations(message):
        return GENERIC_FINDING
    return message


def fallback_roast(review: Review, spice_level: SpiceLevel, variant: int = 0) -> RoastText:
    """Build a safe, hand-written roast from the score and the top issue."""
    templates = _FALLBACK_TEMPLATES[spice_level]
    content_tpl, punchline = templates[variant % len(templates)]
    content = content_tpl.format(
        score=review.effective_score, max_score=_max_score(review), issue=_issue_snippet(review)
    )
    return RoastText(content=content, punchline=trim_punchline(punchline), is_fallback=True)


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------


def produce_roast_text(review: Review, spice_level: SpiceLevel) -> RoastText:
    """Generate a guarded roast: up to 2 AI attempts, then the safe fallback.

    Raises:
        ai_client.AIConfigError / ai_client.AIServiceError: API not configured / failed.
    """
    system = load_prompt("roast_system.md")
    user_content = build_roast_user_content(review, spice_level)
    max_tokens = max(settings.CLAUDE_MAX_TOKENS, ROAST_MAX_TOKENS)
    submission_id = review.submission_id

    for attempt in range(1, MAX_GENERATION_ATTEMPTS + 1):
        try:
            result = ai_client.generate_structured(
                system=system,
                user_content=user_content,
                tool_name=ROAST_TOOL_NAME,
                tool_description=ROAST_TOOL_DESCRIPTION,
                input_schema=ROAST_INPUT_SCHEMA,
                max_tokens=max_tokens,
                effort="medium",
            )
            parsed = AIRoastOutput.model_validate(result.data)
        except ai_client.AIOutputError as exc:
            logger.warning(
                "Submission %s roast attempt %s: unusable output (%s)",
                submission_id,
                attempt,
                exc.message,
            )
            continue
        except ValidationError as exc:
            logger.warning(
                "Submission %s roast attempt %s: schema invalid (%s errors)",
                submission_id,
                attempt,
                exc.error_count(),
            )
            continue
        guard = check_roast(parsed.content, parsed.punchline)
        if guard.ok:
            return RoastText(content=guard.content, punchline=guard.punchline, is_fallback=False)
        logger.warning(
            "Submission %s roast attempt %s blocked by guard: %s",
            submission_id,
            attempt,
            "; ".join(guard.reasons),
        )

    logger.warning("Submission %s: using safe fallback roast (%s)", submission_id, spice_level)
    return fallback_roast(review, spice_level, variant=review.id or 0)


def generate_roast(db: Session, review: Review, spice_level: SpiceLevel) -> Roast:
    """Create and persist the roast for ``review`` (one per review)."""
    text = produce_roast_text(review, spice_level)
    roast = Roast(
        review_id=review.id,
        spice_level=spice_level,
        content=text.content,
        punchline=text.punchline,
    )
    db.add(roast)
    db.commit()
    db.refresh(roast)
    logger.info(
        "Submission %s roast created (spice=%s, fallback=%s)",
        review.submission_id,
        spice_level,
        text.is_fallback,
    )
    return roast


def regenerate_roast(db: Session, roast: Roast, spice_level: SpiceLevel | None) -> Roast:
    """Replace the roast text (optionally with a new spice level); max 2 regenerations.

    Keeps ``is_shared``/``share_slug``/``is_hidden``. Caller checks ownership/visibility.

    Raises:
        ConflictError: ``REGENERATE_LIMIT`` once 2 regenerations were used.
    """
    if roast.regenerate_count >= MAX_REGENERATIONS:
        raise ConflictError(
            "Roast-a already 2 thadava regenerate pannitteenga (regeneration limit reached)",
            code="REGENERATE_LIMIT",
        )
    level = spice_level or roast.spice_level
    text = produce_roast_text(roast.review, level)
    roast.content = text.content
    roast.punchline = text.punchline
    roast.spice_level = level
    roast.regenerate_count += 1
    db.commit()
    db.refresh(roast)
    logger.info(
        "Roast %s regenerated (%s/%s, spice=%s, fallback=%s)",
        roast.id,
        roast.regenerate_count,
        MAX_REGENERATIONS,
        level,
        text.is_fallback,
    )
    return roast


__all__ = [
    "MAX_REGENERATIONS",
    "ROAST_INPUT_SCHEMA",
    "RoastText",
    "build_roast_user_content",
    "fallback_roast",
    "generate_roast",
    "produce_roast_text",
    "regenerate_roast",
]
