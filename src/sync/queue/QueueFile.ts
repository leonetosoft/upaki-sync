import { FileTask } from './../task/FileTask';
import { Processor } from "./../../queue/processor";
import { Job } from "./../../queue/job";
import { Environment } from '../../config/env';
import { Logger } from '../../util/Logger';

export class QueueFile {
    private static _instance: QueueFile;
    public tasks: Processor<FileTask>;
    constructor() {
        this.initTasks();
    }

    public static get Instance(): QueueFile {
        return this._instance || (this._instance = new this());
    }

    private processJobs(jobs: Job<FileTask>[]) {
        jobs.forEach(async (job, index) => {
            try {
                let uploader = job.task as FileTask;
                uploader.Analize();
            } catch (error) {
                job.Fail(Environment.config.queue.fileAction.retryDelay);
            }
        });
    }

    private UploaderFinish(uploader: FileTask) {

    }

    private initTasks() {
        this.tasks = new Processor((jobs: Job<FileTask>[]) => {
            this.processJobs(jobs);
        }, {
                taskSize: Environment.config.queue.fileAction.taskSize,
                maxRetries: Environment.config.queue.fileAction.maxRetries,
                retryDelay: Environment.config.queue.fileAction.retryDelay
            });

        Logger.info(`[FileRename] - Queue initialized taskSize[${Environment.config.queue.fileAction.taskSize}] maxRetries[${Environment.config.queue.fileAction.maxRetries}] retryDelay[${Environment.config.queue.fileAction.retryDelay}]`)
        
        this.tasks.Event('taskFinish', (task) => {
            Logger.info(`Task File Process ended id ${task.id}`);
            // this.UploaderFinish(task as FileTask);
            /*if(Environment.config.useCluster && this.tasks.NoTasksProcessing()){
                WorkerProcessFile.Instance.ContinueScan();
            }*/
        });

        this.tasks.Event('taskRetry', (task) => {
            Logger.warn(`Task File Process retry id ${task.id}`);
        });

        this.tasks.Event('taskProcessing', (task) => {
            Logger.info(`Task File Process Processing id ${task.id}`);
        });

        this.tasks.Event('taskMaxRetries', (task) => {
            Logger.warn(`Task File Process max retries id ${task.id}`);

            /*if(Environment.config.useCluster && this.tasks.NoTasksProcessing()){
                WorkerProcessFile.Instance.ContinueScan();
            }*/
        });

        this.tasks.Event('taskUnQueue', (task) => {
            Logger.warn(`Task File Process removed from queue id ${task.id}`);
        });
    }

    addJob(job: FileTask) {
        this.tasks.AddJob(job);
    }
}
