# Roster Signal

A static, local-first **Sleeper Fantasy Team Advisor** for weekly roster, waiver, and trade decisions. It reads public Sleeper league data, stores user-entered settings and imported context only in the browser, and never submits a Sleeper lineup, waiver claim, trade, or transaction.

## What is live and what is not

| Signal | Source | When it is obtained | What it supports |
| --- | --- | --- | --- |
| League, roster, matchup, transaction, and league-specific rostered-player state | Documented public Sleeper API | Directly in the browser when the user refreshes | Roster display, roster-count needs, unrostered candidate list, and confirmed matchup scores |
| Public player identity, position, team, and reported player status | Documented public Sleeper API | Directly in the browser and in a Tuesday Pages baseline | Player labels and explicitly attributed status context |
| Availability in a league | Sleeper league rosters | Calculated locally from the selected league refresh | Candidate is unrostered in that league at refresh time; it is not a waiver guarantee |
| Valuation, projection, injury news, beat reporting, and expert analysis | No built-in provider | Only through an attributed user import or an optional secure endpoint | Local deterministic trade and waiver context display |

Roster Signal does **not** have a configured live injury, news, projection, rankings, or valuation provider. It never implies that a player is available, healthy, projected, or valuable beyond data supplied by Sleeper or a source you explicitly import.

## Use the advisor

1. Enter a public Sleeper username and up to two public NFL league IDs, then select **Save & refresh**.
2. Review reported starters, bench, IR/reserve, record, rank, roster-count needs, public matchup scores, transactions, and unrostered candidates.
3. For Tuesday waiver work, select **Load deployed Tuesday baseline**. Its badge and message identify its source and generated time. It is a public Sleeper directory baseline, not live news.
4. If you lawfully receive projections, injuries, valuations, or news from another source, configure its display name and attribution URL, then import a snapshot. The app validates and stores it locally.
5. Review the **Tuesday waiver review** in each loaded league. It shows the reported waiver type, budget, processing settings, roster positions, and playoff start week where Sleeper provides them, then offers up to five ranked add/drop proposals. Mark a proposal as reviewed only after checking the Sleeper player pool and waiver screen; marking it does not create or submit a transaction.
6. Open **Trade Analyzer**, choose a refreshed league, list the assets being given and received one per line, and select **Analyze proposal**. The default assessment compares only attributed values, roster-count effects, and explicitly imported player context.

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

The waiver review uses public Sleeper league settings, roster positions, your roster, league rosters, player-directory fields, current NFL week, and current/prior-week league transactions. It calculates a player as available only when that player is absent from the loaded league rosters. It incorporates a player bye week and the league playoff start week only when those fields are reported by Sleeper.

Recommendations are prioritization aids, not projections or guaranteed claims. A suggestion’s multi-week explanation identifies basic positional depth, near-term reported bye timing, and playoff timing; it treats rest-of-season upside, projected usage, injuries, and news as unknown unless they occur in the imported, source-attributed snapshot. The app never scrapes third-party news sites. To use external waiver news responsibly, obtain it through a provider/API/export you are permitted to use, import the JSON snapshot, and include a source URL for each context item. The review links that source and shows when no live news context is available.

## Tuesday refresh workflow

`.github/workflows/deploy-pages.yml` runs on pushes to `main`, manual dispatches, and at **Tuesday 14:00 UTC**. It runs tests, then `scripts/refresh-sleeper-snapshot.mjs`, which calls only:

- `GET https://api.sleeper.app/v1/state/nfl`
- `GET https://api.sleeper.app/v1/players/nfl`

It adds `data/snapshots/latest.json` and a date-versioned `data/snapshots/sleeper-public-YYYY-MM-DD.json` to that Pages deployment artifact. The checked-in `data/snapshots/README.md` explains the artifact lifecycle. Scheduled runs can be delayed by GitHub; the timestamp in the app is authoritative. No secret is required for this refresh.

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
