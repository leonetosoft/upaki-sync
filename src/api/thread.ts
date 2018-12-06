import { Worker } from "cluster";
import { IQueuedSender } from "../ipc/QueueSender";

export interface WorkerProcess {
    pname: string;
    WORKER: Worker;
    sender?: IQueuedSender;
    ready?: boolean;
}

export interface TaskModel<T> {
    pname?: string;
    pdesc: string;
    pstate: ProcTaskState;
    ptype: ProcessType;
    pdata: T;
    autostart: number;
}

export enum WorkProcess {
    MASTER = 1,
    WORKER_PROCESS_FILE = 6,
    WORKER_UPLOAD = 2,
    WORKER_SOCKET = 3,
    WORKER_SCAN_PROCESS = 4,
    WORKER_WHATCHER = 5,
    WORKER_DOWNLOAD = '',
    WORKER_FILE_RECEIVER = ''
}

export enum ProcessType {
    DOWNLOAD = 1,
    FILE_RECEIVER = 2
}

export enum ProcTaskState {
    STOPPED = 0,
    STARTED = 2,
    ERROR = 3,
    COMPLETED = 4
}