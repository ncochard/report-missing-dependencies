# Check all the dependencies in the `package.json`
This utility will parse the `*.js` files and the `*.ts` files in your `src` folder to identify all packages used in the `import {xxx} from "package"` statement. And it will report an error if that package is missing from the `package.json`.

## Usage

    {
        "name": "your-project",
        ...
        "scripts": {
            "pre-build": "report-missing-dependencies",
            "tsc": "tsc --build tsconfig.json",
            "build": "npm run check && npm run tsc"
        },
        "devDependencies": {
            "report-missing-dependencies": "*"
        }
    }
