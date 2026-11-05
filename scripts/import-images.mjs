// Copy only images referenced by the historical dataset. Preserve legacy filenames.
import {copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';

const data = JSON.parse(readFileSync('public/data/attendance.json', 'utf8'));
const destination = 'public/images';
mkdirSync(destination, {recursive: true});
const available = {};
let missing = 0;
for (const {logo} of [...data.clubs, ...data.league]) {
    if (!logo || !/^[\w.-]+$/.test(logo) || Object.hasOwn(available, logo)) continue;
    const original = `old-project/images/${logo}`;
    const base = `old-project/images/${logo.replace(/_\d+(?=\.[^.]+$)/, '')}`;
    const source = existsSync(original) ? original : existsSync(base) ? base : null;
    if (source) {
        copyFileSync(source, `${destination}/${logo}`);
        available[logo] = logo;
    } else {
        available[logo] = null;
        missing++;
    }
}
writeFileSync(`${destination}/manifest.json`, JSON.stringify(available));
console.log(`Copied ${Object.values(available).filter(Boolean).length} referenced images; ${missing} filenames have no local image.`);
