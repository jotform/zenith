import { SAVE_AS_TXT_KEYWORD } from './constants';
import { ProjectStats, PackageJsonType } from '../types/BuildTypes';
import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';

export const formatTimeDiff = (time: [number, number]): string => {
  const seconds = (time[0] + time[1] / 1e9);
  if (seconds > 60) {
    const minutes = Math.floor(seconds / 60);
    return `(${minutes}m ${(seconds % 60).toFixed(3)}s)`;
  }
  return `(${seconds.toFixed(3)}s)`;
};

export const formatMissingProjects = (missingProjects: Array<ProjectStats>): string => missingProjects.reduce((acc, curr) => {
  return `${acc}\n${curr.buildProject} ${formatTimeDiff(curr.time)}`;
}, '');

// output is expected to be a string or array of strings
export const isOutputTxt = (output: string | Array<string>): boolean => {
  if (typeof output === 'string') return output === SAVE_AS_TXT_KEYWORD;
  return output.includes(SAVE_AS_TXT_KEYWORD);
};

const getAllFiles = (dirPath: string, arrayOfFiles: string[]) => {
  const files = readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(join(__dirname, dirPath, "/", file));
    }
  });

  return arrayOfFiles;
};

export const isEmpty = (path: string): boolean => {
  const arr: string[] = [];
  return getAllFiles(path, arr).length === 0;
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