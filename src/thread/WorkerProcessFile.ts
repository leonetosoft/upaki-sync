import { PRIORITY_QUEUE } from "../queue/task";
import { Logger } from "../util/Logger";
import { FileTask, FileTypeAction } from "../sync/task/FileTask";
import { RenameTask } from "../sync/task/RenameTask";
import { QueueRename } from "../sync/queue/QueueRename";
import { QueueFile } from "../sync/queue/QueueFile";
import { EntityUpload } from "../persist/entities/EntityUpload";
import { File } from "../sync/File";
import * as fs from 'fs';
import { UploadState } from '../sync/task/UploaderTask';
import { SystemWorker } from "./SystemWorker";
import { FunctionsBinding } from "../ipc/FunctionsBinding";
import { WorkProcess } from "../api/thread";
//import { Util } from "../util/Util";

export class WorkerProcessFile extends SystemWorker<any> {
    private static _instance: WorkerProcessFile;
    constructor() {
        super(WorkProcess.WORKER_PROCESS_FILE);
        Logger.info(`[WorkerProcessFile] Worker ${process.pid} start!`);
    }

    public static get Instance(): WorkerProcessFile {
        return this._instance || (this._instance = new this());
    }

    Init() {
        // process.on('message', this.Listen.bind(this));
        QueueFile.Instance.tasks.Start();
        QueueRename.Instance.tasks.Start();
    }

    Listen(msg: any) {
        try {
            /*if (msg === 'shutdown') {
                Shutdown();
                return;
            }*/

            switch (msg.type) {
                /*case 'FILE_LIST':
                    this.PutFilesQueue(msg.data);
                    break;

                case 'ADD_FILE':
                    this.ProcessFileWhatched(msg.data);
                    break;

                case 'DATABASE':
                    Database.Instance.OnMessage(msg.data);
                    break;*/
            }
        } catch (error) {
            Logger.error(error);
        }
    }

    public async ProcessFileWhatched(data: { key: string, action: FileTypeAction, item: 'folder' | 'file', oldKey: string, rootFolder: string }) {
        if (!fs.existsSync(data.key)) {
            return;
        }
        switch (data.action) {
            case FileTypeAction.ADD:
                if (data.item === 'file') {
                    Logger.debug(`New file add ${data.key}`);
                    
                    if (!fs.existsSync(data.key)) {
                        Logger.warn(`File ${data.key} removed, process canceled`);
                        return;
                    }
                    try {
                        fs.accessSync(data.key, fs.constants.R_OK);
                        QueueFile.Instance.addJob(new FileTask(new File(data.key, data.rootFolder), FileTypeAction.ADD));
                    } catch (error) {
                        Logger.warn(`File ${data.key} no read permissions!`);
                    }
                } else {
                    Logger.debug(`Ignored folder creation ${data.key}`);
                }
                break;

            case FileTypeAction.RENAME:
                try {
                    if (data.item === 'file') {
                        Logger.debug(`New file renamed ${data.key}`);
                        let fileData = await EntityUpload.Instance.getFile(data.oldKey);

                        if (fileData && fileData.state === UploadState.FINISH) {
                            Logger.debug(`File renamed checksum OK, not upload!`);
                        } else {
                            // this.RequestStopUpload(data.oldKey);
                            if (!fs.existsSync(data.key)) {
                                Logger.warn(`File ${data.key} removed, process canceled`);
                                return;
                            }

                            try {
                                fs.accessSync(data.key, fs.constants.R_OK);

                                FunctionsBinding.Instance.StopUpload(data.oldKey);
                                let job = new FileTask(new File(data.key, data.rootFolder), FileTypeAction.ADD);
                                job.priority = PRIORITY_QUEUE.HIGH;
                                QueueFile.Instance.addJob(job);
                            } catch (error) {
                                Logger.warn(`File ${data.key} no read permissions!`);
                            }


                        }
                    }
                } catch (error) {
                    Logger.error(error);
                }

                QueueRename.Instance.addJob(new RenameTask(data.key, data.oldKey, data.rootFolder));
                break;

            case FileTypeAction.UNLINK:
                if (data.item === 'file') {
                    Logger.debug(`Remove file ${data.key}`);

                    if (!fs.existsSync(data.key)) {
                        Logger.warn(`File ${data.key} removed, process canceled`);
                        return;
                    }
                    try {
                        fs.accessSync(data.key, fs.constants.R_OK);
                        let job = new FileTask(new File(data.key, data.rootFolder), FileTypeAction.UNLINK);
                        job.priority = PRIORITY_QUEUE.HIGH;
                        QueueFile.Instance.addJob(job);
                    } catch (error) {
                        Logger.warn(`File ${data.key} no read permissions!`);
                    }
                }
                break;

            case FileTypeAction.CHANGE:
                if (data.item === 'file') {
                    Logger.debug(`New file changed ${data.key}`);

                    if (!fs.existsSync(data.key)) {
                        Logger.warn(`File ${data.key} removed, process canceled`);
                        return;
                    }

                    try {
                        fs.accessSync(data.key, fs.constants.R_OK);
                        let job = new FileTask(new File(data.key, data.rootFolder), FileTypeAction.CHANGE);
                        job.priority = PRIORITY_QUEUE.HIGH;
                        QueueFile.Instance.addJob(job);
                    } catch (error) {
                        Logger.warn(`File ${data.key} no read permissions!`);
                    }
                }
                break;
        }
    }

    PutFilesQueue(files: string[], rootFolder: string) {
        files.forEach(element => {
            if (element !== null && element !== undefined)
                QueueFile.Instance.addJob(new FileTask(new File(element, rootFolder), FileTypeAction.ADD));
        });
    }

    PutFileQueue(file: string, rootFolder: string) {
        QueueFile.Instance.addJob(new FileTask(new File(file, rootFolder), FileTypeAction.ADD));
    }

    /**
     * Um novo upload deve entrar na fila
     * @param file 
     * @param session 
     * Enviar para: uploader
     
    AddUploadQueue(file: File, session: S3StreamSessionDetails = {
        Parts: [],
        DataTransfered: 0
    }, callback: (err, rs) => void) {
        FunctionsBinding.Instance.UploadFile(file.filePath, session, callback);
    }*/

    /**
     * Um upload deve ser parado
     * Enviar para: Uploader
     */
    /*RequestStopUpload(path) {
        MessageToWorker(WorkProcess.WORKER_UPLOAD, { type: 'STOP_UPLOAD', data: path });
    }*/
}