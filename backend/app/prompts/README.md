# Prompts

System prompts for the AI pipeline live here as Markdown files and are loaded at
runtime by the services layer (never inlined in Python code):

- `review_system.md` - system prompt for the structured, rubric-based code review
  (per-criterion scores, issues with severity/category, summary).
- `roast_system.md` - system prompt for the "Madurai roast" persona, parameterised
  by spice level (`mild | medium | mass`). Output is post-filtered by `roast_guard`.

Both prompts must treat submitted student code strictly as untrusted data
(prompt-injection resistant) and are only sent via `app/services/ai_client.py`.
