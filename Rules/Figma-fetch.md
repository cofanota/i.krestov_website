# Figma fetch workflow

Figma file: `cpLveNkdlW6XRiHClNtgWn` (Web-Personal)

**HARD RULE:** See [`.cursor/rules/figma-mcp-fresh-stop.mdc`](../.cursor/rules/figma-mcp-fresh-stop.mdc). If live Figma data was not fetched in the current session, **stop work** — do not implement from cache or memory.

## Preferred: Figma MCP (current session)

1. Confirm Figma MCP is connected (Cursor → MCP / reload window if missing).
2. For the page you are building, call MCP on the **exact** node-id from the user URL or frame name.

### Common nodes

| Page / frame | Node ID |
|--------------|---------|
| Home (theme control placement) | `12196:6100` |
| Segmented control | `12257:7793` |
| About card | `12167:13920` |
| About inner content | `12167:14359` |
| Contacts card | `12167:14038` |
| Map / pages overview | `12192:9521` |

### MCP calls (in order)

1. `get_design_context` — `fileKey` + `nodeId`
2. `get_screenshot` — same node (layout check)
3. Download assets from URLs returned in that response only

## Fallback: Figma REST API

Only if MCP is unavailable **and** the user provides `FIGMA_ACCESS_TOKEN` (Figma → Settings → Security → Personal access tokens).

```bash
export FIGMA_ACCESS_TOKEN="your-token"
curl -sS "https://api.figma.com/v1/files/cpLveNkdlW6XRiHClNtgWn/nodes?ids=12167%3A13920" \
  -H "X-Figma-Token: $FIGMA_ACCESS_TOKEN"
```

Save the JSON with a timestamp. Still **stop** if neither MCP nor a successful REST fetch happened in-session — do not reuse an old export.

## Stale sources — never use for implementation

- `agent-tools/*.txt` from past agent runs
- Chat summaries or transcript HTML/CSS
- `.figma-cache/*` unless re-fetched in the **current** session
- Guessed copy, spacing, or assets

## After a successful fetch

Implement in `index.html`, `404.html`, and CSS to match the live export. Transcode local videos under `Media/Videos/` when Figma shows video placeholders.
