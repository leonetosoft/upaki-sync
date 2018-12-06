import * as cluster from 'cluster';
import { WorkerMaster } from './WorkerMaster';
import { IQueuedSender } from '../ipc/QueueSender';
import { WorkProcess } from '../api/thread';

export interface IMessageToWorker {
    type: 'SEND_REQUEST_CALL' | 'RECEIVE_CALL_RESPONSE' | 'FILE_LIST' /* Lista de arquivos */ | 'UPLOAD_LIST' | 'DO_UPLOAD' | 'DATABASE' | 'DATABASE_RESPONSE' | 'CONTINUE_SCAN' | 'STOP_UPLOAD' | 'ADD_FILE' | 'UPLOAD_STATE' | 'UPLOAD_NOTIFY',
    data: any
}
export namespace ProcesSys {
    export var processMaster: WorkerMaster;
    export var sender: IQueuedSender;
    export var pname: string;
}

export function MessageToWorker(work: WorkProcess, msg: IMessageToWorker) {
    if (!cluster.isMaster) {
        ProcesSys.sender.send({ type: 'TO_WORKER', work: work, type_to: msg.type, data: msg.data });
    } else {
        ProcesSys.processMaster.ToWorkerMsg({ work: work, type_to: msg.type, data: msg.data });
    }
}

export function Shutdown() {
   process.exit(0);
    setTimeout(() => {
        process.exit(1);
    }, 5 * 1e+3)
}