import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../user-counts.json', import.meta.url);
const counts = JSON.parse(await readFile(path, 'utf8'));

export function parseCount(value) {
    const match = String(value).trim().match(/^(\d+(?:,\d{3})*(?:\.\d+)?)\s*([km])?\+?$/i);
    if (!match) throw new Error('Invalid user count');
    const multiplier = { k: 1000, m: 1000000 }[match[2]?.toLowerCase()] || 1;
    const count = Math.round(Number(match[1].replaceAll(',', '')) * multiplier);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid user count');
    return count;
}

async function fetchJson(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

const sources = {
    chrome: async () => {
        const data = await fetchJson('https://img.shields.io/chrome-web-store/users/bkhjomondpmkjohilihdldfjmhpgkhcm.json');
        if (data.isError) throw new Error('Chrome count unavailable');
        return parseCount(data.value ?? data.message);
    },
    firefox: async () => {
        const data = await fetchJson('https://addons.mozilla.org/api/v5/addons/addon/youtube-fast-forward-rewind/');
        return parseCount(data.average_daily_users);
    },
};

for (const [browser, load] of Object.entries(sources)) {
    try {
        counts[browser] = { users: await load(), updatedAt: new Date().toISOString() };
        console.log(`${browser}: ${counts[browser].users}`);
    } catch (error) {
        console.warn(`${browser}: keeping saved count (${error.message})`);
    }
}
await writeFile(path, JSON.stringify(counts, null, 2) + '\n');
