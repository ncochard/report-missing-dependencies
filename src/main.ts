import glob from 'glob';
import { join } from 'path';
import throatFactory from 'throat';
import { parse as parseTs, ImportedPackageType } from 'parse-imports-ts';
import { error } from './feedback';
import { Config, getCommand } from './command';
import { getConfig, mergeConfigs } from './configuration';
import { readFileAsync } from './fs';
import { PackageJson, readPackageJson } from './package-json';

const MAX_NUMBER_OF_FILES_CONCURENTLY_OPENED = 50;
const throat = throatFactory(MAX_NUMBER_OF_FILES_CONCURENTLY_OPENED);

enum PackageType {
  NormalImport,
  DevImport,
}

enum FileType {
  Source,
  Test,
}

interface FileDetails {
  file: string, type: FileType
}

function convertType(packageType: ImportedPackageType, fileType: FileType): PackageType {
  switch (fileType) {
    case FileType.Test:
      return PackageType.DevImport;
    default:
      switch (packageType) {
        case ImportedPackageType.NormalImport:
          return PackageType.NormalImport;
        case ImportedPackageType.TypeImport:
          return PackageType.DevImport;
        default:
          throw new Error(`Type ${packageType} not supported`);
      }
  }
}

interface ImportDetails {
  name: string;
  files: string[];
  type: PackageType;
}

async function parseFileTs(file: FileDetails): Promise<ImportDetails[]> {
  const code = await readFileAsync(file.file);
  const result = parseTs(code, file.file);
  return result.map(({ name, type }) => ({ files: [file.file], name, type: convertType(type, file.type) }));
}

async function parseFile(file: FileDetails): Promise<ImportDetails[]> {
  try {
    return await parseFileTs(file);
  } catch (e) {
    error(`Could not parse "${file}"`);
    error(e);
    return [];
  }
}

const getFileList = (sourceFiles: string[], testFiles: string[]): FileDetails[] => sourceFiles.map((file): FileDetails => {
  const type = testFiles.includes(file) ? FileType.Test : FileType.Source;
  return { file, type };
});

async function getImportsForFiles(files: FileDetails[]): Promise<ImportDetails[]> {
  const imports = await Promise.all(
    files.map(
      (f: FileDetails): Promise<ImportDetails[]> => throat(() => parseFile(f)),
    ),
  );
  return imports.reduce(
    (acc: ImportDetails[], list: ImportDetails[]): ImportDetails[] => {
      list?.forEach((item) => {
        const newImport = acc.find((existing) => existing.name === item.name);
        if (newImport) {
          newImport.files = [...new Set([...newImport.files, ...item.files])];
          newImport.type = newImport.type === PackageType.NormalImport
            ? PackageType.NormalImport
            : item.type;
        } else {
          acc.push({ ...item, files: [...item.files] });
        }
      });
      return acc;
    },
    [] as ImportDetails[],
  );
}

const getFiles = (src: string) => (pattern: string) => new Promise<string[]>((resolve, reject) => {
  const forFiles = (err: Error, files: string[]) => {
    if (err) {
      reject(err);
    } else {
      resolve(files.map((f) => join(src, f)));
    }
  };
  glob(pattern, { cwd: src }, forFiles);
});

function getSourceFiles({
  src,
}: Pick<Config, 'src'>): Promise<string[]> {
  const pattern = '**/*.{ts,tsx,js,jsx,mjs,mts,cts}';
  return getFiles(src)(pattern);
}

async function getTestFiles({
  src, testMatch,
}: Pick<Config, 'src' | 'testMatch'>): Promise<string[]> {
  const lists: string[][] = await Promise.all(testMatch.map((pattern) => getFiles(src)(pattern)));
  let result: string[] = [];
  for (let i = 0; i < lists.length; i += 1) {
    result = [...new Set([...result, ...lists[i]])];
  }
  return result;
}

interface Errors {
  errors: string[];
  warnings: string[];
}

function getErrors(
  packageJson: PackageJson,
  imports: ImportDetails[],
  ignoredDependencies: string[],
  runtimeDependencies: string[],
): Errors {
  const result: Errors = { errors: [], warnings: [] };
  // Report any package used in the src folder that are not specified in the dependencies or peerDependencies.
  imports.forEach((i) => {
    if (i.type === PackageType.NormalImport) {
      if (packageJson.dependencies.includes(i.name)) {
        return;
      }
      if (packageJson.peerDependencies.includes(i.name)) {
        return;
      }
      if (ignoredDependencies.includes(i.name)) {
        return;
      }
      if (i.files.length === 1) {
        result.errors.push(
          `The package "${i.name}" is used in the module "${i.files[0]}". But it is missing from the dependencies (or peerDependencies) in package.json.`,
        );
      } else if (i.files.length > 1) {
        result.errors.push(
          `The package "${i.name}" is used in the module "${i.files[0]}" and ${
            i.files.length - 1
          } other modules. But it is missing from the dependencies (or peerDependencies) in package.json.`,
        );
      }
    }
    // Report any type package used in the src folder that are not specified in the devDependencies.
    if (i.type === PackageType.DevImport) {
      if (packageJson.devDependencies.includes(i.name)) {
        return;
      }
      if (ignoredDependencies.includes(i.name)) {
        return;
      }
      if (i.files.length === 1) {
        result.errors.push(
          `Types from the package "${i.name}" are used in the module "${i.files[0]}". But it is missing from the devDependencies in package.json.`,
        );
      } else if (i.files.length > 1) {
        result.errors.push(
          `Types from the package "${i.name}" are used in the module "${
            i.files[0]
          }" and ${
            i.files.length - 1
          } other modules. But it is missing from the devDependencies in package.json.`,
        );
      }
    }
  });
  // Report any package specified in the dependencies that are not used in the src folder.
  const usedImports = imports.map((i) => i.name);
  packageJson.dependencies.forEach((d) => {
    if (ignoredDependencies.includes(d)) {
      return;
    }
    if (runtimeDependencies.includes(d)) {
      return;
    }
    if (usedImports.includes(d)) {
      return;
    }
    result.errors.push(
      `The package "${d}" is in the \`dependencies\` of package.json, but it is not used in the source folder. Remove it or move it to the \`devDependencies\`.`,
    );
  });
  // Report any package that are not used in the src folder but still need to be added to the dependencies section of the package.json.
  runtimeDependencies.forEach((d) => {
    if (packageJson.dependencies.includes(d)) {
      return;
    }
    result.errors.push(
      `The package "${d}" is missing from the \`dependencies\` section of package.json.`,
    );
  });
  return result;
}

export async function processSourceFolder(commandLine: Partial<Config>): Promise<Errors> {
  const configFile = getConfig(commandLine);
  const config = mergeConfigs(commandLine, configFile);
  const pkgJsonPromise = readPackageJson(config);
  const [sourceFiles, testFiles] = await Promise.all([getSourceFiles(config), getTestFiles(config)]);
  const files = getFileList(sourceFiles, testFiles);
  const imports = await getImportsForFiles(files);
  const packageJson = await pkgJsonPromise;
  return getErrors(
    packageJson,
    imports,
    config?.ignoredDependencies || [],
    config?.runtimeDependencies || [],
  );
}

export async function main(): Promise<void> {
  const commandLine = getCommand();
  const { errors } = await processSourceFolder(commandLine);
  errors.forEach((e) => error(e));
  if (errors.length > 0) {
    process.exit(1);
  }
}
