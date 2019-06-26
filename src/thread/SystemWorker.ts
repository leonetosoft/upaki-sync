//import * as ipc from 'node-ipc';
import { Shutdown, ProcesSys } from './UtilWorker';
import { SharedReceiveCall, SharedResponseCall } from '../ipc/EventBinding';
import { FunctionsBinding } from '../ipc/FunctionsBinding';
import { UIFunctionsBinding } from '../ipc/UIFunctionsBinding';
import { createQueuedSender } from '../ipc/QueueSender';
import { EntityTask } from '../persist/entities/EntityTask';
import { Logger } from '../util/Logger';
import * as events from 'events';
import { TaskModel, WorkProcess, ProcTaskState, TaskEvent } from '../api/thread';

export interface WorkerListeners {
    Listen: (msg: any) => void;
}

export class SystemWorker<T> {
    workerP: WorkProcess;
    pname: string;
    intervalUpdateUi;
    eventParams: events.EventEmitter;
    private modelProcess: TaskModel<T>;
    private modelProcessOld: string;
    constructor(woker: WorkProcess, pname = undefined) {
        this.workerP = woker;
        this.pname = pname;
        ProcesSys.sender = createQueuedSender(<any>process);
        ProcesSys.pname = pname;
        process.on('message', this.DefaultListem.bind(this));
        FunctionsBinding.Instance;
        UIFunctionsBinding.Instance;
        this.eventParams = new events.EventEmitter();
        this.ProcessSignals();
        ProcesSys.sender.send('WORKER_READY'); // envia uma mensagem avisando que esta tudo carregado
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

    UpdateUiHandler(time = 1000) {
        this.intervalUpdateUi = setInterval(async () => {
            this.SaveData();
        }, time);
    }

    protected async DefaultListem(msg: any) {
        if (msg === 'shutdown') {
            try {
                this.OnShuttdown();
                if (this.modelProcess) {
                    this.modelProcess.pstate = ProcTaskState.STOPPED;
                }

                Logger.info(`Shuttdown received in pid ${process.pid}`);
                if (this.modelProcess) {
                    await this.SaveData();
                    Logger.info(`Data Saved in pid ${process.pid}`);
                }
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

            case 'UPDATE_PARAMETERS':
                this.eventParams.emit(msg.data.key, msg.data.value);
                break;
        }

        this.Listen(msg);
    }

    public OnShuttdown() { }

    async SaveData(force = false) {
        try {
            if (force) {
                await EntityTask.Instance.UpdateData(this.model);
            } else {
                if (this.hasChanges()) {
                    await EntityTask.Instance.UpdateDataLight(this.model);
                }
            }

            this.modelProcessOld = JSON.stringify(this.modelProcess);
        } catch (error) {
            Logger.error(error);
        }
    }

    private hasChanges(): boolean {
        if (!this.modelProcessOld) {
            return true;
        }

        if (this.modelProcess && JSON.stringify(this.modelProcess) !== JSON.stringify(this.modelProcessOld)) {
            return true;
        }

        return false;
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
            try {
                if (this.model.pstate === ProcTaskState.COMPLETED || this.model.pstate === ProcTaskState.STOPPED) {
                    if (this.intervalUpdateUi) {
                        clearInterval(this.intervalUpdateUi);
                    }
                    await this.SaveData(true);
                    Logger.warn(`Process ${process.pid} ${this.model.pstate === ProcTaskState.COMPLETED ? 'COMPLETED' : 'STOPPED'}`);
                    if (this.model.pstate === ProcTaskState.STOPPED) {
                        UIFunctionsBinding.Instance.OnTaskEvent(TaskEvent.TASK_STOP, this.model.pname);
                    } else {
                        UIFunctionsBinding.Instance.OnTaskEvent(TaskEvent.TASK_COMPLETE, this.model.pname);
                    }
                    process.exit(1);
                }

                if (this.model.pstate === ProcTaskState.COMPLETED_DELETE) {
                    if (this.intervalUpdateUi) {
                        clearInterval(this.intervalUpdateUi);
                    }
                    await this.SaveData(true);
                    await EntityTask.Instance.Delete(this.model.pname);
                    Logger.warn(`Process ${process.pid} Completed delete task`);
                    process.exit(1);
                }
            } catch (error) {
                Logger.error(error);
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