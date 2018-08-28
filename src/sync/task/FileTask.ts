import { QueueFile } from './../queue/QueueFile';
import { UploaderTask, UploadState } from './UploaderTask';
import { QueueUploader } from './../queue/QueueUploader';
import { EntityUpload } from './../../persist/entities/EntityUpload';
import { File } from './../File';
import { Task, PRIORITY_QUEUE } from './../../queue/task';
import { Logger } from '../../util/Logger';
import { Environment } from '../../config/env';
import { S3StreamSessionDetails } from 'upaki-cli';
import { WorkerProcessFile } from '../../thread/WorkerProcessFile';
import { Util } from '../../util/Util';
import * as fs from 'fs';

export enum FileTypeAction {
    ADD = 'ADD',
    UNLINK = 'UNLINK',
    CHANGE = 'CHANGE',
    RENAME = 'RENAME'
}

export class FileTask extends Task {
    file: File;
    action: FileTypeAction;
    constructor(file: File, action: FileTypeAction) {
        super();
        this.file = file;
        this.action = action;
    }

    /**
     * Termina os uploads deste path
     * @param path 
     */
    private StopUploadsOfPath(path) {
        if (!Environment.config.useCluster) {
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
        } else {
            WorkerProcessFile.Instance.RequestStopUpload(path);
        }
    }

    /**
     * Termina as analises deste arquivo visto que a analise não pode continuar
     * 
     * @private
     * @memberof FileTask
     */
    private StopFileAnalizes() {
        QueueFile.Instance.tasks.getTaskListByPriority().forEach(job => {
            try {
                if (job.task.id !== this.id) {
                    job.Finish();
                }
            } catch (error) {
                Logger.error(error);
            }
        });
    }

    /*private ProcessPriority(task: UploaderTask) {
        if (task.loaded > 0) {
            task.priority = PRIORITY_QUEUE.HIGH;
        } else if (task.file.getSize() < 5242880) {
            task.priority = PRIORITY_QUEUE.MEDIUM;
        } else {
            task.priority = PRIORITY_QUEUE.LOW;
        }
        return task;
    }*/

    private addUploadQueue(file: File, session: S3StreamSessionDetails = {
        Parts: [],
        DataTransfered: 0
    }) {
        if (!Environment.config.useCluster) {
            QueueUploader.Instance.addJob(Util.ProcessPriority(new UploaderTask(file, session)));
        } else {
            WorkerProcessFile.Instance.AddUploadQueue(file, session);
        }
    }

    async Analize() {
        try {
            if (!this.file.Exists()) {
                this.job.Finish();
                return;
            }

            if (this.file.getSize() <= 0) {
                this.job.Finish();
                return;
            }

            let fileData = await EntityUpload.Instance.getFile(this.file.getPath());

            // console.log(JSON.stringify(fileData));
            if (this.action == FileTypeAction.ADD) {
                if (fileData) {
                    if (fileData.state === UploadState.FINISH && fileData.lastModifies !== this.file.getLastModifies()) {
                        // QueueUploader.Instance.addJob(this.ProcessPriority(new UploaderTask(this.file)));
                        this.addUploadQueue(this.file);
                    }
                    else if (fileData.state !== UploadState.FINISH) {
                        if(!fs.existsSync(fileData.path)){
                            await EntityUpload.Instance.delete(fileData.path);
                            this.job.Finish();
                        }
                        // caso for o mesmo arquivo ai sim reiniciar o upload
                        if (fileData.lastModifies === this.file.getLastModifies()) {
                            Logger.warn(`File ${this.file.getPath()} restart upload session data ${JSON.stringify(fileData.sessionData)}`);
                            this.file.key = fileData.key;
                            // QueueUploader.Instance.addJob(this.ProcessPriority(new UploaderTask(this.file, fileData.sessionData)));
                            this.addUploadQueue(this.file, fileData.sessionData);
                        } else {
                            Logger.warn(`File ${this.file.getPath()} reinit(FILE CHANGED) upload session data ${JSON.stringify(fileData.sessionData)}`);
                            fileData.sessionData.Parts = [];
                            // QueueUploader.Instance.addJob(this.ProcessPriority(new UploaderTask(this.file, {})));
                            this.addUploadQueue(this.file, {});
                        }
                    } else {
                        Logger.warn(`File ${this.file.getPath()} already uploaded`);
                    }
                } else {
                    // QueueUploader.Instance.addJob(this.ProcessPriority(new UploaderTask(this.file)));
                    this.addUploadQueue(this.file);
                }

                this.job.Finish();
            } else if (this.action == FileTypeAction.CHANGE) {
                this.StopUploadsOfPath(this.file.getPath());
                if (fileData) {
                    try {
                        let continueParts = fileData.sessionData;
                        await EntityUpload.Instance.delete(this.file.getPath());
                        continueParts.Parts = [];
                        continueParts.DataTransfered = 0;
                        // QueueUploader.Instance.addJob(this.ProcessPriority(new UploaderTask(this.file, continueParts)));
                        this.addUploadQueue(this.file, continueParts);
                    } catch (error) {
                        Logger.error(error);
                        this.job.Fail(Environment.config.queue.fileAction.retryDelay);
                    }
                } else {
                    // QueueUploader.Instance.addJob(this.ProcessPriority(new UploaderTask(this.file)));
                    this.addUploadQueue(this.file);
                }
                this.job.Finish();
            } else if (this.action == FileTypeAction.UNLINK) {
                if (fileData) {
                    try {
                        this.StopUploadsOfPath(this.file.getPath());
                    } catch (error) {
                        Logger.error(error);
                    } finally {
                        this.job.Finish();
                    }
                }
            } /*else if (this.action == FileTypeAction.RENAME) {
                this.StopUploadsOfPath(this.file.getPath());
                if (fileData) {
                    try {
                        Logger.warn(`File ${this.file.getPath()} upload stop filename changed!`);
                        let continueParts = fileData.sessionData;
                        await EntityUpload.Instance.delete(this.file.getPath());
                        continueParts.Parts = [];
                        continueParts.DataTransfered = 0;
                        // QueueUploader.Instance.addJob(this.ProcessPriority(new UploaderTask(this.file, continueParts)));
                        this.addUploadQueue(this.file, continueParts);
                        this.job.Finish();
                    } catch (error) {
                        Logger.error(error);
                        this.job.Fail(Environment.config.queue.fileAction.retryDelay);
                    }
                }
            }*/


        } catch (error) {
            Logger.error(error);
            this.job.Fail(Environment.config.queue.fileAction.retryDelay);
        }
    }
}