const fs = require('fs');
const content = fs.readFileSync('src/views/MatchIntelligenceTab.tsx', 'utf8');

let depth = 0;
let lineNum = 1;
for (let i = 0; i < content.length; i++) {
  if (content[i] === '\n') lineNum++;
  if (content[i] === '{') depth++;
  if (content[i] === '}') {
    depth--;
    if (depth < 0) {
      console.log(`Unmatched } at line ${lineNum}`);
      depth = 0;
    }
  }
}
console.log(`Final depth: ${depth}`);
