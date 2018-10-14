import { Database } from './../persist/Database';
import { UploadState } from './../sync/task/UploaderTask';
import { EntityUpload } from './../persist/entities/EntityUpload';
import { Logger } from "../util/Logger";
import { WorkProcess } from "./UtilWorker";
import * as events from 'events';
import { ScanFast } from '../sync/ScanFast';
import { Util } from '../util/Util';
import { SystemWorker } from './SystemWorker';
import { FunctionsBinding } from '../ipc/FunctionsBinding';
import { UIFunctionsBinding } from '../ipc/UIFunctionsBinding';
import { EntityFolderSync } from '../persist/entities/EntityFolderSync';
export interface ScanTasks {
    path: string;
    stop: boolean;
}
export class WorkerScanProcess extends SystemWorker {
    scannerDir = new events.EventEmitter();
    finishedScan = false;
    scanTasks: ScanTasks[] = [];
    private static _instance: WorkerScanProcess;

    public static get Instance(): WorkerScanProcess {
        return this._instance || (this._instance = new this());
    }

    constructor() {
        super(WorkProcess.WORKER_SCAN_PROCESS);
        Logger.info(`[WorkerScanProcess] Worker ${process.pid} start!`);
    }

    Listen(msg: any) {
        /*if (msg === 'shutdown') {
            Shutdown();
            return;
        }*/

        switch (msg.type) {
            case 'CONTINUE_SCAN':
                this.RequestScan();
                break;

            case 'DATABASE_RESPONSE':
                Database.Instance.DbResponse(msg.data);
                break;

            case 'DATABASE':
                Database.Instance.OnMessage(msg.data);
                break;

            case 'SCANDIR':
                this.ScanDir(msg.data);
                break;

            case 'STOP_SCAN':
                this.ScanDir(msg.data);
                break;
        }
    }

    RequestScan() {

        if (!this.finishedScan) {
            this.scannerDir.emit('continue');
        }
    }

    StopScan(src) {
        const scTaskId = this.scanTasks.find(el => el.path === src);
        if (scTaskId) {
            scTaskId.stop = true;
        } else {
            Logger.warn(`Task Scan ${src} not found`);
        }
    }

    InitSync() {
        EntityFolderSync.Instance.ListFolders(async (err, folders) => {
            if (err) {
                Logger.error(err);
                return;
            }
            for (let foder of folders) {
                await this.ScanDir(foder);
            }
        });
    }

    private RemoveTask(src) {
        const scTaskId = this.scanTasks.findIndex(el => el.path === src);
        if (scTaskId) {
            this.scanTasks.splice(scTaskId, 1);
            Logger.info(`Task Scan ${src} REMOVED`);
        } else {
            Logger.warn(`Task Scan ${src} not found`);
        }
    }

    private AddUploadList(file: string, rootFolder: string) {
        return new Promise((resolve, reject) => {
            FunctionsBinding.Instance.ProcessFile([file], rootFolder, (err, rs) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async ScanDir(src) {
        try {
            return new Promise((resolve, reject) => {
                this.scanTasks.push({
                    path: src,
                    stop: false
                });

                let scanner = ScanFast(src, (file) => {
                    if (Util.getExtension(file).indexOf('lnk') === -1 &&
                        Util.getExtension(file).indexOf('tmp') === -1 &&
                        file.indexOf('$Recycle.Bin') === -1 &&
                        file.indexOf('Thumbs.db') === -1 &&
                        file.indexOf('tmp$$') === -1 && file.indexOf('.DS_Store') === -1) {
                        return true;
                    } else {
                        return false;
                    }
                }, 50);

                scanner.on('onFile', (list) => {
                    for (let listFile of list) {
                        if (listFile.lstat.size > 0) {
                            let file = listFile.filePath;
                            EntityUpload.Instance.getFile(file).then(async fileData => {
                                try {

                                    if (fileData) {
                                        if (fileData.state === UploadState.FINISH && fileData.lastModifies !== Util.getLastModifies(file)) {
                                            // MessageToWorker(WorkProcess.WORKER_PROCESS_FILE, { type: 'FILE_LIST', data: [file] });
                                            await this.AddUploadList(file, src);
                                        } else if (fileData.state !== UploadState.FINISH) {
                                            // MessageToWorker(WorkProcess.WORKER_PROCESS_FILE, { type: 'FILE_LIST', data: [file] });
                                            await this.AddUploadList(file, src);
                                        }
                                    } else {
                                        // MessageToWorker(WorkProcess.WORKER_PROCESS_FILE, { type: 'FILE_LIST', data: [file] });
                                        await this.AddUploadList(file, src);
                                    }
                                } catch (error) {
                                    Logger.error(error);
                                }

                                const scTask = this.scanTasks.find(el => el.path === src);
                                if (scTask && !scTask.stop) {
                                    scanner.emit('next');
                                } else {
                                    this.RemoveTask(src);
                                }
                            }).catch(err => {
                                const scTask = this.scanTasks.find(el => el.path === src);
                                if (scTask && !scTask.stop) {
                                    scanner.emit('next');
                                } else {
                                    this.RemoveTask(src);
                                }
                            });
                            // MessageToWorker(WorkProcess.WORKER_PROCESS_FILE, { type: 'FILE_LIST', data: [file] });
                        }
                    }
                });

                scanner.on('onFolder', (dir) => {
                    Logger.info(`Scan dir: ${dir}`);
                    UIFunctionsBinding.Instance.PathScan(src, dir);
                    // MessageToWorker(WorkProcess.MASTER, { type: 'SCAN_DIR_NOTIFY', data: { folder: src, directory: dir } });
                });

                scanner.on('onError', (err) => {
                    Logger.error(err);
                    reject(err);
                });

                scanner.on('onFinish', () => {
                    Logger.info(`Complete Scan Directory ${src}`);
                    UIFunctionsBinding.Instance.FinishScan(src);
                    // MessageToWorker(WorkProcess.MASTER, { type: 'SCAN_DIR_NOTIFY', data: { folder: 'src', directory: '' } });
                    this.RemoveTask(src);
                    resolve();
                });
            });


        } catch (error) {
            Logger.error(error);
        }
    }
}