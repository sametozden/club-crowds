import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import './results.css';
import './top-fifty.css';
import imageManifest from '../public/images/manifest.json';
import {
    comparisonUrl,
    defaultSelection,
    metricUrl,
    rankingSeasonUrl,
    readComparisonUrl,
    resolveSeasonRange,
    seasonRangeUrl,
    selectionLimit,
    topFiveUrl
} from './comparison-url.js';
import {attendanceValue} from './attendance-value.js';
import {latestClubLeagues} from './club-leagues.js';
import {topClubs} from './top-clubs.js';

const colors = ['#527820', '#13775c', '#b65637', '#426db2', '#8a519f', '#a66a12', '#bd4872', '#166887', '#745640', '#6a6bb2'];
const format = value => new Intl.NumberFormat('en-US', {maximumFractionDigits: 1}).format(value);
const seasonLabel = value => `${String(value).slice(0, 2)}/${String(value).slice(2)}${String(value) === '2021' ? ' (COVID)' : ''}`;
const fallbackImage = `${import.meta.env.BASE_URL}images/placeholder.svg`;
const logoUrl = item => imageManifest[item.logo] ? `${import.meta.env.BASE_URL}images/${encodeURIComponent(imageManifest[item.logo])}` : fallbackImage;

function Logo({item}) {
    return <img className="entity-logo" src={logoUrl(item)} alt="" onError={event => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = fallbackImage;
    }}/>;
}

function Chart({data, selected, metric, seasons}) {
    const [hiddenIds, setHiddenIds] = useState([]);
    const visibleCount = selected.filter(item => !hiddenIds.includes(item.id)).length;

    useEffect(() => {
        setHiddenIds(current => {
            const remaining = current.filter(id => selected.some(item => item.id === id));
            return remaining.length === current.length ? current : remaining;
        });
    }, [selected]);

    useEffect(() => {
        if (!window.AmCharts || !selected.length || !visibleCount) return;
        const chart = window.AmCharts.makeChart('chart', {
            type: 'serial', color: '#405247', fontFamily: 'Inter, Arial, sans-serif', backgroundAlpha: 0,
            dataProvider: seasons.map(season => {
                const point = {season: seasonLabel(season)};
                selected.forEach(item => {
                    const row = data.find(r => String(r.season) === season && Number(r.entity) === Number(item.id));
                    const value = attendanceValue(row, metric);
                    if (value !== null) point[`v${item.id}`] = value;
                });
                return point;
            }),
            categoryField: 'season', categoryAxis: {gridAlpha: 0, axisAlpha: 0, labelRotation: 0},
            valueAxes: [{
                gridColor: '#a3b2a4', gridAlpha: 0.4, axisAlpha: 0, minimum: 0, ...(metric === 'percentage' ? {
                    maximum: 100,
                    unit: '%'
                } : {})
            }],
            graphs: selected.map((item, i) => ({
                title: item.title.trim(),
                valueField: `v${item.id}`,
                type: 'line',
                lineColor: colors[i % colors.length],
                lineThickness: 3,
                customBullet: logoUrl(item),
                bulletSize: 22,
                connect: false,
                balloonText: `<img src="${logoUrl(item)}" width="20" height="20" style="vertical-align:middle;object-fit:contain;margin-right:6px" alt="">[[title]]: <b>[[value]]</b>`
            })).filter((_, i) => !hiddenIds.includes(selected[i].id)),
            chartCursor: {cursorColor: '#829788', cursorAlpha: 0.3, categoryBalloonEnabled: true, zoomable: false},
            creditsPosition: 'bottom-right', marginTop: 24, marginRight: 25,
        });
        return () => chart.clear();
    }, [data, selected, metric, seasons, hiddenIds, visibleCount]);
    return <>
        <p className="chart-mobile-hint">Swipe to see all seasons · Tap a point for details</p>
        <div className="chart-scroll" style={{'--chart-min-width': `${Math.max(320, seasons.length * 74 + 70)}px`}}>
            <div className="chart-container">
                <div id="chart" className="chart" role="img" aria-label="Historical attendance comparison chart"/>
                {!visibleCount && <div className="chart-hidden-message">Select a team or league below to show its line.</div>}
            </div>
        </div>
        <p className="chart-legend-hint">Select a name to show or hide its line.</p>
        <div className="chart-legend" aria-label="Show or hide chart lines">{selected.map((item, i) => {
            const visible = !hiddenIds.includes(item.id);
            return <button type="button" key={item.id} className={visible ? 'legend-item' : 'legend-item is-hidden'}
                           aria-pressed={visible} onClick={() => setHiddenIds(current => visible ? [...current, item.id] : current.filter(id => id !== item.id))}>
                <span className="legend-color" style={{background: colors[i % colors.length]}}/><Logo item={item}/><span>{item.title.trim()}</span>
            </button>;
        })}</div>
    </>;
}

