import { Database } from './../persist/Database';
import { Worker } from "cluster";
import { Logger } from "../util/Logger";
import { Shutdown, MessageToWorker, WorkProcess } from "./UtilWorker";
import { Util } from "../util/Util";
import { QueueUploader } from "../sync/queue/QueueUploader";
import { UploaderTask, UploadState } from "../sync/task/UploaderTask";
import { File } from "../sync/File";
import { Processor } from '../queue/processor';

export class WorkerUpload {
    private static _instance: WorkerUpload;
    constructor() {
        Logger.info(`[WorkerUpload] Worker ${process.pid} start!`);
    }

    public static get Instance(): WorkerUpload {
        return this._instance || (this._instance = new this());
    }

    Init() {
        process.on('message', this.Listen.bind(this));
        QueueUploader.Instance.tasks.Start();
    }

    Listen(msg: any) {
        try {
            if (msg === 'shutdown') {
                Shutdown();
                return;
            }

            switch (msg.type) {
                case 'DO_UPLOAD':
                    let file = new File(msg.data.file.filePath, msg.data.file.rootFolder);
                    QueueUploader.Instance.addJob(Util.ProcessPriority(new UploaderTask(file, msg.data.session)));
                    break;

                case 'STOP_UPLOAD':
                    this.StopUploadsOfPath(msg.data);
                    break;

                case 'DATABASE_RESPONSE':
                    Database.Instance.DbResponse(msg.data);
                    break;
            }
        } catch (error) {
            Logger.error(error);
        }
    }

    private StopUploadsOfPath(path) {
        QueueUploader.Instance.tasks.getTaskListByPriority().forEach(job => {
            try {
                if (job.task.file.getPath() === path) {
                    Logger.debug(`Request cancel taskId=${job.task.id}`);
                    job.task.Cancel();
                }
            } catch (error) {
                Logger.error(error);
            }
        });
    }

    AddUpload(upload: UploaderTask) {
        try {
            MessageToWorker(WorkProcess.WORKER_SOCKET, { type: 'UPLOAD_NOTIFY', data: { stateType: 'ADD', size: upload.file.getSize() } });
        } catch (error) {
            Logger.error(error);
        }
    }

    RemoveUpload(upload: UploaderTask) {
        try {
            MessageToWorker(WorkProcess.WORKER_SOCKET, { type: 'UPLOAD_NOTIFY', data: { stateType: 'REMOVE', size: upload.file.getSize(true), path: upload.file.getPath() } });
        } catch (error) {
            Logger.error(error);
        }
    }

    sendUploadList() {
        try {
            let taskByPriority = QueueUploader.Instance.tasks.getTaskListByPriority();

            let totalSend = taskByPriority.reduce<number>((i, el) => {
                return i + (el.task.file.getSize() - el.task.loaded);
            }, 0);

            let numberOfUploads = taskByPriority.length;

            taskByPriority = taskByPriority.sort((a, b) => {
                if (a.task.state === UploadState.UPLOADING) {
                    return -1;
                } else {
                    return 1;
                }
            });

            let listUpload = taskByPriority.slice(0, 5).map(task => {
                let upload = task.task;
                return {
                    path: upload.file.getPath(),
                    cloudpath: upload.file.getKey(),
                    state: upload.state,
                    parts: upload.session.Parts,
                    loaded: upload.loaded,
                    uploadType: upload.uploadType,
                    size: upload.file.getSize(),
                    name: upload.file.getFullName(),
                    key: upload.file.getKey(),
                    preventTimeLeft: upload.preventTimeLeft,
                    speedBps: upload.speedBps,
                    speed: upload.speed,
                    speedType: upload.speedType
                }
            });

            MessageToWorker(WorkProcess.WORKER_SOCKET, {
                type: 'UPLOAD_LIST', data: {
                    list: listUpload,
                    numberOfUploads: numberOfUploads,
                    totalSend: totalSend
                }
            });
        } catch (error) {
            Logger.error(error);
        }
    }

    notifyUpload(upload: UploaderTask) {
        try {
            /*let objFormed = {
                path: upload.file.getPath(),
                cloudpath: upload.file.getKey(),
                state: upload.state,
                parts: upload.session.Parts,
                loaded: upload.loaded,
                uploadType: upload.uploadType,
                size: upload.file.getSize(),
                name: upload.file.getFullName(),
                key: upload.file.getKey(),
                preventTimeLeft: upload.preventTimeLeft,
                speedBps: upload.speedBps,
                speed: upload.speed,
                speedType: upload.speedType
            };

            MessageToWorker(WorkProcess.WORKER_SOCKET, { type: 'UPLOAD_STATE', data: objFormed });*/

            this.sendUploadList();
        } catch (error) {
            Logger.error(error);
        }
    }
}