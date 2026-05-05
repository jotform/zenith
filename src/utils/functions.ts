import { SAVE_AS_TXT_KEYWORD } from './constants';
import { ProjectStats, PackageJsonType, MissingProjectStats } from '../types/BuildTypes';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';

/** Zip streams (e.g. JSZip generateNodeStream) may not pass `instanceof Readable` in all runtimes. */
export function isReadableStreamBody(body: string | Buffer | Readable | unknown): body is Readable {
  if (body === null || typeof body !== 'object') return false;
  if (Buffer.isBuffer(body)) return false;
  if (typeof body === 'string') return false;
  const maybe = body as NodeJS.ReadableStream;
  return typeof maybe.pipe === 'function';
}

export const formatTimeDiff = (time: [number, number]): string => {
  const seconds = (time[0] + time[1] / 1e9);
  if (seconds > 60) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${(seconds % 60).toFixed(3)}s`;
  }
  return `${seconds.toFixed(3)}s`;
};

export const formatMissingProjects = (missingProjects: Array<ProjectStats | MissingProjectStats>, name: string): Array<{[key: string]: string}> =>  missingProjects.map((project => {
  if ('time' in project && project.time) {
    return { [name]: project.buildProject, "Time": formatTimeDiff(project.time) };
  }
  if ('execTime' in project && project.execTime && project.cacheTime) {
    const totalTime: [number, number] = [project.execTime[0] + project.cacheTime[0], project.execTime[1] + project.cacheTime[1]];
    return { [name]: project.buildProject, 'Total Time': formatTimeDiff(totalTime), 'Execution Time': formatTimeDiff(project.execTime), 'Cache Time': formatTimeDiff(project.cacheTime)};
  }
  return { [name]: project.buildProject};
}));

// output is expected to be a string or array of strings
export const isOutputTxt = (output: string | Array<string>): boolean => {
  if (typeof output === 'string') return output === SAVE_AS_TXT_KEYWORD;
  return output.includes(SAVE_AS_TXT_KEYWORD);
};

/**
 * True when the directory tree rooted at `dirPath` contains no non-directory
 * paths (same rule as the old recursive walker: anything that is not a
 * directory counts as a "file"). Exits as soon as one such path is found
 * instead of enumerating every file in the tree.
 */
export const isEmpty = (dirPath: string): boolean => {
  const stack: string[] = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    let names: string[];
    try {
      names = readdirSync(current);
    } catch {
      return true;
    }
    for (const name of names) {
      const full = join(current, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) stack.push(full);
      else return false;
    }
  }
  return true;
};

export const getMissingRequiredFiles = (path: string, requiredFiles: string[] | undefined): string[] => {
  if (!requiredFiles) return [];
  const nonExistantFiles: string[] = [];
  requiredFiles.forEach(filePath => {
    if (!existsSync(`${path}/${filePath}`)) nonExistantFiles.push(filePath);
  });
  return nonExistantFiles;
};

export const isCommandDummy = (commandPath: string, command: string): boolean => {
  const packageJSONPath = join(commandPath, "package.json");
  const packageJSON = JSON.parse(readFileSync(packageJSONPath, {encoding: 'utf8'})) as PackageJsonType;
  const commandValue = packageJSON.scripts[command];
  if (commandValue === 'true') return true;
  return false;
};

export const readableToBuffer = async (readable: Readable): Promise<Buffer> => {
  const chunks: Array<Buffer> = [];
  return new Promise((resolve, reject) => {
    readable.on('data', (chunk: Buffer) => {
      chunks.push(Buffer.from(chunk));
    });
    readable.on('error', (err: Error) => reject(err));
    readable.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
};

export const deepCloneMap = <K>(map: Map<K, Set<string>>): Map<K, Set<string>> => {
  const newMap = new Map<K, Set<string>>();
  map.forEach((value, key) => {
    newMap.set(key, new Set(JSON.parse(JSON.stringify(Array.from(value))) as string[]));
  });
  return newMap;
};
