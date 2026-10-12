# Counter Studio & Target Match

Counter Studio is a small full-stack application with two modes:

- **Target Match** is a number puzzle. Reach a generated target using arithmetic operations, ideally in the minimum number of moves.
- **Classic Studio** is the original increment/decrement/reset counter.

The backend is a .NET 10 ASP.NET Core Minimal API. The frontend is a React 19 single-page app served locally by Vite.

## Architecture

```text
┌────────────────────────── Browser ───────────────────────────┐
│ React 19 app (Vite :5173)                                    │
│  Target Match UI ─┐                                          │
│  Classic UI ──────┼── fetch /api/game… and /api/counter…     │
│  Sound + confetti ┘                                          │
└───────────────────────┬─────────────────────────────────────┘
                        │ /api/* (development proxy)
                        ▼
                Vite proxy :5173 → :5057
                        │
                        ▼
┌──────────────────── .NET 10 API ─────────────────────────────┐
│ ASP.NET Core Minimal API (Kestrel :5057)                      │
│  /api/game/* ─── singleton TargetGameState                   │
│  /api/counter/* ─ singleton CounterState                     │
│                       │                    │                  │
│                       ▼                    ▼                  │
│               puzzle state          classic count            │
│         (target, moves, stats)      (integer count)           │
└───────────────────────────────────────────────────────────────┘
```

The Vite proxy keeps browser calls on the frontend origin during local development. Both state objects live only in the running .NET process; multiple tabs share that process's state, but restarting the backend clears the game progress, counters, streaks, and win totals.

## Features

### Target Match

- The API generates a target based on the selected difficulty:

  | Level | Name | Target range |
  | --- | --- | ---: |
  | 1 | Warmup | 15–40 |
  | 2 | Casual | 41–90 |
  | 3 | Challenger | 91–200 |
  | 4 | Expert | 201–350 |
  | 5 | Master | 351–500 |

- Start at zero and use `+1`, `+5`, `+10`, `−1`, `−5`, `×2`, `×3`, and `÷2`. Division is available only when the current value is even.
- The backend calculates a “Par” move count with breadth-first search (BFS), bounded to 12 steps and a limited value range.
- The UI displays distance to target, move count and Par, efficiency stars, operation history, current/best win streak, and total puzzles solved.
- Undo (`Ctrl+Z`), reset round (`R`), and new target (`N`) are supported. Keyboard shortcuts `1`, `5`, and `0` trigger `+1`, `+5`, and `+10`.
- Winning triggers synthesized Web Audio sound effects and a canvas confetti animation. Sound can be toggled; the preference is saved in browser `localStorage`.

### Classic Studio

The classic counter supports increment, decrement, and reset. Its count is separate from puzzle state but remains process-local on the API.

## Project files

```text
Console_app/
├── README.md
├── .gitignore
├── server/
│   ├── ConsoleApp.Api.csproj
│   ├── Program.cs
│   ├── appsettings.json
│   ├── appsettings.Development.json
│   └── Properties/launchSettings.json
└── client/
    ├── package.json
    ├── package-lock.json
    ├── index.html
    ├── vite.config.js
    ├── .oxlintrc.json
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── App.css
        ├── index.css
        ├── Confetti.jsx
        └── sound.js
```

