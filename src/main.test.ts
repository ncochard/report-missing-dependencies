import { processSourceFolder } from './main';

describe('processSourceFolder', () => {
  describe('test-project-1', () => {
    it('Returns no error when everything is fine', async () => {
      const cwd = './test-projects/test-project-1';
      const result = await processSourceFolder({ cwd });
      expect(result.errors).toEqual([]);
    });
  });
  describe('test-project-2', () => {
    it('Reports an error if the runtimeDependencies from the config file is not in the package.json', async () => {
      const cwd = './test-projects/test-project-2';
      const result = await processSourceFolder({ cwd });
      expect(result.errors).toEqual(['The package "http" is missing from the `dependencies` section of package.json.']);
    });
  });
  describe('test-project-3', () => {
    it('Reports a missing dependency', async () => {
      const cwd = './test-projects/test-project-3';
      const result = await processSourceFolder({ cwd });
      expect(result.errors.length).toEqual(1);
      expect(result.errors[0]).toMatch(/The package "lodash" is used in the module ".+index\.ts"\. But it is missing from the dependencies \(or peerDependencies\) in package\.json\./);
    });
  });
  describe('test-project-4', () => {
    it('Reports a missing dependency', async () => {
      const cwd = './test-projects/test-project-4';
      const result = await processSourceFolder({ cwd });
      expect(result.errors.length).toEqual(3);
      expect(result.errors[0]).toMatch(/Types from the package "react" are used in the module ".+index\.ts"\. But it is missing from the devDependencies in package\.json\./);
      expect(result.errors[1]).toMatch(/Types from the package "library-with-types" are used in the module ".+index\.ts"\. But it is missing from the devDependencies in package\.json\./);
      expect(result.errors[2]).toMatch(/The package "library-with-object" is used in the module ".+index\.ts"\. But it is missing from the dependencies \(or peerDependencies\) in package\.json\./);
    });
  });
  describe('test-project-5', () => {
    it('Reports devDependencies from a test file', async () => {
      const cwd = './test-projects/test-project-5';
      const result = await processSourceFolder({ cwd });
      expect(result.errors.length).toEqual(0);
    });
  });
});
