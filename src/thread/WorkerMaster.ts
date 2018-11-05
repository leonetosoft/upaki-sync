import * as cluster from 'cluster';
import { Worker } from 'cluster';
import { Logger } from '../util/Logger';
import { WorkProcess, ProcesSys, ProcessType } from './UtilWorker';
import * as events from 'events';
import { UIEvents } from '../ipc/UIEvents';
import { SharedReceiveCall, SharedResponseCall } from '../ipc/EventBinding';
import { FunctionsBinding } from '../ipc/FunctionsBinding';
import { UIFunctionsBinding } from '../ipc/UIFunctionsBinding';
import { createQueuedSender, IQueuedSender } from '../ipc/QueueSender';
import * as uuidv1 from 'uuid/v1';
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

    PROCESS_LIST: WorkerProcess[] = [];


    constructor() {
        this.events = new events.EventEmitter();
        ProcesSys.processMaster = this;
        // this.RegisterUI(new testBing());
    }

    public static get Instance(): WorkerMaster {
        return this._instance || (this._instance = new this());
    }

    public RegisterUI(ui: UIEvents) {
        this.implUi.push(ui);
    }

    public forkProcess(ptype: ProcessType, pname = uuidv1()) {
        var new_worker_env = {};
        new_worker_env["PNAME"] = pname;
        new_worker_env["PTYPE"] = ptype;

        let proc: WorkerProcess = {
            pname: pname,
            WORKER: cluster.fork(new_worker_env),
            ready: false
        };

        this.PROCESS_LIST.push(proc);

        proc.sender = createQueuedSender(<any>proc.WORKER);

        proc.WORKER.on('message', this.Listen.bind(this));
        proc.WORKER.on('online', () => {
            proc.ready = true;
        });
    }

    Init() {
        FunctionsBinding.Instance;
        UIFunctionsBinding.Instance;
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
                        this.ProcessStarted();
                        this.ListenShutdownClusters();
                    });
                });
            });
        });
    }


    ProcessStarted() {
        try {
            this.WORKER_PROCESS_FILE.on('exit', (worker, code, signal) => {
                Logger.error(`Closed Worker - [WORKER_PROCESS_FILE] - Cluster ID=${worker.id} Closed Code=${code}`);
                this.WORKER_PROCESS_FILE = cluster.fork();
                this.WORKER_PROCESS_FILE.on('message', this.Listen.bind(this));
                this.WORKER_PROCESS_FILE.on('online', () => {
                    this.WORKER_PROCESS_FILE_SENDER.send({ type: 'CONFIG_WORKER', work: WorkProcess.WORKER_PROCESS_FILE });
                });

                let shutdown = () => {
                    Logger.info('Shutting down workers...');
                    this.WORKER_PROCESS_FILE_SENDER.send('shutdown');
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
            });
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
        }
    }

    ListenShutdownClusters() {
        let shutdown = () => {
            Logger.info('Shutting down workers...');

            this.WORKER_PROCESS_FILE_SENDER.send('shutdown');
            this.WORKER_UPLOAD_SENDER.send('shutdown');
            this.WORKER_SOCKET_SENDER.send('shutdown');
            this.WORKER_SCAN_PROCESS_SENDER.send('shutdown');

            /*this.WORKER_PROCESS_FILE.on('exit', () => {
                Logger.info('[WORKER_PROCESS_FILE] - Close');
            });
            this.WORKER_UPLOAD.on('exit', () => {
                Logger.info('[WORKER_UPLOAD] - Close');
            });
            this.WORKER_SOCKET.on('exit', () => {
                Logger.info('[WORKER_SOCKET] - Close');
            });
            this.WORKER_SCAN_PROCESS.on('exit', () => {
                Logger.info('[WORKER_SCAN_PROCESS] - Close');
            });*/
        };

        process.on('SIGTERM', shutdown.bind(this));
        process.on('SIGINT', shutdown.bind(this));
    }

}