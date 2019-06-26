import { BackupFile, Backup, BackupProduct, BackupType } from "../../api/backup";
import { Util } from "../../util/Util";
import { Database } from "../Database";
import * as uuidv1 from 'uuid/v1';

export class EntityBackup {
    private static _instance: EntityBackup;

    public static get Instance(): EntityBackup {
        return this._instance || (this._instance = new this());
    }

    getFilesByKey(paths: string[], backupType?: BackupType): Promise<BackupFile[]> {
        return new Promise<BackupFile[]>((resolve, reject) => {
            if(backupType && backupType === BackupType.FULL) {
                resolve([]);
                return;
            }
            let keys = paths.map(el => {
                return Util.MD5SRC(el);
            });
            // console.log(keys.join(','));
            Database.Instance.All(`SELECT backup_id, file, pname, last_modifies,
             updated, size FROM backup_file WHERE file in(${keys.map(k => { return `'${k}'`; }).join(`,`)})`,
                [], (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        if (row.length) {
                            resolve(row);
                        } else {
                            resolve([]);
                        }
                    }
                });
        })
    }

    bulkInsert(backupFile: BackupFile[]) {
        let insertParams = backupFile.map(el => '(?,?,?,?,?,?)');
        let values = [];
        for (let fl of backupFile) {
            values.push(fl.backup_id, fl.file, fl.pname, fl.last_modifies, fl.updated, fl.size);
        }
        return new Promise((resolve, reject) => {
            Database.Instance.Run(`INSERT INTO backup_file
            (backup_id, file, pname, last_modifies, updated, size) VALUES
            ${insertParams.join(',')}`,
                values,
                (errInsert) => {
                    if (errInsert) {
                        reject(errInsert);
                        return;
                    }
                    resolve();
                });
        });
    }

    bulkInsertProduct(backupProduct: BackupProduct[]) {
        let insertParams = backupProduct.map(el => '(?,?)');
        let values = [];
        for (let fl of backupProduct) {
            values.push(fl.backup_id, fl.pathName);
        }
        return new Promise((resolve, reject) => {
            Database.Instance.Run(`INSERT INTO backup_product
            (backup_id, pathName) VALUES
            ${insertParams.join(',')}`,
                values,
                (errInsert) => {
                    if (errInsert) {
                        reject(errInsert);
                        return;
                    }
                    resolve();
                });
        });
    }

    inserOrUpdateBackupFile(backupFile: BackupFile) {
        backupFile.file = Util.MD5SRC(backupFile.file);
        let promise = new Promise((resolve, reject) => {
            Database.Instance.Get('SELECT backup_id FROM backup_file WHERE pname=? and file=?',
                [backupFile.pname, backupFile.file],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (row) {
                        Database.Instance.Run(`UPDATE backup_file SET last_modifies=?, updated=?, size=? WHERE pname=? and file=?`,
                            [backupFile.last_modifies, backupFile.updated, backupFile.size, backupFile.pname, backupFile.file],
                            (errInsert) => {
                                if (errInsert) {
                                    reject(errInsert);
                                    return;
                                }
                                resolve();
                            });
                    } else {

                        Database.Instance.Run(`INSERT INTO backup_file(backup_id, file, pname, last_modifies, updated, size) VALUES(?,?,?,?,?,?)`,
                            [backupFile.backup_id, backupFile.file, backupFile.pname, backupFile.last_modifies, backupFile.updated, backupFile.size],
                            (errInsert) => {
                                if (errInsert) {
                                    reject(errInsert);
                                    return;
                                }
                                resolve();
                            });
                    }
                });
        });
        return promise;
    }

    DumpBackupData(pname: string) {
        return new Promise((resolve, reject) => {
            Database.Instance.Run(`DELETE FROM backup WHERE pname=?`,
                [pname],
                (errInsert) => {
                    if (errInsert) {
                        reject(errInsert);
                        return;
                    }
                    Database.Instance.Run(`DELETE FROM backup_file WHERE pname=?`,
                        [pname],
                        (errdel) => {
                            if (errdel) {
                                reject(errdel);
                                return;
                            }
                            resolve();
                        })
                });
        });
    }

    countExecution(pname): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            Database.Instance.Get(`SELECT count(*) as total from backup where pname=?`,
                [pname],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(Number(row.total));
                });
        });
    }

    inserOrUpdateBackup(backupFile: Backup): Promise<string> {
        let promise = new Promise<string>((resolve, reject) => {
            Database.Instance.Get('SELECT id FROM backup WHERE id=?',
                [backupFile.id],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (row) {
                        Database.Instance.Run(`UPDATE backup SET type=?,
                         date_time_exec=?, size=?, next_execution=?,
                          pname=?, date_time_finish=?, errors=?, success=?  WHERE id=?`,
                            [backupFile.type,
                            backupFile.date_time_execution,
                            backupFile.size,
                            backupFile.next_execution,
                            backupFile.pname,
                            backupFile.date_time_finish,
                            backupFile.errors,
                            backupFile.success,
                            backupFile.id],
                            (errInsert) => {
                                if (errInsert) {
                                    reject(errInsert);
                                    return;
                                }
                                resolve(backupFile.id);
                            });
                    } else {
                        backupFile.id = uuidv1();
                        Database.Instance.Run(`INSERT INTO backup(id, type, date_time_exec, size, next_execution, pname, date_time_finish, errors, success) VALUES(?,?,?,?,?,?,?,?,?)`,
                            [backupFile.id, backupFile.type,
                            backupFile.date_time_execution,
                            backupFile.size,
                            backupFile.next_execution,
                            backupFile.pname,
                            backupFile.date_time_finish,
                            backupFile.errors,
                            backupFile.success],
                            (errInsert) => {
                                if (errInsert) {
                                    reject(errInsert);
                                    return;
                                }
                                resolve(backupFile.id);
                            });
                    }
                });
        });
        return promise;
    }

}