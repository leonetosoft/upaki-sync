//import * as ipc from 'node-ipc';
import { WorkProcess, Shutdown } from './UtilWorker';
import { SharedReceiveCall, SharedResponseCall } from '../ipc/EventBinding';
import { FunctionsBinding } from '../ipc/FunctionsBinding';
import { UIFunctionsBinding } from '../ipc/UIFunctionsBinding';

export interface WorkerListeners {
    Listen: (msg: any) => void;
}

export class SystemWorker {
    workerP: WorkProcess
    constructor(woker: WorkProcess) {
        this.workerP = woker;
        process.on('message', this.DefaultListem.bind(this));
        FunctionsBinding.Instance;
        UIFunctionsBinding.Instance;
    }

    protected DefaultListem(msg: any) {
        if (msg === 'shutdown') {
            Shutdown();
            return;
        }

        switch (msg.type) {
            case 'SEND_REQUEST_CALL':
                SharedReceiveCall(msg.data);
                break;

            case 'RECEIVE_CALL_RESPONSE':
                SharedResponseCall(msg.data);
                break;
        }

        this.Listen(msg);
    }

    Listen(msg: any) { }
}