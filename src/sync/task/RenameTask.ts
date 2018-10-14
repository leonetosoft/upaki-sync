import { Task } from "../../queue/task";
import * as fs from 'fs';
import { EntityFolderMap } from "../../persist/entities/EntityFolderMap";
import { Upaki } from "upaki-cli";
import { Environment } from "../../config/env";
import { Logger } from "../../util/Logger";
import { EntityUpload } from "../../persist/entities/EntityUpload";
import { Util } from "../../util/Util";
import { QueueFile } from "../queue/QueueFile";
import { FileTask, FileTypeAction } from "./FileTask";
import { File } from "../File";

export class RenameTask extends Task {
    newKey: string;
    oldKey: string;
    upaki: Upaki;
    rootFolder: string;

    constructor(newKey: string, oldKey: string, rootFolder: string) {
        super();
        this.newKey = newKey;
        this.oldKey = oldKey;
        this.rootFolder = rootFolder;
    }

    getItemName(type: 'folder' | 'file') {
        if (type !== 'folder') {
            return Util.getFileNameByPath(this.newKey);
        } else {
            return Util.getFolderNameByPath(this.newKey);
        }
    }

    private async ChangeNameUpaki(id, type: 'folder' | 'file', idLocalDb) {
        try {
            if (!id) {
                Logger.error(`No id from item [${type}] ${this.newKey}`);

                let index = QueueFile.Instance.tasks.getTaskListByPriority().findIndex(job => job.task.file.getPath() == this.newKey);
                if (index === -1) {
                    QueueFile.Instance.addJob(new FileTask(new File(this.newKey, this.rootFolder), FileTypeAction.ADD));
                }
                return;
            }
            let changes = await this.upaki.changeName(type === 'file' ? this.newKey : this.newKey, id, this.getItemName(type));
            if (changes.code === 1) {
                if (type === 'folder') {
                    await EntityFolderMap.Instance.updateKey(idLocalDb, this.newKey);
                } else {
                    await EntityUpload.Instance.updateKey(idLocalDb, this.newKey);
                }
                this.job.Finish();
            } else {
                Logger.error(changes.msg);
                this.job.Fail(Environment.config.queue.renameAction.retryDelay);
            }
        } catch (error) {
            Logger.error(error);
            this.job.Fail(Environment.config.queue.renameAction.retryDelay);
        }
    }

    async Process() {
        if (!this.upaki) {
            this.upaki = new Upaki(Environment.config.credentials);
        }

        if (!fs.existsSync(this.newKey)) {
            Logger.warn(`Item ${this.newKey} removed, renamed fail!`);
            this.job.Finish();
            return;
        }

        try {
            let stat = fs.lstatSync(this.newKey);

            if (stat.isDirectory()) {
                let folderSearch = await EntityFolderMap.Instance.getFolder(this.oldKey);

                if (folderSearch) {
                    this.ChangeNameUpaki(folderSearch.id, 'folder', folderSearch.key);
                } else {
                    Logger.warn(`[FOLDER] Item ${this.oldKey} not uploaded, rename descarted!`);
                    this.job.Finish();
                }
            } else {
                let fileData = await EntityUpload.Instance.getFile(this.oldKey);

                if (fileData) {
                    this.ChangeNameUpaki(fileData.file_id, 'file', fileData.path);
                } else {
                    Logger.warn(`[FILE] Item ${this.oldKey} not uploaded, rename descarted!`);
                    this.job.Finish();
                }
            }
        } catch (error) {
            this.job.Fail(Environment.config.queue.renameAction.retryDelay);
        }
    }

}