# Roster Signal

A mobile-friendly, static **Sleeper Fantasy Team Advisor** for in-season decisions. It runs entirely in the browser, stores its small amount of user input locally, and never submits a Sleeper lineup, waiver claim, trade, or transaction.

## Run locally

Serve the repository root:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000`. With Node 18+ installed, run the targeted logic tests:

```powershell
node --test tests/sleeper-advisor.test.js
```

## Use it

1. Enter your public Sleeper username and up to two public NFL league IDs, then select **Save & refresh**.
2. The advisor resolves your Sleeper user ID, identifies your roster in each league, and loads the current public league metadata, users, rosters, player directory, regular-season matchup data, and current/prior-week transactions.
3. Review the reported starters, bench, IR/reserve, record, rank, roster-count needs, matchup score where Sleeper returns it, and locally computed unrostered candidate list.
4. Enter your own start/sit projection and risk notes. Those inputs are intentionally manual and remain in your browser. Use **Remove local data** to delete the saved username, league IDs, and notes.

## Data, privacy, and limitations

The app uses documented, read-only Sleeper endpoints directly from the browser:

- `GET /v1/user/{username}`
- `GET /v1/state/nfl`
- `GET /v1/league/{league_id}`, `/users`, `/rosters`
- `GET /v1/league/{league_id}/matchups/{week}`
- `GET /v1/league/{league_id}/transactions/{week}`
- `GET /v1/players/nfl`

No credentials, cookies, roster edits, or server-side storage are used. `localStorage` holds only the supplied username, up to two league IDs, and manually entered start/sit notes.

Sleeper’s public API is useful for roster and league state, but it does **not** provide trusted real-time expert projections, injury analysis, or news. For that reason:

- Matchup scores are shown only when returned by Sleeper; no matchup projection is fabricated.
- “Waiver / free-agent candidates” are unrostered player-directory entries prioritized by simple roster-count needs, not a claim recommendation or live availability guarantee.
- Projection and risk fields are visibly manual expert inputs, never presented as Sleeper or real-time news data.
- Record/rank are shown only from available public roster settings and a simple record ordering; tiebreak rules can differ by league.

## Deploy to GitHub Pages

The included GitHub Actions workflow deploys the repository root whenever `main` is pushed. Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The deployed app is available at:

`https://aofarre.github.io/sleeper-team-advisor/`
