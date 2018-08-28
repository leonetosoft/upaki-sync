import { WorkProcess } from './../thread/UtilWorker';
import { Environment } from '../config/env';
import { Logger } from '../util/Logger';
import * as sqlite3 from 'sqlite3';
import * as mkdirp from 'mkdirp';
import * as fs from 'fs';
import { Util } from '../util/Util';
import { MessageToWorker } from '../thread/UtilWorker';
import * as uuidv1 from 'uuid/v1';
import * as events from 'events';

export enum TYPE_DB_EXECUTIONM {
    GET = 'GET',
    RUN = 'RUN',
    ALL = 'ALL'
}

export class Database {
    private static _instance: Database;
    private connection: sqlite3.Database;
    private isDBMaster = false;
    private events: events.EventEmitter;
    private timeout = 5000;
    private workerMain: WorkProcess = WorkProcess.WORKER_SCAN_PROCESS;
    constructor() {
        this.events = new events.EventEmitter();
    }
    public static get Instance(): Database {
        return this._instance || (this._instance = new this());
    }

    public setMaster() {
        this.isDBMaster = true;
        this.Connect();
    }

    private CreateTable() {
        this.connection.run(`CREATE TABLE IF NOT EXISTS file (key NOT NULL, data TEXT, PRIMARY KEY ("key"))`, () => { });
        this.connection.run(`CREATE TABLE IF NOT EXISTS folder (key NOT NULL, data TEXT,  PRIMARY KEY ("key"))`, () => { });
    }

    public Run(sql: string, params: any[], callback?: (err: Error | null) => void) {
        if (this.isDBMaster) {
            Logger.debug(`Database Execution: ${sql}`);
            this.connection.run(sql, params, callback);
        } else {
            let idRequest = uuidv1();
            Logger.debug(`Database Request Execution: ${sql}`);
            this.events.once(idRequest, callback);
            setTimeout(() => {
                let find = this.events.eventNames().find(el => el === idRequest);
                if (find) {
                    callback(new Error('Database Timeout error'));
                }
            }, this.timeout);
            MessageToWorker(this.workerMain, { type: 'DATABASE', data: { sql: sql, id: idRequest, worker: Environment.config.worker, params: params, type: 'RUN' } });
        }
    }

    public Get(sql: string, params: any[], callback?: (err: Error | null, row: any) => void) {
        if (this.isDBMaster) {
            Logger.debug(`Database Execution: ${sql}`);
            this.connection.get(sql, params, callback);
        } else {
            let idRequest = uuidv1();
            Logger.debug(`Database Request Execution: ${sql}`);
            this.events.once(idRequest, callback);
            setTimeout(() => {
                let find = this.events.eventNames().find(el => el === idRequest);
                if (find) {
                    callback(new Error('Database Timeout error'), undefined);
                }
            }, this.timeout);
            MessageToWorker(this.workerMain, { type: 'DATABASE', data: { sql: sql, id: idRequest, worker: Environment.config.worker, params: params, type: 'GET' } });
        }
    }

    public All(sql: string, params: any[], callback?: (err: Error | null, rows: any[]) => void) {
        if (this.isDBMaster) {
            Logger.debug(`Database Execution: ${sql}`);
            this.connection.all(sql, params, callback);
        } else {
            let idRequest = uuidv1();
            Logger.debug(`Database Request Execution: ${sql}`);
            this.events.once(idRequest, callback);
            setTimeout(() => {
                let find = this.events.eventNames().find(el => el === idRequest);
                if (find) {
                    callback(new Error('Database Timeout error'), undefined);
                }
            }, this.timeout);
            MessageToWorker(this.workerMain, { type: 'DATABASE', data: { sql: sql, id: idRequest, worker: Environment.config.worker, params: params, type: 'ALL' } });
        }
    }

    public DbResponse(data: { id: string, rs: any, err: boolean }) {
        this.events.emit(data.id, data.err ? new Error(`Execution DB Error, id = ${data.id}`) : undefined, data.rs);
    }

    public OnMessage(data: { sql: string, id: string, worker: WorkProcess, params: any[], type: TYPE_DB_EXECUTIONM }) {
        switch (data.type) {
            case 'RUN':
                this.Run(data.sql, data.params, (err) => {
                    if (err) {
                        Logger.error(`Database Execution Error`);
                        Logger.error(err);
                    }
                    MessageToWorker(data.worker, {
                        type: 'DATABASE_RESPONSE',
                        data: { id: data.id, rs: '', err: err ? true : false }
                    });
                })
                break;

            case 'GET':
                this.Get(data.sql, data.params, (err, row) => {
                    if (err) {
                        Logger.error(`Database Execution Error`);
                        Logger.error(err);
                    }
                    MessageToWorker(data.worker, {
                        type: 'DATABASE_RESPONSE',
                        data: { id: data.id, rs: row, err: err ? true : false }
                    });
                })
                break;

            case 'ALL':
                this.All(data.sql, data.params, (err, row) => {
                    if (err) {
                        Logger.error(`Database Execution Error`);
                        Logger.error(err);
                    }
                    MessageToWorker(data.worker, {
                        type: 'DATABASE_RESPONSE',
                        data: { id: data.id, rs: row, err: err ? true : false }
                    });
                })
                break;
        }

    }


    private Connect() {
        try {
            // cria o diretorio caso nao exista
            if (!fs.existsSync(Util.getPathNameFromFile(Environment.config.database.filedb))) {
                mkdirp.sync(Util.getPathNameFromFile(Environment.config.database.filedb));
            }
            let sqlVerb = sqlite3.verbose();
            Logger.debug(`SQLITE load db file=${Environment.config.database.filedb}`);
            this.connection = new sqlVerb.Database(Environment.config.database.filedb);
            this.CreateTable();

        } catch (error) {
            console.log(error);
            Logger.error(error);
        }
    }

    /*public get con(): sqlite3.Database {
        if (!this.connection) {
            this.Connect();
        }
        return this.connection;
    }*/
}