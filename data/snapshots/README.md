# Deployed Tuesday snapshots

`latest.json` and the dated `sleeper-public-YYYY-MM-DD.json` are generated in the GitHub Actions artifact every Tuesday from Sleeper's documented public API. They are not committed to the repository and are replaced on the next deployment.

The snapshot automatically combines the Sleeper public player directory, NFL state, seven-day trending adds, and seven-day trending drops. It contains active player identity, position, team, bye week, reported player status/injury/practice fields, trend counts, source attribution, source availability, and generation time. A failed optional feed is emitted as `unavailable` and marks coverage `partial`; the player directory is required.

It cannot state league-specific availability (the browser calculates that from each refreshed league), expert projections, independent injury analysis, editorial news, projected usage, or player valuation.

Use the schema in the project README when importing a manual or licensed-provider context snapshot locally.
