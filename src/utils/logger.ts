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
    if (this.logLevel < level) return;
    // Callers may skip the color argument and pass a value straight through
    // (e.g. an Error). Treat a non-string first argument as part of the message
    // instead of dropping the whole line.
    const prefix = typeof color === 'string' ? color : '';
    const rest: Array<unknown> = typeof color === 'string' ? args : [color, ...args];
    console.log(`${prefix}${rest.join(' ')}`, "\x1b[0m");
  }
}

const singleton = new Logger();
export default singleton;
