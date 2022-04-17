import * as crypto from 'crypto';
import { Database } from '../Database';
import { FolderObject } from '../../api/entity';
import { Environment } from '../../config/env';
import { WorkProcess } from '../../api/thread';
import { SharedFuncion } from '../../ipc/EventBinding';

export class EntityFolderMap {
    private static _instance: EntityFolderMap;
    private table: string = 'folder';

    constructor() {
        /* this.connection = new Datastore({
             filename: Environment.config.database.folderdb,
             autoload: true
         });*/
    }

    public static get Instance(): EntityFolderMap {
        return this._instance || (this._instance = new this());
    }

    private MD5SRC(src) {
        return crypto.createHash('md5').update(src).digest("hex");
    }

    @SharedFuncion({
        mainWorter: WorkProcess.MASTER,
        response: true
    })
    saveIpcFolder(upload: FolderObject, callback: (err: Error, data: any) => void) {
        EntityFolderMap.Instance.save(upload, callback);
    }

    save(folder: FolderObject, callback: (err: Error, data: any) => void) {
        let key = this.MD5SRC(folder.key);
        let data = JSON.stringify(folder);
        Database.Instance.All(`SELECT key FROM ${this.table} WHERE key=? ${!Environment.config.uploadFolderShared ?  `and user_id='${Environment.config.credentials.userId}'` : ''}`, [key], (err, row) => {
            if (err) {
                callback(err, undefined);
            } else {
                if (row[0]) {
                    Database.Instance.Run(`UPDATE ${this.table} SET data=? WHERE key = ? ${!Environment.config.uploadFolderShared ?  `and user_id='${Environment.config.credentials.userId}'` : ''}`, [data, key], (errInsert) => {
                        callback(errInsert, undefined);
                    });
                } else {
                    Database.Instance.Run(`INSERT INTO ${this.table}(key, data, user_id) VALUES(?,?,?)`, [key, data, Environment.config.credentials.userId], (errInsert) => {
                        callback(errInsert, undefined);
                    });
                }
            }
        });
    }

    updateKey(oldPath: string, newPath): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            let key = this.MD5SRC(oldPath);
            let newKey = this.MD5SRC(newPath);
            Database.Instance.Get(`SELECT data FROM ${this.table} WHERE key=? ${!Environment.config.uploadFolderShared ? `and user_id='${Environment.config.credentials.userId}'` : ''}`, [key], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (row) {
                    let data = JSON.parse(row.data) as FolderObject;
                    data.key = newPath;

                    Database.Instance.Run(`UPDATE ${this.table} SET key=?, data=? WHERE key = ? ${!Environment.config.uploadFolderShared ? `and user_id='${Environment.config.credentials.userId}'` : ''}`, [newKey, JSON.stringify(data), key], (errInsert) => {
                        if (errInsert) {
                            reject(errInsert);
                            return;
                        }
                        resolve(1);
                    });
                } else {
                    reject(new Error(`Objeto ${key} nao encontrado !`));
                }
            });
        })
    }

    getFolder(path: string): Promise<FolderObject> {
        return new Promise<FolderObject>((resolve, reject) => {
            let key = this.MD5SRC(path);
            Database.Instance.Get(`SELECT data FROM ${this.table} WHERE key=? ${!Environment.config.uploadFolderShared ?  `and user_id='${Environment.config.credentials.userId}'` : ''}`, [key], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row && row.data) {
                        resolve(JSON.parse(row.data));
                    } else {
                        resolve(undefined);
                    }
                }
            });
        })
    }
}
