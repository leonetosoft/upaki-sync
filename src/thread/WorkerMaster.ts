import * as cluster from 'cluster';
import { Worker } from 'cluster';
import { Logger } from '../util/Logger';
import { WorkProcess, ProcesSys, ProcessType, ProcTaskState } from './UtilWorker';
import * as events from 'events';
import { UIEvents } from '../ipc/UIEvents';
import { SharedReceiveCall, SharedResponseCall } from '../ipc/EventBinding';
import { FunctionsBinding } from '../ipc/FunctionsBinding';
import { UIFunctionsBinding } from '../ipc/UIFunctionsBinding';
import { createQueuedSender, IQueuedSender } from '../ipc/QueueSender';
import * as uuidv1 from 'uuid/v1';
import { TaskModel, EntityTask } from '../persist/entities/EntityTask';
import { PendingFolder, DownloadProcData, ScanDownloadState } from './WorkerDownload';
// import { UploadList } from '../ipc/IPCInterfaces';
/*export class testBing implements UIEvents {
    UploadList(list: UploadList) {
        throw new Error("Method not implemented.");
    }   
     PathScan(src: string, actualScan: string) {
        throw new Error("Method not implemented.");
    }
    FinishScan(src: string) {
        throw new Error("Method not implemented.");
    }
}*/

export interface WorkerProcess {
    pname: string;
    WORKER: Worker;
    sender?: IQueuedSender;
    ready?: boolean;
}

export class WorkerMaster {
    private static _instance: WorkerMaster;
    WORKER_SOCKET: Worker;
    WORKER_SCAN_PROCESS: Worker;
    WORKER_PROCESS_FILE: Worker;
    WORKER_UPLOAD: Worker;
    WORKER_WHATCHER: Worker;

    WORKER_SOCKET_SENDER: IQueuedSender;
    WORKER_SCAN_PROCESS_SENDER: IQueuedSender;
    WORKER_PROCESS_FILE_SENDER: IQueuedSender;
    WORKER_UPLOAD_SENDER: IQueuedSender;
    WORKER_WHATCHER_SENDER: IQueuedSender;

    events: events.EventEmitter;
    implUi: UIEvents[] = [];

    ready = false;

    PROCESS_LIST: WorkerProcess[] = [];


    constructor() {
        this.events = new events.EventEmitter();
        ProcesSys.processMaster = this;
        // this.RegisterUI(new testBing());
        FunctionsBinding.Instance;
        UIFunctionsBinding.Instance;
    }

    public static get Instance(): WorkerMaster {
        return this._instance || (this._instance = new this());
    }

    public isReady() {
        return this.ready;
    }

    public RegisterUI(ui: UIEvents) {
        this.implUi.push(ui);
    }

