import { UploaderTask } from '../task/UploaderTask';
import { Processor } from "./../../queue/processor";
import { Job } from "./../../queue/job";
import { Environment } from '../../config/env';
import { Logger } from '../../util/Logger';
import { WorkerUpload } from '../../thread/WorkerUpload';
import { EntityFolderSync } from '../../persist/entities/EntityFolderSync';
import { Util } from '../../util/Util';
import * as rmdir from 'rmdir';

export class QueueUploader {
    private static _instance: QueueUploader;
    tasks: Processor<UploaderTask>;
    constructor() {
        this.initTasks();
    }

    public static get Instance(): QueueUploader {
        return this._instance || (this._instance = new this());
    }

    private processJobs(jobs: Job<UploaderTask>[]) {
        jobs.forEach(async (job, index) => {
            try {
                let uploader = job.task as UploaderTask;
                uploader.Upload();
            } catch (error) {
                job.Fail();
            }
        });
    }

    private async checkUploads(job: Job<UploaderTask>) {
        if (await EntityFolderSync.Instance.DeleteOnFinish(job.task.file.rootFolder)) {
            let totalSending = this.tasks.getTaskListByPriority().filter(el => el.task.file.rootFolder === job.task.file.rootFolder);
            if (totalSending.length === 0) {
                EntityFolderSync.Instance.DeleteFolder(job.task.file.rootFolder, (errDel) => {
                    if (!errDel) {
                        /*rmdir(job.task.file.rootFolder, (er, dirs, files) => {
                            if (er) {
                                Logger.error(er);
                            } else {
                                Logger.info(`Deleted ${dirs ? dirs.length : 0} directories and ${files ? files.length : 0} files`);
                            }
                        })*/
                    } else {
                        Logger.error(errDel);
                    }
                });
            }
        }
    }


    private initTasks() {
        this.tasks = new Processor((jobs: Job<UploaderTask>[]) => {
            this.processJobs(jobs);
        }, {
                taskSize: Environment.config.queue.uploader.taskSize,
                maxRetries: Environment.config.queue.uploader.maxRetries,
                retryDelay: Environment.config.queue.uploader.retryDelay
            });

        Logger.info(`[UploaderTask] - Queue initialized taskSize[${Environment.config.queue.uploader.taskSize}] maxRetries[${Environment.config.queue.uploader.maxRetries}] retryDelay[${Environment.config.queue.uploader.retryDelay}]`)

        this.tasks.Event('taskFinish', (task) => {
            Logger.debug(`Upload File Process ended id ${task.id}`);
            WorkerUpload.Instance.sendUploadList();
        });

        this.tasks.Event('taskRetry', (task) => {
            Logger.warn(`Upload File Process retry id ${task.id}`);
        });

        this.tasks.Event('taskProcessing', (task) => {
            Logger.debug(`Upload File Process Processing id ${task.id}`);
        });

        this.tasks.Event('taskMaxRetries', (task) => {
            Logger.warn(`Upload File Process max retries id ${task.id}`);
        });

        this.tasks.Event('taskUnQueue', (task) => {
            Logger.debug(`Upload File Process removed from queue id ${task.id}`);
            WorkerUpload.Instance.sendUploadList();
            this.checkUploads(task);
        });
    }
    isAlreadyUploading(path) {
        return this.tasks.getTaskListByPriority().findIndex(el => el.task.file.filePath === path) !== -1;
    }
    addJob(job: UploaderTask) {
        if (!this.isAlreadyUploading(job.file.filePath)) {
            this.tasks.AddJob(job);
        } else {
            Logger.warn(`File  ${job.file.filePath} already uploading!`);
        }
    }
}
