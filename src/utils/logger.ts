/* eslint-disable no-console */
class Logger {
  logLevel: number;

  constructor() {
    this.logLevel = 2;
  }

  setLogLevel(level: number) {
    this.logLevel = level;
  }

  log(level: number, color?: string | unknown, ...args: Array<unknown>) {
    if (typeof color !== 'string') color = "\x1b[32m";
    if (this.logLevel >= level) console.log(`${color}${args.join(' ')}`, "\x1b[0m");
  }
}

const singleton = new Logger();
export default singleton;
