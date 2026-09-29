# Roster Signal

A static, local-first **Sleeper Fantasy Team Advisor** for weekly roster, waiver, and trade decisions. It reads public Sleeper league data, stores user-entered settings and imported context only in the browser, and never submits a Sleeper lineup, waiver claim, trade, or transaction.

## What is live and what is not

| Signal | Source | When it is obtained | What it supports |
| --- | --- | --- | --- |
| League, roster, matchup, transaction, and league-specific rostered-player state | Documented public Sleeper API | Directly in the browser when the user refreshes | Roster display, roster-count needs, unrostered candidate list, and confirmed matchup scores |
| Player identity, position, team, bye, reported status, injury fields, and practice participation | Documented public Sleeper player directory | Automatically refreshed into the Tuesday Pages baseline | Player labels, bye timing, and reported injury/practice context |
| Sleeper-wide seven-day add/drop activity | Documented public Sleeper trending-player endpoints | Automatically refreshed into the Tuesday Pages baseline | A modest market-interest signal in waiver ranking; not a projection or league-specific availability |
| Availability in a league | Sleeper league rosters | Calculated locally from the selected league refresh | Candidate is unrostered in that league at refresh time; it is not a waiver guarantee |
| Valuation, projection, independent beat reporting, and expert analysis | No built-in no-key provider | Optional advanced local import or secure endpoint only | Supplemental local trade and waiver context |

Roster Signal automatically provides a usable public-data waiver baseline after the initial Sleeper username and league IDs. It does **not** have a no-key, independent projection or editorial-news provider, so it never implies a player is projected, healthy, or valuable beyond the documented Sleeper evidence or an explicitly attributed advanced source.

## Use the advisor

1. Enter a public Sleeper username and up to two public NFL league IDs, then select **Save & refresh**.
2. Review reported starters, bench, IR/reserve, record, rank, roster-count needs, public matchup scores, transactions, and unrostered candidates.
3. The app automatically loads the deployed Tuesday baseline. Its coverage panel names every source, source URL, timestamp, and unavailable feed. Use **Refresh automated baseline** only if you want to reload it in the current browser.
4. Review the **Tuesday waiver review** in each loaded league. It shows the reported waiver settings and roster rules, then offers up to five ranked add/drop proposals based on league availability, roster depth, bye/playoff timing, reported Sleeper injury/practice fields, and seven-day Sleeper trends. Mark a proposal as reviewed only after checking the Sleeper player pool and waiver screen; marking it does not create or submit a transaction.
5. Optionally, expand **Advanced** to add a lawful local source override for licensed projections or news. It supplements—rather than replaces—the automatic baseline.
6. Open **Trade Analyzer**, choose a refreshed league, list the assets being given and received one per line, and select **Analyze proposal**. The default assessment compares only attributed values, roster-count effects, and available player context.

Use **Remove local data** to remove the username, league IDs, decisions, source configuration, imported snapshot, and optional endpoint URL from the browser.

## Import snapshot format

Imports must be JSON with `schemaVersion: 1`, a valid `generatedAt` time, a named source, and a `playerContext` object keyed by Sleeper player ID. Only `valuation` and `projection` are numeric; the remaining player fields are optional strings.

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-09-29T14:00:00.000Z",
  "source": {
    "name": "Licensed provider weekly export",
    "url": "https://provider.example/export-description",
    "type": "licensed-export"
  },
  "playerContext": {
    "4046": {
      "playerName": "Example Player",
      "position": "WR",
      "team": "AAA",
      "status": "Questionable",
      "projection": 14.2,
      "valuation": 37.5,
      "injury": "Practice status as supplied by the licensed export",
      "news": "Short source summary supplied by the licensed export",
      "updatedAt": "2026-09-29T13:30:00.000Z",
      "sourceUrl": "https://provider.example/item/4046"
    }
  }
}
```

The source name and URL are displayed alongside the result. Import only data that your provider license and applicable terms permit you to use. The project intentionally does not scrape third-party sites, ship any provider credentials, or use undocumented endpoints.

### Tuesday waiver-review inputs and limits

The waiver review uses public Sleeper league settings, roster positions, your roster, league rosters, player-directory fields, current NFL week, current/prior-week league transactions, and the automated Tuesday trending snapshot. It calculates a player as available only when that player is absent from the loaded league rosters. It restricts automatic targets to current team-affiliated, non-reserve players and incorporates a player bye week and the league playoff start week only when those fields are reported by Sleeper.

Recommendations are prioritization aids, not projections or guaranteed claims. A suggestion’s multi-week explanation identifies basic positional depth, near-term reported bye timing, playoff timing, reported Sleeper injury/practice fields, and modest seven-day Sleeper add/drop interest. It treats rest-of-season upside, projected usage, and independent editorial news as unknown unless they occur in an advanced, source-attributed snapshot. The app never scrapes third-party news sites. To add external waiver news responsibly, use a provider/API/export you are permitted to use, import the JSON snapshot, and include a source URL for each context item. The review links that source and shows automated coverage or unavailable feeds.

## Tuesday refresh workflow

`.github/workflows/deploy-pages.yml` runs on pushes to `main`, manual dispatches, and at **Tuesday 14:00 UTC**. It runs tests, then `scripts/refresh-sleeper-snapshot.mjs`, which calls only documented public Sleeper endpoints:

- `GET https://api.sleeper.app/v1/state/nfl`
- `GET https://api.sleeper.app/v1/players/nfl?active=true`
- `GET https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=168&limit=100`
- `GET https://api.sleeper.app/v1/players/nfl/trending/drop?lookback_hours=168&limit=100`

It adds `data/snapshots/latest.json` and a date-versioned `data/snapshots/sleeper-public-YYYY-MM-DD.json` to that Pages deployment artifact. Each snapshot carries source URLs, fetch times, source availability, and a `complete` or `partial` coverage status. The player directory is required; NFL state and either trending feed can fail without blocking deployment, and that failure is visible in the UI. The checked-in `data/snapshots/README.md` explains the artifact lifecycle. Scheduled runs can be delayed by GitHub; the timestamp in the app is authoritative. No secret is required for this refresh.

## Optional secure AI endpoint

The static Pages app never accepts an AI API key. Its optional endpoint field saves only a URL locally and sends the already-computed deterministic trade analysis to that URL when the user explicitly selects **Use configured secure endpoint**.

`serverless/trade-analysis.example.mjs` is a provider-neutral Node 20 handler template. Deploy it to a serverless platform that supports Web `Request`/`Response` handlers, then configure these server-side secrets there:

| Variable | Required | Meaning |
| --- | --- | --- |
| `AI_API_URL` | Yes | Your licensed AI provider's server-side request URL |
| `AI_API_KEY` | Yes | The provider key kept in the platform secret store |

The endpoint must return JSON in this shape:

```json
{ "analysis": "A concise supplemental assessment." }
```

Protect the endpoint with authentication, origin controls, rate limits, and appropriate logging/privacy policies before entering its HTTPS URL in the app. The template deliberately returns a configuration error rather than a fabricated successful response. If no endpoint is configured or it fails, the local deterministic assessment remains available.

## Local development and tests

Serve the repository root:

```powershell
python -m http.server 8000
```

Run targeted logic tests with Node 18+:

```powershell
node --test tests/sleeper-advisor.test.js
```

To build a public-only Tuesday baseline locally (requires network access to the documented Sleeper API):

```powershell
node scripts/refresh-sleeper-snapshot.mjs
```

## Deploy to GitHub Pages

Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The workflow deploys `main` to:

`https://aofarre.github.io/sleeper-team-advisor/`
