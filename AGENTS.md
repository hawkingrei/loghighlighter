# LogHighlighter Agent Notes

## Goal
Build a client-only log highlighting tool in Next.js for Vercel deployment. Users can load logs by URL (via proxy) or upload a local file. Highlighting is driven by default regex rules plus custom rules saved in the browser.

## Core Features
- Next.js App Router, no backend services.
- URL loading uses `/api/fetch-log` as a proxy to bypass CORS.
- Local file upload for logs.
- Highlight rules stored in `localStorage` with defaults merged into user overrides.
- Settings modal with:
  - Global regex flags (checkboxes; `g` always on).
  - Optional per-rule flags (advanced mode).
  - Configurable matched line text color.
- Preview supports:
  - Folding long unhighlighted sections (shows line count + snippet, expandable).
  - Entire matched line receives a neutral background.
  - Keyword matches use rule colors.
  - ANSI/ASCII color codes are rendered.

## Default Rules (current)
- Error Level: `\\b(ERROR|FATAL|CRITICAL)\\b`
- Warning Level: `\\b(WARN|WARNING)\\b`
- DATA RACE
- FAIL or Failure: `(FAIL|Failure \\[)\\b`
- Error Prefix: `(Error|ERROR)s?:`
- ` Error:`
- fatal error
- panic: runtime error: invalid memory address or nil pointer dereference
- ========
- index out of range
- core dumped
- should not happened
- POTENTIAL DEADLOCK
- errors found by nogo during build-time code analysis:
- assert failed
- goleak
- race detected

Removed from defaults: Timestamp, Info Level, IP Address.

## UX Notes
- "Highlight Rules" is accessed via a Settings button.
- Rules are displayed as a table; each cell is editable.
- Rules can be disabled (defaults) or removed (custom).
- Upload input is styled; no paste textarea.

## Key Files
- `app/page.js`: UI + highlighting logic + storage.
- `app/globals.css`: Styling for layout, modal, table, and preview.
- `app/api/fetch-log/route.js`: URL fetch proxy.
- `vercel.json`: Framework config.

## Constraints
- ASCII-only code unless file already contains Unicode.
- No destructive git commands.
- No backend services beyond Vercel API route.

## State Storage (localStorage)
Key: `loghighlighter.rules.v1`

Shape:
```json
{
  "overrides": {
    "<defaultRuleId>": {
      "id": "level-error",
      "name": "Error Level",
      "pattern": "\\\\b(ERROR|FATAL|CRITICAL)\\\\b",
      "flags": "gi",
      "color": "#ef6b6b",
      "enabled": true,
      "note": "Severity highlight"
    }
  },
  "custom": [
    {
      "id": "custom-<uuid>",
      "name": "Custom Rule",
      "pattern": "",
      "flags": "g",
      "color": "#9ad1d4",
      "enabled": true,
      "note": ""
    }
  ],
  "settings": {
    "globalFlags": "gi",
    "useAdvancedFlags": false,
    "lineTextColor": "#BE6DAB"
  }
}
```

## Rule Ordering and Priority
- Rules are applied in the order they appear in the combined list: defaults first, then custom rules.
- Overlaps are resolved by earliest match position; for ties, longer matches win, then earlier rule order.
- For each line, multiple keyword matches can appear; the line gets a neutral background, and each keyword gets its configured color.
