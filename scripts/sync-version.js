const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(PROJECT_DIR, 'package.json');
const README_PATH = path.join(PROJECT_DIR, '.github', 'README.md');
const CHANGELOG_PATH = path.join(PROJECT_DIR, '.github', 'CHANGELOG.md');
const MESON_PATH = path.join(PROJECT_DIR, 'meson.build');

try {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    const majorVersion = parseInt(pkg.version.split('.')[0], 10);

    if (Number.isNaN(majorVersion))
        throw new Error('Invalid version in package.json');

    // Update meson.build version
    let mesonContent = fs.readFileSync(MESON_PATH, 'utf8');
    mesonContent = mesonContent.replace(/version:\s*'[^']+'/g, `version: '${majorVersion}'`);
    fs.writeFileSync(MESON_PATH, mesonContent);

    // Extract latest changes from CHANGELOG.md
    const changelogContent = fs.readFileSync(CHANGELOG_PATH, 'utf8');
    let latestChanges = '';
    let latestHeader = `Latest Update (v${majorVersion})`;

    const unreleasedRegex = /##\s+Unreleased([\s\S]*?)(?=\n##\s+|$)/;
    const unreleasedMatch = changelogContent.match(unreleasedRegex);
    if (unreleasedMatch && unreleasedMatch[1]) {
        latestChanges = unreleasedMatch[1]
            .trim()
            .split('\n')
            .filter(line => line.startsWith('-'))
            .join('\n');
    } else {
        const versionRegex = new RegExp(`##\s+v${majorVersion}\\b([\\s\\S]*?)(?=\\n##\\s+|$)`);
        const versionMatch = changelogContent.match(versionRegex);
        if (versionMatch && versionMatch[1]) {
            latestChanges = versionMatch[1]
                .trim()
                .split('\n')
                .filter(line => line.startsWith('-'))
                .join('\n');
        }
    }

    if (!latestChanges)
        latestChanges = '- Pending release notes.';

    // Update README badges and latest update section
    let readmeContent = fs.readFileSync(README_PATH, 'utf8');
    readmeContent = readmeContent.replace(/Version-\d+-green/g, `Version-${majorVersion}-green`);

    const latestUpdateSection = `### ${latestHeader}\n${latestChanges}`;
    const latestVersionRegex = /<!-- LATEST-VERSION-START -->[\s\S]*?<!-- LATEST-VERSION-END -->/;
    readmeContent = readmeContent.replace(
        latestVersionRegex,
        `<!-- LATEST-VERSION-START -->\n${latestUpdateSection}\n<!-- LATEST-VERSION-END -->`
    );

    fs.writeFileSync(README_PATH, readmeContent);
    console.log('✅ Version sync complete!');
} catch (error) {
    console.error('❌ Error during version sync:', error);
    process.exit(1);
}
