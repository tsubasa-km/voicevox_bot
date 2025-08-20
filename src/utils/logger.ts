export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private static logLevel: LogLevel = LogLevel.INFO;

  static setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  static debug(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${this.formatMessage(message)}`, ...args);
    }
  }

  static info(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.INFO) {
      console.info(`[INFO] ${this.formatMessage(message)}`, ...args);
    }
  }

  static warn(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.WARN) {
      console.warn(`[WARN] ${this.formatMessage(message)}`, ...args);
    }
  }

  static error(message: string, error?: Error, ...args: any[]): void {
    if (this.logLevel <= LogLevel.ERROR) {
      console.error(`[ERROR] ${this.formatMessage(message)}`, error || "", ...args);
    }
  }

  private static formatMessage(message: string): string {
    const timestamp = new Date().toISOString();
    return `${timestamp} - ${message}`;
  }
}
