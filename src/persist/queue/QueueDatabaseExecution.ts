import { Processor } from "../../queue/processor";
import { Job } from "../../queue/job";
import { Environment } from '../../config/env';
import { Logger } from '../../util/Logger';
import { DatabaseExecutionTask } from "./DatabaseExecutionTask";

export class QueueDatabaseExecution {
    private static _instance: QueueDatabaseExecution;
    public tasks: Processor<DatabaseExecutionTask>;
    constructor() {
        this.initTasks();
    }

    public static get Instance(): QueueDatabaseExecution {
        return this._instance || (this._instance = new this());
    }

    private processJobs(jobs: Job<DatabaseExecutionTask>[]) {
        jobs.forEach(async (job, index) => {
            try {
                job.task.Execute();
            } catch (error) {
                job.Fail(Environment.config.queue.renameAction.retryDelay || 10000);
            }
        });
    }

    private initTasks() {
        this.tasks = new Processor((jobs: Job<DatabaseExecutionTask>[]) => {
            this.processJobs(jobs);
        }, {
                taskSize: Environment.config.queue.database.taskSize || 1,
                maxRetries: Environment.config.queue.database.maxRetries || 10,
                retryDelay: Environment.config.queue.database.retryDelay || 10000
            });

        Logger.info(`[TaskDatabaseExecution] - Queue initialized taskSize[${Environment.config.queue.database.taskSize}] maxRetries[${Environment.config.queue.renameAction.maxRetries}] retryDelay[${Environment.config.queue.renameAction.retryDelay}]`)

        this.tasks.Event('taskFinish', (task) => {
            Logger.debug(`[TaskDatabaseExecution] - Process ended id ${task.id} await process [ ${this.tasks.getTaskListByPriority().length}, processing [${this.tasks.CountProcessingJobs()}]]`);
        });

        this.tasks.Event('taskRetry', (task) => {
            Logger.warn(`[TaskDatabaseExecution] - Process retry id ${task.id}`);
        });

        this.tasks.Event('taskProcessing', (task) => {
            Logger.debug(`[TaskDatabaseExecution] - Processing id ${task.id}`);
        });

        this.tasks.Event('taskMaxRetries', (task) => {
            Logger.warn(`[TaskDatabaseExecution] - Process max retries id ${task.id}`);
        });

        this.tasks.Event('taskUnQueue', (task: Job<DatabaseExecutionTask>) => {
            // Logger.debug(`[TaskDatabaseExecution] - Execution finished ${task.id}`);
        });

        this.tasks.Start();
    }

    addJob(job: DatabaseExecutionTask) {
        if(!this.tasks){
            this.initTasks();
        }

        this.tasks.AddJob(job);
    }
}
