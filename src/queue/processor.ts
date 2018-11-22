import { Task, PRIORITY_QUEUE } from './task';
import { STATUS } from './stat';
import { Job } from './job';

import * as events from 'events';
import { Logger } from '../util/Logger';

//var eventEmitter =

export class Processor<T extends Task> {
    private loopTime: number;
    private retryDelay: number;
    public maxRetries: number;
    private taskSize: number;
    // private taskList: Job<T>[];
    private taskListHigh: Job<T>[];
    private taskListMedium: Job<T>[];
    private taskListLow: Job<T>[];
    private fn: any;
    private interval: NodeJS.Timer;
    public eventEmitter: events.EventEmitter;
    private countProcessing = 0;

    constructor(fn, options) {
        this.loopTime = options.loopTime || 1000;
        this.retryDelay = options.retryDelay || 1000;
        this.maxRetries = options.maxRetries || 1;
        this.taskSize = options.taskSize || 1;
        //this.taskList = [];

        this.taskListHigh = [];
        this.taskListMedium = [];
        this.taskListLow = [];
        // taskError
        // taskFinish
        // taskRetry
        // taskProcessing
        // taskMaxRetries
        // taskUnQueue
        this.eventEmitter = new events.EventEmitter();

        this.fn = fn;

        // this.Loop();

        process.on('SIGINT', () => {
            if (this.interval !== undefined) {
                clearInterval(this.interval);
            }
        });
    }

    /*getTaskList(): Job<T>[] {
        return this.taskList;
    }*/

    getTaskListByPriority(): Job<T>[] {
        /*let taskHigh = this.taskList.filter(task =>
            task.task.priority == PRIORITY_QUEUE.HIGH);

        let taskMedium = this.taskList.filter(task =>
            task.task.priority == PRIORITY_QUEUE.MEDIUM);

        let taskLow = this.taskList.filter(task =>
            task.task.priority == PRIORITY_QUEUE.LOW);*/

        let selectedTasks: Job<T>[] = [];
        selectedTasks = selectedTasks.concat(this.taskListHigh, this.taskListMedium, this.taskListLow);

        return selectedTasks;
    }

    NoTasksProcessing() {
        return this.taskListHigh.length === 0 && this.taskListMedium.length === 0 && this.taskListLow.length === 0;
    }

    getTaskById(id): Job<T> {
        return this.getTaskListByPriority().find(t => t.id === id);
    }

    LoopFunction() {
        try {
            let jobs = this.DeQueue(); // Coleto as tarefas

            if (jobs.length > 0) {
                this.countProcessing += jobs.length;
                try {
                    this.fn.call(this, jobs);
                } catch (err) {
                    Logger.error('Execution Error !!!');
                    Logger.error(err);
                }
            } else {
                // console.log('no jobs ', this.countProcessing);
            }
        } catch (error) {
            Logger.error('Error LoopFuncion');
            Logger.error(error);
        }
    }

    Event(evt, func) {
        this.eventEmitter.on(evt, func);
    }

    Loop() {
        this.interval = setInterval(this.LoopFunction.bind(this), this.loopTime);
    }

    Start() {
        this.Loop();
    }

    Stop() {
        clearInterval(this.interval);
    }

    AddJob(task: Task) {
        let jb = new Job<T>(<T>task, this);

        switch (jb.task.priority) {
            case PRIORITY_QUEUE.HIGH:
                this.taskListHigh.push(jb);
                break;

            case PRIORITY_QUEUE.LOW:
                this.taskListLow.push(jb);
                break;

            case PRIORITY_QUEUE.MEDIUM:
                this.taskListMedium.push(jb);
                break;
        }

    }

    CountProcessingJobs() {
        let counter = 0;
        this.getTaskListByPriority().forEach((job, index) => {
            if (job.stat == STATUS.PROCESSING) {
                counter++;
            }
        });
        return counter;
    }

