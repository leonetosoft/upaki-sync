import { Database } from "../Database";
import { ProcessType, ProcTaskState } from "../../thread/UtilWorker";

export interface TaskModel<T> {
    pname: string;
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
                    Database.Instance.Run(`UPDATE task SET pdata=?, pstate=?, ptype=? WHERE pname = ?`, [JSON.stringify(task.pdata), task.pstate, task.ptype, task.pname], (errInsert) => {
                        if (errInsert) {
                            reject(errInsert);
                            return;
                        }
                        resolve(1);
                    });
                } else {

                    /*if(!pdefault || !pdefault.ptype || pdefault.pstate === undefined){
                        reject('Please set ptype and pstate of task');
                        return;
                    }*/

                    Database.Instance.Run(`INSERT INTO task(pname, pdata, pstate, ptype) VALUES(?,?,?,?)`, [task.pname, JSON.stringify(task.pdata), task.pstate, task.ptype], (errInsert) => {
                        if (errInsert) {
                            reject(errInsert);
                            return;
                        }
                        resolve(1);
                    });
                }
            });
        });
    }


    getTask<T>(pname: string): Promise<TaskModel<T>> {
        return new Promise<TaskModel<T>>((resolve, reject) => {
            Database.Instance.Get(`SELECT pname, pdata, pstate, ptype FROM task WHERE pname=?`, [pname], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!row) {
                    resolve(undefined);
                    return;
                }

                resolve({
                    pdata: JSON.parse(row.pdata),
                    pname: row.pname,
                    pstate: row.pstate,
                    ptype: row.ptype
                });
            });
        })
    }
}