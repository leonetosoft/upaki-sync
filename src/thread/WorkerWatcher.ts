import { Database } from './../persist/Database';
import { Worker } from "cluster";
import { Logger } from "../util/Logger";
import { Shutdown, MessageToWorker, WorkProcess } from "./UtilWorker";
import { Util } from "../util/Util";
import { QueueUploader } from "../sync/queue/QueueUploader";
import { UploaderTask } from "../sync/task/UploaderTask";
import { File } from "../sync/File";
import { SyncDataNative } from "../sync/SyncDataNative";
import { Environment } from "../config/env";
import { FileTypeAction } from "../sync/task/FileTask";

export class WorkerWatcher {
    private static _instance: WorkerWatcher;
    constructor() {
        Logger.info(`[WorkerWatcher] Worker ${process.pid} start!`);

        process.on('message', (msg) => {
            switch (msg) {
                case 'shutdown':
                    // Stop accepting connections, wait until existing connections close
                    process.exit(0);
                    setTimeout(() => {
                        process.exit(1);
                    }, 5 * 1e+3)
                    break;
                default:
                    break;
            }
        });
    }

    public static get Instance(): WorkerWatcher {
        return this._instance || (this._instance = new this());
    }

    Init() {
        process.on('message', this.Listen.bind(this));
        let sync = new SyncDataNative(Environment.config.synchPath);
        sync.StartSystem();
    }

    Listen(msg: any) {
        if (msg === 'shutdown') {
            Shutdown();
            return;
        }

        switch (msg.type) {
            case 'DO_UPLOAD':

                break;

            case 'DATABASE_RESPONSE':
                Database.Instance.DbResponse(msg.data);
                break;
        }
    }

    AddFileTask(type: 'folder' | 'file', key, action: FileTypeAction, oldKey: string = undefined) {
        MessageToWorker(WorkProcess.WORKER_PROCESS_FILE, { type: 'ADD_FILE', data: { key: key, action: action, item: type, oldKey: oldKey } });
    }
}