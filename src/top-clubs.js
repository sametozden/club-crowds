import { attendanceValue } from './attendance-value.js';

// Bundesliga, Premier League, LaLiga, Ligue 1 and Serie A in the SQL dataset.
const topFiveLeagueIds = new Set([1, 3, 6, 8, 10]);

export function topClubs(dataset, season, metric, topFiveOnly = false) {
  const clubs = new Map(dataset.clubs.map(club => [club.id, club]));
  return dataset.clubdata
    .filter(row => String(row.season).padStart(4, '0') === season && (!topFiveOnly || topFiveLeagueIds.has(Number(row.leagueid))))
    .map(row => ({ club: clubs.get(row.clubid), value: attendanceValue(row, metric), capacity: Number(row.capacity) || 0 }))
    .filter(item => item.club && item.value !== null)
    .sort((a, b) => b.value - a.value || b.capacity - a.capacity || a.club.title.localeCompare(b.club.title))
    .slice(0, 50);
}
