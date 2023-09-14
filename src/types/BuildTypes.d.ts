export interface ProjectStats {
  buildProject: string;
  time: [number, number];
}

export interface BuildParams {
  debug: boolean;
  compareWith: string;
  compareHash: boolean;
  logAffected: boolean;
  skipDependencies: boolean;
  debugLocation: string;
}

export interface PackageJsonType {
  name: string,
  author: string,
  license: string,
  packageManager: string,
  version: string,
  description: string,
  main: string,
  keywords: string[],
  bin: Record<string, string>,
  dependencies: object,
  devDependencies: object,
  files: string[],
  scripts: Record<string,string>,
}

export interface ExecError extends Error {
  status: number,
  signal: null | number,
  output: Array<null | string>,
  pid: number,
  stdout: string,
  stderr: string
}