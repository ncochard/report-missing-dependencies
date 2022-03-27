import { readPackageJson } from './package-json';

describe('readPackageJson', () => {
  it('reads the correct values', async () => {
    const cwd = './test-projects/test-project-1';
    const { dependencies, runtimeDependencies, typeDependencies } = await readPackageJson({ cwd });
    expect(dependencies).toEqual(['lodash']);
    expect(runtimeDependencies).toEqual(['lodash']);
    expect(typeDependencies).toEqual([]);
  });
});
