import { SAVE_AS_TXT_KEYWORD } from './constants';
import { ProjectStats } from '../types/BuildTypes';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

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
  const files = readdirSync(dirPath)

  arrayOfFiles = arrayOfFiles || []

  files.forEach(function(file) {
    if (statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles)
    } else {
      arrayOfFiles.push(join(__dirname, dirPath, "/", file))
    }
  })

  return arrayOfFiles
}

export const isEmpty = (path: string): boolean => {
  const arr: string[] = []
  return getAllFiles(path, arr).length === 0
}