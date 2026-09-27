# Draft Room

A local NFL fantasy draft assistant for **offline mock drafts** and **read-only public Sleeper drafts**. It runs entirely in the browser, has no build step, and never submits, queues, or automates a Sleeper pick.

## Run locally

Serve the repository root so browser requests to Sleeper work consistently:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000` in a modern browser. For the included logic tests, use Node 18+:

```powershell
node --test tests/draft-assistant.test.js
```

## Use it

1. **Start a mock:** Set the number of teams, your slot, and roster format, then select **Start fresh mock**. Use **Draft** or **Mark drafted** in the player table to move the board forward. Your slot builds the roster-needs model.
2. **Connect Sleeper read-only:** Paste a public Sleeper draft ID or league ID, then choose **Connect read-only**. The assistant resolves a league to its current `draft_id` where present, reads the public draft and picks endpoints, and refreshes at the selected manual, 60-second, or 2-minute interval.
3. **Tune the model:** PPR, passing-touchdown, and passing-interception values adjust projected points. Need, scarcity, ADP, and risk weights set the maximum impact of those transparent factors. Every player row shows the resulting model score and its factor breakdown.
4. **Maintain risk notes:** Use **News / risk notes** to add your own player-specific score adjustment and note. There is no live injury/news provider, so the app does not represent those notes as real-time data.

## Data and limits

Sleeper mode only uses public, read-only endpoints:

- `GET /v1/draft/{draft_id}`
- `GET /v1/draft/{draft_id}/picks`
- `GET /v1/league/{league_id}` when resolving a league ID
- `GET /v1/players/nfl` once per browser cache window (seven days) to improve player-name resolution

The large public player directory is never included in the polling loop. Draft metadata and picks are the only resources polled, with a minimum automatic interval of 60 seconds. If a request fails, the last board remains visible and the failure is shown in the connection status.

The built-in player pool contains sample preseason-style projections and ADP values for every standard fantasy position (QB, RB, WR, TE, K, and DEF). Treat those values as editable local decision inputs, not live rankings or advice.

## Deploy to GitHub Pages

The included GitHub Actions workflow deploys the static repository root whenever `main` is pushed. The application uses relative asset paths, so it works at GitHub Pages' repository base path without additional configuration.

1. In the repository, go to **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
2. Push the desired deployment branch. The **Deploy static site to Pages** workflow publishes it automatically.

The deployment URL is:

`https://aofarre.github.io/fantasy-draft-assistant/`
