export type CommandExecutionOutput = {
  output: string;
  execTime?: [number, number];
  cacheTime?: [number, number];
}

export type CacheRecoveryOutput = {
  result: boolean | string;
  time: [number, number];
}