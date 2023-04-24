export interface ProjectConfig {
  [key: string]: string;
}

export interface DebugJSON {
  [key: string]: string
}

export interface TargetValue {
  script: string,
  outputs: Array<string>,
  input?: string,
  constantDependencies?: Array<string>,
  compareRemoteHashes?: boolean
}

export interface TargetObject {
  [key: string]: TargetValue
}

export interface BuildConfig {
  [key: string]: TargetObject;
}

export interface ZenithConfigType {
  ignore: string[],
  appDirectories: string[]
  buildConfig: BuildConfig,
  projects: ProjectConfig,
}