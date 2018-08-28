import * as cluster from 'cluster';
import { WorkerScanProcess } from './WorkerScanProcess';
import { WorkerProcessFile } from './WorkerProcessFile';
import { WorkerUpload } from './WorkerUpload';
import { WorkerSocket } from './WorkerSocket';
import { Worker } from 'cluster';
import { Logger } from '../util/Logger';
import { WorkProcess } from './UtilWorker';
import * as events from 'events';
export class WorkerMaster {
    private static _instance: WorkerMaster;
    WORKER_SOCKET: Worker;
    WORKER_SCAN_PROCESS: Worker;
    WORKER_PROCESS_FILE: Worker;
    WORKER_UPLOAD: Worker;
    WORKER_WHATCHER: Worker;
    events: events.EventEmitter;

    constructor() {
        this.events = new events.EventEmitter();
    }

    public static get Instance(): WorkerMaster {
        return this._instance || (this._instance = new this());
    }

    Init() {
        this.WORKER_PROCESS_FILE = cluster.fork();
        this.WORKER_PROCESS_FILE.on('message', this.Listen.bind(this));
        this.WORKER_PROCESS_FILE.on('online', () => {
            this.WORKER_PROCESS_FILE.send({ type: 'CONFIG_WORKER', work: WorkProcess.WORKER_PROCESS_FILE });
            this.WORKER_UPLOAD = cluster.fork();
            this.WORKER_UPLOAD.on('message', this.Listen.bind(this));
            this.WORKER_UPLOAD.on('online', () => {
                this.WORKER_UPLOAD.send({ type: 'CONFIG_WORKER', work: WorkProcess.WORKER_UPLOAD });
                this.WORKER_SOCKET = cluster.fork();
                this.WORKER_SOCKET.on('message', this.Listen.bind(this));
                this.WORKER_SOCKET.on('online', () => {
                    this.WORKER_SOCKET.send({ type: 'CONFIG_WORKER', work: WorkProcess.WORKER_SOCKET });
                    this.WORKER_SCAN_PROCESS = cluster.fork();
                    this.WORKER_SCAN_PROCESS.on('message', this.Listen.bind(this));

                    this.WORKER_WHATCHER = cluster.fork();
                    this.WORKER_WHATCHER.on('message', this.Listen.bind(this));
                    this.WORKER_WHATCHER.on('online', () => {
                        this.WORKER_WHATCHER.send({ type: 'CONFIG_WORKER', work: WorkProcess.WORKER_WHATCHER });
                    });
                    this.WORKER_SCAN_PROCESS.on('online', () => {
                        this.WORKER_SCAN_PROCESS.send({ type: 'CONFIG_WORKER', work: WorkProcess.WORKER_SCAN_PROCESS });
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
                    this.WORKER_UPLOAD.send({ type: 'CONFIG_WORKER', work: WorkProcess.WORKER_UPLOAD });
                });

                let shutdown = () => {
                    Logger.info('Shutting down workers...');
                    this.WORKER_UPLOAD.send('shutdown');
                };

                process.on('SIGTERM', shutdown.bind(this));
                process.on('SIGINT', shutdown.bind(this));
            });

            this.WORKER_WHATCHER.on('exit', (worker, code, signal) => {
                Logger.error(`Closed Worker - [WORKER_WHATCHER] - Cluster ID=${worker.id} Closed Code=${code}`);
                this.WORKER_WHATCHER = cluster.fork();

                
                this.WORKER_WHATCHER.on('message', this.Listen.bind(this));
                this.WORKER_WHATCHER.on('online', () => {
                    this.WORKER_WHATCHER.send({ type: 'CONFIG_WORKER', work: WorkProcess.WORKER_WHATCHER });
                });

                let shutdown = () => {
                    Logger.info('Shutting down workers...');
                    this.WORKER_WHATCHER.send('shutdown');
                };

                process.on('SIGTERM', shutdown.bind(this));
                process.on('SIGINT', shutdown.bind(this));
            });

            this.WORKER_SOCKET.on('exit', (worker, code, signal) => {
                Logger.error(`Closed Worker - [WORKER_SOCKET] - Cluster ID=${worker.id} Closed Code=${code}`);
                this.WORKER_SOCKET = cluster.fork();

                this.WORKER_SOCKET.on('message', this.Listen.bind(this));
                this.WORKER_SOCKET.on('online', () => {
                    this.WORKER_SOCKET.send({ type: 'CONFIG_WORKER', work: WorkProcess.WORKER_SOCKET });
                });

                let shutdown = () => {
                    Logger.info('Shutting down workers...');
                    this.WORKER_SOCKET.send('shutdown');
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
                this.WORKER_PROCESS_FILE.send({ type: msg.type_to, data: msg.data });
                break;
            case WorkProcess.WORKER_UPLOAD:
                this.WORKER_UPLOAD.send({ type: msg.type_to, data: msg.data });
                break;
            case WorkProcess.WORKER_SOCKET:
                this.WORKER_SOCKET.send({ type: msg.type_to, data: msg.data });
                break;
            case WorkProcess.WORKER_SCAN_PROCESS:
                this.WORKER_SCAN_PROCESS.send({ type: msg.type_to, data: msg.data });
                break;
        }
    }

    ListenShutdownClusters() {
        let shutdown = () => {
            Logger.info('Shutting down workers...');

            this.WORKER_PROCESS_FILE.send('shutdown');
            this.WORKER_UPLOAD.send('shutdown');
            this.WORKER_SOCKET.send('shutdown');
            this.WORKER_SCAN_PROCESS.send('shutdown');

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