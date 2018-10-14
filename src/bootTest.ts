import { Environment, Config } from './config/env';
import * as cluster from 'cluster';
import { PrintCredits } from './credits';
import { WorkProcess } from './thread/UtilWorker';
import { WorkerMaster } from './thread/WorkerMaster';
import { Database } from './persist/Database';
import { WorkerProcessFile } from './thread/WorkerProcessFile';
import { WorkerUpload } from './thread/WorkerUpload';
import { WorkerSocket } from './thread/WorkerSocket';
import { WorkerScanProcess } from './thread/WorkerScanProcess';
import { WorkerWatcher } from './thread/WorkerWatcher';
import { Logger } from './util/Logger';

export function BootSync(config: Config){
    Environment.config = config;

    if (cluster.isMaster) {
        PrintCredits();
        Environment.config.worker = WorkProcess.MASTER;
        WorkerMaster.Instance.Init();
    } else if (cluster.isWorker) {
        process.once('message', (msg) => {
            if (msg.type === 'CONFIG_WORKER') {
                switch (msg.work) {
                    case 1:
                        Database.Instance.setMaster();
                        Environment.config.worker = WorkProcess.WORKER_PROCESS_FILE;
                        WorkerProcessFile.Instance.Init();
                        break;
                    case 2:
                        Database.Instance.setMaster();
                        Environment.config.worker = WorkProcess.WORKER_UPLOAD;
                        WorkerUpload.Instance.Init();
                        break;
                    case 3:
                        Environment.config.worker = WorkProcess.WORKER_SOCKET;
                        WorkerSocket.Instance.Init();
                        break;
                    case 4:
                        Database.Instance.setMaster();
                        Environment.config.worker = WorkProcess.WORKER_SCAN_PROCESS;
                        let scan = new WorkerScanProcess();
                        scan.InitSync();
                        break;
                    case 5:
                        // Database.Instance.setMaster();
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