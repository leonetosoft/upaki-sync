import { Processor } from "./../../queue/processor";
import { Job } from "./../../queue/job";
import { Environment } from '../../config/env';
import { Logger } from '../../util/Logger';
import { RenameTask } from '../task/RenameTask';

export class QueueRename {
    private static _instance: QueueRename;
    public tasks: Processor<RenameTask>;
    constructor() {
        this.initTasks();
    }

    public static get Instance(): QueueRename {
        return this._instance || (this._instance = new this());
    }

    private processJobs(jobs: Job<RenameTask>[]) {
        jobs.forEach(async (job, index) => {
            try {
                let uploader = job.task;
                uploader.Process();
            } catch (error) {
                job.Fail(Environment.config.queue.renameAction.retryDelay);
            }
        });
    }

    private initTasks() {
        this.tasks = new Processor((jobs: Job<RenameTask>[]) => {
            this.processJobs(jobs);
        }, {
                taskSize: Environment.config.queue.renameAction.taskSize,
                maxRetries: Environment.config.queue.renameAction.maxRetries,
                retryDelay: Environment.config.queue.renameAction.retryDelay
            });

        Logger.info(`[FileAction] - Queue initialized taskSize[${Environment.config.queue.renameAction.taskSize}] maxRetries[${Environment.config.queue.renameAction.maxRetries}] retryDelay[${Environment.config.queue.renameAction.retryDelay}]`)
        
        this.tasks.Event('taskFinish', (task) => {
            Logger.debug(`Task Rename File Process ended id ${task.id}`);
        });

        this.tasks.Event('taskRetry', (task) => {
            Logger.warn(`Task Rename File Process retry id ${task.id}`);
        });

        this.tasks.Event('taskProcessing', (task) => {
            Logger.debug(`Task Rename File Process Processing id ${task.id}`);
        });

        this.tasks.Event('taskMaxRetries', (task) => {
            Logger.warn(`Task Rename File Process max retries id ${task.id}`);
        });

        this.tasks.Event('taskUnQueue', (task) => {
            Logger.debug(`Task Rename File Process removed from queue id ${task.id}`);
        });
    }

    addJob(job: RenameTask) {
        this.tasks.AddJob(job);
    }
}
