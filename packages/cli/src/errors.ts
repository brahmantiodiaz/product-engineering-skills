export class GyroError extends Error {
  constructor(readonly exitCode: 1 | 2, readonly lines: string[]) { super(lines.join('\n')); }
}
export const refused = (...lines: string[]) => new GyroError(1, lines);
export const usage = (...lines: string[]) => new GyroError(2, lines);
