# Counter Studio

A small interactive counter with a .NET 10 API and a React frontend. The API runs as a console-hosted application and prints its startup and request logs in the terminal. The counter is kept in memory for as long as the API process is running.

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

Open the local URL printed by Vite (usually `http://localhost:5173`). Use **Add a step**, **−**, and **Reset** to interact with the counter.

In PowerShell, use `npm.cmd` rather than `npm` if script execution is disabled. This avoids changing your PowerShell execution policy.
