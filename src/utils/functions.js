import { readFileSync, existsSync } from 'fs';

const readFileAsJSON = path => {
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, { encoding: 'utf-8' }));
  }
  return {};
}
export default readFileAsJSON;