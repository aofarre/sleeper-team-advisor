# Deployed Tuesday snapshots

`latest.json` and the dated `sleeper-public-YYYY-MM-DD.json` are generated in the GitHub Actions artifact every Tuesday from Sleeper's documented public API. They are not committed to the repository and are replaced on the next deployment.

The snapshot automatically combines the active-only Sleeper public player directory, NFL state, seven-day trending adds, seven-day trending drops, and [RotoWire's published NFL RSS feed](https://www.rotowire.com/rss/news.php?sport=NFL). It contains active team-affiliated player identity, position, team, bye week, reported player status/injury/practice fields, trend counts, matched RSS title/link/publication metadata, source attribution, source availability, and generation time. A failed optional feed is emitted as `unavailable` and marks coverage `partial`; the player directory is required.

It cannot state league-specific availability (the browser calculates that from each refreshed league), expert projections, independent injury analysis, projected usage, or player valuation. RSS metadata is a cited player-update signal, not copied article content or an editorial waiver ranking.

Use the schema in the project README when importing a manual or licensed-provider context snapshot locally.
