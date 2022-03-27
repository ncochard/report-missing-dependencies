// "lodash" needs to be specified in the package.json for this test to pass
import {merge} from "lodash";
// "fs" is a native nodejs package so it does not need to be specified in the package.json.
import { readFile } from 'fs';