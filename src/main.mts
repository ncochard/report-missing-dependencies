import glob from 'glob';
import { readFile } from 'fs';
import { join } from 'path';
import throatFactory from 'throat';
import { parse as parseTs, ImportedPackageType } from 'parse-imports-ts';
import { rcFile } from 'rc-config-loader';
import { error, warn } from './feedback.mjs';
import { CommandOptions, Config } from './types.mjs';
import { getCommand } from './command.mjs';
import { configName } from './constants.mjs';

const MAX_NUMBER_OF_FILES_CONCURENTLY_OPENED = 50;
const throat = throatFactory(MAX_NUMBER_OF_FILES_CONCURENTLY_OPENED);

async function readFileAsync(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    readFile(file, (err1: Error, data: Buffer) => {
      try {
        if (err1) {
          reject(err1);
        } else {
          resolve(data.toString());
        }
      } catch (err2) {
        reject(err2);
      }
    });
  });
}

interface PackageJson {
  runtimeDependencies: string[];
  typeDependencies: string[];
  dependencies: string[];
}

async function readPackageJson(): Promise<PackageJson> {
  const code = await readFileAsync('package.json');
  const pkg = JSON.parse(code);
  const dependencies = pkg.dependencies ? Object.keys(pkg.dependencies) : [];
  const devDependencies = pkg.devDependencies
    ? Object.keys(pkg.devDependencies)
    : [];
  const peerDependencies = pkg.peerDependencies
    ? Object.keys(pkg.peerDependencies)
    : [];
  const runtimeDependencies = [...new Set([...dependencies, ...peerDependencies])];
  const typeDependencies = [...new Set([...devDependencies, ...peerDependencies])];
  return { runtimeDependencies, typeDependencies, dependencies };
}

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

async function getImportsForFiles(
  files: string[],
  config: Config | undefined,
): Promise<ImportDetails[]> {
  const imports = await Promise.all(
    files.map(
      (f: string): Promise<ImportDetails[]> => throat(() => parseFile(f)),
    ),
  );
  const ignoredPackages = config?.ignoredPackages || [];
  return imports.reduce(
    (acc: ImportDetails[], list: ImportDetails[]): ImportDetails[] => {
      list?.forEach((item) => {
        if (ignoredPackages.includes(item.name)) {
          return;
        }
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
}: Pick<CommandOptions, 'src'>): Promise<string[]> {
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

function getErrors(packageJson: PackageJson, imports: ImportDetails[]): Errors {
  const result: Errors = { errors: [], warnings: [] };
  imports.forEach((i) => {
    if (i.type === ImportedPackageType.NormalImport) {
      if (packageJson.runtimeDependencies.includes(i.name)) {
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
    if (i.type === ImportedPackageType.TypeImport) {
      if (packageJson.typeDependencies.includes(i.name)) {
        return;
      }
      if (i.files.length === 1) {
        result.errors.push(
          `Types from the package "${i.name}" are used in the module "${i.files[0]}". But it is missing from the devDependencies in package.json.`,
        );
      } else if (i.files.length > 1) {
        result.errors.push(
          `Types from the package "${i.name}" are used in the module "${i.files[0]}" and ${
            i.files.length - 1
          } other modules. But it is missing from the devDependencies in package.json.`,
        );
      }
    }
  });
  const usedImports = imports.map((i) => i.name);
  packageJson.dependencies.forEach((d) => {
    if (usedImports.includes(d)) {
      return;
    }
    result.errors.push(
      `The package "${d}" is in the \`dependencies\` of package.json, but it is not used in the source folder. Remove it or move it to the \`devDependencies\`.`,
    );
  });
  return result;
}

export async function processSourceFolder(): Promise<Errors> {
  const config = await rcFile<Config>(configName);
  const command = getCommand();
  const pkgJsonPromise = readPackageJson();
  const sourceFiles = await getSourceFiles(command);
  const imports = await getImportsForFiles(sourceFiles, config?.config);
  const packageJson = await pkgJsonPromise;
  return getErrors(packageJson, imports);
}

export async function main(): Promise<void> {
  const { errors, warnings } = await processSourceFolder();
  warnings.forEach((e) => warn(e));
  errors.forEach((e) => error(e));
  if (errors.length > 0) {
    process.exit(1);
  }
}
