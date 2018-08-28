import { Database } from './../persist/Database';
import { Worker } from "cluster";
import { Logger } from "../util/Logger";
import { QueueFile } from "../sync/queue/QueueFile";
import { FileTask, FileTypeAction } from "../sync/task/FileTask";
import { File } from "../sync/File";
import { UploaderTask, UploadState } from "../sync/task/UploaderTask";
import { S3StreamSessionDetails } from "upaki-cli";
import { MessageToWorker, WorkProcess } from "./UtilWorker";
import { Shutdown } from "./UtilWorker";
import { PRIORITY_QUEUE } from "../queue/task";
import { QueueRename } from "../sync/queue/QueueRename";
import { RenameTask } from "../sync/task/RenameTask";
import { EntityUpload } from "../persist/entities/EntityUpload";
import { Util } from "../util/Util";
import * as fs from 'fs';

export class WorkerProcessFile {
    rootFolder;
    private static _instance: WorkerProcessFile;
    constructor() {
        Logger.info(`[WorkerProcessFile] Worker ${process.pid} start!`);
    }

    public static get Instance(): WorkerProcessFile {
        return this._instance || (this._instance = new this());
    }

    Init(rootFolder: string) {
        this.rootFolder = rootFolder;
        process.on('message', this.Listen.bind(this));
        QueueFile.Instance.tasks.Start();
        QueueRename.Instance.tasks.Start();
    }

    Listen(msg: any) {
        try {
            if (msg === 'shutdown') {
                Shutdown();
                return;
            }

            switch (msg.type) {
                case 'FILE_LIST':
                    this.PutFilesQueue(msg.data);
                    break;

                case 'ADD_FILE':
                    this.ProcessFileWhatched(msg.data);
                    break;

                case 'DATABASE':
                    Database.Instance.OnMessage(msg.data);
                    break;
            }
        } catch (error) {
            Logger.error(error);
        }
    }
    ContinueScan() {
        MessageToWorker(WorkProcess.WORKER_SCAN_PROCESS, { type: 'CONTINUE_SCAN', data: {} });
    }

    private async ProcessFileWhatched(data: { key: string, action: FileTypeAction, item: 'folder' | 'file', oldKey: string }) {
        if (!fs.existsSync(data.key)) {
            return;
        }
        switch (data.action) {
            case FileTypeAction.ADD:
                if (data.item === 'file') {
                    Logger.debug(`New file add ${data.key}`);
                    QueueFile.Instance.addJob(new FileTask(new File(data.key, this.rootFolder), FileTypeAction.ADD));
                } else {
                    Logger.warn(`Ignored folder creation ${data.key}`);
                }
                break;

            case FileTypeAction.RENAME:
                try {
                    if (data.item === 'file') {
                        Logger.debug(`New file renamed ${data.key}`);
                        let fileData = await EntityUpload.Instance.getFile(data.oldKey);
                        console.log(fileData);
                        if (fileData && fileData.state === UploadState.FINISH) {
                            Logger.warn(`File renamed checksum OK, not upload!`);
                        } else {
                            this.RequestStopUpload(data.oldKey);
                            let job = new FileTask(new File(data.key, this.rootFolder), FileTypeAction.ADD);
                            job.priority = PRIORITY_QUEUE.HIGH;
                            QueueFile.Instance.addJob(job);
                        }
                    }
                } catch (error) {
                    Logger.error(error);
                }

                QueueRename.Instance.addJob(new RenameTask(data.key, data.oldKey, this.rootFolder));
                break;

            case FileTypeAction.UNLINK:
                if (data.item === 'file') {
                    Logger.debug(`Remove file ${data.key}`);
                    let job = new FileTask(new File(data.key, this.rootFolder), FileTypeAction.UNLINK);
                    job.priority = PRIORITY_QUEUE.HIGH;
                    QueueFile.Instance.addJob(job);
                }
                break;

            case FileTypeAction.CHANGE:
                if (data.item === 'file') {
                    Logger.debug(`New file changed ${data.key}`);
                    let job = new FileTask(new File(data.key, this.rootFolder), FileTypeAction.CHANGE);
                    job.priority = PRIORITY_QUEUE.HIGH;
                    QueueFile.Instance.addJob(job);
                }
                break;
        }
    }

    PutFilesQueue(files: string[]) {
        files.forEach(element => {
            if (element !== null && element !== undefined)
                QueueFile.Instance.addJob(new FileTask(new File(element, this.rootFolder), FileTypeAction.ADD));
        });
    }

    /**
     * Um novo upload deve entrar na fila
     * @param file 
     * @param session 
     * Enviar para: uploader
     */
    AddUploadQueue(file: File, session: S3StreamSessionDetails = {
        Parts: [],
        DataTransfered: 0
    }) {
        MessageToWorker(WorkProcess.WORKER_UPLOAD, { type: 'DO_UPLOAD', data: { file: file, session: session } });
    }

    /**
     * Um upload deve ser parado
     * Enviar para: Uploader
     */
    RequestStopUpload(path) {
        MessageToWorker(WorkProcess.WORKER_UPLOAD, { type: 'STOP_UPLOAD', data: path });
    }
}