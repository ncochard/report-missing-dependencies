import { readPackageJson } from './package-json';

describe('readPackageJson', () => {
  it('reads the correct values in test-project-1', async () => {
    const cwd = './test-projects/test-project-1';
    const { dependencies, peerDependencies, devDependencies } = await readPackageJson({ cwd });
    expect(dependencies).toEqual(['lodash']);
    expect(peerDependencies).toEqual([]);
    expect(devDependencies).toEqual([]);
  });
  it('reads the correct values in test-project-5', async () => {
    const cwd = './test-projects/test-project-5';
    const { dependencies, peerDependencies, devDependencies } = await readPackageJson({ cwd });
    expect(dependencies).toEqual(['react']);
    expect(peerDependencies).toEqual([]);
    expect(devDependencies).toEqual(['lodash']);
  });
});
