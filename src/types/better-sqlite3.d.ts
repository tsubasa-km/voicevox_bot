declare module 'better-sqlite3' {
  export interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export interface Statement<Params extends unknown[] = unknown[], Result = unknown> {
    readonly reader: boolean;
    all(...params: Params): Result[];
    run(...params: Params): RunResult;
  }

  export default class Database {
    constructor(path: string, options?: { readonly?: boolean; fileMustExist?: boolean; timeout?: number });
    prepare<T = unknown>(sql: string): Statement<unknown[], T>;
    pragma(source: string): unknown;
    close(): void;
  }
}
