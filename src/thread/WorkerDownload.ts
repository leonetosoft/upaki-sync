import { SystemWorker } from "./SystemWorker";
import { WorkProcess, ProcTaskState } from "./UtilWorker";
import { TaskModel, EntityTask } from "../persist/entities/EntityTask";
import { Logger } from "../util/Logger";
import { Upaki } from "upaki-cli";
import { Environment } from "../config/env";
import { QueueDownload } from "../sync/queue/QueueDownload";
import { DownloadTask } from "../sync/task/DownloadTask";
export enum DownloadFileState {
    AWAIT = 1,
    DOWNLOADING = 2,
    COMPLETED = 3,
    ERROR = 4
}

export interface PendingFolder {
    id: string;
    name: string;
    dad: string;
}

export interface PendingFile {
    id: string;
    name: string;
    state: DownloadFileState;
    size: number;
    progress?: number;
    info?: string;
    etag?: string;
    path?: string;
}

export interface DownloadProcData {
    pendingFolders: PendingFolder[];
    pendingFiles: PendingFile[];
    actualFolder: PendingFolder;
    folder: string; //folder que esta sendo escaneado
    path: PendingFolder[]; // path em que é concatenado a cada varredura
    destFolder: string;
    state: ScanDownloadState;
}

export enum ScanDownloadState {
    SCAN = 1,
    AWAIT_NEXT = 2,
    COMPLETE_SCAN = 3
}

export class WorkerDownload extends SystemWorker {
    private static _instance: WorkerDownload;
    private model: TaskModel<DownloadProcData>;
    private upaki: Upaki;

    constructor() {
        super(WorkProcess.WORKER_DOWNLOAD, process.env['PNAME'])
    }

    async LoadData() {
        this.model = await EntityTask.Instance.getTask<DownloadProcData>(this.pname);
    }

    async SaveData() {
        await EntityTask.Instance.UpdateData(this.model);
    }

    async initScan() {
        try {
            await this.LoadData();

            if (!this.pData.state) {
                this.pData.state = ScanDownloadState.AWAIT_NEXT;
            }

            console.log(this.model);
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

    get pData() {
        return this.model.pdata;
    }

    private OnCompleteScanFolder() {
        this.SaveData();
        this.processQueue();
    }

    processQueue() {
        for (let down of this.pData.pendingFiles.filter(el => el.state !== DownloadFileState.COMPLETED)) {
            QueueDownload.Instance.addJob(new DownloadTask(down, this.pData.destFolder));
        }
    }

    private AwaitNext() {
        this.SaveData();

        if (this.pData.pendingFiles.filter(el => el.state !== DownloadFileState.COMPLETED).length === 0) {
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
                console.log('ActualFolder:');
                console.log(this.pData.actualFolder);
                console.log('PedingFolders');
                console.log(this.pData.pendingFolders);
                console.log('PendingFiles');
                console.log(this.pData.pendingFiles);
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
            console.log(this.pData.path);
            //console.log(this.pData.path);

            //console.log(this.pData.pendingFolders);
            this.LoadFiles(fileList.data.next);

        } catch (error) {
            Logger.error(error);
            Logger.debug(`Fail to load archive List, trying ${tentativas}`);
            if (tentativas < 5) {
                tentativas++;
                this.LoadFiles(next, tentativas);
            }
        }
    }

    public static get Instance(): WorkerDownload {
        return this._instance || (this._instance = new this());
    }
}