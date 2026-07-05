# Project Agent Notes

## Local Server Port

- Always use `http://localhost:3000` as the canonical local app URL for this project.
- If port `3000` is not accessible, returns `500`, or is occupied by a stale process, fix that first before proceeding with implementation, testing, or user handoff.
- Do not switch to `3001` or another temporary port as the final answer. Alternate ports are only acceptable for short-lived diagnosis, and the project must be restored to a healthy `3000` server before finishing.

## Recovering Port 3000

When `3000` is broken:

1. Probe the port with `Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing -TimeoutSec 10`.
2. Check listeners with `netstat -ano -p tcp` and find the `0.0.0.0:3000` or `127.0.0.1:3000` PID.
3. If that PID is an old or broken `node` process serving the wrong build, stop only that process with `Stop-Process -Id <PID>`.
4. Start the current version from its folder, for example:

```powershell
cd D:\Codex\Mail_test_task\versions\04_sheet_visualizations
npm run start -- -p 3000
```

5. Verify `http://localhost:3000` returns `200` before reporting that the app is ready.

For this repo, the recurring failure mode was a stale `node` process on `3000` returning `500` while a freshly started app on another port worked. The correct fix is to replace the stale `3000` listener with the current app, not to ask the user to use another port.

## Token-Saving Server Handoff

- If recovering `3000` requires repeated process inspection, rebuilds, or more than one failed restart, stop spending agent tokens on server babysitting.
- Instead, give the user concise manual PowerShell commands to:
  - find the PID listening on `3000`,
  - stop that PID,
  - start the current version from its folder on `3000`,
  - verify the app returns `200`.
- Ask the user to run those commands locally and report the result before continuing implementation or debugging.
