import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_PATH = path.join(__dirname, '../../');

export const FLAGS = [
    '--project',
    '--target',
    '--debug'
]