    public CreateDownloadTask(pendFolders: PendingFolder[], pdesc: string, destinination: string, pname = undefined, forcesave = false): Promise<WorkerProcess> {
        return new Promise((resolve, reject) => {
            let task: TaskModel<DownloadProcData> = {
                pdesc: pdesc,
                ptype: ProcessType.DOWNLOAD,
                pdata: {
                    pendingFiles: [],
                    pendingFolders: pendFolders,
                    actualFolder: pendFolders[0],
                    folder: pendFolders[0].name,
                    destFolder: destinination,
                    path: [],
                    state: ScanDownloadState.CREATED
                },
                pstate: ProcTaskState.CREATED
            };

            if (pname) {
                task.pname = pname;
            }

            this.forkProcess(task, true, (err, worker) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(worker);
                }
            }, forcesave)
        })
    }

    public async StartTask(pname: string): Promise<WorkerProcess> {
        return new Promise<WorkerProcess>(async (resolve, reject) => {
            let taskStart = await EntityTask.Instance.getTask(pname);
            if (!taskStart) {
                reject(new Error(`Tarefa não encontrada`));
                return;
            }
            this.forkProcess(taskStart, true, (err, worker) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(worker);
                }
            })
        });
    }

    public StopTask(pname: string) {
        let indexOfProc = this.PROCESS_LIST.findIndex(el => el.pname === pname);
        if (indexOfProc) {
            this.PROCESS_LIST[indexOfProc].WORKER.kill();
            this.PROCESS_LIST.splice(indexOfProc, 1);
            Logger.info(`Process task ${pname} terminated by user!`);
        } else {
            throw new Error(`Process task ${pname} not found or not started!`);
        }
    }

    public async DeleteTask(pname: string) {
        try {
            this.StopTask(pname);
        } catch (error) {
            // ignore !
            Logger.warn(`Request stop ${pname} : ${error.message}`);
        }
        await EntityTask.Instance.Delete(pname);
    }

    /**
     * Iniciaza tarefa
     * @param newProcess Modelo de tarefa a ser iniciada
     * @param initialize Se true inicializar a tarefa imediatamente
     * @param callback (err, worker) Retorna err !== undefined caso houver erro ou pnew com dados do novo processo
     */
    public async forkProcess<T>(newProcess: TaskModel<T>, initialize = false, callback: (err: Error, pnew: WorkerProcess) => void, forcesave = false) {
        try {
            if (!newProcess.pname) {
                newProcess.pname = uuidv1();
                await EntityTask.Instance.UpdateData(newProcess);
            }

            if (forcesave) {
                await EntityTask.Instance.UpdateData(newProcess);
            }

            if (!newProcess.pdata) {
                callback(new Error(`Não existe nenhum dado nesta tarefa`), undefined);
                return;
            }

            if (!newProcess.pdesc) {
                callback(new Error(`Não existe uma descricao para esta tarefa`), undefined);
                return;
            }

            let indexOfProcF = this.PROCESS_LIST.findIndex(el => el.pname === newProcess.pname);

            if (indexOfProcF !== -1) {
                callback(new Error(`Tarefa ${newProcess.pname} identificada por ${newProcess.pdesc} já esta iniciada!`), undefined);
                return;
            }

            if (initialize) {
                var new_worker_env = {};
                new_worker_env["PNAME"] = newProcess.pname;
                new_worker_env["PTYPE"] = newProcess.ptype;

                let proc: WorkerProcess = {
                    pname: newProcess.pname,
                    WORKER: cluster.fork(new_worker_env),
                    ready: false
                };

                this.PROCESS_LIST.push(proc);

                proc.sender = createQueuedSender(<any>proc.WORKER);

                proc.WORKER.on('message', this.Listen.bind(this));
                proc.WORKER.on('online', () => {
                    proc.ready = true;
                    Logger.info(`Process task ${newProcess.pname} identified by ${newProcess.pname} is ready!`);
                    callback(undefined, proc);
                });

                proc.WORKER.on('exit', (worker, code, signal) => {
                    let indexOfProc = this.PROCESS_LIST.findIndex(el => el.pname === newProcess.pname);
                    this.PROCESS_LIST.splice(indexOfProc, 1);
                    Logger.info(`Process task ${newProcess.pname} identified by ${newProcess.pname} exit code!`);
                });
            } else {
                callback(undefined, undefined);
            }
        } catch (error) {
            callback(error, undefined);
            Logger.error(error);
        }
    }

    private ShutdownWorkers(workerSender: IQueuedSender, worker: Worker) {
        return new Promise((resolve, reject) => {
            let timeout;
            Logger.info(`Request close process ${worker.process.pid} ...`);
            workerSender.send('shutdown');
            worker.disconnect();
            Logger.info(`Send shutdown and close IPC Channel, await disconnect event ${worker.process.pid} ...`);
            timeout = setTimeout(() => {
                Logger.warn(`Process force disconnection ${worker.process.pid} ...`);
                worker.kill();
                resolve(worker.process.pid);
            }, 2000);

            worker.on('disconnect', () => {
                Logger.info(`Process ${worker.process.pid} gracefull close`);
                clearTimeout(timeout);
                resolve(worker.process.pid);
            });
        });
    }

    CloseAllProcess() {
        return Promise.all([
            this.ShutdownWorkers(this.WORKER_PROCESS_FILE_SENDER, this.WORKER_PROCESS_FILE),
            this.ShutdownWorkers(this.WORKER_SCAN_PROCESS_SENDER, this.WORKER_SCAN_PROCESS),
            this.ShutdownWorkers(this.WORKER_SOCKET_SENDER, this.WORKER_SOCKET),
            this.ShutdownWorkers(this.WORKER_UPLOAD_SENDER, this.WORKER_UPLOAD),
            this.ShutdownWorkers(this.WORKER_WHATCHER_SENDER, this.WORKER_WHATCHER),
            Promise.all(this.PROCESS_LIST.map((el) => {
                return this.ShutdownWorkers(el.sender, el.WORKER);
            }))
        ]);
        /*Logger.debug(`Closing all clusters !`);
        if (this.WORKER_PROCESS_FILE.isConnected()) {
            this.WORKER_PROCESS_FILE.kill();
        }

        if (this.WORKER_UPLOAD.isConnected()) {
            this.WORKER_UPLOAD.kill();
        }

        if (this.WORKER_SOCKET.isConnected()) {
            this.WORKER_SOCKET.kill();
        }

        if (this.WORKER_SCAN_PROCESS.isConnected()) {
            this.WORKER_SCAN_PROCESS.kill();
        }

        if (this.WORKER_WHATCHER.isConnected()) {
            this.WORKER_WHATCHER.kill();
        }

        for (let task of this.PROCESS_LIST) {
            try {
                task.WORKER.kill();
            } catch (error) {
                Logger.error(error);
            }
        }*/



    }

    Init(onInit?: () => void) {
        this.ready = false;
        this.WORKER_PROCESS_FILE = cluster.fork();
        this.WORKER_PROCESS_FILE_SENDER = createQueuedSender(this.WORKER_PROCESS_FILE.process);
        this.WORKER_PROCESS_FILE.on('message', this.Listen.bind(this));
        this.WORKER_PROCESS_FILE.on('online', () => {
            this.WORKER_PROCESS_FILE_SENDER.send({ type: 'CONFIG_WORKER', work: WorkProcess.WORKER_PROCESS_FILE });
            this.WORKER_UPLOAD = cluster.fork();
            this.WORKER_UPLOAD_SENDER = createQueuedSender(this.WORKER_UPLOAD.process);
            this.WORKER_UPLOAD.on('message', this.Listen.bind(this));
            this.WORKER_UPLOAD.on('online', () => {
                this.WORKER_UPLOAD_SENDER.send({ type: 'CONFIG_WORKER', work: WorkProcess.WORKER_UPLOAD });
                this.WORKER_SOCKET = cluster.fork();
                this.WORKER_SOCKET_SENDER = createQueuedSender(this.WORKER_SOCKET.process);
                this.WORKER_SOCKET.on('message', this.Listen.bind(this));
                this.WORKER_SOCKET.on('online', () => {
                    this.WORKER_SOCKET_SENDER.send({ type: 'CONFIG_WORKER', work: WorkProcess.WORKER_SOCKET });
                    this.WORKER_SCAN_PROCESS = cluster.fork();
                    this.WORKER_SCAN_PROCESS_SENDER = createQueuedSender(this.WORKER_SCAN_PROCESS.process);
                    this.WORKER_SCAN_PROCESS.on('message', this.Listen.bind(this));

                    this.WORKER_WHATCHER = cluster.fork();
                    this.WORKER_WHATCHER_SENDER = createQueuedSender(this.WORKER_WHATCHER.process);
                    this.WORKER_WHATCHER.on('message', this.Listen.bind(this));
                    this.WORKER_WHATCHER.on('online', () => {
                        this.WORKER_WHATCHER_SENDER.send({ type: 'CONFIG_WORKER', work: WorkProcess.WORKER_WHATCHER });
                    });
                    this.WORKER_SCAN_PROCESS.on('online', () => {
                        this.WORKER_SCAN_PROCESS_SENDER.send({ type: 'CONFIG_WORKER', work: WorkProcess.WORKER_SCAN_PROCESS });
                        if (onInit)
                            onInit();
                        this.ProcessStarted();
                        this.ListenShutdownClusters();
                    });
                });
            });
        });
    }


    ProcessStarted() {
        this.ready = true;
        try {
            /* setTimeout(() => {
                 console.log('fechando');
                 //this.WORKER_PROCESS_FILE_SENDER.send('shutdown');
 
                 this.CloseAllProcess().then(rs => {
                     console.log(rs);
                 }).catch(err => {
                     console.log(err);
                 })
             }, 15000);*/
            /*this.WORKER_PROCESS_FILE.on('exit', (worker, code, signal) => {
                Logger.error(`Closed Worker - [WORKER_PROCESS_FILE] - Cluster ID=${worker.id} Closed Code=${code}`);
                this.WORKER_PROCESS_FILE = cluster.fork();
                this.WORKER_PROCESS_FILE.on('message', this.Listen.bind(this));
                this.WORKER_PROCESS_FILE.on('online', () => {
                    this.WORKER_PROCESS_FILE.send({ type: 'CONFIG_WORKER', work: WorkProcess.WORKER_PROCESS_FILE });
                });

                let shutdown = () => {
                    Logger.info('Shutting down workers...');
                    this.WORKER_PROCESS_FILE.send('shutdown');
                };

                process.on('SIGTERM', shutdown.bind(this));
                process.on('SIGINT', shutdown.bind(this));
            });

            this.WORKER_UPLOAD.on('exit', (worker, code, signal) => {
                Logger.error(`Closed Worker - [WORKER_UPLOAD] - Cluster ID=${worker.id} Closed Code=${code}`);
                this.WORKER_UPLOAD = cluster.fork();

                this.WORKER_UPLOAD.on('message', this.Listen.bind(this));
                this.WORKER_UPLOAD.on('online', () => {
                    this.WORKER_UPLOAD_SENDER.send({ type: 'CONFIG_WORKER', work: WorkProcess.WORKER_UPLOAD });
                });

                let shutdown = () => {
                    Logger.info('Shutting down workers...');
                    this.WORKER_UPLOAD_SENDER.send('shutdown');
                };

                process.on('SIGTERM', shutdown.bind(this));
                process.on('SIGINT', shutdown.bind(this));
            });

            this.WORKER_WHATCHER.on('exit', (worker, code, signal) => {
                Logger.error(`Closed Worker - [WORKER_WHATCHER] - Cluster ID=${worker.id} Closed Code=${code}`);
                this.WORKER_WHATCHER = cluster.fork();


                this.WORKER_WHATCHER.on('message', this.Listen.bind(this));
                this.WORKER_WHATCHER.on('online', () => {
                    this.WORKER_WHATCHER_SENDER.send({ type: 'CONFIG_WORKER', work: WorkProcess.WORKER_WHATCHER });
                });

                let shutdown = () => {
                    Logger.info('Shutting down workers...');
                    this.WORKER_WHATCHER_SENDER.send('shutdown');
                };

                process.on('SIGTERM', shutdown.bind(this));
                process.on('SIGINT', shutdown.bind(this));
            });

            this.WORKER_SOCKET.on('exit', (worker, code, signal) => {
                Logger.error(`Closed Worker - [WORKER_SOCKET] - Cluster ID=${worker.id} Closed Code=${code}`);
                this.WORKER_SOCKET = cluster.fork();

                this.WORKER_SOCKET.on('message', this.Listen.bind(this));
                this.WORKER_SOCKET.on('online', () => {
                    this.WORKER_SOCKET_SENDER.send({ type: 'CONFIG_WORKER', work: WorkProcess.WORKER_SOCKET });
                });

                let shutdown = () => {
                    Logger.info('Shutting down workers...');
                    this.WORKER_SOCKET_SENDER.send('shutdown');
                };

                process.on('SIGTERM', shutdown.bind(this));
                process.on('SIGINT', shutdown.bind(this));
            });*/
        } catch (error) {
            Logger.error(error);
        }
    }

    Listen(msg: any) {
        try {
            this.events.emit('message', msg);
            switch (msg.type) {
                case 'TO_WORKER':
                    /*console.log(msg.data);
                    this.WORKER_PROCESS_FILE.send({ type: 'LIST_FILES', data: msg.data });*/
                    this.ToWorkerMsg(msg);
                    break;
            }
        } catch (error) {
            Logger.error(error);
        }
    }

    ToWorkerMsg(msg: any) {
        switch (msg.work) {
            case WorkProcess.WORKER_PROCESS_FILE:
                this.WORKER_PROCESS_FILE_SENDER.send({ type: msg.type_to, data: msg.data });
                break;
            case WorkProcess.WORKER_UPLOAD:
                this.WORKER_UPLOAD_SENDER.send({ type: msg.type_to, data: msg.data });
                break;
            case WorkProcess.WORKER_SOCKET:
                this.WORKER_SOCKET_SENDER.send({ type: msg.type_to, data: msg.data });
                break;
            case WorkProcess.WORKER_SCAN_PROCESS:
                this.WORKER_SCAN_PROCESS_SENDER.send({ type: msg.type_to, data: msg.data });
                break;
            case WorkProcess.MASTER:
                switch (msg.type_to) {
                    case 'SEND_REQUEST_CALL':
                        SharedReceiveCall(msg.data);
                        break;

                    case 'RECEIVE_CALL_RESPONSE':
                        SharedResponseCall(msg.data);
                        break;
                }
                break;
            default:
                if (!msg.data.args) {
                    Logger.error(`Msg destined by task not contains parameters taskid`);
                    return;
                }
                let taskId = msg.data.args[0];

                let task = this.PROCESS_LIST.find(el => el.pname === taskId);
                if (task) {
                    task.WORKER.send({ type: msg.type_to, data: msg.data });
                } else {
                    // throw new Error(`Tarefa não encontrada ou nao iniciada`);
                    Logger.error(`Msg destined for task ${taskId} not sended, task not found`);
                }
                break;
        }
    }

    ListenShutdownClusters() {
        let shutdown = () => {
            Logger.info('Shutting down workers...');

            this.WORKER_PROCESS_FILE_SENDER.send('shutdown');
            this.WORKER_UPLOAD_SENDER.send('shutdown');
            this.WORKER_SOCKET_SENDER.send('shutdown');
            this.WORKER_SCAN_PROCESS_SENDER.send('shutdown');
        };

        process.on('SIGTERM', shutdown.bind(this));
        process.on('SIGINT', shutdown.bind(this));
        process.on('SIGKILL', shutdown.bind(this));
    }

}