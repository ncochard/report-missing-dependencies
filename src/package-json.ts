import { resolve } from 'path';
import { readFileAsync } from './fs';

export interface PackageJson {
  runtimeDependencies: string[];
  typeDependencies: string[];
  dependencies: string[];
}

export async function readPackageJson({ cwd }: { cwd: string }): Promise<PackageJson> {
  const code = await readFileAsync(resolve(cwd, 'package.json'));
  const pkg = JSON.parse(code);
  const dependencies = pkg.dependencies ? Object.keys(pkg.dependencies) : [];
  const devDependencies = pkg.devDependencies
    ? Object.keys(pkg.devDependencies)
    : [];
  const peerDependencies = pkg.peerDependencies
    ? Object.keys(pkg.peerDependencies)
    : [];
  const runtimeDependencies = [
    ...new Set([...dependencies, ...peerDependencies]),
  ];
  const typeDependencies = devDependencies;
  return { runtimeDependencies, typeDependencies, dependencies };
}
