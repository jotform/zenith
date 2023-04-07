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
  constantDependencies?: Array<string>
}

export interface TargetObject {
  [key: string]: TargetValue
}

export interface BuildConfig {
  [key: string]: TargetObject;
}
