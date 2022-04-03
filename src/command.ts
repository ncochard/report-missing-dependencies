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
  testMatch: string[],
}

export const defaultConfig: Config = {
  src: 'src',
  cwd: process.cwd(),
  ignoredDependencies: ['fs', 'http', 'net', 'url'],
  runtimeDependencies: [],
  debug: true,
  testMatch: [
    '**/__tests__/**/*.?(m)[jt]s?(x)',
    '**/?(*.)+(spec|test).?(m)[jt]s?(x)'],
};

export function getCommand(argv: string[] = process.argv): Config {
  const defaultCwd = process.cwd();
  program.option('--cwd <string>', 'Execution folder', process.cwd());
  program.option('--src <string>', 'Source folder', defaultConfig.src);
  program.option('--ignoredDependencies <string...>', 'Packages that are used in the `src` folder (e.g. `import fs from "fs"`) but do not need to be added to the `dependencies` section of the `package.json`.', defaultConfig.ignoredDependencies.join(' '));
  program.option('--runtimeDependencies <string...>', 'Packages that are not used in an import statement in the `src` folder but still need to be specified in the `dependencies` section of the `package.json`.', defaultConfig.runtimeDependencies.join(' '));
  program.option('--testMatch <string...>', 'The glob patterns uses to detect test files.', defaultConfig.testMatch.join(' '));
  program.parse(argv);
  const options = program.opts<Config>();
  let { cwd } = options;
  if (cwd !== defaultCwd) {
    cwd = resolve('.', cwd);
  }
  const src = resolve(cwd, options.src);
  let ignoredDependencies = defaultConfig.ignoredDependencies || [];
  if (Array.isArray(options.ignoredDependencies)) {
    ignoredDependencies = options.ignoredDependencies as string[];
  }
  let runtimeDependencies = defaultConfig.runtimeDependencies || [];
  if (Array.isArray(options.runtimeDependencies)) {
    runtimeDependencies = options.runtimeDependencies as string[];
  }
  let testMatch = defaultConfig.testMatch || [];
  if (Array.isArray(options.testMatch)) {
    testMatch = options.testMatch as string[];
  }
  const debug: boolean = options.debug === true;
  if (!src) {
    error('Missing --src parameter');
  }
  return {
    src,
    debug,
    cwd,
    ignoredDependencies: ignoredDependencies.filter(dedupe),
    runtimeDependencies: runtimeDependencies.filter(dedupe),
    testMatch: testMatch.filter(dedupe),
  };
}
