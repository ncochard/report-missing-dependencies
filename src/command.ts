import { program } from 'commander';
import { resolve } from 'path';
import { error } from './feedback';

const dedupe = (item: string, pos: number, list: string[]): boolean => list.indexOf(item) === pos;

export interface Config {
  src: string;
  cwd: string;
  ignoredDependencies: string[],
  runtimeDependencies: string[],
  debug: boolean;
}

export const defaultConfig: Config = {
  src: 'src',
  cwd: process.cwd(),
  ignoredDependencies: ['fs', 'http', 'net', 'url'],
  runtimeDependencies: [],
  debug: true,
};

export function getCommand(argv: string[] = process.argv): Config {
  const defaultCwd = process.cwd();
  program.option('--cwd <string>', 'Execution folder', process.cwd());
  program.option('--src <string>', 'Source folder', 'src');
  program.option('--ignoredDependencies <string...>', 'Packages that are used in the `src` folder (e.g. `import fs from "fs"`) but do not need to be added to the `dependencies` section of the `package.json`.', defaultConfig.ignoredDependencies.join(' '));
  program.option('--runtimeDependencies <string...>', 'Packages that are not used in an import statement in the `src` folder but still need to be specified in the `dependencies` section of the `package.json`.', defaultConfig.runtimeDependencies.join(' '));
  program.parse(argv);
  const options = program.opts();
  let cwd = `${options.cwd}`;
  if (cwd !== defaultCwd) {
    cwd = resolve('.', cwd);
  }
  const src = resolve(cwd, `${options.src}`);
  let ignoredDependencies = defaultConfig.ignoredDependencies || [];
  if (Array.isArray(options.ignoredDependencies)) {
    ignoredDependencies = options.ignoredDependencies as string[];
  }
  let runtimeDependencies = defaultConfig.runtimeDependencies || [];
  if (Array.isArray(options.runtimeDependencies)) {
    runtimeDependencies = options.runtimeDependencies as string[];
  }
  const debug: boolean = options.debug === true;
  if (!src) {
    error('Missing --src parameter');
  }
  return {
    src, debug, cwd, ignoredDependencies: ignoredDependencies.filter(dedupe), runtimeDependencies: runtimeDependencies.filter(dedupe),
  };
}
