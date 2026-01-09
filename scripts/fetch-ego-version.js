const https = require('https');
const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const README_PATH = path.join(PROJECT_DIR, '.github', 'README.md');
const EGO_ID = process.env.EGO_EXTENSION_ID;

if (!EGO_ID) {
    console.log('EGO_EXTENSION_ID not set; skipping GNOME Extensions version update.');
    process.exit(0);
}

const EGO_URL = `https://extensions.gnome.org/extension/${EGO_ID}/`;

function fetchPage(url) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

(async () => {
    try {
        const html = await fetchPage(EGO_URL);
        const versionMatch = html.match(/Latest Version\s*<\/dt>\s*<dd>([^<]+)<\/dd>/i);
        const gnomeMatch = html.match(/Shell Versions\s*<\/dt>\s*<dd>([^<]+)<\/dd>/i);

        const egoVersion = versionMatch ? versionMatch[1].trim() : 'Unknown';
        const gnomeVersions = gnomeMatch ? gnomeMatch[1].trim() : 'Unknown';

        const statusBadge = egoVersion === 'Unknown'
            ? '[![Status: Unknown](https://img.shields.io/badge/Status-Unknown-lightgrey)](' + EGO_URL + ')'
            : '[![Status: Live](https://img.shields.io/badge/Status-Live-brightgreen)](' + EGO_URL + ')';

        const block = `<!-- EGO-VERSION-START -->\n${statusBadge} ![EGO](https://img.shields.io/badge/EGO-v${egoVersion}-blue) ![GNOME](https://img.shields.io/badge/GNOME-${gnomeVersions.replace(/\s+/g, '')}-green)\n<!-- EGO-VERSION-END -->`;

        const readmeContent = fs.readFileSync(README_PATH, 'utf8');
        const regex = /<!-- EGO-VERSION-START -->[\s\S]*<!-- EGO-VERSION-END -->/;

        if (regex.test(readmeContent)) {
            const newContent = readmeContent.replace(regex, block);
            fs.writeFileSync(README_PATH, newContent);
            console.log('✅ README.md updated with GNOME Extensions version info.');
        } else {
            console.warn('⚠️ Could not find EGO-VERSION placeholders in README.md');
        }
    } catch (error) {
        console.error('❌ Error fetching GNOME Extensions version:', error);
        process.exit(1);
    }
})();
