import { UploadState } from './../../sync/task/UploaderTask';
import { S3StreamSessionDetails } from 'upaki-cli';
import * as crypto from 'crypto';
import { Database } from '../Database';

export interface EntityUploadData {
    key: string;
    lastModifies: string;
    file_id: string;
    folder_id: string;
    sessionData?: S3StreamSessionDetails;
    state: UploadState;
    Etag: string;
    path: string;
}


export class EntityUpload {
    private static _instance: EntityUpload;
    private table: string = 'file';
    // private connection: Datastore;

    constructor() {}

    public static get Instance(): EntityUpload {
        return this._instance || (this._instance = new this());
    }

    private MD5SRC(src) {
        return crypto.createHash('md5').update(src).digest("hex");
    }

    save(upload: EntityUploadData, callback: (err: Error, data: any) => void) {
        let key = this.MD5SRC(upload.path);
        let data = JSON.stringify(upload);
        Database.Instance.All(`SELECT data FROM ${this.table} WHERE key=?`, [key], (err, row) => {
            if (err) {
                callback(err, undefined);
            } else {
                if (row[0]) {
                    Database.Instance.Run(`UPDATE ${this.table} SET data=? WHERE key = ?`, [data, key], (errInsert) => {
                        callback(errInsert, undefined);
                    });
                } else {
                    Database.Instance.Run(`INSERT INTO ${this.table}(key, data) VALUES(?,?)`, [key, data], (errInsert) => {
                        callback(errInsert, undefined);
                    });
                }
            }
        });
    }

    getFile(path: string): Promise<EntityUploadData> {
        return new Promise<EntityUploadData>((resolve, reject) => {
            let key = this.MD5SRC(path);
            Database.Instance.Get(`SELECT data FROM ${this.table} WHERE key=?`, [key], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row && row.data) {
                        resolve(JSON.parse(row.data));
                    }else{
                        resolve(undefined);
                    }
                }
            });
        })
    }

    updateKey(oldPath: string, newPath): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            let key = this.MD5SRC(oldPath);
            let newKey = this.MD5SRC(newPath);
            Database.Instance.Get(`SELECT data FROM ${this.table} WHERE key=?`, [key], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (row) {
                    let data = JSON.parse(row.data) as EntityUploadData;
                    data.path = newPath;

                    Database.Instance.Run(`UPDATE ${this.table} SET key=?, data=? WHERE key = ?`, [newKey, JSON.stringify(data), key], (errInsert) => {
                        if(errInsert){
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
            Database.Instance.Run(`DELETE FROM ${this.table} WHERE key = ?`, [key], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(1);
                }
            });
        })
    }
}