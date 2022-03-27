import { resolve } from 'path';
import { rcFile } from 'rc-config-loader';
import { Config, defaultConfig } from './command';
import { configName } from './constants';

export function getConfig(input: Pick<Partial<Config>, 'cwd' | 'src'>): Partial<Config> {
  let configFile: Partial<Config>;
  if (input.cwd?.length > 0) {
    configFile = rcFile<Partial<Config>>(configName, { packageJSON: true, cwd: input.cwd })?.config || {};
  } else {
    configFile = rcFile<Partial<Config>>(configName, { packageJSON: true })?.config || {};
  }
  let src = input.src || defaultConfig.src;
  if (input.cwd) {
    src = resolve(input.cwd, src);
  } else {
    src = resolve(src);
  }
  return {
    ...defaultConfig, ...configFile, src,
  };
}

const same = (array1: string[], array2: string[]):boolean => array1.sort().join(',') === array2.sort().join(',');

function mergeIgnoredDependencies(commandLine: Partial<Config>, configFile: Partial<Config>): string[] {
  if (commandLine.ignoredDependencies?.length >= 0 && !same(commandLine.ignoredDependencies, defaultConfig.ignoredDependencies)) {
    return commandLine.ignoredDependencies;
  }
  if (configFile.ignoredDependencies?.length >= 0 && !same(configFile.ignoredDependencies, defaultConfig.ignoredDependencies)) {
    return configFile.ignoredDependencies;
  }
  return defaultConfig.ignoredDependencies;
}

function mergeRuntimeDependencies(commandLine: Partial<Config>, configFile: Partial<Config>): string[] {
  if (commandLine.runtimeDependencies?.length >= 0 && !same(commandLine.runtimeDependencies, defaultConfig.runtimeDependencies)) {
    return commandLine.runtimeDependencies;
  }
  if (configFile.runtimeDependencies?.length >= 0 && !same(configFile.runtimeDependencies, defaultConfig.runtimeDependencies)) {
    return configFile.runtimeDependencies;
  }
  return defaultConfig.runtimeDependencies;
}

function mergeSrc(commandLine: Partial<Config>, configFile: Partial<Config>): string {
  if (commandLine.src?.length >= 0 && commandLine.src !== defaultConfig.src) {
    return commandLine.src;
  }
  if (configFile.src?.length >= 0 && configFile.src !== defaultConfig.src) {
    return configFile.src;
  }
  return defaultConfig.src;
}

function mergeCwd(commandLine: Partial<Config>, configFile: Partial<Config>): string {
  if (commandLine.cwd?.length >= 0 && commandLine.cwd !== defaultConfig.cwd) {
    return commandLine.cwd;
  }
  if (configFile.cwd?.length >= 0 && configFile.cwd !== defaultConfig.cwd) {
    return configFile.cwd;
  }
  return defaultConfig.cwd;
}

export function mergeConfigs(commandLine: Partial<Config>, configFile: Partial<Config>): Config {
  const src = mergeSrc(commandLine, configFile);
  const cwd = mergeCwd(commandLine, configFile);
  return {
    ...defaultConfig,
    ...configFile,
    ...commandLine,
    ignoredDependencies: mergeIgnoredDependencies(commandLine, configFile),
    runtimeDependencies: mergeRuntimeDependencies(commandLine, configFile),
    src,
    cwd,
  };
}
