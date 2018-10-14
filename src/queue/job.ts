import { Task } from './task';
import { Processor } from './processor';
import { STATUS } from './stat';
import * as uuidv1 from 'uuid/v1';

export class Job<T extends Task> {
    public task: T;
    public stat: STATUS = STATUS.PENDING;
    public id: string;
    private processor: Processor<T>;
    private retries: number;

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
            setTimeout(() => {
                this.processor.eventEmitter.emit('taskRetry', this);
                this.retries++;
                this.stat = STATUS.FAILED;

            }, retryTime);
        }
    }
}