    RemoveFinishedJob(job: Job<T>) {
        let indexDel = -1;
        switch (job.task.priority) {
            case PRIORITY_QUEUE.HIGH:
                indexDel = this.taskListHigh.findIndex(jobFind => jobFind.id === job.id);
                if (indexDel !== -1) {
                    this.taskListHigh.splice(indexDel, 1);
                    this.countProcessing--;
                }
                else
                    Logger.error(`Unknow job id [${job.id}] state [${job.stat}] Priority [${job.task.priority}]`);
                break;

            case PRIORITY_QUEUE.LOW:
                indexDel = this.taskListLow.findIndex(jobFind => jobFind.id === job.id);
                if (indexDel !== -1) {
                    this.taskListLow.splice(indexDel, 1);
                    this.countProcessing--;
                }
                else
                    Logger.error(`Unknow job id [${job.id}] state [${job.stat}] Priority [${job.task.priority}]`);
                break;

            case PRIORITY_QUEUE.MEDIUM:
                indexDel = this.taskListMedium.findIndex(jobFind => jobFind.id === job.id);
                if (indexDel !== -1) {
                    this.taskListMedium.splice(indexDel, 1);
                    this.countProcessing--;
                }
                else
                    Logger.error(`Unknow job id [${job.id}] state [${job.stat}] Priority [${job.task.priority}]`);
                break;
        }

        this.eventEmitter.emit('taskUnQueue', job);
    }
    RemoveFinishedJobsDEPRECATED() {
        /*let deleteList: { id?: number, priority?: PRIORITY_QUEUE } = [];
        this.getTaskListByPriority().forEach((job, index) => {
            if (job.stat == STATUS.FINISHED || job.stat == STATUS.MAX_RETRIES) {
                deleteList.push(index);
                this.eventEmitter.emit('taskUnQueue', job);
            }
        });*/

        let deletions = this.getTaskListByPriority().filter(job => job.stat == STATUS.FINISHED || job.stat == STATUS.MAX_RETRIES);
        //console.log(deleteList);
        deletions.forEach((del) => {
            // this.taskList.splice(del, 1);
            let indexDel = -1;
            switch (del.task.priority) {
                case PRIORITY_QUEUE.HIGH:
                    indexDel = this.taskListHigh.findIndex(jobFind => jobFind.task.id === del.task.id);
                    if (indexDel)
                        this.taskListHigh.splice(indexDel, 1);
                    break;

                case PRIORITY_QUEUE.LOW:
                    indexDel = this.taskListLow.findIndex(jobFind => jobFind.task.id === del.task.id);
                    if (indexDel)
                        this.taskListLow.splice(indexDel, 1);
                    break;

                case PRIORITY_QUEUE.MEDIUM:
                    indexDel = this.taskListMedium.findIndex(jobFind => jobFind.task.id === del.task.id);
                    if (indexDel)
                        this.taskListMedium.splice(indexDel, 1);
                    break;
            }



        });
    }
    // Coleta tarefa para processar
    DeQueue() {
        //let i = 0;
        let jobArray = [];
        let processingJobs = this.CountProcessingJobs()/*this.countProcessing*/;


        /*let taskHigh = this.taskList.filter(task =>
            (task.stat === STATUS.PENDING || task.stat === STATUS.FAILED) &&
            task.task.priority == PRIORITY_QUEUE.HIGH);

        let taskMedium = this.taskList.filter(task =>
            (task.stat === STATUS.PENDING || task.stat === STATUS.FAILED) &&
            task.task.priority == PRIORITY_QUEUE.MEDIUM);

        let taskLow = this.taskList.filter(task =>
            (task.stat === STATUS.PENDING || task.stat === STATUS.FAILED) &&
            task.task.priority == PRIORITY_QUEUE.LOW);

        let selectedTasks: Job<T>[] = [];
        selectedTasks = selectedTasks.concat(taskHigh, taskMedium, taskLow);*/

        /*if (taskHigh.length > 0) {
            selectedTasks = taskHigh;
        } else if (taskMedium.length > 0) {
            selectedTasks = taskMedium;
        } else {
            selectedTasks = taskLow;
        }*/
        // Logger.debug(`High: ${taskHigh.length} Low: ${taskLow.length} Medium: ${taskMedium.length}`);
        //if (this.countProcessing < this.taskSize) {
        this.getTaskListByPriority().forEach((job, index) => {
            if ((job.stat == STATUS.PENDING || job.stat == STATUS.FAILED) &&
                (jobArray.length + processingJobs) < this.taskSize) {
                job.stat = STATUS.PROCESSING;
                this.eventEmitter.emit('taskProcessing', job);
                jobArray.push(job);
            }
        });
        // }

        /*this.taskList.forEach((job, index) => {
            if ((job.stat == STATUS.PENDING || job.stat == STATUS.FAILED) &&
                (jobArray.length + processingJobs) < this.taskSize) {
                job.stat = STATUS.PROCESSING;
                this.eventEmitter.emit('taskProcessing', job);
                jobArray.push(job);
            }
        });*/

        return jobArray;
    }
}