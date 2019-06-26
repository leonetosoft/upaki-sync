import { Database } from "../Database";
import { WorkerMaster } from "../../thread/WorkerMaster";
import { Environment } from "../../config/env";

export class EntityParameter {
    private static _instance: EntityParameter;
    constructor() { }

    public static get Instance(): EntityParameter {
        return this._instance || (this._instance = new this());
    }

    private Update(key, value, update) {
        let promise = new Promise((resolve, reject) => {
            Database.Instance.Get('SELECT KEY, VALUE FROM parameter WHERE KEY = ?',
                [key],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (row) {
                        if (update) {
                            Database.Instance.Run(`UPDATE parameter SET VALUE=? WHERE KEY=?`,
                                [value, key],
                                (errInsert) => {
                                    if (errInsert) {
                                        reject(errInsert);
                                        return;
                                    }
                                    if (Environment.config.useCluster) {
                                        WorkerMaster.Instance.BroadcastMsg('UPDATE_PARAMETERS', {
                                            key: key,
                                            value: value
                                        });
                                    }
                                    resolve();
                                });
                        } else {
                            resolve();
                        }
                    } else {

                        Database.Instance.Run(`INSERT INTO parameter(KEY, VALUE) VALUES(?,?)`,
                            [key, value],
                            (errInsert) => {
                                if (errInsert) {
                                    reject(errInsert);
                                    return;
                                }
                                if (Environment.config.useCluster) {
                                    WorkerMaster.Instance.BroadcastMsg('UPDATE_PARAMETERS', {
                                        key: key,
                                        value: value
                                    });
                                }
                                resolve();
                            });
                    }
                });
        });
        return promise;
    }

    UpdateParameters<T>(params: T, update = true) {
        return Promise.all(Object.keys(params).map(el => {
            return this.Update(el, params[el], update);
        }));
    }

    GetParams<T>(requestParams: string[]): Promise<T> {
        let promise = new Promise<T>((resolve, reject) => {
            Database.Instance.All(`SELECT KEY, VALUE FROM parameter WHERE KEY IN(${requestParams.map(k => { return `'${k}'`; }).join(`,`)})`,
                [],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    }
                    let ret = {};
                    for (let KEY of requestParams) {
                        let finded = rows.find(el => el.KEY === KEY);
                        ret[KEY] = finded ? finded.VALUE : undefined;
                    }

                    resolve(ret as T);
                });
        });
        return promise;
    }
}