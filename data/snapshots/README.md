# Deployed Tuesday snapshots

`latest.json` and the dated `sleeper-public-YYYY-MM-DD.json` are generated in the GitHub Actions artifact every Tuesday from Sleeper's documented public API. They are not committed to the repository and are replaced on the next deployment.

The snapshot contains only active player identity, position, team, reported player status, the current NFL state, source attribution, and generation time. It cannot state league-specific availability, expert projections, injury analysis, news, or player valuation.

Use the schema in the project README when importing a manual or licensed-provider context snapshot locally.
