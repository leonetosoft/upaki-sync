// created from 'create-ts-index'
export * from './indexClusterV2';

// env variables
export * from './ipc/EventBinding';
export * from './ipc/IPCInterfaces'
export * from './ipc/UIEvents';
export * from './config/development';
export * from './config/production';
export * from './config/env';


// workers
export * from './thread/WorkerMaster';
export * from './thread/WorkerProcessFile';
export * from './thread/WorkerUpload';
export * from './thread/WorkerSocket';
export * from './thread/WorkerScanProcess';
export * from './thread/WorkerWatcher';
export * from './util/Logger';

export * from './persist/Database';
export * from './persist/entities/EntityFolderMap';
export * from './persist/entities/EntityFolderSync';
export * from './persist/entities/EntityUpload';

import { Environment, Config } from './config/env';
import * as cluster from 'cluster';
import { PrintCredits } from './credits';
import { WorkProcess } from './thread/UtilWorker';
import { WorkerMaster/*, testBing */} from './thread/WorkerMaster';
import { Database } from './persist/Database';
import { WorkerProcessFile } from './thread/WorkerProcessFile';
import { WorkerUpload } from './thread/WorkerUpload';
import { WorkerSocket } from './thread/WorkerSocket';
import { WorkerScanProcess } from './thread/WorkerScanProcess';
import { WorkerWatcher } from './thread/WorkerWatcher';
import { Logger } from './util/Logger';
import { EntityFolderSync } from './persist/entities/EntityFolderSync';

export function BootSync(config: Config) {
    Environment.config = config;

    if (cluster.isMaster) {
        PrintCredits();
        Environment.config.worker = WorkProcess.MASTER;
        Database.Instance.setMaster();
        WorkerMaster.Instance.Init();
        // WorkerMaster.Instance.RegisterUI(new testBing());
    } else if (cluster.isWorker) {
        process.once('message', (msg) => {
            if (msg.type === 'CONFIG_WORKER') {
                switch (msg.work) {
                    case WorkProcess.WORKER_PROCESS_FILE:
                        Database.Instance.setMaster();
                        Environment.config.worker = WorkProcess.WORKER_PROCESS_FILE;
                        WorkerProcessFile.Instance.Init();
                        break;
                    case WorkProcess.WORKER_UPLOAD:
                        Database.Instance.setMaster();
                        Environment.config.worker = WorkProcess.WORKER_UPLOAD;
                        WorkerUpload.Instance.Init();
                        break;
                    case WorkProcess.WORKER_SOCKET:
                        Environment.config.worker = WorkProcess.WORKER_SOCKET;
                        WorkerSocket.Instance.Init();
                        break;
                    case WorkProcess.WORKER_SCAN_PROCESS:
                        Database.Instance.setMaster();
                        Environment.config.worker = WorkProcess.WORKER_SCAN_PROCESS;
                        WorkerScanProcess.Instance.InitSync();
                        /*let scan = new WorkerScanProcess(Environment.config.synchPath);
                        scan.InitSync();*/
                        break;
                    case WorkProcess.WORKER_WHATCHER:
                        Database.Instance.setMaster();
                        Environment.config.worker = WorkProcess.WORKER_WHATCHER;
                        WorkerWatcher.Instance.Init();
                        break;
                }
            }
        });

        process.on('uncaughtException', (error) => {
            Logger.error(`uncaughtException Exception clusters`);
            Logger.error(error.stack);
            process.exit(1);
        });

    }
}
