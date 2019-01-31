import { Environment } from '../config/env';
import { Logger } from '../util/Logger';
import * as sqlite3 from 'sqlite3';
import * as mkdirp from 'mkdirp';
import * as fs from 'fs';
import { Util } from '../util/Util';
import { MessageToWorker } from '../thread/UtilWorker';
import * as uuidv1 from 'uuid/v1';
import * as events from 'events';
import { getSqlsStart, dbMaintance } from './dbstart';
import { WorkProcess } from '../api/thread';
import * as dgram from 'dgram';

export enum TYPE_DB_EXECUTIOM {
    GET = 'GET',
    RUN = 'RUN',
    ALL = 'ALL'
}

export interface SqliteRequestPacket {
    sql: string;
    id: string;
    worker: number;
    params: any[];
    type: TYPE_DB_EXECUTIOM;
}

export interface SqliteResponsePacket {
    id: string;
    rs: any;
    err: string;
}

export class Database {
    private static _instance: Database;
    private connection: sqlite3.Database;
    private isDBMaster = false;
    private events: events.EventEmitter;
    private timeout = 5000;
    private PORT = 33333;
    private HOST = '127.0.0.1';
    private workerMain: WorkProcess = WorkProcess.WORKER_SCAN_PROCESS;
    private server: dgram.Socket;
    private client: dgram.Socket;
    constructor() {
        this.events = new events.EventEmitter();
        // this.setMaster();
    }
    public static get Instance(): Database {
        return this._instance || (this._instance = new this());
    }

    public setMaster() {
        this.isDBMaster = true;
        this.startServer();
        this.Connect();
    }

    private startServer() {
        this.server = dgram.createSocket('udp4');
        this.server.on('listening', () => {
            var address = this.server.address();
            Logger.info('SQLITE Server listening on ' + address.address + ":" + address.port);
        });
        this.server.on('message', this.serverOnReceivePacket.bind(this));
        this.server.bind(this.PORT, this.HOST);
    }

    private startClient() {
        this.client = dgram.createSocket('udp4');
        this.client.on('message', this.clientOnReceivePacket.bind(this));
    }

    private sendPacketToServer(msg: SqliteRequestPacket) {
        if (this.isDBMaster) {
            throw new Error('Send packet to server incorrect call in server mode');
        }

        if(!this.client) {
            this.startClient();
        }

        let msgBuffer = Buffer.from(JSON.stringify(msg));
        this.client.send(msgBuffer, 0, msgBuffer.length, this.PORT, this.HOST);
    }

    private sendPacketToClient(msg: SqliteResponsePacket, rinfo: dgram.AddressInfo) {
        if (!this.isDBMaster) {
            throw new Error('Send packet to client incorrect call in client mode');
        }
        let msgBuffer = Buffer.from(JSON.stringify(msg));
        this.server.send(msgBuffer, 0, msgBuffer.length, rinfo.port, rinfo.address);
    }

    private clientOnReceivePacket(msg: Buffer, rinfo: dgram.AddressInfo) {
        let packet = JSON.parse(msg.toString('utf8')) as SqliteResponsePacket;
        this.events.emit(packet.id, packet.err ? new Error(packet.err) : undefined, packet.rs);
    }

    private serverOnReceivePacket(msg: Buffer, rinfo: dgram.AddressInfo) {
        let packet = JSON.parse(msg.toString('utf8')) as SqliteRequestPacket;

        switch (packet.type) {
            case TYPE_DB_EXECUTIOM.RUN:
                this.Run(packet.sql, packet.params, (err) => {
                    /*if (err) {
                        Logger.error(`Database Execution Error`);
                        Logger.error(err);
                    }*/

                    this.sendPacketToClient({
                        id: packet.id,
                        rs: '',
                        err: err ? err.message : undefined
                    }, rinfo);
                })
                break;

            case TYPE_DB_EXECUTIOM.GET:
                this.Get(packet.sql, packet.params, (err, row) => {
                    /*if (err) {
                        Logger.error(`Database Execution Error`);
                        Logger.error(err);
                    }*/

                    this.sendPacketToClient({
                        id: packet.id,
                        rs: row,
                        err: err ? err.message : undefined
                    }, rinfo);
                })
                break;

            case TYPE_DB_EXECUTIOM.ALL:
                this.All(packet.sql, packet.params, (err, row) => {
                    /*if (err) {
                        Logger.error(`Database Execution Error`);
                        Logger.error(err);
                    }*/

                    this.sendPacketToClient({
                        id: packet.id,
                        rs: row,
                        err: err ? err.message : undefined
                    }, rinfo);
                })
                break;
        }
    }

    private CreationStartProm(sql: string, checkErrors = true) {
        return new Promise((resolve, reject) => {
            this.connection.run(sql, (rs, err) => {
                if (checkErrors) {
                    if (err) {
                        Logger.error(sql);
                        Logger.error(err);
                        reject(err);
                    } else {
                        resolve();
                    }
                } else {
                    resolve();
                }
            });
        });
    }

    InitDatabase() {
        return Promise.all(getSqlsStart().map(sql => {
            return this.CreationStartProm(sql);
        }).concat(dbMaintance().map(sql => {
            return this.CreationStartProm(sql, false);
        })));
        /* this.connection.run(`CREATE TABLE IF NOT EXISTS file (key NOT NULL, data TEXT, PRIMARY KEY ("key"))`, () => { });
         this.connection.run(`CREATE TABLE IF NOT EXISTS folder (key NOT NULL, data TEXT,  PRIMARY KEY ("key"))`, () => { });
         this.connection.run(`CREATE TABLE IF NOT EXISTS sync_folder (folder NOT NULL, PRIMARY KEY ("folder"))`, () => { });
         this.connection.run(`CREATE TABLE task (pname TEXT NOT NULL, ptype INTEGER NOT NULL, pdata text, pstate INTEGER DEFAULT 0 NOT NULL, pdesc TEXT, PRIMARY KEY ("pname"))`, () => { });
         this.connection.run(`CREATE TABLE credential (
             device_id text NOT NULL,
             credential_key text,
             token text,
             PRIMARY KEY ("device_id")
         );`, () => { });*/
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

            this.sendPacketToServer({
                sql: sql, id: idRequest, worker: Environment.config.worker, params: params, type: TYPE_DB_EXECUTIOM.RUN
            });
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

            this.sendPacketToServer({
                sql: sql, id: idRequest, worker: Environment.config.worker, params: params, type: TYPE_DB_EXECUTIOM.GET
            });
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
           
            this.sendPacketToServer({
                sql: sql, id: idRequest, worker: Environment.config.worker, params: params, type: TYPE_DB_EXECUTIOM.ALL
            });
        }
    }

    private Connect() {
        try {
            // cria o diretorio caso nao exista
            if (!fs.existsSync(Util.getDbSource())) {
                mkdirp.sync(Util.getDbSource());
            }
            let sqlVerb = sqlite3.verbose();
            Logger.debug(`SQLITE load db file=${Util.getDbSource('sync.db')}`);
            this.connection = new sqlVerb.Database(Util.getDbSource('sync.db'));
            // this.CreateTable();

        } catch (error) {
            console.log(error);
            Logger.error(error);
        }
    }
}