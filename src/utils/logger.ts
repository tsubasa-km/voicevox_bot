import fs from 'node:fs';
import path from 'node:path';
import { config } from '@/config.js';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const levelPriority: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const configuredLevel = config.logLevel;
const configuredPriority = levelPriority[configuredLevel];

let logStream: fs.WriteStream | null = null;
let resolvedLogPath: string | null = null;

try {
  resolvedLogPath = path.isAbsolute(config.logFilePath)
    ? config.logFilePath
    : path.resolve(process.cwd(), config.logFilePath);
  fs.mkdirSync(path.dirname(resolvedLogPath), { recursive: true });
  logStream = fs.createWriteStream(resolvedLogPath, { flags: 'a' });
} catch (error) {
  console.error('Failed to initialise log file', error);
  logStream = null;
}

function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] <= configuredPriority;
}

function serializeArgs(args: readonly unknown[]): string {
  return args
    .map((arg) => {
      if (arg instanceof Error) {
        const stack = arg.stack ?? `${arg.name}: ${arg.message}`;
        return stack;
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ');
}

function writeLog(level: LogLevel, message: string, args: unknown[]): void {
  if (!shouldLog(level)) {
    return;
  }

  const timestamp = new Date().toISOString();
  const trailing = args.length > 0 ? ` ${serializeArgs(args)}` : '';
  const line = `${timestamp} [${level.toUpperCase()}] ${message}${trailing}\n`;

  if (logStream) {
    logStream.write(line);
  }

  switch (level) {
    case 'error':
      console.error(message, ...args);
      break;
    case 'warn':
      console.warn(message, ...args);
      break;
    case 'info':
      console.info(message, ...args);
      break;
    case 'debug':
    default:
      console.debug(message, ...args);
      break;
  }
}

export const logger = {
  info(message: string, ...args: unknown[]): void {
    writeLog('info', message, args);
  },
  warn(message: string, ...args: unknown[]): void {
    writeLog('warn', message, args);
  },
  error(message: string, ...args: unknown[]): void {
    writeLog('error', message, args);
  },
  debug(message: string, ...args: unknown[]): void {
    writeLog('debug', message, args);
  },
  get logFilePath(): string | null {
    return resolvedLogPath;
  }
};

process.on('exit', () => {
  logStream?.end();
});
