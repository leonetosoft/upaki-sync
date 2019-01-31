import { SystemWorker } from "./SystemWorker";
import { EntityTask } from "../persist/entities/EntityTask";
import { Logger } from "../util/Logger";
import { Upaki } from "upaki-cli";
import { Environment } from "../config/env";
import { QueueDownload } from "../sync/queue/QueueDownload";
import { DownloadTask } from "../sync/task/DownloadTask";
import { PendingFolder, DownloadUiAction, DownloadFileState, DownloadProcData, ScanDownloadState } from "../api/download";
import { WorkProcess, ProcTaskState } from "../api/thread";

export class WorkerDownload extends SystemWorker<DownloadProcData> {
    private static _instance: WorkerDownload;
    private upaki: Upaki;

    constructor() {
        super(WorkProcess.WORKER_DOWNLOAD, process.env['PNAME'])
    }

    uiAction(queueId: string, action: DownloadUiAction, callback: (err, rs) => void) {
        let task = QueueDownload.Instance.tasks.getTaskById(queueId);
        if (!task) {
            callback('Processo nao encontrado', undefined);
        } else {

            if (action === DownloadUiAction.PAUSE) {
                if (task.task.fileDownload.state === DownloadFileState.PAUSE) {
                    task.task.Continue();

                    task.task.events.once('onContinue', (err) => {
                        callback(err ? 'Erro ao continuar' : undefined, undefined);
                    });
                } else {
                    task.task.Pause();

                    task.task.events.once('onPause', (err) => {
                        callback(err ? 'Erro ao pausar' : undefined, undefined);
                    });
                }
            }else {
                task.task.Stop();

                task.task.events.once('onStop', (err) => {
                    callback(err ? 'Erro ao remover' : undefined, undefined);
                });
            }

        }
    }

    async initScan() {
        try {
            await this.LoadData();

            if (!this.pData.state) {
                this.pData.state = ScanDownloadState.AWAIT_NEXT;
            }

            this.UpdateUiHandler();
            this.LoadFiles();
        } catch (error) {
            Logger.error(error);
        }
    }

    async UpdateData() {
        try {
            await EntityTask.Instance.UpdateData(this.model);
        } catch (error) {
            Logger.error(error);
        }
    }

    private OnCompleteScanFolder() {
        this.SaveData();
        this.processQueue();
    }

    processQueue() {
        let dataProcess = this.pData.pendingFiles.filter(el => el.state !== DownloadFileState.COMPLETED &&
             el.state !== DownloadFileState.ERROR && el.state !== DownloadFileState.STOP);

        for (let down of dataProcess) {
            QueueDownload.Instance.addJob(new DownloadTask(down, this.pData.destFolder));
        }

        if (dataProcess.length === 0) {
            Logger.debug(`Complete task download ${this.pname}`);
            this.pData.state = ScanDownloadState.COMPLETE_DOWNLOAD;
            this.SaveData();
            this.model.pstate = ProcTaskState.COMPLETED;
        }
    }

    private AwaitNext() {
        this.SaveData();

        if (this.pData.pendingFiles.filter(el => (el.state !== DownloadFileState.COMPLETED &&
            el.state !== DownloadFileState.ERROR && el.state !== DownloadFileState.STOP)).length === 0) {
            Logger.warn(`No files in folder, force next step ...`);
            this.LoadFiles();
        } else {
            this.processQueue();
        }
    }

    getPathOfFolder(folder: PendingFolder, path = []): string[] {
        path.push(folder.name);
        let findDad = this.pData.path.find(el => el.id === folder.dad);
        if (findDad) {
            //path.push(findDad);
            return this.getPathOfFolder(findDad, path)
        } else {
            return path;
        }
    }

    async CompleteDownloadTask() {
        await this.LoadFiles();
        let findAwait = this.pData.pendingFiles.find(el => el.state === DownloadFileState.AWAIT);

        if (!findAwait) {
            Logger.debug(`Complete task download ${this.pname}`);
            this.pData.state = ScanDownloadState.COMPLETE_DOWNLOAD;
            this.model.pstate = ProcTaskState.COMPLETED;

        }
    }

