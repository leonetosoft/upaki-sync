//import * as ipc from 'node-ipc';
import { WorkProcess } from './UtilWorker';

export class SystemWorket {
    workerP: WorkProcess
    constructor(woker: WorkProcess) {
        this.workerP = woker;
    }

    private ConfigureWorker() {
      //  ipc.config.id = 'worker_' + this.workerP;
      //  ipc.config.retry = 1500;
      //  ipc.config.silent = true;
    }
}