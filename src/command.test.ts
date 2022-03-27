import { resolve } from 'path';
import { defaultConfig, getCommand } from './command';

describe('getCommand', () => {
  it('finds the default values', () => {
    const {
      cwd, src, ignoredDependencies, runtimeDependencies,
    } = getCommand();
    expect(cwd).toEqual(process.cwd());
    expect(src).toEqual(resolve('./src'));
    expect(ignoredDependencies).toEqual(defaultConfig.ignoredDependencies);
    expect(runtimeDependencies).toEqual(defaultConfig.runtimeDependencies);
  });
  it('find the correct src folder', () => {
    const cwd = './test-projects/test-project-1';
    const command = getCommand([
      'node.exe',
      'report-missing-dependencies.js',
      '--cwd', cwd,
    ]);
    expect(command.cwd).toEqual(resolve(cwd));
    expect(command.src).toEqual(resolve(cwd, 'src'));
  });
  it('parses the correct ignoredDependencies', () => {
    const command = getCommand([
      'node.exe',
      'report-missing-dependencies.js',
      '--ignoredDependencies', 'lodash', 'fs', 'url',
    ]);
    expect(command.ignoredDependencies).toEqual(['lodash', 'fs', 'url']);
  });
  it('parses the correct runtimeDependencies', () => {
    const command = getCommand([
      'node.exe',
      'report-missing-dependencies.js',
      '--runtimeDependencies', 'url',
    ]);
    expect(command.runtimeDependencies).toEqual(['url']);
  });
});
