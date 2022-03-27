# Check all the dependencies in the `package.json`
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
    -h, --help                         display help for command

## Configuration

    //.rmdrc
    {
        src: "src",
        ignoredDependencies: ["fs", "http", "net", "url"],
        runtimeDependencies: []
    }