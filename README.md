# Counter Studio &bull; Target Match

An interactive number puzzle game and counter studio built with a high-performance .NET 10 Minimal API and a modern React 19 frontend.

## Game Modes

1. **Target Match (Puzzle Game)**:
   - The .NET backend generates a target number and calculates the optimal minimum "Par" moves using BFS pathfinding.
   - Use math operations (`+1`, `+5`, `+10`, `−1`, `−5`, `×2`, `×3`, `÷2`) to hit the target in the fewest moves.
   - Includes real-time formula breadcrumbs, `Undo` support (`Ctrl+Z`), win streak tracking, level progression (Level 1 Warmup to Level 5 Master), Web Audio synthesized sound effects, and celebratory confetti.
2. **Classic Studio**:
   - The original minimal counter with `+ Add a step`, `−`, and `Reset`.

## Run it

Open two terminals in the `Console_app` folder.

In the first terminal, start the .NET API:

```powershell
dotnet run --project .\server
```

In the second terminal, install the frontend packages once, then start React:

```powershell
cd .\client
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173` in your browser.

In PowerShell, use `npm.cmd` rather than `npm` if script execution is disabled. This avoids changing your PowerShell execution policy.
