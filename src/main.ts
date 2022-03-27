import glob from 'glob';
import { join } from 'path';
import throatFactory from 'throat';
import { parse as parseTs, ImportedPackageType } from 'parse-imports-ts';
import { error, warn } from './feedback';
import { Config, getCommand } from './command';
import { getConfig, mergeConfigs } from './configuration';
import { readFileAsync } from './fs';
import { PackageJson, readPackageJson } from './package-json';

const MAX_NUMBER_OF_FILES_CONCURENTLY_OPENED = 50;
const throat = throatFactory(MAX_NUMBER_OF_FILES_CONCURENTLY_OPENED);

interface ImportDetails {
  name: string;
  files: string[];
  type: ImportedPackageType;
}

async function parseFileTs(file: string): Promise<ImportDetails[]> {
  const code = await readFileAsync(file);
  const result = parseTs(code, file);
  return result.map(({ name, type }) => ({ files: [file], name, type }));
}

async function parseFile(file: string): Promise<ImportDetails[]> {
  try {
    return parseFileTs(file);
  } catch (e) {
    error(`Could not parse "${file}"`);
    error(e);
    return [];
  }
}

async function getImportsForFiles(files: string[]): Promise<ImportDetails[]> {
  const imports = await Promise.all(
    files.map(
      (f: string): Promise<ImportDetails[]> => throat(() => parseFile(f)),
    ),
  );
  return imports.reduce(
    (acc: ImportDetails[], list: ImportDetails[]): ImportDetails[] => {
      list?.forEach((item) => {
        const newImport = acc.find((existing) => existing.name === item.name);
        if (newImport) {
          newImport.files = [...new Set([...newImport.files, ...item.files])];
          newImport.type = newImport.type === ImportedPackageType.NormalImport
            ? ImportedPackageType.NormalImport
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

function getSourceFiles({
  src,
}: Pick<Config, 'src'>): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    const forFiles = (err: Error, files: string[]) => {
      if (err) {
        reject(err);
      } else {
        resolve(files.map((f) => join(src, f)));
      }
    };
    glob('**/*.{ts,tsx,js,jsx,mjs,mts,cts}', { cwd: src }, forFiles);
  });
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
    if (i.type === ImportedPackageType.NormalImport) {
      if (packageJson.runtimeDependencies.includes(i.name)) {
        return;
      }
      if (ignoredDependencies.includes(i.name)) {
        return;
      }
      if (i.files.length === 1) {
        result.errors.push(
          `The package "${i.name}" is used in the module "${i.files[0]}"; but it is missing from the dependencies in package.json.`,
        );
      } else if (i.files.length > 1) {
        result.errors.push(
          `The package "${i.name}" is used in the module "${i.files[0]}" and ${
            i.files.length - 1
          } other modules; but it is missing from the dependencies in package.json.`,
        );
      }
    }
    // Report any type package used in the src folder that are not specified in the devDependencies.
    if (i.type === ImportedPackageType.TypeImport) {
      if (packageJson.typeDependencies.includes(i.name)) {
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
  const sourceFiles = await getSourceFiles(config);
  const imports = await getImportsForFiles(
    sourceFiles,
  );
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
  const { errors, warnings } = await processSourceFolder(commandLine);
  warnings.forEach((e) => warn(e));
  errors.forEach((e) => error(e));
  if (errors.length > 0) {
    process.exit(1);
  }
}
