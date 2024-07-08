import { readFile } from 'fs/promises';
import path from 'path';
import { ROOT_PATH } from '../../utils/constants';
import Logger from '../../utils/logger';
import ConfigHelper from '../../classes/ConfigHelper';
import { PackageJsonType } from '../../types/BuildTypes';

type Node = {
  id: string;
  height: number;
  path: string;
}

type Link = {
  source: string;
  target: string;
  value: number;
}

export default class Graph {
  projects: Map<string, {path: string, dependencies: Set<string>}> = new Map();
  nodes: Node[] = [];
  links: Link[] = [];

  async addProject(project: string): Promise<void> {
    if (!this.projects.has(project) && project && ConfigHelper.projects[project]) {
      try {
        const root = ConfigHelper.projects[project] || '';
        const packageJSONString = await readFile(path.join(ROOT_PATH, root, 'package.json'), { encoding: 'utf-8' });
        const packageJSON = JSON.parse(packageJSONString) as PackageJsonType;
        const allDependencies: Record<string, string> = { ...packageJSON.dependencies, ...packageJSON.devDependencies };
        const dependencyArray = Object.keys(allDependencies);

        this.projects.set(project, {path: root, dependencies: new Set(dependencyArray.filter(i => ConfigHelper.projects[i]))});
        const projectAdditions = dependencyArray.map(async (dependency) => {
          await this.addProject(dependency);
        });
        await Promise.all(projectAdditions);
      } catch (error) {
        if (error instanceof Error) {
          Logger.log(2, 'Package.json file not found in the project!');
          throw error;
        } else {
          throw error;
        }
      }
    }
  }

  async buildAll(): Promise<void> {
    const allProjects = Object.keys(ConfigHelper.projects);
    const projectAdditionPromisses = allProjects.map(async (project) => {
      await this.addProject(project);
    });
    await Promise.all(projectAdditionPromisses);
  }

  getProjectHeight(searchedProject: string): number {
    const parentMap = new Map<string, Set<string>>();
  
    for (const [child, { dependencies }] of this.projects.entries()) {
      for (const parent of dependencies) {
        if (!parentMap.has(parent)) {
          parentMap.set(parent, new Set<string>());
        }
        const parentEntry = parentMap.get(parent);
        if (!parentEntry) {
          throw new Error("Parent entry not found!");
        }
        parentEntry.add(child);
      }
    }

    // Identify root nodes (nodes with no parents)
    const rootNodes = new Set<string>(this.projects.keys());
    for (const children of this.projects.values()) {
      for (const child of children.dependencies) {
        rootNodes.delete(child);
      }
    }

    // Perform BFS to find the distance from the root node
    const queue: [string, number][] = [[searchedProject, 0]];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const queueElement = queue.shift();
      if (!queueElement) throw new Error("No queue element!");
      const [currentProject, depth] = queueElement;
      
      if (rootNodes.has(currentProject)) {
        return depth;
      }
      
      if (visited.has(currentProject)) {
        continue;
      }
      
      visited.add(currentProject);
      
      if (parentMap.has(currentProject)) {
        const projectMap = parentMap.get(currentProject);
        if (!projectMap) throw new Error("Project does not have a dependency map!");
        for (const parent of projectMap) {
          queue.push([parent, depth + 1]);
        }
      }
    }

    return -1; // In case the project is not connected to any root
  }

  constructGraph(): void {
    this.projects.forEach(({path, dependencies}, project) => {
      if (this.nodes.filter(n => n.id === project).length === 0) {
        this.nodes.push({ id: project, height: this.getProjectHeight(project), path});
      }
      dependencies.forEach(dep => {
        if (this.links.filter(l => l.target === dep && l.source === project).length === 0) {
          this.links.push({ target: dep, source: project, value: 1});
        }
      });
    });
  }
}