    async LoadFiles(next = undefined, tentativas = 0) {
        if (!this.pData.actualFolder || this.pData.state === ScanDownloadState.COMPLETE_SCAN) {
            Logger.warn(`Actual folder is undefined ..`);
            this.OnCompleteScanFolder();
            return;
        }

        if (!this.upaki) {
            this.upaki = new Upaki(Environment.config.credentials);
        }

        this.pData.state = ScanDownloadState.SCAN;

        try {
            if (!next) {
                if (!this.pData.path) {
                    this.pData.path = [];
                }

                /* this.pData.path.push({
                     id: this.model.pdata.actualFolder.id,
                     name: this.model.pdata.actualFolder.name
                     rootFolder: 
                 });
                 this.pData.path += '/' + this.model.pdata.actualFolder.name;*/
            }

            let fileList = await this.upaki.getFiles(this.model.pdata.actualFolder.id, next);

            if (fileList.data.list.length === 0) {
                this.pData.folder = this.model.pdata.actualFolder.name;

                let indexOk = this.pData.pendingFolders.findIndex(el => el.id === this.model.pdata.actualFolder.id);

                if (indexOk !== -1) {
                    this.pData.pendingFolders.splice(indexOk, 1); //remove actual
                }

                if (this.pData.pendingFolders.length > 0) {
                    this.pData.state = ScanDownloadState.AWAIT_NEXT;
                    this.pData.actualFolder = this.pData.pendingFolders[0];
                    Logger.debug(`Scan dir ${this.model.pdata.actualFolder.id} AWAIT_NEXT`);
                    this.pData.pendingFolders.splice(0, 1);
                    /*setTimeout(() => {
                        this.LoadFiles();
                    }, 10000)*/
                    this.AwaitNext();
                } else {
                    this.pData.state = ScanDownloadState.COMPLETE_SCAN;
                    Logger.debug(`Scan dir ${this.model.pdata.actualFolder.id} COMPLETE_SCAN`);
                    this.pData.actualFolder = undefined;
                    this.OnCompleteScanFolder();
                }
                /*console.log('ActualFolder:');
                console.log(this.pData.actualFolder);
                console.log('PedingFolders');
                console.log(this.pData.pendingFolders);
                console.log('PendingFiles');
                console.log(this.pData.pendingFiles);*/
                return;
            }
            let pendingFolders = fileList.data.list.filter(el => el.isFolder);
            let pendingFile = fileList.data.list.filter(el => !el.isFolder);

            // console.log(pendingFolders);
            let notInFiles = pendingFile.filter((el) => !this.pData.pendingFiles.find(it => it.id === el.id));

            this.pData.pendingFiles = this.pData.pendingFiles.concat(notInFiles.map(fl => {
                return {
                    id: fl.id,
                    name: `${fl.name}${fl.extension ? `.${fl.extension}` : ``}`,
                    state: DownloadFileState.AWAIT,
                    size: fl.size,
                    path: this.getPathOfFolder(this.pData.actualFolder).reverse().join('/')
                };
            }));

            let notInFolders = pendingFolders.filter((el) => !this.pData.pendingFolders.find(it => it.id === el.id));

            this.pData.pendingFolders = this.pData.pendingFolders.concat(notInFolders.map(fl => {
                return { id: fl.id, name: fl.name, dad: this.pData.actualFolder.id };
            }));

            for (let pFolders of this.pData.pendingFolders) {
                this.pData.path.push(pFolders);
            }
            this.LoadFiles(fileList.data.next);

        } catch (error) {
            Logger.error(error);
            Logger.warn(`Fail to load archive List, trying ${tentativas} 30 seconds`);
            if (tentativas < 5) {
                tentativas++;
                setTimeout(() => this.LoadFiles(next, tentativas), 30000);
            }else{
                Logger.warn(`Fail to load archive List, trying ${tentativas} ... process stop!!!`);
                this.model.pstate = ProcTaskState.STOPPED;
            }
        }
    }

    public static get Instance(): WorkerDownload {
        return this._instance || (this._instance = new this());
    }
}