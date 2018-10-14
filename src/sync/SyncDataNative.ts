import { FileTypeAction } from './task/FileTask';
import { QueueFile } from './queue/QueueFile';
import { Logger } from '../util/Logger';
import { Environment } from '../config/env';
import { SocketClient } from '../socket/SocketClient';
import { QueueUploader } from './queue/QueueUploader';
import { NSFW, ChangesWhatch } from './NSFW';
import { QueueRename } from './queue/QueueRename';
import { WorkerWatcher } from '../thread/WorkerWatcher';
import { Util } from '../util/Util';

export class SyncDataNative {
    rootFolder: string;
    watcher: NSFW;
    constructor(folderPath: string) {
        this.rootFolder = folderPath;
    }

    Scan() {
        return new Promise((resolve, reject) => {
            /*
            @Obsoleto
            ScannerDir(this.rootFolder, (err, files) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(files);
                }
            });*/
        });
    }

    IsValidFile(key) {
        if (Util.getExtension(key).indexOf('lnk') === -1 &&
            Util.getExtension(key).indexOf('tmp') === -1 &&
            key.indexOf('$Recycle.Bin') === -1 &&
            key.indexOf('Thumbs.db') === -1 &&
            key.indexOf('tmp$$') === -1 && key.indexOf('.DS_Store') === -1) {
            return true;
        } else {
            return false;
        }
    }

    Stop() {
        this.watcher.Stop();
    }

    StartWhatch() {
        this.watcher = new NSFW(this.rootFolder);
        this.watcher.Init();

        this.watcher.on('CREATED', this.onAdd.bind(this));
        this.watcher.on('MODIFIED', this.onChanged.bind(this));
        this.watcher.on('DELETED', this.onDelete.bind(this));
        this.watcher.on('RENAMED', this.onRename.bind(this));

        this.watcher.on('error', (err) => {
            Logger.error(err);
        });

        this.watcher.on('dbug', (dbug) => {
            Logger.info(dbug);
        });

        this.watcher.on('ready', () => {
            process.on('SIGINT', () => {
                try {
                    Logger.warn(`File Whatcher ended`);
                    this.watcher.emit('stop');
                    process.exit();
                } catch (error) {
                    Logger.error(error);
                }
            });
            Logger.info(`Folder ${this.rootFolder} is being monitored.`);
            if (!Environment.config.useCluster) {
                QueueFile.Instance.tasks.Start();
                QueueUploader.Instance.tasks.Start();
                QueueRename.Instance.tasks.Start();
                SocketClient.Instance;
            }
        });
    }

    onAdd(change: ChangesWhatch) {
        try {
            if (!this.IsValidFile(change.key)) {
                return;
            }
            WorkerWatcher.Instance.AddFileTask(change.type, change.key, FileTypeAction.ADD, undefined, this.rootFolder);
        } catch (error) {
            Logger.error(error);
        }
    }

    onRename(change: ChangesWhatch) {
        try {
            if (!this.IsValidFile(change.key)) {
                return;
            }
            WorkerWatcher.Instance.AddFileTask(change.type, change.key, FileTypeAction.RENAME, change.oldKey, this.rootFolder);
        } catch (error) {
            Logger.error(error);
        }
    }

    onDelete(change: ChangesWhatch) {
        try {
            if (!this.IsValidFile(change.key)) {
                return;
            }
            WorkerWatcher.Instance.AddFileTask(change.type, change.key, FileTypeAction.UNLINK, undefined, this.rootFolder);

        } catch (error) {
            Logger.error(error);
        }

    }

    onChanged(change: ChangesWhatch) {
        try {
            if (!this.IsValidFile(change.key)) {
                return;
            }
            WorkerWatcher.Instance.AddFileTask(change.type, change.key, FileTypeAction.CHANGE, undefined, this.rootFolder);
        } catch (error) {
            Logger.error(error);
        }
    }
}