import { FileTask, FileTypeAction } from './task/FileTask';
import { File } from './File';
import { QueueFile } from './queue/QueueFile';
import * as chokidar from 'chokidar';
import * as fs from 'fs';
import { Logger } from '../util/Logger';
import { Environment } from '../config/env';
import { SocketClient } from '../socket/SocketClient';
import { QueueUploader } from './queue/QueueUploader';
import { PRIORITY_QUEUE } from '../queue/task';
import { NSFW, ChangesWhatch } from './NSFW';
import { QueueRename } from './queue/QueueRename';
import { RenameTask } from './task/RenameTask';
import { WorkerWatcher } from '../thread/WorkerWatcher';
import { Util } from '../util/Util';

export class SyncDataNative {
    rootFolder: string;
    watcher: NSFW;
    constructor(folderPath: string) {
        this.rootFolder = folderPath;
    }

    StartSystem() {
        if (!Environment.config.useCluster) {
            this.Scan().then((files: string[]) => {
                Logger.info(`Total of ${files.length}, add to queue.`);
                // fs.writeFileSync('FILA.json', JSON.stringify(files, null, 4), 'utf8');
                files.forEach(element => {
                    if (element !== null && element !== undefined)
                        QueueFile.Instance.addJob(new FileTask(new File(element, this.rootFolder), FileTypeAction.ADD));
                });
                Logger.info(`Queue file ok.`);
            }).then(() => {
                this.StartWhatch();
            }).catch(err => {
                Logger.error(err);
            });
        } else {
            this.StartWhatch();
        }
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
            if (!Environment.config.useCluster) {
                if (change.type === 'file') {
                    Logger.debug(`New file add ${change.key}`);
                    QueueFile.Instance.addJob(new FileTask(new File(change.key, this.rootFolder), FileTypeAction.ADD));
                } else {
                    Logger.warn(`Ignored folder creation ${change.key}`);
                }
            } else {
                WorkerWatcher.Instance.AddFileTask(change.type, change.key, FileTypeAction.ADD);
            }
        } catch (error) {
            Logger.error(error);
        }
    }

    onRename(change: ChangesWhatch) {
        try {
            if (!this.IsValidFile(change.key)) {
                return;
            }
            if (!Environment.config.useCluster) {
                if (change.type === 'file') {
                    Logger.debug(`New file renamed ${change.key}`);
                    let job = new FileTask(new File(change.key, this.rootFolder), FileTypeAction.RENAME);
                    job.priority = PRIORITY_QUEUE.HIGH;
                    QueueFile.Instance.addJob(job);
                }

                QueueRename.Instance.addJob(new RenameTask(change.key, change.oldKey, this.rootFolder));
            } else {
                WorkerWatcher.Instance.AddFileTask(change.type, change.key, FileTypeAction.RENAME, change.oldKey);
            }
        } catch (error) {
            Logger.error(error);
        }
    }

    onDelete(change: ChangesWhatch) {
        try {
            if (!this.IsValidFile(change.key)) {
                return;
            }
            if (!Environment.config.useCluster) {
                if (change.type === 'file') {
                    Logger.debug(`Remove file ${change.key}`);
                    let job = new FileTask(new File(change.key, this.rootFolder), FileTypeAction.UNLINK);
                    job.priority = PRIORITY_QUEUE.HIGH;
                    QueueFile.Instance.addJob(job);
                }
            } else {
                WorkerWatcher.Instance.AddFileTask(change.type, change.key, FileTypeAction.UNLINK);
            }
        } catch (error) {
            Logger.error(error);
        }

    }

    onChanged(change: ChangesWhatch) {
        try {
            if (!this.IsValidFile(change.key)) {
                return;
            }
            if (!Environment.config.useCluster) {
                if (change.type === 'file') {
                    Logger.debug(`New file changed ${change.key}`);
                    let job = new FileTask(new File(change.key, this.rootFolder), FileTypeAction.CHANGE);
                    job.priority = PRIORITY_QUEUE.HIGH;
                    QueueFile.Instance.addJob(job);
                }
            } else {
                WorkerWatcher.Instance.AddFileTask(change.type, change.key, FileTypeAction.CHANGE);
            }
        } catch (error) {
            Logger.error(error);
        }
    }
}