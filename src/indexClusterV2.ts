import { Database } from './persist/Database';
import { WorkProcess } from './thread/UtilWorker';
import { SocketClient } from './socket/SocketClient';
import { production } from './config/production';
import { development } from './config/development';
import "reflect-metadata";
import { Environment } from './config/env';
import * as AWS from 'aws-sdk';
import * as fs from 'fs';
import * as zlib from 'zlib';
import { Upaki } from 'upaki-cli';
import { Logger } from './util/Logger';
import { PrintCredits } from './credits';
import { SyncDataNative } from './sync/SyncDataNative';
import * as cluster from 'cluster';
import { WorkerMaster } from './thread/WorkerMaster';
import { WorkerProcessFile } from './thread/WorkerProcessFile';
import { WorkerUpload } from './thread/WorkerUpload';
import { WorkerSocket } from './thread/WorkerSocket';
import { WorkerScanProcess } from './thread/WorkerScanProcess';
import { WorkerWatcher } from './thread/WorkerWatcher';
import { BootSync } from './index';


let arg = 0;
if (process.argv.length === 3) {
    arg = 2;
} else {
    arg = 1;
}

if (process.argv.length > 0 && process.argv[arg] === "--dev") {
    console.log(`> Process started in developmente mode < `);
    Environment.config = development;
} else {
    if (!fs.existsSync(process.argv[arg])) {
        console.error('Caminho nao encontrado ', process.argv[arg]);
        throw new Error('Caminho nao encontrado ' + process.argv[arg]);
    }
    let env = fs.readFileSync(process.argv[arg], 'utf8');
    Environment.config = JSON.parse(env);
}

if (!Environment.config.credentials ||
    Environment.config.credentials.secretToken === '' ||
    Environment.config.credentials.credentialKey === '') {
    let credentialsLoad = fs.readFileSync(Environment.config.credentialsPath, 'utf8');
    Environment.config.credentials = JSON.parse(credentialsLoad);
}

BootSync(Environment.config);



/*if (!process.argv[3]) {
    console.error('Defina a pasta para sincronizacao!!!!');
} else if (!process.argv[4]) {
    console.error('Defina as credenciais!!!!');
}
else {
    fs.readFile(process.argv[4], 'utf8', (err, data) => {
        if (err) {
            console.log(err);
            console.log(process.argv[4]);
            console.log('Credenciais nao encontradas!!!');
        } else {
            let obj = JSON.parse(data); //now it an object

            Environment.config.credentials = obj;
            PrintCredits();
           // let sync = new SyncData(process.argv[3]);
           let sync = new SyncDataNative(process.argv[3]);
           sync.StartSystem();
        }
    });
}*/