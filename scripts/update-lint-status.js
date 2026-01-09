const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_DIR = path.resolve(__dirname, '..');
const README_PATH = path.join(PROJECT_DIR, '.github', 'README.md');

console.log('Running linter for README update...');

let lintOutput = '';
let statusIcon = '✅';
let statusText = 'Passing';
let exitCode = 0;

try {
    lintOutput = execSync('npm run lint', { cwd: PROJECT_DIR, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
} catch (error) {
    lintOutput = (error.stdout || '') + (error.stderr || '') || error.message;
    exitCode = error.status || 1;
    statusIcon = '❌';
    statusText = 'Failed';
}

const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

const errorCount = (lintOutput.match(/(\d+) error/) || ['0', '0'])[1];
const warningCount = (lintOutput.match(/(\d+) warning/) || ['0', '0'])[1];

const markdownBlock = `<!-- LINT-RESULT-START -->
### Latest Linting Result
> **Status**: ${statusIcon} **${statusText}**  
> **Date**: ${timestamp}  
> **Summary**: ${errorCount} errors, ${warningCount} warnings

<details>
<summary>Click to view full lint output</summary>

\`\`\`
${lintOutput.trim()}
\`\`\`

</details>
<!-- LINT-RESULT-END -->`;

try {
    const readmeContent = fs.readFileSync(README_PATH, 'utf8');
    const regex = /<!-- LINT-RESULT-START -->[\s\S]*<!-- LINT-RESULT-END -->/;

    if (regex.test(readmeContent)) {
        const newContent = readmeContent.replace(regex, markdownBlock);
        fs.writeFileSync(README_PATH, newContent);
        console.log(`✅ README.md updated with lint results (${statusText})`);
    } else {
        console.warn('⚠️ Could not find LINT-RESULT placeholders in README.md');
    }
} catch (error) {
    console.error('❌ Error updating README:', error);
    process.exit(1);
}

if (exitCode !== 0) {
    console.warn('⚠️ Linting failed, but README was updated.');
}
