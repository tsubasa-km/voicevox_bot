---
name: notion-patchnote-updater
description: Update this VoiceVox bot project's Notion patch notes from recent git changes. Use when asked to add or rewrite patch notes in Notion, especially for user-facing Japanese wording and date toggle formatting under 「# パッチノート」.
---

# Notion Patchnote Updater

## Goal

Reflect recent repository changes in the project Notion patch notes with user-friendly Japanese text.

## Workflow

1. Identify the target page and date.
- Use the URL provided by the user.
- If omitted, ask for the target page URL.
- Use absolute date format `YYYY-MM-DD`.

2. Collect factual changes from git.
- Check recent commits with `git log --oneline`.
- Inspect target commit(s) with `git show --name-only` and patch when needed.
- Write only behavior-level facts that are supported by code or docs changes.

3. Rewrite into user-facing Japanese.
- Focus on user impact and operation changes.
- Avoid internal implementation terms unless needed for clarity.
- Keep one bullet to one change.
- See `references/wording-ja.md` when wording is too technical.

4. Update Notion by MCP.
- Fetch current page first (`notion-fetch`) and locate `# パッチノート`.
- Preserve existing structure and edit only the target date entry.
- Keep date entries in a toggle list and keep bullets inside the date toggle.
- Prefer minimal replacement range with `notion-update-page` and `replace_content_range`.

5. Verify and report.
- Fetch the page again and confirm the updated section appears under the intended date toggle.
- Report what was updated and include the final bullet text in the response.

## Output Format Rules

- Use this structure under `# パッチノート`:

```text
▶# パッチノート
    ▶ YYYY-MM-DD
        - 変更点1
        - 変更点2
```

- Keep the date line as the toggle parent.
- Keep bullets indented under that date toggle.
- Keep wording short and understandable to non-developers.

## Safety Rules

- Never include secrets (tokens, keys, environment values).
- Do not invent release contents; use only repository-backed facts.
- Keep edits limited to the patch notes section unless explicitly requested.
