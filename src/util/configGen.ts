import { Environment } from './../config/env';
import { production } from './../config/production';
import * as fs from 'fs';
Environment.config = production;
Environment.config.credentials.secretToken = "";
Environment.config.credentials.credentialKey = "";
fs.writeFileSync('../dist/config.json', JSON.stringify(Environment.config, null, 4), 'utf8');