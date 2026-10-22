// Prints the game's fixed spoken lines with their hashes, for tools/voice-build.py
import {fixedLines, hashText, normText} from '../simulator/voice-lines.js';
console.log(JSON.stringify(fixedLines().map(t => ({hash: hashText(t), text: normText(t)}))));
