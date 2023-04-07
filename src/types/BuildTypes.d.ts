export interface ProjectStats {
  buildProject: string;
  time: [number, number];
}

export interface BuildParams {
  debug: boolean;
  compareWith: string;
  compareHash: boolean;
  logAffected: boolean;
  debugLocation: string;
}
