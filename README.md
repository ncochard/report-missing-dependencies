# `report-missing-dependencies`: Check all the dependencies in the `package.json`
This utility will parse the `*.js` files and the `*.ts` files in your `src` folder to identify all packages used in the `import {xxx} from "package"` statement. And it will report an error if that package is missing from the `package.json`.

## Features
 - Reports an error if a package (e.g. `import {xx} from "my-package"`) is used in the `src` folder but not defined in the `dependencies` section (or `peerDependencies` section) of the `package.json`.
 - Reports an error if a type is imported from a package (e.g. `import type {MyType} from "my-package"`) but that package is not in the `devDependencies` section of the `package.json`.
## Usage

    {
        "name": "your-project",
        ...
        "scripts": {
            "tsc": "tsc --build tsconfig.json",
            "build": "report-missing-dependencies && npm run tsc"
        },
        "devDependencies": {
            "report-missing-dependencies": "*"
        }
    }


## Command line

    Usage: report-missing-dependencies [options]

    Options:
    --cwd <string>                     Execution folder
                                       (default: ".")
    --src <string>                     Source folder (default: "src")
    --ignoredDependencies <string...>  Packages that are used in the `src` folder
                                       (e.g. `import fs from "fs"`) but do not
                                       need to be added to the `dependencies`
                                       section of the `package.json`.
                                       (default: "fs http net url")
    --runtimeDependencies <string...>  Packages that are not used in an import
                                       statement in the `src` folder but still
                                       need to be specified in the `dependencies`
                                       section of the `package.json`.
                                       (default: "")
    --testMatch <string...>            The glob patterns uses to detect test files.
                                       (default: "**/__tests__/**/*.?(m)[jt]s?(x) **/?(*.)+(spec|test).?(m)[jt]s?(x)")
    -h, --help                         display help for command

## Configuration

    //.rmdrc.js
    const builtinModules = require("module").builtinModules;
    module.exports = {
        src: "src",
        ignoredDependencies: [...builtinModules],
        runtimeDependencies: [],
        testMatch: ["**/__tests__/**/*.?(m)[jt]s?(x)", "**/?(*.)+(spec|test).?(m)[jt]s?(x)"]
    }

## Why

Invalid dependencies in the `package.json` of a project can cause any issues.

- E.g. When working on a mono-repo using a toold like NX, a missing dependency on one of the projects in the mono-repo can cause NX not to compile the missing dependency causing errors at runtime.
- E.g. When working on a mono-repo using a toold like NX, a extraneout dependency on one of the projects in the mono-repo can cause NX compile the extraneous dependency causing a slower development cycle.
- E.g. If a runtime dependency is incorrectly places in the `devDependencies` rather than the `dependencies`, you will not notice any issue in development mode (because `yarn install` installs all dependencies in the `node_modules` folder), but you will experience some runtime errors in production (because `yarn isntall --production` does not install dev dependencies).

You can arguably use [`depcheck`](https://github.com/depcheck/depcheck) to identify missing dependencies.
In fact, `depcheck` has many more options than `report-missing-dependencies`.
But `report-missing-dependencies` has the advantage that it can be used in the Continuous Integration pipeline.