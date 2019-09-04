import { Task, PRIORITY_QUEUE } from './task';
import { STATUS } from './stat';
import { Job } from './job';

import * as events from 'events';
import { Logger } from '../util/Logger';
import * as fs from 'fs';

//var eventEmitter =
export interface Indexe<T extends Task> {
    [index: string]: Job<T>;
}
export interface ProcessorIndexes<T extends Task> {
    [index: string]: Indexe<T>;
}

export class Processor<T extends Task> {
    private loopTime: number;
    public retryDelay: number;
    public maxRetries: number;
    public taskSize: number;
    // private taskList: Job<T>[];
    private taskListHigh: Job<T>[];
    private taskListMedium: Job<T>[];
    private taskListLow: Job<T>[];
    private fn: any;
    private interval: NodeJS.Timer;
    public eventEmitter: events.EventEmitter;
    private indexes: ProcessorIndexes<T> = {};

    countProcessing: number = 0;

    debug = false;

    constructor(fn, options, debug = false) {
        this.loopTime = options.loopTime || 1000;
        this.retryDelay = options.retryDelay || 1000;
        this.maxRetries = options.maxRetries || 1;
        this.taskSize = options.taskSize || 1;
        options.indexes = options.indexes ? [options.indexes, ...['id']] : ['id'];
        //this.taskList = [];
        if (options.indexes) {
            for (let index of options.indexes) {
                this.indexes[String(index)] = {};
            }
        }

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

        this.debug = debug;
        /*  if (debug) {
              setInterval(() => {
                 // this.DebugIndex();
                 console.log(this.indexes['filePath']);
              }, 1000);
          }*/
    }

    getTotalQueue() {
        return this.taskListHigh.length + this.taskListMedium.length + this.taskListLow.length;
    }

    trends(max: number) {
        let trends_1 = this.taskListHigh.slice(0, max);
        if (trends_1.length === max) {
            return trends_1;
        }

        let trends_2 = this.taskListMedium.slice(0, max - trends_1.length);
        if ((trends_1.length + trends_2.length) === max) {
            return [...trends_1, ...trends_2];
        }

        let trends_3 = this.taskListLow.slice(0, max - trends_1.length - trends_2.length);
        return [...trends_1, ...trends_2, ...trends_3];
    }

    byIndex(index: string, value: string): Job<T> {
        if (this.indexes[index]) {
            return this.indexes[index][value];
        }
    }

    NoTasksProcessing() {
        return this.taskListHigh.length === 0 && this.taskListMedium.length === 0 && this.taskListLow.length === 0;
    }

    getTaskById(id): Job<T> {
        return this.indexes['id'][id];
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

    DebugIndex() {
        var cache = [];
        fs.writeFile(`testa.json`, JSON.stringify(this.indexes, function (key, value) {
            if (typeof value === 'object' && value !== null) {
                if (cache.indexOf(value) !== -1) {
                    // Duplicate reference found, discard key
                    return;
                }
                // Store value in our collection
                cache.push(value);
            }
            return value;
        }, 4), function (err) {
            if (err) {
                console.log(err);
            } else {
                console.log("JSON saved to " + 'testa.json');
            }
        });
    }

    Enqueue(task: Task) {
        let jb = new Job<T>(<T>task, this);

        for (let index of Object.keys(this.indexes)) {
            if (index !== 'id' && !jb.task[index]) {
                console.log(`Index ${index} not exists in task`);
                this.eventEmitter.emit('indexError', `Index ${index} not exists in task`);
                continue;
            }
            this.indexes[index][String(index !== 'id' ? jb.task[index] : jb['id'])] = jb;
        }

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
        return this.countProcessing;
    }

    RemoveFinishedJob(job: Job<T>) {
        let indexDel = -1;

        for (let index of Object.keys(this.indexes)) {
            if ((index !== 'id' && job.task[index]) || index === 'id') {
                delete this.indexes[index][index !== 'id' ? job.task[index] : job['id']];
            }
        }

        switch (job.task.priority) {
            case PRIORITY_QUEUE.HIGH:
                indexDel = this.taskListHigh.findIndex(jobFind => jobFind.id === job.id);
                if (indexDel !== -1) {
                    this.taskListHigh.splice(indexDel, 1);
                    this.countProcessing--;
                    this.eventEmitter.emit('taskUnQueue', job);
                }
                else
                    Logger.warn(`Unknow job id [${job.id}] state [${job.stat}] Priority [${job.task.priority}]`);
                break;

            case PRIORITY_QUEUE.LOW:
                indexDel = this.taskListLow.findIndex(jobFind => jobFind.id === job.id);
                if (indexDel !== -1) {
                    this.taskListLow.splice(indexDel, 1);
                    this.countProcessing--;
                    this.eventEmitter.emit('taskUnQueue', job);
                }
                else
                    Logger.warn(`Unknow job id [${job.id}] state [${job.stat}] Priority [${job.task.priority}]`);
                break;

            case PRIORITY_QUEUE.MEDIUM:
                indexDel = this.taskListMedium.findIndex(jobFind => jobFind.id === job.id);
                if (indexDel !== -1) {
                    this.taskListMedium.splice(indexDel, 1);
                    this.countProcessing--;
                    this.eventEmitter.emit('taskUnQueue', job);
                }
                else
                    Logger.warn(`Unknow job id [${job.id}] state [${job.stat}] Priority [${job.task.priority}]`);
                break;
        }


    }

    // Coleta tarefa para processar
    DeQueue() {
        let jobArray = [];

        if (this.CountProcessingJobs() >= this.taskSize) {
            return jobArray;
        }

        let i = 0;
        for (const arr of ['taskListHigh', 'taskListMedium', 'taskListLow']) {

            i = 0;
            while (i < this[arr].length && (jobArray.length + this.CountProcessingJobs()) < this.taskSize) {
                const job = this[arr][i];
                if ((job.stat === STATUS.PENDING || job.stat === STATUS.FAILED) /*&&
                (jobArray.length + processingJobs) < this.taskSize*/) {
                    job.stat = STATUS.PROCESSING;
                    this.eventEmitter.emit('taskProcessing', job);
                    jobArray.push(job);
                }

                i++;
            }
        }

        return jobArray;
    }
}