function TopFifty({dataset, season, metric, topFiveOnly}) {
    const rows = useMemo(() => topClubs(dataset, season, metric, topFiveOnly), [dataset, season, metric, topFiveOnly]);
    useEffect(() => {
        if (!window.AmCharts || !rows.length) return;
        const chart = window.AmCharts.makeChart('top-fifty-chart', {
            type: 'serial', rotate: true, fontFamily: 'Inter, Arial, sans-serif', color: '#405247',
            autoMargins: false, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 8,
            dataProvider: rows.map((item, index) => ({rank: String(index + 1), value: item.value, logo: logoUrl(item.club)})),
            categoryField: 'rank', categoryAxis: {labelsEnabled: false, axisAlpha: 0, gridAlpha: 0, tickLength: 0},
            valueAxes: [{
                labelsEnabled: false,
                axisAlpha: 0,
                gridAlpha: 0,
                tickLength: 0,
                minimum: 0, ...(metric === 'percentage' ? {maximum: 100} : {})
            }],
            graphs: [{
                type: 'column',
                valueField: 'value',
                fillAlphas: 1,
                fillColors: '#718e42',
                lineAlpha: 0,
                columnWidth: 0.55,
                balloonText: `[[value]]${metric === 'percentage' ? '%' : ''}`
            }],
            creditsPosition: 'bottom-right',
        });
        return () => chart.clear();
    }, [rows, metric]);
    return <div className="top-fifty-panel">
        <div className="top-fifty-header">
            <div>
                <div className="eyebrow muted">CLUB RANKINGS</div>
                <h3>Top 50 <span>{season && seasonLabel(season)}</span></h3><p>{topFiveOnly ? 'The biggest crowds across the top five leagues.' : 'The biggest crowds across the available leagues.'}</p></div>
        </div>
        <div className="top-fifty-note">{rows.length} CLUBS · {metric === 'average' ? 'AVERAGE ATTENDANCE' : 'STADIUM OCCUPANCY'} · ZERO VALUES
            EXCLUDED
        </div>
        {rows.length ? <div className="top-fifty-scroll">
            <div className="top-fifty-grid">
                <div className="top-fifty-clubs">{rows.map((item, index) => <div className="top-fifty-row" key={item.club.id}><span
                    className="top-fifty-rank">{String(index + 1).padStart(2, '0')}</span><Logo item={item.club}/><span
                    className="top-fifty-name">{item.club.title.trim()}</span><span
                    className="top-fifty-value">{format(item.value)}{metric === 'percentage' ? '%' : ''}</span></div>)}</div>
                <div id="top-fifty-chart" className="top-fifty-chart" style={{height: rows.length * 38}} aria-hidden="true"/>
            </div>
        </div> : <p className="top-fifty-empty">No data for this season.</p>}</div>;
}

