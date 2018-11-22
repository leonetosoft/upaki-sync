import { Database } from "../Database";
import { ProcessType, ProcTaskState } from "../../thread/UtilWorker";
import { Util } from "../../util/Util";
import { Logger } from "../../util/Logger";
import { UIFunctionsBinding } from "../../ipc/UIFunctionsBinding";

export interface TaskModel<T> {
    pname?: string;
    pdesc: string;
    pstate: ProcTaskState;
    ptype: ProcessType;
    pdata: T;
}
export class EntityTask {
    private static _instance: EntityTask;

    public static get Instance(): EntityTask {
        return this._instance || (this._instance = new this());
    }


    UpdateData<T>(task: TaskModel<T>) {
        return new Promise<number>((resolve, reject) => {
            Database.Instance.Get(`SELECT pstate FROM task WHERE pname=?`, [task.pname], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (row) {
                    Util.WriteTaskData(task.pname, task.pdata, (errTaskData, source) => {
                        if (errTaskData) {
                            reject(errTaskData);
                        } else {
                            Database.Instance.Run(`UPDATE task SET pdata=?, pstate=?, ptype=?, pdesc=? WHERE pname = ?`, [source, task.pstate, task.ptype, task.pdesc, task.pname], (errInsert) => {
                                if (errInsert) {
                                    reject(errInsert);
                                    return;
                                }
                                resolve(1);
                            });

                            UIFunctionsBinding.Instance.UpdateTaskDefinition(task.pname, source);
                        }
                    });

                } else {

                    /*if(!pdefault || !pdefault.ptype || pdefault.pstate === undefined){
                        reject('Please set ptype and pstate of task');
                        return;
                    }*/

                    Util.WriteTaskData(task.pname, task.pdata, (errTaskData, source) => {
                        console.log(`Write taskData .... ${source}`);
                        if (errTaskData) {
                            reject(errTaskData);
                        } else {
                            Database.Instance.Run(`INSERT INTO task(pname, pdata, pstate, ptype, pdesc) VALUES(?,?,?,?,?)`, [task.pname, /*JSON.stringify(task.pdata)*/source, task.pstate, task.ptype, task.pdesc], (errInsert) => {
                                if (errInsert) {
                                    reject(errInsert);
                                    return;
                                }
                                resolve(1);
                            });
                            UIFunctionsBinding.Instance.UpdateTaskDefinition(task.pname, source);
                        }
                    });

                }
            });
        });
    }

    ListTasksOfType<T>(ptype: ProcessType): Promise<TaskModel<T>[]> {
        return new Promise((resolve, reject) => {
            Database.Instance.All(`SELECT pname, pdata, pstate, ptype, pdesc FROM task WHERE ptype=?`, [ptype], (err, rows: TaskModel<any>[]) => {
                if (err) {
                    reject(err);
                } else {
                    for (let row of rows) {
                        if (row.pdata) {
                            Util.ReadTaskData(`${row.pname}`, ((errReadTask, data, cacheSource) => {
                                if (errReadTask) {
                                    Logger.error(errReadTask);
                                } else {
                                    UIFunctionsBinding.Instance.UpdateTaskDefinition(row.pname, cacheSource);
                                }
                            }));
                        }
                    }
                    resolve(rows.map(el => {
                        el.pdata = undefined;
                        return el;
                    }));
                }
            });
        })
    }

    public Delete(pname: string) {
        return new Promise((resolve, reject) => {
            Util.DumpTaskData(pname, (errDel) => {
                if(errDel){
                    reject(errDel);
                    return;
                }
                Database.Instance.Run('DELETE FROM task WHERE pname=?', [pname], (err) => {
                    if(err){
                        reject(err);
                    }else{
                        resolve();
                    }
                });
            });
        });
    }

    getTask<T>(pname: string): Promise<TaskModel<T>> {
        return new Promise<TaskModel<T>>((resolve, reject) => {
            Database.Instance.Get(`SELECT pname, pdata, pstate, ptype, pdesc FROM task WHERE pname=?`, [pname], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (!row) {
                    resolve(undefined);
                    return;
                }

                Util.ReadTaskData<T>(`${row.pname}`, (errReadTask, data, cacheSource) => {
                    if (errReadTask) {
                        reject(errReadTask);
                    } else {
                        resolve({
                            pdata: data,
                            pname: row.pname,
                            pstate: row.pstate,
                            pdesc: row.pdesc,
                            ptype: row.ptype
                        });
                    }
                });


            });
        })
    }
}