import { attendanceValue } from './attendance-value.js';

export function topClubs(dataset, season, metric) {
  const clubs = new Map(dataset.clubs.map(club => [club.id, club]));
  return dataset.clubdata
    .filter(row => String(row.season).padStart(4, '0') === season)
    .map(row => ({ club: clubs.get(row.clubid), value: attendanceValue(row, metric), capacity: Number(row.capacity) || 0 }))
    .filter(item => item.club && item.value !== null)
    .sort((a, b) => b.value - a.value || b.capacity - a.capacity || a.club.title.localeCompare(b.club.title))
    .slice(0, 50);
}
