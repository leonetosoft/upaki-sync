import { Database } from '../Database';
import { FunctionsBinding } from '../../ipc/FunctionsBinding';


export class EntityFolderSync {
    private static _instance: EntityFolderSync;
    private cacheSyncFolders: string[] = [];
    constructor() { }

    public static get Instance(): EntityFolderSync {
        return this._instance || (this._instance = new this());
    }

    public ListFolders(callback: (err: Error, folders: string[]) => void) {
        Database.Instance.All('SELECT folder FROM sync_folder', [], (err, rows) => {
            console.log(rows[0])
            callback(err, err ? [] : rows.map(el => { return el.folder; }));
        });
    }

    public AddFolder(src: string, callback: (err: Error) => void) {
        Database.Instance.Run('INSERT INTO sync_folder (folder) VALUES(?)', [src], (err) => {
            if (!err) {
                FunctionsBinding.Instance.AddScanDir(src);
                FunctionsBinding.Instance.AddWatch(src);
            }
            callback(err);
        });
    }

    public DeleteFolder(src: string, callback: (err: Error) => void) {
        Database.Instance.Run('DELETE FROM sync_folder WHERE folder=?', [src], (err) => {
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