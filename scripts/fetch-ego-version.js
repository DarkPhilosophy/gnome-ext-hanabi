const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const README_PATH = path.join(PROJECT_DIR, '.github', 'README.md');

const UPSTREAM_REPO = 'jeffshee/gnome-ext-hanabi';
const UPSTREAM_URL = `https://github.com/${UPSTREAM_REPO}`;

const block = `<!-- EGO-VERSION-START -->\n[![Upstream Last Commit](https://img.shields.io/github/last-commit/${UPSTREAM_REPO})](${UPSTREAM_URL})\n<!-- EGO-VERSION-END -->`;

try {
    const readmeContent = fs.readFileSync(README_PATH, 'utf8');
    const regex = /<!-- EGO-VERSION-START -->[\s\S]*<!-- EGO-VERSION-END -->/;

    if (regex.test(readmeContent)) {
        const newContent = readmeContent.replace(regex, block);
        fs.writeFileSync(README_PATH, newContent);
        console.log('✅ README.md updated with upstream last-commit badge.');
    } else {
        console.warn('⚠️ Could not find EGO-VERSION placeholders in README.md');
    }
} catch (error) {
    console.error('❌ Error updating README:', error);
    process.exit(1);
}
