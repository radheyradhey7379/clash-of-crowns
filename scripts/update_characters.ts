import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const file = path.join(__dirname, '../src/game/ai/aiCharacters.ts');
let content = fs.readFileSync(file, 'utf8');

// Replace simple -> hce
content = content.replace(/engine:\s*'simple'/g, "engine: 'hce'");
// Replace stockfish -> nnue
content = content.replace(/engine:\s*'stockfish'/g, "engine: 'nnue'");

// Replace blunderRate with errorNoiseCp
content = content.replace(/blunderRate:\s*([0-9.]+)/g, (match, p1) => {
  const val = parseFloat(p1);
  let noise = 100;
  if (val >= 0.3) noise = 200;
  else if (val >= 0.2) noise = 160;
  else if (val >= 0.1) noise = 80;
  else if (val > 0) noise = 40;
  else noise = 0;
  return `errorNoiseCp: ${noise}`;
});

fs.writeFileSync(file, content, 'utf8');
console.log("Updated aiCharacters.ts");
