//import * as ipc from 'node-ipc';
import { Shutdown, ProcesSys } from './UtilWorker';
import { SharedReceiveCall, SharedResponseCall } from '../ipc/EventBinding';
import { FunctionsBinding } from '../ipc/FunctionsBinding';
import { UIFunctionsBinding } from '../ipc/UIFunctionsBinding';
import { createQueuedSender } from '../ipc/QueueSender';
import { EntityTask } from '../persist/entities/EntityTask';
import { Logger } from '../util/Logger';
import { TaskModel, WorkProcess, ProcTaskState } from '../api/thread';

export interface WorkerListeners {
    Listen: (msg: any) => void;
}

export class SystemWorker<T> {
    workerP: WorkProcess;
    pname: string;
    private modelProcess: TaskModel<T>;
    constructor(woker: WorkProcess, pname = undefined) {
        this.workerP = woker;
        this.pname = pname;
        ProcesSys.sender = createQueuedSender(<any>process);
        ProcesSys.pname = pname;
        process.on('message', this.DefaultListem.bind(this));
        FunctionsBinding.Instance;
        UIFunctionsBinding.Instance;
        this.ProcessSignals();
    }

    get model() {
        return this.modelProcess;
    }

    get pData() {
        return this.model.pdata;
    }

    async LoadData() {
        this.model = await EntityTask.Instance.getTask<T>(this.pname);
    }

    set model(model) {
        this.modelProcess = model;
        this.modelProcess.pstate = ProcTaskState.STARTED;
        this.MonitoreProcess();
    }

    protected async DefaultListem(msg: any) {
        if (msg === 'shutdown') {
            this.OnShuttdown();
            this.modelProcess.pstate = ProcTaskState.STOPPED;
            try {
                Logger.info(`Shuttdown received in pid ${process.pid}`);
                await this.SaveData();
                Logger.info(`Data Saved in pid ${process.pid}`);
            } catch (error) {
                Logger.error(error);
            } finally {
                Logger.info(`Send Exit code in pid ${process.pid}`);
                Shutdown();
            }
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

    public OnShuttdown(){}

    async SaveData() {
        try {
            await EntityTask.Instance.UpdateData(this.model);
        } catch (error) {
            Logger.error(error);
        }
    }

    /* UpdateTaskDefs() {
         if (!this.model.pdata || !this.pname) {
             Logger.warn(`UpdateTaskDefs in process ${process.pid} is invalid !!`);
             return;
         }
         let dataCache = JSON.stringify(this.model.pdata);
         Util.WriteCache(this.pname, dataCache, (err, cacheSource) => {
             if (err) {
                 Logger.error(err);
             } else {
                 UIFunctionsBinding.Instance.UpdateTaskDefinition(this.pname, cacheSource);
             }
         });
     }*/

    MonitoreProcess() {
        if (!this.model)
            return;

        setInterval(async () => {
            if (this.model.pstate === ProcTaskState.COMPLETED || this.model.pstate === ProcTaskState.STOPPED) {
                await this.SaveData();
                Logger.warn(`Process ${process.pid} ${this.model.pstate === ProcTaskState.COMPLETED ? 'COMPLETED' : 'STOPPED'}`);
                process.exit(1);
            }
        }, 1000);
    }

    ProcessSignals() {
        process.on('SIGTERM', async () => {
            Logger.debug(`SIGTERM - received!`);
            if (this.model) {
                Logger.debug(`Process ${this.model.pname} Save process data !!`);
                await this.SaveData();
            }
        });
        process.on('SIGINT', async () => {
            Logger.debug(`SIGINT - received!`);
            if (this.model) {
                Logger.debug(`Process ${this.model.pname} Save process data !!`);
                await this.SaveData();
            }
        });
    }

    Listen(msg: any) { }
}