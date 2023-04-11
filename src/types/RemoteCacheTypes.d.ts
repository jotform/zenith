declare module 'zip-local' {
  export interface Zipped {
    compress(): void;
    memory(): Buffer;
  }

  export function zip(
    directoryPath: string,
    callback: (error: string, zipped: Zipped) => void,
  ): void;
}

declare module 'unzipper' {
  import { Writable } from 'stream';

  export function Extract(
    { path } : { path: string }
  ): Writable;
}
