import { UploaderTask } from '../task/UploaderTask';
import { Processor } from "./../../queue/processor";
import { Job } from "./../../queue/job";
import { Environment } from '../../config/env';
import { Logger } from '../../util/Logger';
import { WorkerUpload } from '../../thread/WorkerUpload';
import { EntityParameter } from '../../persist/entities/EntityParameter';

export class QueueUploader {
    private static _instance: QueueUploader;
    tasks: Processor<UploaderTask>;
    totalUploadBytes = 0;
    constructor() {
        // this.initTasks();
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
        //deprecated
        
       /* try {
            if (await EntityFolderSync.Instance.DeleteOnFinish(job.task.file.rootFolder)) {
                let totalSending = this.tasks.getTaskListByPriority().filter(el => el.task.file.rootFolder === job.task.file.rootFolder);
                if (totalSending.length === 0) {
                    EntityFolderSync.Instance.DeleteFolder(job.task.file.rootFolder, (errDel) => {
                        if (!errDel) {

                        } else {
                            Logger.error(errDel);
                        }
                    });
                }
            }
        } catch (error) {
            Logger.error(error);
        }*/
    }


    public async initTasks() {
        let parameters = await EntityParameter.Instance.GetParams(['MAX_UPLOAD_QUEUE', 'MAX_RETRY_UPLOAD', 'UPLOAD_RETRY_DELAY']);
        Logger.debug('========== UPLOAD PARAMETERS ==========');
        Logger.debug(JSON.stringify(parameters));
        this.tasks = new Processor((jobs: Job<UploaderTask>[]) => {
            this.processJobs(jobs);
        }, {
                /*taskSize: Environment.config.queue.uploader.taskSize,
                maxRetries: Environment.config.queue.uploader.maxRetries,
                retryDelay: Environment.config.queue.uploader.retryDelay*/
                taskSize: parseInt(parameters['MAX_UPLOAD_QUEUE']),
                maxRetries: parseInt(parameters['MAX_RETRY_UPLOAD']),
                retryDelay: parseInt(parameters['UPLOAD_RETRY_DELAY']),
                indexes: ['filePath']
            }, true);

        WorkerUpload.Instance.eventParams.on('MAX_UPLOAD_QUEUE', (value) => {
            Logger.debug('Change MAX_UPLOAD_QUEUE to ' + value);
            this.tasks.taskSize = parseInt(value);
        });

        WorkerUpload.Instance.eventParams.on('MAX_RETRY_UPLOAD', (value) => {
            Logger.debug('Change MAX_RETRY_UPLOAD to ' + value);
            this.tasks.maxRetries = parseInt(value);
        });

        WorkerUpload.Instance.eventParams.on('UPLOAD_RETRY_DELAY', (value) => {
            Logger.debug('Change UPLOAD_RETRY_DELAY to ' + value);
            this.tasks.retryDelay = parseInt(value);
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

        this.tasks.Event('taskUnQueue', (task: Job<UploaderTask>) => {
            Logger.debug(`Upload File Process removed from queue id ${task.id}`);
            this.totalUploadBytes -= task.task.file.getSize(true);
            WorkerUpload.Instance.sendUploadList();
            this.checkUploads(task);
        });
    }

    addJob(job: UploaderTask) {
        const byFilePath = this.tasks.byIndex('filePath', job.file.filePath);
        if(byFilePath) {
            Logger.warn(`File  ${job.file.filePath} already uploading!`);
            return;
        }
        if(job.file.getSize(true)) {
            this.totalUploadBytes += job.file.getSize(true);
        }
        this.tasks.Enqueue(job);
    }
}
