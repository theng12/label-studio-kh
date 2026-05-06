# IPC Channels

Per spec §13, every IPC channel between the renderer and main process is documented here. This makes future REST/CLI wrapping trivial — the channel name + payload shape define the API.

## Channel naming convention

`{domain}:{action}` — e.g. `brand:list`, `template:save`, `export:run`.

## Channels

### Phase 1

| Channel | Direction | Input | Output | Purpose |
|---|---|---|---|---|
| `app:getVersion` | renderer → main | – | `string` | Returns `app.getVersion()` for diagnostics. |

(Brand and template IPC channels land alongside their services in Step 3 of Phase 1.)
