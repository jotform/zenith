import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const update = () => {
  const { projects } = JSON.parse(readFileSync(path.join(__dirname, '../workspace.json'), { encoding: 'utf-8' }));
  const projectsJSON = {};
  for (const key in projects) {
    const { root } = projects[key];
    projectsJSON[key] = root;
  }
  writeFileSync(path.join(__dirname, 'Projects.json'), JSON.stringify(projectsJSON));
}

update();
