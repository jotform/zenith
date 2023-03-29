class Logger {
  constructor() {
    this.logLevel = 2;
  }
  setLogLevel(level) {
    this.logLevel = level;
  }

  log(level, ...args) {
    if (this.logLevel >= level) console.log(...args);
  }
}

const singleton = new Logger();
export default singleton;
