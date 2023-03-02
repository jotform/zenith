import { readFileSync, existsSync } from 'fs';

export default readFileAsJSON = path => {
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, { encoding: 'utf-8' }));
  }
  return {};
}
