// Minimal stand-in for the `vscode` module so extension-layer code can be imported in Vitest.
export const window = {};
export const workspace = { getConfiguration: () => ({ get: () => undefined }) };
export const commands = {};
export class EventEmitter<T> {
  event = (_listener: (e: T) => void) => ({ dispose() {} });
  fire(_e: T) {}
  dispose() {}
}
