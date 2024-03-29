import { Database } from './../persist/Database';
import { UploadState } from './../sync/task/UploaderTask';
import { EntityUpload } from './../persist/entities/EntityUpload';
import { Logger } from "../util/Logger";
import * as events from 'events';
import { ScanFast } from '../sync/ScanFast';
import { Util } from '../util/Util';
import { SystemWorker } from './SystemWorker';
import { FunctionsBinding } from '../ipc/FunctionsBinding';
import { UIFunctionsBinding } from '../ipc/UIFunctionsBinding';
import { EntityFolderSync } from '../persist/entities/EntityFolderSync';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { WorkProcess } from '../api/thread';
import { EntityUploadData } from '../api/entity';

export interface ScanTasks {
    path: string;
    stop: boolean;
}

export interface ScanTasksHandlers extends ScanTasks {
    interval: any;
}

export class WorkerScanProcess extends SystemWorker<any> {
    scannerDir = new events.EventEmitter();
    finishedScan = false;
    scanTasks: ScanTasks[] = [];
    handlersTask: ScanTasksHandlers[] = [];
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

        /*switch (msg.type) {
            case 'CONTINUE_SCAN':
                this.RequestScan();
                break;

            case 'SCANDIR':
                this.ScanDir(msg.data);
                break;

            case 'STOP_SCAN':
                this.ScanDir(msg.data);
                break;
        }*/
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

        const handlers = this.handlersTask.find(el => el.path === src);

