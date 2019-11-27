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
export * from './api/filereceiver';
export * from './api/copydir';

// entity
export * from './persist/Database';
export * from './persist/entities/EntityFolderMap';
export * from './persist/entities/EntityFolderSync';
export * from './persist/entities/EntityUpload';
export * from './persist/entities/EntityTask';
export * from './persist/entities/EntityCredentials';
export * from './persist/entities/EntityParameter';

import { Environment, Config } from './config/env';
import * as cluster from 'cluster';
import { WorkerMaster/*, testBing */ } from './thread/WorkerMaster';
import { WorkerProcessFile } from './thread/WorkerProcessFile';
import { WorkerUpload } from './thread/WorkerUpload';
import { WorkerSocket } from './thread/WorkerSocket';
import { WorkerScanProcess } from './thread/WorkerScanProcess';
import { WorkerWatcher } from './thread/WorkerWatcher';
import { Logger } from './util/Logger';
import { WorkerDownload } from './thread/WorkerDownload';
import { WorkProcess, ProcessType } from './api/thread';
import { Database } from './persist/Database';
import { WorkerFileReceiver } from './thread/WorkerFileReceiver';
import { WorkerCopyDir } from './thread/WorkerCopyDir';
import { EntityParameter } from './persist/entities/EntityParameter';
import { Util } from './util/Util';
import { WorkerBackup } from './thread/WorkerBackup';
import { Upaki } from 'upaki-cli';

function initialProcess(okCallback: () => void) {
    EntityParameter.Instance.GetParams(['PROXY_SERVER',
        'PROXY_PORT',
        'PROXY_PROTOCOL',
        'PROXY_USER',
        'PROXY_PASS',
        'PROXY_ENABLE']).then(proxyParams => {
            if (Number(proxyParams['PROXY_ENABLE'])) {
                Logger.debug(`Proxy agent: ${JSON.stringify(proxyParams)}`);
                Upaki.UpdateProxyAgent({
                    PROXY_SERVER: proxyParams['PROXY_SERVER'],
                    PROXY_PORT: proxyParams['PROXY_PORT'],
                    PROXY_PROTOCOL: proxyParams['PROXY_PROTOCOL'],
                    PROXY_USER: proxyParams['PROXY_USER'],
                    PROXY_PASS: proxyParams['PROXY_PASS']
                });
            }
            return EntityParameter.Instance.GetParams(['LOGGER_TYPE',
                'LOGGER_WARN',
                'LOGGER_INFO',
                'LOGGER_DBUG',
                'LOGGER_ERROR'
            ]);
        }).then(params => {
            console.log('Logger params loadded');
            if (Environment.config.ignoreLoggerParams) {
                console.log('Params ignored ignoreLoggerParams = true');
            } else {
                Environment.config.logging.type = params['LOGGER_TYPE'].split(',');
                Environment.config.logging.warn = params['LOGGER_WARN'] === '1';
                Environment.config.logging.info = params['LOGGER_INFO'] === '1';
                Environment.config.logging.dbug = params['LOGGER_DBUG'] === '1';
                Environment.config.logging.error = params['LOGGER_ERROR'] === '1';
            }
            
            okCallback();
        })
        .catch(err => {
            Logger.error(err);
            okCallback();
        });
}

function UpdateUserProfile() {
    Util.getUserProfile().then((rs) => {
        Logger.info('User profile OK');
    }).catch(err => {
        Logger.error(err);
    });
}
export function BootSync(config: Config, onInit?: (err?) => void) {

    // Environment.config = config;


    if (cluster.isMaster) {
        // PrintCredits();
        Environment.config.worker = WorkProcess.MASTER;
        //Database.Instance.setMaster();
        if (Environment.config.credentials && Environment.config.credentials.credentialKey && Environment.config.credentials.secretToken) {
            WorkerMaster.Instance.InitV2(onInit);
        } else {
            Database.Instance.InitDatabase();
        }

        /*updateProxyParams(() => {
            UpdateUserProfile();
        });*/

        initialProcess(() => {
            UpdateUserProfile();
            Logger.info('Initial config ok');
        })

        /* WorkerMaster.Instance.CreateDownloadTask([{
             id: 'wBgqk01NYe',
             name: 'TES_PAUSE_START'
         }], 'test-download', 'C:\\Download2').then(rs => {
 
         });
 
         WorkerMaster.Instance.StartTask('test');*/
        // TestDownloadTask();
        // WorkerMaster.Instance.RegisterUI(new testBing());
    } else if (cluster.isWorker) {
        /*updateProxyParams(() => {
            UpdateUserProfile();
        });*/

        /*EntityParameter.Instance.GetParams(['LOGGER_TYPE',
            'LOGGER_WARN',
            'LOGGER_INFO',
            'LOGGER_DBUG',
            'LOGGER_ERROR'
        ]).then(params => {
            console.log('Logger params loadded');
            if (Environment.config.ignoreLoggerParams) {
                console.log('Params ignored ignoreLoggerParams = true');
                return;
            }
            Environment.config.logging.type = params['LOGGER_TYPE'].split(',');
            Environment.config.logging.warn = params['LOGGER_WARN'] === '1';
            Environment.config.logging.info = params['LOGGER_INFO'] === '1';
            Environment.config.logging.dbug = params['LOGGER_DBUG'] === '1';
            Environment.config.logging.error = params['LOGGER_ERROR'] === '1';
        }).catch(err => {
            console.log('fail to load logger params:::');
            console.log(err);
        });*/

        initialProcess(() => {
            Logger.info('Initial config ok');

            UpdateUserProfile();

            if (process.env['PNAME'] && process.env['PTYPE']) {
                let type = Number(process.env['PTYPE']) as ProcessType;
                switch (type) {
                    case ProcessType.DOWNLOAD:
                        //Database.Instance.setMaster();
                        WorkerDownload.Instance.initScan();
                        break;

                    case ProcessType.FILE_RECEIVER:
                        WorkerFileReceiver.Instance.InitService();
                        break;

                    case ProcessType.FILE_COPY:
                        WorkerCopyDir.Instance.Init();
                        break;

                    case ProcessType.BACKUP:
                        WorkerBackup.Instance.Init();
                        break;
                }
            } else {
                switch (Number(process.env['DEFAULT_TYPE'])) {
                    case WorkProcess.WORKER_PROCESS_FILE:
                        Environment.config.worker = WorkProcess.WORKER_PROCESS_FILE;
                        WorkerProcessFile.Instance.Init();
                        break;
                    case WorkProcess.WORKER_UPLOAD:
                        Environment.config.worker = WorkProcess.WORKER_UPLOAD;
                        WorkerUpload.Instance.Init();
                        break;
                    case WorkProcess.WORKER_SOCKET:
                        Environment.config.worker = WorkProcess.WORKER_SOCKET;
                        WorkerSocket.Instance.Init();
                        break;
                    case WorkProcess.WORKER_SCAN_PROCESS:
                        Environment.config.worker = WorkProcess.WORKER_SCAN_PROCESS;
                        WorkerScanProcess.Instance.InitSync();
                        break;
                    case WorkProcess.WORKER_WHATCHER:
                        Environment.config.worker = WorkProcess.WORKER_WHATCHER;
                        WorkerWatcher.Instance.Init();
                        break;
                }
            }

        })


        process.on('uncaughtException', (error) => {
            Logger.error(`uncaughtException Exception clusters`);
            Logger.error(error.stack);
            process.exit(1);
        });

    }
}
