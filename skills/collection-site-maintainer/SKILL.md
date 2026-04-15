---
name: collection-site-maintainer
description: Maintain the local collection website by adding, updating, deleting, reordering, replacing covers, and appending gallery images. Use when an agent is asked to operate this repository's personal collection site from chat or natural-language requests.
---

# Collection Site Maintainer

Use this skill when the task is to maintain the collection website in this repository.

## What This Skill Owns

- Card CRUD for `影视` / `游戏` / `旅游`
- Cover replacement
- Gallery image append
- Time-based sorting with `YY.MM`
- Quick verification after each change

## Source Of Truth

- Main data source: `website/data/collection.json`
- Auto-generated mirror: `website/data/my-collection.db`
- Public images:
  - `website/public/assets/thumbs/`
  - `website/public/assets/gallery/`

Do not hand-edit the SQLite file directly.

## Preferred Execution Path

For repository maintenance, prefer the local CLI:

```bash
npm --prefix website run collection:list
npm --prefix website run collection:add -- ...
npm --prefix website run collection:update -- ...
npm --prefix website run collection:gallery:add -- ...
npm --prefix website run collection:delete -- ...
```

The website also exposes write APIs, but the CLI is the safest default when the agent is already inside this repo.

## Category Rules

### `movies`

Fields:

- `类型`
- `观看时间`
- `产地`
- `主题`

### `games`

Fields:

- `类型`
- `游玩时间`
- `产地`
- `主题`

### `places`

Fields:

- `事件`
- `城市`
- `时间`
- `印象`

## Time Rule

All time values must use:

```text
YY.MM
```

Examples:

- `25.03`
- `26.01`

After add/update/delete, the collection must stay newest-first automatically.

## Image Rule

When replacing a cover or adding gallery images:

- Prefer stable local files
- Avoid fragile external hotlinks in the repo
- Keep cover and gallery as separate concepts

Use:

- `--cover-file` for covers
- `npm --prefix website run collection:gallery:add -- ...` for extra detail images

## Default Workflow

1. Identify the category and target item from the user request.
2. If needed, inspect current entries with `npm --prefix website run collection:list`.
3. Perform the change with the CLI.
4. Verify the result with `npm --prefix website run collection:list` or by checking `website/data/collection.json`.
5. Reply briefly once the operation succeeds.

## Response Style

Keep confirmations short.

Good:

```text
做好了。
```

Also fine:

```text
做好了，时间已改成 25.09，排序也同步更新了。
```

Avoid long internal explanations unless the user asks.
