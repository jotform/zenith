class Logger {
  logLevel: number;

  constructor() {
    this.logLevel = 2;
  }

  setLogLevel(level: number) {
    this.logLevel = level;
  }

  log(level: number, ...args: Array<unknown>) {
    // eslint-disable-next-line no-console
    if (this.logLevel >= level) console.log(...args);
  }
}

const singleton = new Logger();
export default singleton;
