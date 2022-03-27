import { processSourceFolder } from './main';

describe('processSourceFolder', () => {
  describe('test-project-1', () => {
    it('Returns no error when everything is fine', async () => {
      const cwd = './test-projects/test-project-1';
      const result = await processSourceFolder({ cwd });
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });
  describe('test-project-2', () => {
    it('Reports an error if the runtimeDependencies from the config file is not in the package.json', async () => {
      const cwd = './test-projects/test-project-2';
      const result = await processSourceFolder({ cwd });
      expect(result.errors).toEqual(['The package "http" is missing from the `dependencies` section of package.json.']);
      expect(result.warnings).toEqual([]);
    });
  });
  describe('test-project-3', () => {
    it('Reports a missing dependency', async () => {
      const cwd = './test-projects/test-project-3';
      const result = await processSourceFolder({ cwd });
      expect(result.warnings).toEqual([]);
      expect(result.errors.length).toEqual(1);
      expect(result.errors[0]).toMatch(/The package "lodash" is used in the module ".+index\.ts"; but it is missing from the dependencies in package\.json\./);
    });
  });
  describe('test-project-4', () => {
    it('Reports a missing dependency', async () => {
      const cwd = './test-projects/test-project-4';
      const result = await processSourceFolder({ cwd });
      expect(result.warnings).toEqual([]);
      expect(result.errors.length).toEqual(1);
      expect(result.errors[0]).toMatch(/Types from the package "react" are used in the module ".+index\.ts". But it is missing from the devDependencies in package\.json\./);
    });
  });
});
