const defaults = { clubs: [1, 2, 105, 111, 184, 183, 38], league: [1, 2, 3], top50: [] };

export const selectionLimit = mode => mode === 'league' ? 6 : mode === 'top50' ? 0 : 10;
export const defaultSelection = mode => [...(defaults[mode] ?? defaults.clubs)];

export function readComparisonUrl(url) {
  const params = new URL(url).searchParams;
  const mode = ['clubs', 'league', 'top50'].includes(params.get('compare')) ? params.get('compare') : 'clubs';
  const ids = !params.has('ids') ? defaultSelection(mode) : params.get('ids').split(',')
    .filter(value => /^[1-9]\d*$/.test(value))
    .map(Number)
    .filter(Number.isSafeInteger);
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const metric = params.get('metric') === 'percentage' ? 'percentage' : 'average';
  const season = params.get('season') || '';
  const topFiveOnly = params.get('top5') === '1';
  return { mode, ids: [...new Set(ids)].slice(0, selectionLimit(mode)), from, to, metric, season, topFiveOnly };
}

export function topFiveUrl(url, enabled) {
  const next = new URL(url);
  if (enabled) next.searchParams.set('top5', '1');
  else next.searchParams.delete('top5');
  return next;
}

export function rankingSeasonUrl(url, season) {
  const next = new URL(url);
  next.searchParams.set('season', season);
  return next;
}

export function metricUrl(url, metric) {
  const next = new URL(url);
  next.searchParams.set('metric', metric);
  return next;
}

export function resolveSeasonRange(available, from, to) {
  if (!available.length) return { from: '', to: '' };
  const start = available.includes(from) ? from : available[0];
  const end = available.includes(to) ? to : available[available.length - 1];
  return start <= end ? { from: start, to: end } : { from: end, to: start };
}

export function seasonRangeUrl(url, from, to) {
  const next = new URL(url);
  next.searchParams.set('from', from);
  next.searchParams.set('to', to);
  return next;
}

export function comparisonUrl(url, mode, ids) {
  const next = new URL(url);
  next.searchParams.set('compare', mode);
  next.searchParams.set('ids', ids.join(','));
  return next;
}
