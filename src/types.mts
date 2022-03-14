export interface CommandOptions {
  src: string;
  debug: boolean;
}

export interface Config {
  ignoredDependencies?: string[];
  runtimeDependencies?: string[];
}
