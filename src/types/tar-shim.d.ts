declare module 'tar' {
  export function c(options: {
    file: string;
    cwd: string;
    gzip?: boolean;
    portable?: boolean;
    sync?: boolean;
  }, paths: string[]): Promise<void>;

  export function x(options: {
    file: string;
    cwd: string;
    gzip?: boolean;
    sync?: boolean;
  }): Promise<void>;
}
