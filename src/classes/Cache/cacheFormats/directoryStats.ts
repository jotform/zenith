import * as fsp from 'fs/promises';
import path = require('path');

export type DirectoryFileStats = {
  fileCount: number;
  totalBytes: number;
  maxFileBytes: number;
};

export const listFilesRecursively = async (
  directoryPath: string,
): Promise<Array<{ absolutePath: string; relativePath: string; size: number }>> => {
  const allFiles: Array<{ absolutePath: string; relativePath: string; size: number }> = [];

  const walk = async (currentDir: string) => {
    const entries = await fsp.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      const stats = await fsp.stat(absolutePath);
      const relativePath = path.relative(directoryPath, absolutePath).split(path.sep).join('/');
      allFiles.push({ absolutePath, relativePath, size: stats.size });
    }
  };

  await walk(directoryPath);
  return allFiles;
};

export const getDirectoryFileStats = async (directoryPath: string): Promise<DirectoryFileStats> => {
  const files = await listFilesRecursively(directoryPath);
  let totalBytes = 0;
  let maxFileBytes = 0;
  for (const f of files) {
    totalBytes += f.size;
    if (f.size > maxFileBytes) maxFileBytes = f.size;
  }
  return {
    fileCount: files.length,
    totalBytes,
    maxFileBytes,
  };
};