function App() {
    const [dataset, setDataset] = useState(null);
    const [error, setError] = useState('');
    const [mode, setMode] = useState(() => readComparisonUrl(window.location.href).mode);
    const [metric, setMetric] = useState(() => readComparisonUrl(window.location.href).metric);
    const [search, setSearch] = useState('');
    const [leagueFilter, setLeagueFilter] = useState('');
    const [ids, setIds] = useState(() => readComparisonUrl(window.location.href).ids);
    const [from, setFrom] = useState(() => readComparisonUrl(window.location.href).from);
    const [to, setTo] = useState(() => readComparisonUrl(window.location.href).to);
    const [rankingSeason, setRankingSeason] = useState(() => readComparisonUrl(window.location.href).season);
    const [topFiveOnly, setTopFiveOnly] = useState(() => readComparisonUrl(window.location.href).topFiveOnly);
    useEffect(() => {
        fetch(`${import.meta.env.BASE_URL}data/attendance.json`).then(r => {
            if (!r.ok) throw Error();
            return r.json();
        }).then(setDataset).catch(() => setError('Could not load the attendance data.'));
    }, []);
    useEffect(() => {
        const restore = () => {
            const state = readComparisonUrl(window.location.href);
            setMode(state.mode);
            setIds(state.ids);
            setFrom(state.from);
            setTo(state.to);
            setMetric(state.metric);
            setRankingSeason(state.season);
            setTopFiveOnly(state.topFiveOnly);
            setSearch('');
        };
        window.addEventListener('popstate', restore);
        return () => window.removeEventListener('popstate', restore);
    }, []);
    const entities = useMemo(() => dataset ? (mode === 'clubs' ? dataset.clubs : dataset.league) : [], [dataset, mode]);
    const clubLeagues = useMemo(() => latestClubLeagues(dataset?.clubdata ?? []), [dataset]);
    const leagues = useMemo(() => [...(dataset?.league ?? [])].sort((a, b) => a.title.localeCompare(b.title)), [dataset]);
    const records = useMemo(() => dataset ? (mode === 'clubs' ? dataset.clubdata.map(r => ({
        ...r,
        entity: r.clubid
    })) : dataset.leaguedata.map(r => ({...r, entity: r.leagueid}))) : [], [dataset, mode]);
    const availableSeasons = useMemo(() => [...new Set(records.map(r => String(r.season).padStart(4, '0')))].sort(), [records]);
    const rankingSeasons = useMemo(() => [...new Set((dataset?.clubdata ?? []).map(row => String(row.season).padStart(4, '0')))].sort().reverse(), [dataset]);
    const selectedRankingSeason = rankingSeasons.includes(rankingSeason) ? rankingSeason : rankingSeasons[0] ?? '';
    const range = useMemo(() => resolveSeasonRange(availableSeasons, from, to), [availableSeasons, from, to]);
    const seasons = useMemo(() => availableSeasons.filter(s => s >= range.from && s <= range.to), [availableSeasons, range]);
    const selected = useMemo(() => ids.map(id => entities.find(e => e.id === id)).filter(Boolean), [ids, entities]);
    const options = useMemo(() => entities.filter(e => e.title.toLowerCase().includes(search.toLowerCase()) && (mode !== 'clubs' || !leagueFilter || String(clubLeagues.get(e.id)?.leagueId) === leagueFilter)).sort((a, b) => a.title.localeCompare(b.title)).slice(0, 40), [entities, search, mode, leagueFilter, clubLeagues]);
    const updateComparison = (nextMode, nextIds) => {
        setMode(nextMode);
        setIds(nextIds);
        window.history.pushState(null, '', comparisonUrl(window.location.href, nextMode, nextIds));
    };
    const switchMode = value => {
        if (value === mode) return;
        updateComparison(value, defaultSelection(value));
        setSearch('');
    };
    const updateRange = (nextFrom, nextTo) => {
        setFrom(nextFrom);
        setTo(nextTo);
        window.history.pushState(null, '', seasonRangeUrl(window.location.href, nextFrom, nextTo));
    };
    const updateMetric = value => {
        if (value === metric) return;
        setMetric(value);
        window.history.pushState(null, '', metricUrl(window.location.href, value));
    };
    const updateRankingSeason = value => {
        setRankingSeason(value);
        window.history.pushState(null, '', rankingSeasonUrl(window.location.href, value));
    };
    const updateTopFiveOnly = enabled => {
        setTopFiveOnly(enabled);
        window.history.pushState(null, '', topFiveUrl(window.location.href, enabled));
    };
    const toggle = id => {
        const current = selected.map(item => item.id);
        const next = current.includes(id) ? current.filter(x => x !== id) : current.length < selectionLimit(mode) ? [...current, id] : current;
        if (next.length !== current.length) updateComparison(mode, next);
    };
    const latest = seasons.at(-1);
    const ranked = selected.map(item => {
        const row = records.find(r => Number(r.entity) === item.id && String(r.season).padStart(4, '0') === latest);
        return {...item, value: attendanceValue(row, metric)};
    }).sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
    return <>
        <header className="topbar"><a className="wordmark" href=".">CLUB<span>CROWDS</span><i>.</i></a><span className="top-note">THE BEAUTIFUL GAME, BY THE NUMBERS</span><span
            className="edition">FOOTBALL ATTENDANCE DATA <b>↗</b></span></header>
        <main>
            <section className="hero">
                <div className="hero-copy">
                    <div className="eyebrow"><span className="dot"/> THE ATTENDANCE ARCHIVE <span className="rule"/> EST. 2014</div>
                    <h1>Football is<br/><em>nothing without</em><br/>the fans<span>.</span></h1><p>From packed terraces to historic seasons. Explore
                    the numbers behind the crowds that make football what it is.</p><a href="#explore" className="hero-link">EXPLORE THE
                    DATA <span>↘</span></a></div>
                <div className="hero-art" aria-hidden="true">
                    <div className="pitch">
                        <div className="pitch-center"/>
                        <div className="pitch-box top"/>
                        <div className="pitch-box bottom"/>
                    </div>
                    <div className="art-caption">THE GAME BELONGS<br/>TO THE CROWD <span>01 / 90</span></div>
                    <div className="art-number">90<span>′</span></div>
                </div>
            </section>
            <section className="explorer" id="explore">
                <div className="section-heading">
                    <div>
                        <div className="eyebrow muted">THE ATTENDANCE EXPLORER</div>
                        <h2>Every crowd has a story<span>.</span></h2><p>Choose a view and explore the numbers.</p></div>
                    <span className="section-mark">THE NUMBERS<br/>BEHIND THE NOISE ↗</span></div>
                {error ? <p className="error">{error}</p> : !dataset ? <p>Loading attendance data…</p> :
                    <div className="workspace">
                        <aside className="controls">
                            <div className="control-title"><span>EXPLORE THE DATA</span><span>↗</span></div>
                            <label className="label">VIEW</label>
                            <div className="segmented view-selector" role="group" aria-label="Choose a view">
                                <button className={mode === 'clubs' ? 'active' : ''} aria-pressed={mode === 'clubs'}
                                        onClick={() => switchMode('clubs')}>Clubs
                                </button>
                                <button className={mode === 'league' ? 'active' : ''} aria-pressed={mode === 'league'}
                                        onClick={() => switchMode('league')}>Leagues
                                </button>
                                <button className={mode === 'top50' ? 'active' : ''} aria-pressed={mode === 'top50'}
                                        onClick={() => switchMode('top50')}>Top 50
                                </button>
                            </div>
                            {mode === 'top50' ? <>
                                <label className="label" htmlFor="ranking-season">SEASON</label>
                                <select id="ranking-season" value={selectedRankingSeason}
                                        onChange={e => updateRankingSeason(e.target.value)}>{rankingSeasons.map(value => <option value={value}
                                                                                                                                 key={value}>{seasonLabel(value)}</option>)}</select>
                                <label className="top-five-filter"><input type="checkbox" checked={topFiveOnly} onChange={e => updateTopFiveOnly(e.target.checked)}/><span>Just Top 5 Leagues</span></label>
                                <p className="filter-hint">{topFiveOnly ? 'Premier League, LaLiga, Bundesliga, Serie A and Ligue 1.' : 'Rankings include clubs from all available leagues.'}</p>
                            </> : <>
                                <label className="label" htmlFor="search">SELECT {mode === 'clubs' ? 'CLUBS' : 'LEAGUES'} <small>UP
                                    TO {selectionLimit(mode)}</small></label>
                                <div className="selected">{selected.map((item, i) => <button key={item.id} onClick={() => toggle(item.id)}><span
                                    className="selection-color" style={{background: colors[i]}}/><Logo item={item}/>{item.title.trim()} <b>×</b>
                                </button>)}{!selected.length && <p>Select at least one option below.</p>}</div>
                                {mode === 'clubs' && <><label className="label" htmlFor="league-filter">LEAGUE <small>LATEST
                                    SEASON</small></label><select id="league-filter" value={leagueFilter}
                                                                  onChange={e => setLeagueFilter(e.target.value)}>
                                    <option value="">All leagues</option>
                                    {leagues.map(league => <option key={league.id} value={league.id}>{league.title.trim()}</option>)}</select></>}
                                <input id="search" placeholder={`Search ${mode === 'clubs' ? 'clubs' : 'leagues'}...`} value={search}
                                       onChange={e => setSearch(e.target.value)}/>
                                <div className="options">{options.map(item => <button key={item.id} onClick={() => toggle(item.id)}
                                                                                      disabled={!selected.some(chosen => chosen.id === item.id) && selected.length >= selectionLimit(mode)}>
                                    <span className="option-name"><Logo
                                        item={item}/>{item.title.trim()}</span><b>{ids.includes(item.id) ? '✓' : '+'}</b>
                                </button>)}{options.length === 0 && <p>No matches found.</p>}</div>
                                <div className="range">
                                    <div><label className="label" htmlFor="from">FROM SEASON</label><select id="from" value={range.from}
                                                                                                            onChange={e => updateRange(e.target.value, e.target.value > range.to ? e.target.value : range.to)}>{availableSeasons.map(s =>
                                        <option key={s} value={s}>{seasonLabel(s)}</option>)}</select></div>
                                    <div><label className="label" htmlFor="to">TO SEASON</label><select id="to" value={range.to}
                                                                                                        onChange={e => updateRange(e.target.value < range.from ? e.target.value : range.from, e.target.value)}>{availableSeasons.map(s =>
                                        <option key={s} value={s}>{seasonLabel(s)}</option>)}</select></div>
                                </div>
                            </>}
                            <label className="label">MEASURE</label>
                            <div className="segmented measure-selector" role="group" aria-label="Choose a measure">
                                <button className={metric === 'average' ? 'active' : ''} aria-pressed={metric === 'average'}
                                        onClick={() => updateMetric('average')}>Average attendance
                                </button>
                                <button className={metric === 'percentage' ? 'active' : ''} aria-pressed={metric === 'percentage'}
                                        onClick={() => updateMetric('percentage')}>Occupancy %
                                </button>
                            </div>
                        </aside>
                        <div className="results">{mode === 'top50' ? <TopFifty dataset={dataset} season={selectedRankingSeason} metric={metric} topFiveOnly={topFiveOnly}/> : <>
                            <div className="results-top">
                                <div>
                                    <div className="eyebrow muted">THE BIG PICTURE <span> / {mode.toUpperCase()}</span></div>
                                    <h3>Attendance over time</h3><p>Compare the numbers, season by season.</p></div>
                            </div>
                            <div className="chart-label">{metric === 'average' ? 'AVERAGE ATTENDANCE' : 'STADIUM OCCUPANCY'} <span>↑</span></div>
                            {selected.length ? <Chart key={mode} data={records} selected={selected} metric={metric} seasons={seasons}/> :
                                <div className="empty-chart">Choose a {mode === 'clubs' ? 'club' : 'league'} to see the chart.</div>}
                            <div className="chart-foot"><span>SEASON</span><span>ZERO VALUES AND GAPS ARE SHOWN AS NO DATA</span></div>
                            <div className="snapshot">
                                <div>
                                    <div className="eyebrow muted">A CLOSER LOOK</div>
                                    <h3>Season snapshot <span>{latest && seasonLabel(latest)}</span></h3></div>
                                <div className="ranking">{ranked.length ? ranked.map((item, i) => <div key={item.id}><span
                                    className="rank">{item.value === null ? '—' : String(i + 1).padStart(2, '0')}</span><Logo
                                    item={item}/><strong>{item.title.trim()}</strong><b>{item.value === null ? 'No data' : `${format(item.value)}${metric === 'percentage' ? '%' : ''}`}</b>
                                </div>) : <p>No data for this selection and season.</p>}</div>
                            </div>
                        </>}</div>
                    </div>}
            </section>
        </main>
        <footer><span>CLUB CROWDS<span className="lime">.</span></span><p>For the love of football and the people in the stands.</p><small>DATA
            SOURCE: TRANSFERMARKT · HISTORICAL DATA MAY BE INCOMPLETE</small></footer>
    </>;
}

createRoot(document.getElementById('root')).render(<App/>);
