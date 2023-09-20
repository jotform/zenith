declare module 'unzipper' {
  import { Writable } from 'stream';

  export function Extract(
    { path } : { path: string }
  ): Writable;
}
