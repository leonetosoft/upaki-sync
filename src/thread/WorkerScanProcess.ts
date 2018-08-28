import { Database } from './../persist/Database';
import { UploadState } from './../sync/task/UploaderTask';
import { EntityUpload } from './../persist/entities/EntityUpload';
import { Worker } from "cluster";
import { Logger } from "../util/Logger";
import { MessageToWorker, WorkProcess, Shutdown } from "./UtilWorker";
import * as events from 'events';
import { ScanFast } from '../sync/ScanFast';
import { Util } from '../util/Util';

export class WorkerScanProcess {
    rootFolder: string;
    scannerDir = new events.EventEmitter();
    finishedScan = false;
    constructor(rootFolder: string) {
        Logger.info(`[WorkerScanProcess] Worker ${process.pid} start!`);
        this.rootFolder = rootFolder;
        process.on('message', this.Listen.bind(this));
    }

    Listen(msg: any) {
        if (msg === 'shutdown') {
            Shutdown();
            return;
        }

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
        }
    }

    RequestScan() {

        if (!this.finishedScan) {
            this.scannerDir.emit('continue');
        }
    }

    async InitSync() {
        try {
            let scanner = ScanFast(this.rootFolder, (file) => {
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
                        EntityUpload.Instance.getFile(file).then(fileData => {
                            if (fileData) {
                                if (fileData.state === UploadState.FINISH && fileData.lastModifies !== Util.getLastModifies(file)) {
                                    MessageToWorker(WorkProcess.WORKER_PROCESS_FILE, { type: 'FILE_LIST', data: [file] });
                                } else if (fileData.state !== UploadState.FINISH) {
                                    MessageToWorker(WorkProcess.WORKER_PROCESS_FILE, { type: 'FILE_LIST', data: [file] });
                                }
                            } else {
                                MessageToWorker(WorkProcess.WORKER_PROCESS_FILE, { type: 'FILE_LIST', data: [file] });
                            }
                            scanner.emit('next');
                        }).catch(err => {
                            scanner.emit('next');
                        });
                        // MessageToWorker(WorkProcess.WORKER_PROCESS_FILE, { type: 'FILE_LIST', data: [file] });
                    }
                }
            });

            scanner.on('onFolder', (src) => {
                Logger.info(`Scan dir: ${this.rootFolder}`);
            });

            scanner.on('onError', (err) => {
                Logger.error(err);
            });

            scanner.on('onFinish', () => {
                Logger.info(`Complete Scan Directory ${this.rootFolder}`);
            });

        } catch (error) {
            Logger.error(error);
        }
    }
}