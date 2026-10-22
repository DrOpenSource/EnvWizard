// Minimal stand-in for the `vscode` module so extension-layer code can be imported in Vitest.
// Tests assign the window/commands functions they need.
export const window: Record<string, unknown> = {};
export const workspace = { getConfiguration: () => ({ get: () => undefined }) };
export const commands: Record<string, unknown> = {};
export class EventEmitter<T> {
  event = (_listener: (e: T) => void) => ({ dispose() {} });
  fire(_e: T) {}
  dispose() {}
}
export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}
export enum TerminalShellExecutionCommandLineConfidence {
  Low = 0,
  Medium = 1,
  High = 2,
}
export enum ExtensionMode {
  Production = 1,
  Development = 2,
  Test = 3,
}
export enum QuickPickItemKind {
  Separator = -1,
  Default = 0,
}
export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}
export class Position {
  constructor(public line: number, public character: number) {}
}
export class Range {
  constructor(public start: Position, public end: Position) {}
}
export class Uri {
  constructor(public scheme: string, public fsPath: string, public query = '') {}
  static file(fsPath: string) {
    return new Uri('file', fsPath);
  }
  static from(parts: { scheme: string; path: string; query?: string }) {
    return new Uri(parts.scheme, parts.path, parts.query);
  }
  toString() {
    return `${this.scheme}:${this.fsPath}${this.query ? `?${this.query}` : ''}`;
  }
}