        if (handlers && handlers.interval) {
            clearInterval(handlers.interval);
            Logger.warn(`Task Scan interval ${src} clear`);
        }
    }

    InitSync() {
        EntityFolderSync.Instance.ListFolders(async (err, folders) => {
            if (err) {
                Logger.error(err);
                return;
            }
            for (let folder of folders) {
                if (!fs.existsSync(folder.folderPath)) {
                    EntityFolderSync.Instance.DeleteFolder(folder.folderPath, (err) => {
                        if (err)
                            Logger.error(err);

                        Logger.warn(`Folder realtime sinch removed, folder not exists ${folder.folderPath}`);
                    });
                    return;
                }

                try {
                    await this.ScanDir(folder.folderPath, folder.scanDelay);
                } catch (scanErr) {
                    Logger.error(scanErr);
                }
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

    /*  private AddUploadList(file: string, rootFolder: string) {
          return new Promise((resolve, reject) => {
  
              this.AppendFile(file, rootFolder, (err) => {
                  if (err) {
                      reject(err);
                  } else {
                      resolve();
                  }
              });
          });
      }*/

    /* private AppendFile(file, rootFolder, callback) {
         let source = path.join(os.tmpdir(), `upaki_read_${Util.MD5SRC(rootFolder)}.json`);
 
         /*if (!fs.existsSync(pathLog)) {
             fs.mkdirSync(pathLog);
         }*/

    // fs.appendFile(source, `${file}\n`, callback);
    //}

    private AppendFastFile(files, rootFolder, callback) {
        let source = path.join(os.tmpdir(), `upaki_read_${Util.MD5SRC(rootFolder)}.json`);

        /*if (!fs.existsSync(pathLog)) {
            fs.mkdirSync(pathLog);
        }*/

        fs.appendFile(source, `${files}`, callback);
    }

    private ClearFile(rootFolder) {
        let source = path.join(os.tmpdir(), `upaki_read_${Util.MD5SRC(rootFolder)}.json`);
        if (fs.existsSync(source)) {
            fs.unlinkSync(source)
        }
    }

    private prepareDataInfo(dta: EntityUploadData) {
        if (dta.sessionData) {
            try {
                return new Buffer(JSON.stringify(dta.sessionData)).toString('base64');
            } catch (error) {
                Logger.error(error);
                return 'null';
            }
        } else {
            return 'null';
        }
    }

    async ScanDir(src, scanDelay: number): Promise<any> {
        try {
            return new Promise((resolve, reject) => {
                let taskData = {
                    path: src,
                    stop: false
                };

                this.scanTasks.push(taskData);

                let actualSrc = '';
                let sended = undefined;
                let arquivos = 0;

                let sendUi = setInterval(() => {
                    if ((sended !== actualSrc) || sended === undefined) {
                        UIFunctionsBinding.Instance.PathScan(src, `${arquivos} arquivos, ${actualSrc}`);
                        sended = src;
                    }
                }, 1000);

                this.ClearFile(src);

                let scanner = ScanFast(src, (file) => {
                    if (Util.getExtension(file).indexOf('lnk') === -1 &&
                        Util.getExtension(file).indexOf('tmp') === -1 &&
                        file.indexOf('$Recycle.Bin') === -1 &&
                        file.indexOf('Thumbs.db') === -1 &&
                        file.indexOf('$RECYCLE.BIN') === -1 &&
                        file.indexOf('tmp$$') === -1 && file.indexOf('.DS_Store') === -1) {
                        return true;
                    } else {
                        return false;
                    }
                }, 50);

                scanner.on('onFile', async (list) => {

                    try {
                        // filtrar apenas arquivos que interessam
                        let filterList = list.filter(el => el.lstat.size > 0);
                        // iniciar a busca pelos arquivos no banco de dados
                        let findFiles = await EntityUpload.Instance.getAnyFiles(filterList.map(el => {
                            return el.filePath;
                        }));
                        // dos encontrados quais serao enviados
                        let sendFilesOnList = findFiles.filter(el => {
                            return (el.state === UploadState.FINISH && el.lastModifies !== Util.getLastModifies(el.path)) || (el.state !== UploadState.FINISH)
                        });

                        let notInList = filterList.filter((el) => {
                            let findOtherList = findFiles.find(k => k.path == el.filePath);

                            if (findOtherList) {
                                return false;
                            } else {
                                return true;
                            }
                        });

                        let fileAppend = '';

                        arquivos += notInList.length + sendFilesOnList.length;

                        for (let append of notInList) {
                            fileAppend += `${append.filePath}|null\n`;
                        }

                        for (let append of sendFilesOnList) {
                            fileAppend += `${append.path}|${this.prepareDataInfo(append)}\n`;
                        }

                        this.AppendFastFile(fileAppend, src, (err) => {
                            if (err) {
                                Logger.error(err);
                            }

                            const scTask = this.scanTasks.find(el => el.path === src);
                            if (scTask && !scTask.stop) {
                                scanner.emit('next');
                            } else {
                                this.RemoveTask(src);
                            }

                        });
                    } catch (error) {
                        Logger.error(error);

                        const scTask = this.scanTasks.find(el => el.path === src);
                        if (scTask && !scTask.stop) {
                            scanner.emit('next');
                        } else {
                            this.RemoveTask(src);
                        }
                    }

                    /*for (let listFile of list) {
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
                    }*/
                });

                scanner.on('onFolder', (dir) => {
                    Logger.info(`Scan dir: ${dir}`);
                    actualSrc = dir;
                    // UIFunctionsBinding.Instance.PathScan(src, dir);
                    // MessageToWorker(WorkProcess.MASTER, { type: 'SCAN_DIR_NOTIFY', data: { folder: src, directory: dir } });
                });

                scanner.on('onError', (err) => {
                    Logger.error(err);
                    reject(err);
                });

                scanner.on('onFinish', () => {
                    Logger.info(`Complete Scan Directory ${src}`);
                    clearInterval(sendUi);
                    UIFunctionsBinding.Instance.FinishScan(src);
                    FunctionsBinding.Instance.ProcessFileLoteV2(src);
                    // MessageToWorker(WorkProcess.MASTER, { type: 'SCAN_DIR_NOTIFY', data: { folder: 'src', directory: '' } });
                    this.RemoveTask(src);
                    resolve(undefined);

                    if (scanDelay) {
                        Logger.debug(`Scan delay Enabled! Next Scan ${src} is ${scanDelay}`);
                        this.handlersTask.push({
                            ...taskData, interval: setTimeout(() => {
                                const handlersIndex = this.handlersTask.findIndex(el => el.path === src);

                                if (handlersIndex !== -1) {
                                    this.handlersTask.splice(handlersIndex, 1);
                                }

                                this.ScanDir(src, scanDelay);
                            }, scanDelay)
                        });

                    }

                });
            });


        } catch (error) {
            Logger.error(error);
        }
    }
}