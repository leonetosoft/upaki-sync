import { Database } from '../Database';
import { FunctionsBinding } from '../../ipc/FunctionsBinding';
import { Environment } from '../../config/env';
import { Logger } from '../../util/Logger';
import { SyncFolderObj } from '../../api/entity';


export class EntityFolderSync {
    private static _instance: EntityFolderSync;
    private cacheSyncFolders: string[] = [];
    constructor() { }

    public static get Instance(): EntityFolderSync {
        return this._instance || (this._instance = new this());
    }

    public ListFolders(callback: (err: Error, folders: string[]) => void) {
        Database.Instance.All('SELECT folder FROM sync_folder WHERE user_id=?', [Environment.config.credentials.userId], (err, rows) => {
            callback(err, err ? [] : rows.map(el => { return el.folder; }));
        });
    }

    public ListFoldersUi(callback: (err: Error, folders: SyncFolderObj[]) => void) {
        Database.Instance.All('SELECT folder, delete_file, delete_on_finish FROM sync_folder WHERE user_id=?', [Environment.config.credentials.userId], (err, rows) => {
            callback(err, err ? [] : rows.map(el => { return { folder: el.folder, delete_file: Number(el.delete_file), delete_on_finish: Number(el.delete_on_finish) }; }));
        });
    }

    public DeleteOnSend(src): Promise<boolean> {
        return new Promise((resolve, reject) => {
            Database.Instance.Get('SELECT delete_file FROM sync_folder WHERE user_id=? and folder=?', [Environment.config.credentials.userId, src], (err, row) => {
                if (err) {
                    Logger.error(err);
                    reject(false);
                } else {
                    resolve(row ? (row.delete_file == 1 ? true : false) : false);
                }
            });
        });
    }

    public DeleteOnFinish(src): Promise<boolean> {
        return new Promise((resolve, reject) => {
            Database.Instance.Get('SELECT delete_on_finish FROM sync_folder WHERE user_id=? and folder=?', [Environment.config.credentials.userId, src], (err, row) => {
                if (err) {
                    Logger.error(err);
                    reject(false);
                } else {
                    resolve(row ? (row.delete_on_finish == 1 ? true : false) : false);
                }
            });
        });
    }

    public AddFolder(src: string, delete_on_finish, delete_file, callback: (err: Error) => void) {
        Database.Instance.Run('INSERT INTO sync_folder (folder, user_id, delete_on_finish, delete_file) VALUES(?, ?, ?, ?)', [src, Environment.config.credentials.userId, delete_on_finish, delete_file], (err) => {
            if (!err) {
                FunctionsBinding.Instance.AddScanDir(src);
                FunctionsBinding.Instance.AddWatch(src);
            }

            if(err && err.message && err.message.indexOf('SQLITE_CONSTRAINT') == -1) {
                callback(err);
            }else{
                callback(undefined);
            }
        });
    }

    public DeleteFolder(src: string, callback: (err: Error) => void) {
        Database.Instance.Run('DELETE FROM sync_folder WHERE folder=? and user_id=?', [src, Environment.config.credentials.userId], (err) => {
            if (!err) {
                FunctionsBinding.Instance.StopScan(src);
                FunctionsBinding.Instance.StopWatch(src);
            }
            callback(err);
        });
    }

    public getRootFolder(src: string) {
        this.ListFolders((err, rs) => {

        })
    }

}