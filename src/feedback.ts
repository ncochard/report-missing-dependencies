import chalk from 'chalk';
import { projectName } from './constants';

const n = chalk.bold(`[${projectName}]`);
const f = chalk.dim(`(${process.cwd()})`);
const r = (text: string) => chalk.red(text);
const o = (text: string) => chalk.magenta(text);

export function debug(message: string): void {
  process.stdout.write(`${n} ${message} ${f}\n`);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function error(message: any): void {
  if (typeof message === 'string') {
    process.stdout.write(`${n} ${r('ERR')} ${message} ${f}\n`);
  } else {
    // eslint-disable-next-line no-console
    console.error(message);
  }
}
export function warn(message: string): void {
  process.stdout.write(`${n} ${o('WARN')} ${message} ${f}\n`);
}
