import { Task } from './task';
import { Processor } from './processor';
import { STATUS } from './stat';
import * as uuidv1 from 'uuid/v1';
import { Logger } from '../util/Logger';

export class Job<T extends Task> {
    public task: T;
    public stat: STATUS = STATUS.PENDING;
    public id: string;
    private processor: Processor<T>;
    private retries: number;
    private retryTimeout;

    constructor(task: T, processor) {
        this.task = task;
        this.task.job = this;
        this.stat = STATUS.PENDING;
        this.id = uuidv1();
        this.task.id = this.id;
        this.processor = processor;
        //this.maxRetries = maxRetries;
        this.retries = 0;
    }

    Finish() {
        if(this.stat === STATUS.FINISHED) {
            return;
        }
        
        this.stat = STATUS.FINISHED;
        this.processor.eventEmitter.emit('taskFinish', this);
        this.processor.RemoveFinishedJob(this);
    }

    Fail(retryTime: number = 0) {
        if (this.retries == this.processor.maxRetries) {
            this.processor.eventEmitter.emit('taskMaxRetries', this);
            this.stat = STATUS.MAX_RETRIES;
            this.processor.RemoveFinishedJob(this);
        } else {
            if(this.retryTimeout) {
                Logger.warn(`Task ${this.id} already restry !!! await!`);
                return;
            }
            this.retryTimeout = setTimeout(() => {
                this.retryTimeout = undefined;
                
                this.processor.eventEmitter.emit('taskRetry', this);
                this.retries++;
                this.stat = STATUS.FAILED;
                this.processor.countProcessing--;
            }, retryTime);
        }
    }
}