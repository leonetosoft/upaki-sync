// created from 'create-ts-index'
export * from './indexClusterV2';

// ipc
export * from './ipc/EventBinding';
export * from './ipc/IPCInterfaces'
export * from './ipc/UIEvents';
export * from './ipc/FunctionsBinding';

// env
export * from './config/development';
export * from './config/production';
export * from './config/env';


// workers
export * from './thread/WorkerMaster';
export * from './thread/WorkerProcessFile';
export * from './thread/WorkerUpload';
export * from './thread/WorkerSocket';
export * from './thread/WorkerDownload';
export * from './thread/WorkerScanProcess';
export * from './thread/WorkerWatcher';

// other util and log
export * from './util/Logger';
export * from './util/Util';

// apis
export * from './api/download';
export * from './api/thread';
export * from './api/entity';

// entity
export * from './persist/Database';
export * from './persist/entities/EntityFolderMap';
export * from './persist/entities/EntityFolderSync';
export * from './persist/entities/EntityUpload';
export * from './persist/entities/EntityTask';
export * from './persist/entities/EntityCredentials';

import { Environment, Config } from './config/env';
import * as cluster from 'cluster';
import { PrintCredits } from './credits';
import { WorkerMaster/*, testBing */ } from './thread/WorkerMaster';
import { WorkerProcessFile } from './thread/WorkerProcessFile';
import { WorkerUpload } from './thread/WorkerUpload';
import { WorkerSocket } from './thread/WorkerSocket';
import { WorkerScanProcess } from './thread/WorkerScanProcess';
import { WorkerWatcher } from './thread/WorkerWatcher';
import { Logger } from './util/Logger';
import { WorkerDownload } from './thread/WorkerDownload';
import { WorkProcess, ProcessType } from './api/thread';

export function BootSync(config: Config, onInit?: (err?) => void) {
    // Environment.config = config;

    if (cluster.isMaster) {
        PrintCredits();
        Environment.config.worker = WorkProcess.MASTER;
        // Database.Instance.setMaster();
        if (Environment.config.credentials && Environment.config.credentials.credentialKey && Environment.config.credentials.secretToken) {
            WorkerMaster.Instance.InitV2(onInit);
        }

        /* WorkerMaster.Instance.CreateDownloadTask([{
             id: 'wBgqk01NYe',
             name: 'TES_PAUSE_START'
         }], 'test-download', 'C:\\Download2').then(rs => {
 
         });
 
         WorkerMaster.Instance.StartTask('test');*/
        // TestDownloadTask();
        // WorkerMaster.Instance.RegisterUI(new testBing());
    } else if (cluster.isWorker) {
        if (process.env['PNAME'] && process.env['PTYPE']) {
            let type = Number(process.env['PTYPE']) as ProcessType;

            switch (type) {
                case ProcessType.DOWNLOAD:
                    //Database.Instance.setMaster();
                    WorkerDownload.Instance.initScan();
                    break;
            }
        } else {
            switch (Number(process.env['DEFAULT_TYPE'])) {
                case WorkProcess.WORKER_PROCESS_FILE:
                    //Database.Instance.setMaster();
                    Environment.config.worker = WorkProcess.WORKER_PROCESS_FILE;
                    WorkerProcessFile.Instance.Init();
                    break;
                case WorkProcess.WORKER_UPLOAD:
                    //Database.Instance.setMaster();
                    Environment.config.worker = WorkProcess.WORKER_UPLOAD;
                 WorkerUpload.Instance.Init();
                    break;
                case WorkProcess.WORKER_SOCKET:
                    Environment.config.worker = WorkProcess.WORKER_SOCKET;
                    WorkerSocket.Instance.Init();
                    break;
                case WorkProcess.WORKER_SCAN_PROCESS:
                    //Database.Instance.setMaster();
                    Environment.config.worker = WorkProcess.WORKER_SCAN_PROCESS;
                    WorkerScanProcess.Instance.InitSync();
                    break;
                case WorkProcess.WORKER_WHATCHER:
                    //Database.Instance.setMaster();
                    Environment.config.worker = WorkProcess.WORKER_WHATCHER;
                    WorkerWatcher.Instance.Init();
                    break;
            }
        }
        /*process.once('message', (msg) => {
            if (msg.type === 'CONFIG_WORKER') {
                switch (msg.work) {
                    case WorkProcess.WORKER_PROCESS_FILE:
                        //Database.Instance.setMaster();
                        Environment.config.worker = WorkProcess.WORKER_PROCESS_FILE;
                        WorkerProcessFile.Instance.Init();
                        break;
                    case WorkProcess.WORKER_UPLOAD:
                        //Database.Instance.setMaster();
                        Environment.config.worker = WorkProcess.WORKER_UPLOAD;
                        WorkerUpload.Instance.Init();
                        break;
                    case WorkProcess.WORKER_SOCKET:
                        Environment.config.worker = WorkProcess.WORKER_SOCKET;
                        WorkerSocket.Instance.Init();
                        break;
                    case WorkProcess.WORKER_SCAN_PROCESS:
                        //Database.Instance.setMaster();
                        Environment.config.worker = WorkProcess.WORKER_SCAN_PROCESS;
                        WorkerScanProcess.Instance.InitSync();
                        break;
                    case WorkProcess.WORKER_WHATCHER:
                        //Database.Instance.setMaster();
                        Environment.config.worker = WorkProcess.WORKER_WHATCHER;
                        WorkerWatcher.Instance.Init();
                        break;
                }
            }
        });*/

        process.on('uncaughtException', (error) => {
            Logger.error(`uncaughtException Exception clusters`);
            Logger.error(error.stack);
            process.exit(1);
        });

    }
}
