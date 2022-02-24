import glob from 'glob';
import { readFile } from 'fs';
import { join } from 'path';
import parseImports from 'parse-imports';
import throatFactory from 'throat';
import ts from 'typescript';
import { error, warn } from './feedback.mjs';
import { CommandOptions } from './types.mjs';
import { getCommand } from './command.mjs';

const MAX_NUMBER_OF_FILES_CONCURENTLY_OPENED = 50;
const throat = throatFactory(MAX_NUMBER_OF_FILES_CONCURENTLY_OPENED);

function getPackageName(name: string): string|undefined {
  const parts = name.split('/').filter((p) => p?.length > 0);
  if (parts.length === 0) {
    throw new Error(`Invalid package: ${name}`);
  }
  if (['.', '..'].includes(parts[0])) {
    return undefined;
  }
  if (parts.length === 1) {
    return parts[0];
  }
  if (parts.length > 1) {
    if (parts[0].startsWith('@')) {
      return `${parts[0]}/${parts[1]}`;
    }
    return parts[0];
  }
  throw new Error(`Invalid package: ${name}`);
}

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
    dependencies: string[];
    devDependencies: string[];
    allDependencies: string[];
}

async function readPackageJson(): Promise<PackageJson> {
  const code = await readFileAsync('package.json');
  const pkg = JSON.parse(code);
  const dependencies = pkg.dependencies ? Object.keys(pkg.dependencies) : [];
  const devDependencies = pkg.devDependencies ? Object.keys(pkg.devDependencies) : [];
  const allDependencies = [...new Set([...dependencies, ...devDependencies])];
  return { dependencies, devDependencies, allDependencies };
}

interface ImportDetails {
    name: string;
    files: string[];
}
function parseTsImportDeclaration(importDeclaration: ts.Node): Promise<string | undefined> {
  return new Promise<string|undefined>((resolve) => {
    ts.forEachChild(importDeclaration, (child: ts.Node) => {
      if (ts.isStringLiteral(child)) {
        resolve(getPackageName(JSON.parse(child.getText())));
      }
    });
  });
}

function parseTsEqualsDeclaration(importDeclaration: ts.Node): Promise<string | undefined> {
  return new Promise<string|undefined>((resolve) => {
    let index = 0;
    ts.forEachChild(importDeclaration, (child: ts.Node) => {
      if (index === 0 && !ts.isImportClause(child)) {
        resolve(undefined);
      }
      if (index === 1 && ts.isStringLiteral(child)) {
        resolve(child.getText());
      }
      index += 1;
    });
  });
}

async function parseTsSourceFile(sourceFile: ts.Node): Promise<string[]> {
  const result: Promise<string>[] = [];
  ts.forEachChild(sourceFile, (child: ts.Node) => {
    if (ts.isImportDeclaration(child)) {
      result.push(parseTsImportDeclaration(child));
    }
    if (ts.isImportEqualsDeclaration(child)) {
      result.push(parseTsEqualsDeclaration(child));
    }
  });
  return (await Promise.all(result)).filter((x) => x?.length > 0);
}

async function parseFileMethod2(file: string): Promise<ImportDetails[]> {
  const code = await readFileAsync(file);
  const sc = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
  if (ts.isSourceFile(sc)) {
    return (await parseTsSourceFile(sc)).map((name) => ({
      files: [file], name,
    }));
  }
  return [];
}

async function parseFileMethod1(file: string): Promise<ImportDetails[]> {
  const code = await readFileAsync(file);
  const imports = [...(await parseImports(code))];
  return imports
    .filter((i) => i.moduleSpecifier.type === 'package')
    .map((i) => ({
      files: [file],
      name: getPackageName(i.moduleSpecifier.value),
    }));
}

async function parseFile(file: string): Promise<ImportDetails[]> {
  try {
    return await parseFileMethod1(file);
  } catch (err1) {
    try {
      return await parseFileMethod2(file);
    } catch (err2) {
      error(`Could not parse "${file}"`);
      error(err1);
      error(err2);
      return [];
    }
  }
}

async function getImportsForFiles(files: string[]): Promise<ImportDetails[]> {
  const imports = await Promise.all(
    files.map((f: string): Promise<ImportDetails[]> => throat(() => parseFile(f))),
  );
  return imports.reduce((acc: ImportDetails[], list: ImportDetails[]): ImportDetails[] => {
    list.forEach((item) => {
      const newImport = acc.find((existing) => existing.name === item.name);
      if (newImport) {
        newImport.files = [...new Set([...newImport.files, ...item.files])];
      } else {
        acc.push({ ...item, files: [...item.files] });
      }
    });
    return acc;
  }, [] as ImportDetails[]);
}

function getSourceFiles({ src }: Pick<CommandOptions, 'src'>): Promise<string[]> {
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
    if (packageJson.dependencies.includes(i.name)) {
      return;
    }
    if (packageJson.devDependencies.includes(i.name)) {
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
        } other packages; but it is missing from the dependencies in package.json.`,
      );
    }
  });
  const usedImports = imports.map((i) => i.name);
  packageJson.dependencies.forEach((d) => {
    if (usedImports.includes(d)) {
      return;
    }
    result.warnings.push(
      `The package "${d}" is in the \`dependencies\` of package.json, but it is not used in the source folder. Remove it or move it to the \`devDependencies\`.`,
    );
  });
  return result;
}

export async function main(): Promise<void> {
  const command = getCommand();
  const pkgJsonPromise = readPackageJson();
  const sourceFiles = await getSourceFiles(command);
  const imports = await getImportsForFiles(sourceFiles);
  const packageJson = await pkgJsonPromise;
  const { errors, warnings } = getErrors(packageJson, imports);
  warnings.forEach((e) => warn(e));
  errors.forEach((e) => error(e));
  if (errors.length > 0) {
    process.exit(1);
  }
}