| File | Responsibility |
| --- | --- |
| `server/ConsoleApp.Api.csproj` | Targets `net10.0`; enables nullable reference types and implicit usings. |
| `server/Program.cs` | Registers the singleton state services, maps game/counter routes, defines the game request/response records, and implements game rules, history, scoring, target generation, and Par search. |
| `server/Properties/launchSettings.json` | Development HTTP profile at `http://localhost:5057`. |
| `server/appsettings*.json` | Default and Development logging configuration. |
| `client/package.json` | React, React DOM, Vite, React Vite plugin, and Oxlint scripts/dependencies. |
| `client/package-lock.json` | Resolved npm dependency versions. |
| `client/index.html` | Document metadata, page title, font loading, and React mount point. Google Fonts are requested from Google Fonts at runtime. |
| `client/vite.config.js` | Enables React and proxies `/api` to `http://localhost:5057`. |
| `client/src/main.jsx` | Mounts the app with React Strict Mode and global styles. |
| `client/src/App.jsx` | Loads game/counter state, sends API actions, implements mode switching, keyboard shortcuts, status/error displays, and renders both interfaces. |
| `client/src/Confetti.jsx` | Draws and animates win confetti on a canvas. |
| `client/src/sound.js` | Generates sound effects with the Web Audio API and saves the sound preference in local storage. |
| `client/src/App.css`, `client/src/index.css` | Application layout, responsive styling, component visuals, and global design tokens. |
| `client/.oxlintrc.json` | Oxlint React/OXC configuration, including the Hooks rule. |
| `.gitignore` | Excludes .NET/npm/Vite generated output, local IDE files, and unused starter assets from this repository. |

Generated output and dependencies such as `server/bin`, `server/obj`, `client/node_modules`, and `client/dist` are not source files.

## API reference

All endpoints are served by the .NET process on port `5057`. Successful requests return JSON snapshots with HTTP `200 OK`.

### Game

| Method | Path | Request | Effect |
| --- | --- | --- | --- |
| `GET` | `/api/game` | — | Returns the current game snapshot. |
| `POST` | `/api/game/new` | `{"level": 1}` (level is optional) | Generates a new target at the requested valid level; invalid/missing level leaves the current level selected. Resets the round, not lifetime-in-process stats. |
| `POST` | `/api/game/op` | `{"op":"+5"}` | Applies one of `+1`, `+5`, `+10`, `-1`, `-5`, `*2`, `*3`, `/2`. A win increments games solved and streaks. |
| `POST` | `/api/game/undo` | — | Reverses the last operation when the game is not won. |
| `POST` | `/api/game/reset` | — | Restarts the current target's round at zero; does not clear win totals/streaks. |

The game snapshot contains `currentValue`, `target`, `moves`, `parMoves`, `level`, `currentStreak`, `bestStreak`, `isWon`, `gamesWon`, `history`, and `allowedOps`. Unknown operations, empty operations, odd-number division, and operations after a win leave the snapshot unchanged.

The game service serializes state updates with a lock. BFS computes Par with a maximum search depth of 12 and bounds candidates to at least `-20` and at most `max(1000, target * 2 + 20)`. If the bounded search finds no solution, it returns a fallback Par value of 5.

### Classic counter

| Method | Path | Effect |
| --- | --- | --- |
| `GET` | `/api/counter` | Returns `{"value": number}`. |
| `POST` | `/api/counter/increment` | Adds one and returns the new value. |
| `POST` | `/api/counter/decrement` | Subtracts one and returns the new value; negative values are allowed. |
| `POST` | `/api/counter/reset` | Sets the value to zero and returns `{"value":0}`. |

`GET /` returns a short message indicating the Counter Studio and Target Match API is running.

## Run locally

Install the .NET 10 SDK and Node.js/npm. Open two PowerShell terminals in `Console_app`.

Terminal 1 — start the API:

```powershell
dotnet run --project .\server
```

Terminal 2 — install dependencies once and start Vite:

```powershell
cd .\client
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173` (or the local URL printed by Vite). In PowerShell, `npm.cmd` avoids the execution-policy error that can occur when `npm` resolves to `npm.ps1`; it does not require changing the PowerShell execution policy.

Other client scripts:

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run preview
```

`preview` serves the production build locally after `build`; the API still needs to be running.

## State and deployment notes

- The game, counter, scores, and streaks are in-memory singleton state. They are shared by clients of the same API process but reset when it stops; no database or durable save is configured.
- The UI has no authentication. This is a local learning/demo project, not a production-hardened service.
- The Vite proxy is configured for development. No production frontend hosting or reverse-proxy configuration is included.
- Sound preference is browser-local; game and counter state are server-process-local.
