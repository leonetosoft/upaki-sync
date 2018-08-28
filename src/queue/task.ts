import { Job } from './job';
export enum PRIORITY_QUEUE {
    HIGH = 'HIGH',
    MEDIUM = 'MEDIUM',
    LOW = 'LOW'
};

export class Task {
    id: number;
    job: Job<Task>;
    priority: PRIORITY_QUEUE = PRIORITY_QUEUE.MEDIUM;
}