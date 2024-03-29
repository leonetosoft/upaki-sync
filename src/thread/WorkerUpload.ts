import { Logger } from "../util/Logger";
import { Util } from "../util/Util";
import { QueueUploader } from "../sync/queue/QueueUploader";
import { UploaderTask, UploadState } from "../sync/task/UploaderTask";
import { File } from "../sync/File";
import { SystemWorker } from './SystemWorker';
import { S3StreamSessionDetails } from "upaki-cli";
import { FunctionsBinding } from "../ipc/FunctionsBinding";
import { UIFunctionsBinding } from "../ipc/UIFunctionsBinding";
import { WorkProcess } from "../api/thread";
import { EntityParameter } from "../persist/entities/EntityParameter";
import { Upaki } from 'upaki-cli';
import { STOP_UPLOAD_DESCRIPTOR } from "../api/stopUploadDescriptor";

export class WorkerUpload extends SystemWorker<any> {
    private static _instance: WorkerUpload;
    constructor() {
        super(WorkProcess.WORKER_UPLOAD);
        Logger.info(`[WorkerUpload] Worker ${process.pid} start!`);
    }

    public static get Instance(): WorkerUpload {
        return this._instance || (this._instance = new this());
    }

    async Init() {
        // process.on('message', this.Listen.bind(this));
        /*const proxyParams = await EntityParameter.Instance.GetParams(['PROXY_SERVER',
            'PROXY_PORT',
            'PROXY_PROTOCOL',
            'PROXY_USER',
            'PROXY_PASS',
            'PROXY_ENABLE']);

        if (Number(proxyParams['PROXY_ENABLE'])) {
            Logger.debug(`Proxy agent: ${JSON.stringify(proxyParams)}`);
            Upaki.UpdateProxyAgent({
                PROXY_SERVER: proxyParams['PROXY_SERVER'],
                PROXY_PORT: proxyParams['PROXY_PORT'],
                PROXY_PROTOCOL: proxyParams['PROXY_PROTOCOL'],
                PROXY_USER: proxyParams['PROXY_USER'],
                PROXY_PASS: proxyParams['PROXY_PASS']
            });
        }*/
        await QueueUploader.Instance.initTasks();
        QueueUploader.Instance.tasks.Start();
        this.UpdateUiHandler();
    }

    UpdateUiHandler() {
        setInterval(() => {
            this.UpdateUiList();
        }, 5000);
    }

    UpdateUiList() {
        if (QueueUploader.Instance.tasks /*&& QueueUploader.Instance.tasks.getTaskListByPriority().length !== 0*/) {
            WorkerUpload.Instance.sendUploadList();
        }
    }

    StartUpload(src, session: S3StreamSessionDetails, rootFolder: string) {
        let file = new File(src, rootFolder);
        QueueUploader.Instance.addJob(Util.ProcessPriority(new UploaderTask(file, session)));
    }

    Listen(msg: any) {
        try {
            /*if (msg === 'shutdown') {
                Shutdown();
                return;
            }*/

            switch (msg.type) {
                /*case 'DO_UPLOAD':
                    let file = new File(msg.data.file.filePath, msg.data.file.rootFolder);
                    QueueUploader.Instance.addJob(Util.ProcessPriority(new UploaderTask(file, msg.data.session)));
                    break;

                case 'STOP_UPLOAD':
                    this.StopUploadsOfPath(msg.data);
                    break;

                case 'DATABASE_RESPONSE':
                    Database.Instance.DbResponse(msg.data);
                    break;*/
            }
        } catch (error) {
            Logger.error(error);
        }
    }

    public StopUploadsOfPath(path, descriptor: STOP_UPLOAD_DESCRIPTOR) {
        const byFilePath = QueueUploader.Instance.tasks.byIndex('filePath', path);

        if (byFilePath) {
            try {
                Logger.debug(`Request cancel taskId=${byFilePath.task.id}`);
                byFilePath.task.Cancel(descriptor);
            } catch (error) {
                Logger.error(error);
            }
        }
        /*QueueUploader.Instance.tasks.getTaskListByPriority().forEach(job => {
            try {
                if (job.task.file.getPath() === path) {
                    Logger.debug(`Request cancel taskId=${job.task.id}`);
                    job.task.Cancel();
                }
            } catch (error) {
                Logger.error(error);
            }
        });*/
    }

    /*AddUpload(upload: UploaderTask) {
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
    }*/

    sendUploadList() {
        try {
            let taskByPriority = /*QueueUploader.Instance.tasks.getTaskListByPriority()*/QueueUploader.Instance.tasks.trends(5);

            let totalSend = QueueUploader.Instance.totalUploadBytes/*taskByPriority.reduce<number>((i, el) => { //contar!!!
                return i + (el.task.file.getSize(true) - el.task.loaded);
            }, 0)*/;

            let numberOfUploads = QueueUploader.Instance.tasks.getTotalQueue(); // numero de uploads !!!!!!

            /*
            ordenacao
            taskByPriority = taskByPriority.sort((a, b) => {
                if (a.task.state === UploadState.UPLOADING) {
                    return -1;
                } else {
                    return 1;
                }
            });*/

            let listUpload = taskByPriority.map(task => {
                let upload = task.task;

                // if (upload.file.Exists()) {
                return {
                    path: upload.file.getPath(),
                    cloudpath: upload.file.getKey(),
                    state: upload.state,
                    parts: upload.session.Parts,
                    loaded: upload.loaded,
                    uploadType: upload.uploadType,
                    size: upload.file.getSize(true),
                    name: upload.file.getFullName(),
                    key: upload.file.getKey(),
                    preventTimeLeft: upload.preventTimeLeft,
                    speedBps: upload.speedBps,
                    speed: upload.speed,
                    speedType: upload.speedType
                }
                /* } else {
                     Logger.warn(`Task upload file ${task.id}, file not exists!!! removed from queue ${upload.file.filePath}`);
                     task.Finish();
                     return undefined;
                 }*/
            })/*.filter(el => el !== undefined)*/;

            /*MessageToWorker(WorkProcess.WORKER_SOCKET, {
                type: 'UPLOAD_LIST', data: {
                    list: listUpload,
                    numberOfUploads: numberOfUploads,
                    totalSend: totalSend
                }
            });*/

            FunctionsBinding.Instance.UpdateUploadList({
                list: listUpload,
                numberOfUploads: numberOfUploads,
                totalSend: totalSend
            });

            UIFunctionsBinding.Instance.UpdateUploadListUI({
                list: listUpload,
                numberOfUploads: numberOfUploads,
                totalSend: totalSend
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