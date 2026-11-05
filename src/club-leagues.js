// A club can move between leagues, so use the most recent season in the dataset.
export function latestClubLeagues(records) {
  const latest = new Map();
  for (const row of records) {
    const season = String(row.season).padStart(4, '0');
    const previous = latest.get(row.clubid);
    if (!previous || season > previous.season) {
      latest.set(row.clubid, { season, leagueId: row.leagueid });
    }
  }
  return latest;
}
