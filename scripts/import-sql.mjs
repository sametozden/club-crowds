// Convert the complete SQL dump into a static frontend dataset, without a DB connection.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {englishLeagueName} from '../src/league-names.js';

const sql = readFileSync('database/club-crowds.sql', 'utf8');
const data = {};
for (const table of ['clubs', 'league', 'clubdata', 'leaguedata']) {
    const rows = [];
    const re = new RegExp('INSERT INTO `' + table + '` \\(([^)]+)\\) VALUES\\s*([\\s\\S]*?);', 'g');
    for (const match of sql.matchAll(re)) {
        const columns = [...match[1].matchAll(/`([^`]+)`/g)].map(x => x[1]);
        const tuples = match[2].matchAll(/\((('(?:\\.|[^'\\])*'|[^()])*)\)/g);
        for (const tuple of tuples) {
            const values = [...tuple[1].matchAll(/\s*('(?:\\.|[^'\\])*'|[^,]+)\s*(?:,|$)/g)].map(x => {
                const value = x[1].trim();
                if (value.startsWith("'")) return value.slice(1, -1).replace(/\\([\\'"nrt])/g, (_, c) => ({n: '\n', r: '\r', t: '\t'}[c] ?? c));
                return value === 'NULL' ? null : Number(value);
            });
            if (values.length !== columns.length) throw new Error(`Invalid ${table} row: ${tuple[0]}`);
            rows.push(Object.fromEntries(columns.map((column, i) => [column, values[i]])));
        }
    }
    if (!rows.length) throw new Error(`No ${table} records found`);
    data[table] = rows;
}
data.league = data.league.map(league => ({...league, title: englishLeagueName(league.title)}));
mkdirSync('public/data', {recursive: true});
writeFileSync('public/data/attendance.json', JSON.stringify(data));
console.log(Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length])));
