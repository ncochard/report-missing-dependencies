import { resolve } from 'path';
import { Config, defaultConfig } from './command';
import { getConfig, mergeConfigs } from './configuration';

describe('getConfig', () => {
  it('gets the default values', () => {
    const cwd = '.';
    const config = getConfig({ cwd });
    expect(config.ignoredDependencies).toEqual(['fs', 'http', 'net', 'url']);
    expect(config.runtimeDependencies).toEqual([]);
    expect(config.cwd).toEqual(process.cwd());
    expect(config.src).toEqual(resolve('src'));
  });
  it('reads from the package.json', () => {
    const cwd = './test-projects/test-project-2';
    const config = getConfig({ cwd });
    expect(config.ignoredDependencies).toEqual(['url']);
    expect(config.runtimeDependencies).toEqual(['http']);
  });
});

describe('mergeConfigs', () => {
  it('uses default values', () => {
    const commandLine: Partial<Config> = {
    };
    const configFile: Partial<Config> = {
    };
    const config = mergeConfigs(commandLine, configFile);
    expect(config.ignoredDependencies).toEqual(defaultConfig.ignoredDependencies);
    expect(config.runtimeDependencies).toEqual(defaultConfig.runtimeDependencies);
    expect(config.src).toEqual(defaultConfig.src);
    expect(config.cwd).toEqual(defaultConfig.cwd);
  });
  it('command line arguments override configuration file', () => {
    const commandLine: Partial<Config> = {
      ignoredDependencies: ['http'],
      runtimeDependencies: ['net'],
      src: 'dist/cjs',
    };
    const configFile: Partial<Config> = {
      ignoredDependencies: ['net'],
      runtimeDependencies: ['fs'],
      src: 'dist/mjs',
    };
    const config = mergeConfigs(commandLine, configFile);
    expect(config.ignoredDependencies).toEqual(['http']);
    expect(config.runtimeDependencies).toEqual(['net']);
    expect(config.src).toEqual('dist/cjs');
  });
  it('configuration file overrides default values', () => {
    const commandLine: Partial<Config> = defaultConfig;
    const configFile: Partial<Config> = {
      ignoredDependencies: ['net'],
      runtimeDependencies: ['fs'],
      src: 'dist',
    };
    const config = mergeConfigs(commandLine, configFile);
    expect(config.ignoredDependencies).toEqual(['net']);
    expect(config.runtimeDependencies).toEqual(['fs']);
    expect(config.src).toEqual('dist');
  });
});
