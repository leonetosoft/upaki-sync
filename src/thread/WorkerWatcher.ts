import { Database } from './../persist/Database';
import { Logger } from "../util/Logger";
import { SyncDataNative } from "../sync/SyncDataNative";
import { FileTypeAction } from "../sync/task/FileTask";
import { EntityFolderSync } from '../persist/entities/EntityFolderSync';
import { SystemWorker } from './SystemWorker';
import { FunctionsBinding } from '../ipc/FunctionsBinding';
import { WorkProcess } from '../api/thread';

export interface WhacterFolder {
    path: string;
    watcher: SyncDataNative;
}
export class WorkerWatcher extends SystemWorker<any> {
    private static _instance: WorkerWatcher;
    private watchers: WhacterFolder[] = [];
    constructor() {
        super(WorkProcess.WORKER_WHATCHER);
        Logger.info(`[WorkerWatcher] Worker ${process.pid} start!`);
    }

    public static get Instance(): WorkerWatcher {
        return this._instance || (this._instance = new this());
    }

    StopWhatch(folder) {
        let item = this.watchers.find(el => el.path === folder);
        if (item) {
            item.watcher.Stop();
        } else {
            Logger.warn(`Folder ${folder} not found in whatching`);
        }
    }

    AddWatch(src) {
        let sync = new SyncDataNative(src);
        sync.StartWhatch();
        Logger.info(`Folder ${src} on whatch`);
        this.watchers.push({
            path: src,
            watcher: sync
        });
    }

    Init() {
        EntityFolderSync.Instance.ListFolders(async (err, folders) => {
            if (err) {
                Logger.error(err);
                return;
            }
            for (let folder of folders) {
                this.AddWatch(folder);
            }
        });
    }

    Listen(msg: any) {
        switch (msg.type) {
            case 'DO_UPLOAD':

                break;

            case 'ADD_WATCH':
                this.AddWatch(msg.data);
                break;

            case 'STOP_WATCHER':
                this.StopWhatch(msg.data);
                break;
        }
    }

    AddFileTask(type: 'folder' | 'file', key, action: FileTypeAction, oldKey: string = undefined, rootFolder: string) {
        // MessageToWorker(WorkProcess.WORKER_PROCESS_FILE, { type: 'ADD_FILE', data: { key: key, action: action, item: type, oldKey: oldKey } });
        FunctionsBinding.Instance.WatchFileEvent({ key: key, action: action, item: type, oldKey: oldKey, rootFolder: rootFolder});
    }
}