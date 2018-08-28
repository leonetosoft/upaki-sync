export enum WorkProcess {
    MASTER = 1,
    WORKER_PROCESS_FILE = 1,
    WORKER_UPLOAD = 2,
    WORKER_SOCKET = 3,
    WORKER_SCAN_PROCESS = 4,
    WORKER_WHATCHER = 5
}

export interface IMessageToWorker {
    type: 'FILE_LIST' /* Lista de arquivos */|'UPLOAD_LIST' | 'DO_UPLOAD' | 'DATABASE' | 'DATABASE_RESPONSE' | 'CONTINUE_SCAN' | 'STOP_UPLOAD' | 'ADD_FILE' | 'UPLOAD_STATE' | 'UPLOAD_NOTIFY',
    data: any
}

export function MessageToWorker(work: WorkProcess, msg: IMessageToWorker) {
    process.send({ type: 'TO_WORKER', work: work, type_to: msg.type, data: msg.data });
}

export function Shutdown() {
    process.exit(0);
    setTimeout(() => {
        process.exit(1);
    }, 5 * 1e+3)
}