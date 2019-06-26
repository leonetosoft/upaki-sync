import * as crypto from 'crypto';
import { Database } from '../Database';
import { EntityUploadData } from '../../api/entity';
import { Environment } from '../../config/env';
import { Logger } from '../../util/Logger';

export class EntityUpload {
    private static _instance: EntityUpload;
    private table: string = 'file';
    // private connection: Datastore;

    constructor() { }

    public static get Instance(): EntityUpload {
        return this._instance || (this._instance = new this());
    }

    private MD5SRC(src) {
        return crypto.createHash('md5').update(src).digest("hex");
    }

    save(upload: EntityUploadData, callback: (err: Error, data: any) => void) {
        let key = this.MD5SRC(upload.path);
        let data = JSON.stringify(upload);
        Database.Instance.All(`SELECT data FROM ${this.table} WHERE key=? and user_id=?`, [key, Environment.config.credentials.userId], (err, row) => {
            if (err) {
                callback(err, undefined);
            } else {
                if (row[0]) {
                    Database.Instance.Run(`UPDATE ${this.table} SET data=? WHERE key = ? and user_id=?`, [data, key, Environment.config.credentials.userId], (errInsert) => {
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

    getFile(path: string): Promise<EntityUploadData> {
        return new Promise<EntityUploadData>((resolve, reject) => {
            let key = this.MD5SRC(path);
            Database.Instance.Get(`SELECT data FROM ${this.table} WHERE key=? and user_id=?`, [key, Environment.config.credentials.userId], (err, row) => {
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

    getAnyFiles(paths: string[]): Promise<EntityUploadData[]> {
        return new Promise<EntityUploadData[]>((resolve, reject) => {
            let keys = paths.map(el => {
                return this.MD5SRC(el);
            });
            // console.log(keys.join(','));
            Database.Instance.All(`SELECT key, data FROM ${this.table} WHERE key in(${keys.map(k => { return `'${k}'`; }).join(`,`)}) and user_id=?`, [Environment.config.credentials.userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    /*console.log(row);
                    console.log(paths);
                    console.log(keys);*/
                    try {
                        Logger.debug(row ? JSON.stringify(row) : `No row in getAnyFiles for path ${JSON.stringify(paths)}`);
                    } catch (errWriteLog) {
                        Logger.error(errWriteLog);
                    }
                    
                    if (row.length) {
                        resolve(row.map(el => {
                            return JSON.parse(el.data);
                        }));
                    } else {
                        resolve([]);
                    }
                }
            });
        })
    }

    updateKey(oldPath: string, newPath): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            let key = this.MD5SRC(oldPath);
            let newKey = this.MD5SRC(newPath);
            Database.Instance.Get(`SELECT data FROM ${this.table} WHERE key=? and user_id=?`, [key, Environment.config.credentials.userId], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (row) {
                    let data = JSON.parse(row.data) as EntityUploadData;
                    data.path = newPath;

                    Database.Instance.Run(`UPDATE ${this.table} SET key=?, data=? WHERE key = ? and user_id=?`, [newKey, JSON.stringify(data), key, Environment.config.credentials.userId], (errInsert) => {
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

    delete(path: string): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            let key = this.MD5SRC(path);
            Database.Instance.Run(`DELETE FROM ${this.table} WHERE key = ? and user_id=?`, [key, Environment.config.credentials.userId], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(1);
                }
            });
        })
    }
}