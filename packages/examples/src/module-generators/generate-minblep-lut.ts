import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import minBLEPLUT from './minBLEPLUT.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(__dirname, '../modules/lookup-tables/minBLEPLUT.8f4em');

await fs.writeFile(outputPath, `8f4e/v1\n\n${minBLEPLUT}\n`, 'utf8');

console.log(`Generated ${outputPath}`);
