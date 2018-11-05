import { Processor } from "./../../queue/processor";
import { Job } from "./../../queue/job";
import { Environment } from '../../config/env';
import { Logger } from '../../util/Logger';
import { DownloadTask } from "../task/DownloadTask";
import { WorkerDownload } from "../../thread/WorkerDownload";

export class QueueDownload {
    private static _instance: QueueDownload;
    public tasks: Processor<DownloadTask>;
    constructor() {
        this.initTasks();
    }

    public static get Instance(): QueueDownload {
        return this._instance || (this._instance = new this());
    }

    private processJobs(jobs: Job<DownloadTask>[]) {
        jobs.forEach(async (job, index) => {
            try {
                let download = job.task;
                download.Download();
            } catch (error) {
                job.Fail(Environment.config.queue.renameAction.retryDelay || 10000);
            }
        });
    }

    private initTasks() {
        this.tasks = new Processor((jobs: Job<DownloadTask>[]) => {
            this.processJobs(jobs);
        }, {
                taskSize: Environment.config.queue.renameAction.taskSize || 1,
                maxRetries: Environment.config.queue.renameAction.maxRetries || 10,
                retryDelay: Environment.config.queue.renameAction.retryDelay || 10000
            });

        Logger.info(`[TaskDownload] - Queue initialized taskSize[${Environment.config.queue.renameAction.taskSize}] maxRetries[${Environment.config.queue.renameAction.maxRetries}] retryDelay[${Environment.config.queue.renameAction.retryDelay}]`)

        this.tasks.Event('taskFinish', (task) => {
            Logger.info(`Task Download File Process ended id ${task.id}`);
        });

        this.tasks.Event('taskRetry', (task) => {
            Logger.warn(`Task Download File Process retry id ${task.id}`);
        });

        this.tasks.Event('taskProcessing', (task) => {
            Logger.info(`Task Download File Process Processing id ${task.id}`);
        });

        this.tasks.Event('taskMaxRetries', (task) => {
            Logger.warn(`Task Download File Process max retries id ${task.id}`);
        });

        this.tasks.Event('taskUnQueue', (task: Job<DownloadTask>) => {
            Logger.warn(`Task Download File Process removed from queue id ${task.id}`);
            try {
                WorkerDownload.Instance.SaveData();
            } catch (error) {
                Logger.error(error);
            }

            if (this.tasks.NoTasksProcessing()) {
                Logger.debug(`Next tasks ...`);
                WorkerDownload.Instance.LoadFiles();
            }
        });

        this.tasks.Start();
    }

    addJob(job: DownloadTask) {
        if(!this.tasks){
            this.initTasks();
        }

        this.tasks.AddJob(job);
    }
}
