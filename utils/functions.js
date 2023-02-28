const { readFileSync, existsSync } = require('fs');

const readFileAsJSON = path => {
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, { encoding: 'utf-8' }));
  }
  return {};
}

module.exports = { readFileAsJSON };