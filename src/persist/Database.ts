import { Environment } from '../config/env';
import { Logger } from '../util/Logger';
import * as sqlite3 from 'sqlite3';
import * as mkdirp from 'mkdirp';
import * as fs from 'fs';
import { Util } from '../util/Util';
import * as uuidv1 from 'uuid/v1';
import * as events from 'events';
import { getSqlsStart, dbMaintance, getDefaultParameters, groupedMaintence } from './dbstart';
import { WorkProcess } from '../api/thread';
import * as dgram from 'dgram';
import { EntityParameter } from './entities/EntityParameter';
import { QueueDatabaseExecution } from './queue/QueueDatabaseExecution';
import { DatabaseExecutionTask } from './queue/DatabaseExecutionTask';
import * as net from 'net';
import { UIFunctionsBinding } from '../ipc/UIFunctionsBinding';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as http from 'http';
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

export interface SqlLiteErr {
    errno?: number; code?: string;
}

export interface SqliteResponsePacket {
    id: string;
    rs: any;
    err: string;
}

export class Database2 {
    private static _instance: Database2;
    private connection: sqlite3.Database;
    private isDBMaster = false;
    private events: events.EventEmitter;
    private timeout = 30000;
    private PORT = 33333;
    private startingClinetConnection = false;
    private HOST = '127.0.0.1';
    private workerMain: WorkProcess = WorkProcess.WORKER_SCAN_PROCESS;
    /*private server: dgram.Socket;
    private client: dgram.Socket;*/
    private server: net.Server;
    private client: net.Socket;
    private connections: net.Socket[] = [];
    private timeoutChecker = {};
    constructor() {
        this.events = new events.EventEmitter();
        // this.setMaster();
    }
    public static get Instance(): Database2 {
        return this._instance || (this._instance = new this());
    }

    public setMaster() {
        this.isDBMaster = true;
        this.startServer();
        this.Connect();
    }

    private startServer() {/*
        this.server = dgram.createSocket('udp4');
        this.server.on('listening', () => {
            var address = this.server.address();
            Logger.info('SQLITE Server listening on ' + address.address + ":" + address.port);
        });
        this.server.on('message', this.serverOnReceivePacket.bind(this));
        this.server.bind(this.PORT, this.HOST);*/
        this.server = net.createServer();

        this.server.on('close', () => {
            Logger.info(`Database server closed`);
        });

        this.server.on('connection', (socket) => {
            socket.setEncoding('utf-8');
            this.connections.push(socket);

            socket.on('data', (data) => {
                let dados = data.toString().split('\n');

                for (let dadoSep of dados) {
                    if (dadoSep === 'REQUEST_MAXIMIZE') {
                        UIFunctionsBinding.Instance.UpakiRequestMaximize();
                    }
                    else if (dadoSep != '') {
                        this.serverOnReceivePacket(dadoSep, socket);
                    }
                }


            });

            socket.on('end', () => {
                this.connections.splice(this.connections.indexOf(socket), 1);
                Logger.info(`Disconected ${socket.remotePort} `);
            });


            socket.on('close', (error) => {
                Logger.info(`Closed ${socket.remotePort} `);
            });

            socket.on('error', (error) => {
                Logger.error(error);
            });
        });

        this.server.on('error', (error: any) => {
            if (error.code === 'EADDRINUSE') {
                console.log('erro');

                var clMaximize = new net.Socket();
                clMaximize = clMaximize.connect({
                    port: this.PORT,
                    host: this.HOST
                });

                clMaximize.on('connect', () => {
                    clMaximize.write('REQUEST_MAXIMIZE\n');
                    UIFunctionsBinding.Instance.UpakiAlreadyOpen();
                });

            } else {
                Logger.error(error);
            }
        });

        this.server.on('listening', () => {
            Logger.info(`Server database listening`);
        });

        this.server.listen(this.PORT, this.HOST);
    }

    private startClient(): Promise<void> {
        this.startingClinetConnection = true;
        return new Promise((resolve, reject) => {
            this.client = new net.Socket();
            this.client.connect({
                port: this.PORT,
                host: this.HOST
            });

            this.client.on('connect', () => {
                this.startingClinetConnection = false;
                Logger.info('[Database TCP] Client: connection established with server');

                var address = this.client.address();
                var port = address.port;
                var family = address.family;
                var ipaddr = address.address;
                Logger.info('[Database TCP] Client is listening at port' + port);
                Logger.info('[Database TCP] Client ip :' + ipaddr);
                Logger.info('[Database TCP] Client is IP4/IP6 : ' + family);

                resolve();
            });

            this.client.setEncoding('utf8');

            this.client.on('data', (data) => {
                let dados = data.toString().split('\n');

                for (let dadoSep of dados) {
                    if (dadoSep != '') {
                        this.clientOnReceivePacket(dadoSep);
                    }
                }

            });

            this.client.on('error', (data) => {
                reject();
            });
        });
    }

    private async sendPacketToServer(msg: SqliteRequestPacket) {
        //Logger.assert(`${msg.id}: sendPacketToServer SQL: ${msg.sql} PARAMS: ${JSON.stringify(msg.params)} TYPE: ${msg.type}`);
        if (this.isDBMaster) {
            throw new Error('Send packet to server incorrect call in server mode');
        }

        if (!this.client && !this.startingClinetConnection) {
            await this.startClient();
        }
        else if (this.startingClinetConnection) {
            setTimeout(() => {
                this.sendPacketToServer(msg);
            }, 1000);
            return;
        }

        //let msgBuffer = Buffer.from(JSON.stringify(msg));
        this.client.write(/*msgBuffer*/JSON.stringify(msg) + '\n');
    }

    public sendPacketToClient(msg: SqliteResponsePacket, clientSocket: net.Socket) {
        if (!this.isDBMaster) {
            throw new Error('Send packet to client incorrect call in client mode');
        }
        clientSocket.write(JSON.stringify(msg) + '\n');
    }

    private clientOnReceivePacket(msg: string) {
        try {
            //console.log(msg.toString('utf8'));
            let packet = JSON.parse(msg) as SqliteResponsePacket;
            // console.log('packet::', packet);
            // console.log(`[${packet.id}] packet rs :: ${ packet.rs}`);
            // Logger.assert(`${packet.id}: clientOnReceivePacket RESPOND: ${JSON.stringify(packet.rs)} ERR: ${packet.err}`);
            clearTimeout(this.timeoutChecker[packet.id]);
            delete this.timeoutChecker[packet.id];
            this.events.emit(packet.id, packet.err ? new Error(packet.err) : undefined, packet.rs);
        } catch (error) {
            console.log(error);
            Logger.error(error);
        }
    }

    private serverOnReceivePacket(msg: string, clientSocket: net.Socket) {
        let packet = JSON.parse(msg) as SqliteRequestPacket;

        // Logger.assert(`${packet.id}: serverOnReceivePacket SQL: ${packet.sql} PARAMS: ${JSON.stringify(packet.params)} TYPE: ${packet.type}`);

        /*if (packet.type === TYPE_DB_EXECUTIOM.RUN) {
            let job = new DatabaseExecutionTask(packet, rinfo);
            //job.priority = packet.type === TYPE_DB_EXECUTIOM.RUN ? PRIORITY_QUEUE.HIGH : PRIORITY_QUEUE.MEDIUM;
            QueueDatabaseExecution.Instance.addJob(job);
        } else {*/
        switch (packet.type) {
            case TYPE_DB_EXECUTIOM.RUN:
                this.Run(packet.sql, packet.params, (err) => {


                    this.sendPacketToClient({
                        id: packet.id,
                        rs: '',
                        err: err ? err.message : undefined
                    }, clientSocket);
                })
                break;

            case TYPE_DB_EXECUTIOM.GET:
                this.Get(packet.sql, packet.params, (err, row) => {

                    this.sendPacketToClient({
                        id: packet.id,
                        rs: row,
                        err: err ? err.message : undefined
                    }, clientSocket);
                })
                break;

            case TYPE_DB_EXECUTIOM.ALL:
                this.All(packet.sql, packet.params, (err, row) => {


                    this.sendPacketToClient({
                        id: packet.id,
                        rs: row,
                        err: err ? err.message : undefined
                    }, clientSocket);
                })
                break;
        }
        /*}*/
    }

    private CreationStartProm(sql: string, checkErrors = true): Promise<void> {
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

    private checkDoubleProcess() {

    }

    InitDatabase() {
        /*return Promise.all(getSqlsStart().map(sql => {
            return this.CreationStartProm(sql);
        }).concat(dbMaintance().map(sql => {
            return this.CreationStartProm(sql, false);
        }).concat(EntityParameter.Instance.UpdateParameters(getDefaultParameters(), false))));*/
        return Promise.all(getSqlsStart().map(sql => {
            return this.CreationStartProm(sql);
        })).then(rs => {
            return Promise.all(dbMaintance().map(sql => {
                return this.CreationStartProm(sql, false);
            }));
        }).then(rs => {
            return EntityParameter.Instance.UpdateParameters(getDefaultParameters(), false);
        }).then((rs) => {
            return EntityParameter.Instance.GetParams(['LOGGER_TYPE',
                'LOGGER_WARN',
                'LOGGER_INFO',
                'LOGGER_DBUG',
                'LOGGER_ERROR'
            ]);
        }).then(params => {
            if (Environment.config.ignoreLoggerParams) {
                console.log('Params ignored ignoreLoggerParams = true');
                return;
            }
            Environment.config.logging.type = params['LOGGER_TYPE'].split(',');
            Environment.config.logging.warn = params['LOGGER_WARN'] === '1';
            Environment.config.logging.info = params['LOGGER_INFO'] === '1';
            Environment.config.logging.dbug = params['LOGGER_DBUG'] === '1';
            Environment.config.logging.error = params['LOGGER_ERROR'] === '1';
        });


        /*.concat(dbMaintance().map(sql => {
            return this.CreationStartProm(sql, false);
        }).concat(EntityParameter.Instance.UpdateParameters(getDefaultParameters(), false))));*/
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

            this.timeoutChecker[idRequest] = setTimeout(() => {
                let find = this.events.eventNames().find(el => el === idRequest);
                if (find) {
                    callback(new Error(`[${idRequest}] Database Timeout error - Timeout=${this.timeout} SQL-${sql ? sql : ''} PARAMS=${JSON.stringify(params)}`));
                }

                delete this.timeoutChecker[idRequest];
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

            this.timeoutChecker[idRequest] = setTimeout(() => {
                let find = this.events.eventNames().find(el => el === idRequest);
                if (find) {
                    callback(new Error(`[${idRequest}]  Database Timeout error Timeout=${this.timeout} SQL-${sql ? sql : ''} PARAMS=${JSON.stringify(params)}`), undefined);
                }

                delete this.timeoutChecker[idRequest];
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

            this.timeoutChecker[idRequest] = setTimeout(() => {
                let find = this.events.eventNames().find(el => el === idRequest);
                if (find) {
                    callback(new Error(`[${idRequest}]  Database Timeout error Timeout=${this.timeout} SQL-${sql ? sql : ''} PARAMS=${JSON.stringify(params)}`), undefined);
                }

                delete this.timeoutChecker[idRequest];
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

export class Database {
    private static _instance: Database;
    private connection: sqlite3.Database;
    private isDBMaster = false;
    private events: events.EventEmitter;
    private timeout = 30000 // 3 minutos;
    private PORT = 33333;
    private MAX_RETRY = 5;
    private startingClinetConnection = false;
    private HOST = '127.0.0.1';
    private httpServer: http.Server;
    private workerMain: WorkProcess = WorkProcess.WORKER_SCAN_PROCESS;
    /*private server: dgram.Socket;
    private client: dgram.Socket;*/
    //private connections: net.Socket[] = [];
    private timeoutChecker = {};
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
        let app = express();

        app.use(bodyParser.json());

        app.listen(this.PORT, function () {
            console.log('Example app listening on port 3000!');
        });

        app.post('/', (req, res) => {
            Logger.debug('Packet HTTP body=' + JSON.stringify(req.body));
            //res.send('Hello World!');
            /*console.log('esti');
            console.log(req.body);*/
            if(req.body.action && req.body.action === 'REQUEST_MAXIMIZE') {
                UIFunctionsBinding.Instance.UpakiRequestMaximize();
                res.send('Maximize');
            } else {
                this.serverOnReceivePacket(req.body, res);
            }
        });

        /*
                this.httpServer = http.createServer((req, res) => {
                    try {
                        let data = [];
        
                        res.setHeader("Content-Type", "application/json");
                        req.on('data', chunk => {
                            data.push(chunk);
                        });
                        req.on('end', () => {
        
                            if (data && data.length) {
                                if (data.toString() === 'REQUEST_MAXIMIZE') {
                                    UIFunctionsBinding.Instance.UpakiRequestMaximize();
                                    res.write('Maximize');
                                    res.end();
                                } else {
                                    this.serverOnReceivePacket(data as any, res);
                                }
                            }
                        })
                    } catch (errorRequest) {
                        try { res.end(); } catch (_) { };
                        Logger.error(errorRequest);
                    }
                }).listen(this.PORT, () => {
                    Logger.info(`Server database listening`);
                });
        
                this.httpServer.timeout = this.timeout;*/
    }

    /*private startClient() {
        this.startingClinetConnection = true;
        return new Promise((resolve, reject) => {
            this.client = new net.Socket();
            this.client.connect({
                port: this.PORT,
                host: this.HOST
            });

            this.client.on('connect', () => {
                this.startingClinetConnection = false;
                Logger.info('[Database TCP] Client: connection established with server');

                var address = this.client.address();
                var port = address.port;
                var family = address.family;
                var ipaddr = address.address;
                Logger.info('[Database TCP] Client is listening at port' + port);
                Logger.info('[Database TCP] Client ip :' + ipaddr);
                Logger.info('[Database TCP] Client is IP4/IP6 : ' + family);

                resolve();
            });

            this.client.setEncoding('utf8');

            this.client.on('data', (data) => {
                let dados = data.toString().split('\n');

                for (let dadoSep of dados) {
                    if (dadoSep != '') {
                        this.clientOnReceivePacket(dadoSep);
                    }
                }

            });

            this.client.on('error', (data) => {
                reject();
            });
        });
    }*/

    private sendHttpRequest(msg: SqliteRequestPacket, callBackErr: (err: any) => void) {
        var options = {
            "method": "POST",
            "hostname": this.HOST,
            "port": this.PORT,
            "path": "/",
            "headers": {
                "content-type": "application/json",
                "cache-control": "no-cache"
            }
        };


        var req = http.request(options, (res) => {
            var chunks = [];

            res.on("data", (chunk) => {
                chunks.push(chunk);
            });

            res.on("end", () => {
                var body = Buffer.concat(chunks);
                //console.log(body.toString());
                this.clientOnReceivePacket(body.toString());
            });
        });

        req.write(JSON.stringify(msg));
        Logger.debug(`Send HTTP packet:` + JSON.stringify(msg));
        req.end();

        req.on("error", (err) => {
            Logger.error(err);
            callBackErr(err);
        });
    }

    private async sendPacketToServer(msg: SqliteRequestPacket, callBackErr: (err: any) => void) {
        //Logger.assert(`${msg.id}: sendPacketToServer SQL: ${msg.sql} PARAMS: ${JSON.stringify(msg.params)} TYPE: ${msg.type}`);
        if (this.isDBMaster) {
            throw new Error('Send packet to server incorrect call in server mode');
        }

        /*if (!this.client && !this.startingClinetConnection) {
            await this.startClient();
        }
        else */if (this.startingClinetConnection) {
            setTimeout(() => {
                this.sendPacketToServer(msg, callBackErr);
            }, 1000);
            return;
        }

        //let msgBuffer = Buffer.from(JSON.stringify(msg));
        // this.client.write(/*msgBuffer*/JSON.stringify(msg) + '\n');
        this.sendHttpRequest(msg, callBackErr);
    }

    public sendPacketToClient(msg: SqliteResponsePacket, clientSocket: http.ServerResponse) {
        if (!this.isDBMaster) {
            throw new Error('Send packet to client incorrect call in client mode');
        }
        clientSocket.write(JSON.stringify(msg) + '\n');
        clientSocket.end();
    }

    private clientOnReceivePacket(msg: string) {
        try {
            //console.log(msg.toString('utf8'));
            let packet = JSON.parse(msg) as SqliteResponsePacket;
            // console.log('packet::', packet);
            // console.log(`[${packet.id}] packet rs :: ${ packet.rs}`);
            // Logger.assert(`${packet.id}: clientOnReceivePacket RESPOND: ${JSON.stringify(packet.rs)} ERR: ${packet.err}`);
            clearTimeout(this.timeoutChecker[packet.id]);
            delete this.timeoutChecker[packet.id];
            this.events.emit(packet.id, packet.err ? new Error(packet.err) : undefined, packet.rs);
        } catch (error) {
            console.log(error);
            Logger.error(error);
        }
    }

    private serverOnReceivePacket(msg: SqliteRequestPacket, clientSocket: http.ServerResponse) {
        try {
            let packet = msg/*JSON.parse(msg) as SqliteRequestPacket*/;
            //this.connection.serialize(() => {
                switch (packet.type) {
                    case TYPE_DB_EXECUTIOM.RUN:
                        this.Run(packet.sql, packet.params, (err) => {


                            this.sendPacketToClient({
                                id: packet.id,
                                rs: '',
                                err: err ? err.message : undefined
                            }, clientSocket);
                        })
                        break;

                    case TYPE_DB_EXECUTIOM.GET:
                        this.Get(packet.sql, packet.params, (err, row) => {

                            this.sendPacketToClient({
                                id: packet.id,
                                rs: row,
                                err: err ? err.message : undefined
                            }, clientSocket);
                        })
                        break;

                    case TYPE_DB_EXECUTIOM.ALL:
                        this.All(packet.sql, packet.params, (err, row) => {


                            this.sendPacketToClient({
                                id: packet.id,
                                rs: row,
                                err: err ? err.message : undefined
                            }, clientSocket);
                        })
                        break;
                }
            //});

        } catch (error) {
            clientSocket.statusCode = 500;
            clientSocket.end();
        }
        /*}*/
    }

    private CreationStartProm(sql: string, checkErrors = true): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.run(sql,[], ( err) => {
                if (checkErrors) {
                    if (err) {
                        //Logger.error(sql);
                        //Logger.error(err);
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

    private CreationStartPromGet(sql: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.connection.all
            (sql,[], (err, rs) => {
                if (err) {
                     reject(err);
                } else {
                 resolve(rs);
                }
            });
        });
    }

    private checkDoubleProcess() {

    }

    InitDatabase() {
        /*return Promise.all(getSqlsStart().map(sql => {
            return this.CreationStartProm(sql);
        }).concat(dbMaintance().map(sql => {
            return this.CreationStartProm(sql, false);
        }).concat(EntityParameter.Instance.UpdateParameters(getDefaultParameters(), false))));*/
        return Promise.all(getSqlsStart().map(sql => {
            return this.CreationStartProm(sql, false);
        })).then(rs => {
            return Promise.all(dbMaintance().map(sql => {
                return this.CreationStartProm(sql, false);
            }));
        })
        .then(rs => {
          /*  return Promise.all(groupedMaintence().map(sql => {
                return Promise.all(sql.map(sql => {
                    return this.CreationStartProm(sql, true);
                }));
            }));*/

            return new Promise(async (resolve, reject) => {
                for(const group of groupedMaintence()) {
                    console.log(group);
                    for(const sql of group) {
                        try {
                            Logger.info('GroupedMaintence: try exec::' + sql)
                            if(typeof sql === 'string') 
                            {
                                await this.CreationStartProm(sql, true)
                            } else {
                                const test = sql as [string, (rs) => void];
                                const ret = await this.CreationStartPromGet(test[0])
                                test[1](ret);
                            }
                            Logger.info('GroupedMaintence: exec ok::' + sql)
                        } catch (error) {
                            Logger.info('GroupedMaintence: exec fail::' + sql)
                            break;
                        }
                    }
                }

                resolve(undefined);
            })
        })
        .then(rs => {
            return EntityParameter.Instance.UpdateParameters(getDefaultParameters(), false);
        }).then((rs) => {
            return EntityParameter.Instance.GetParams(['LOGGER_TYPE',
                'LOGGER_WARN',
                'LOGGER_INFO',
                'LOGGER_DBUG',
                'LOGGER_ERROR',
                'UPLOAD_FOLDER_SHARED'
            ]);
        }).then(params => {
            Environment.config.uploadFolderShared =  params['UPLOAD_FOLDER_SHARED'] === '1';
            
            if( Environment.config.uploadFolderShared) {
                Logger.warn(`Option uploadFolderShared is enabled`);
            } else{
                Logger.info(`Option uploadFolderShared is disabled`);
            }

            if (Environment.config.ignoreLoggerParams) {
                console.log('Params ignored ignoreLoggerParams = true');
                return;
            }
            Environment.config.logging.type = params['LOGGER_TYPE'].split(',');
            Environment.config.logging.warn = params['LOGGER_WARN'] === '1';
            Environment.config.logging.info = params['LOGGER_INFO'] === '1';
            Environment.config.logging.dbug = params['LOGGER_DBUG'] === '1';
            Environment.config.logging.error = params['LOGGER_ERROR'] === '1';
        });


        /*.concat(dbMaintance().map(sql => {
            return this.CreationStartProm(sql, false);
        }).concat(EntityParameter.Instance.UpdateParameters(getDefaultParameters(), false))));*/
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

    private sendRemoteExecution(sql: string, params: any[], callback?: any, type?: TYPE_DB_EXECUTIOM, idRequest = undefined, retryCount = 0) {
        if (!idRequest) {
            idRequest = uuidv1();
        }

        Logger.debug(`Database ${retryCount > 0 ? 'RETRY' : ''} Request Execution: ${sql}`);
        this.events.once(idRequest, callback);

        this.timeoutChecker[idRequest] = setTimeout(() => {
            let find = this.events.eventNames().find(el => el === idRequest);
            if (find) {
                if (retryCount < this.MAX_RETRY) {
                    retryCount++;
                    switch (type) {
                        case TYPE_DB_EXECUTIOM.RUN:
                            this.Run(sql, params, callback, idRequest, retryCount);
                            break;

                        case TYPE_DB_EXECUTIOM.ALL:
                            this.All(sql, params, callback, idRequest, retryCount);
                            break;

                        case TYPE_DB_EXECUTIOM.GET:
                            this.Get(sql, params, callback, idRequest, retryCount);
                            break;
                    }
                } else {
                    try {
                        callback(new Error(`(${type.toString()})[${idRequest}] Database Timeout error - Timeout=${this.timeout} SQL-${sql ? sql : ''} PARAMS=${JSON.stringify(params)}`));
                    } catch (error) {
                        callback(new Error(`(${type.toString()})[${idRequest}] Database Timeout error`));
                    }
                }
            }

            delete this.timeoutChecker[idRequest];
        }, this.timeout);


        this.sendPacketToServer({
            sql: sql, id: idRequest, worker: Environment.config.worker, params: params, type: type
        }, (err) => {
            Logger.warn('HTTP Error .... process failed');
            clearInterval(this.timeoutChecker[idRequest]);
            callback(err);
        });
    }

    public Run(sql: string, params: any[], callback?: (err: Error | null) => void, idRequest = undefined, retryCount = 0) {
        if (this.isDBMaster) {
            Logger.debug(`Database Execution: ${sql}`);
            this.connection.run(sql, params, callback);
        } else {
            this.sendRemoteExecution(sql, params, callback, TYPE_DB_EXECUTIOM.RUN, idRequest, retryCount);
            /* if (!idRequest) {
                 idRequest = uuidv1();
             }
 
             Logger.debug(`Database ${retryCount > 0 ? 'RETRY' : ''} Request Execution: ${sql}`);
             this.events.once(idRequest, callback);
 
             this.timeoutChecker[idRequest] = setTimeout(() => {
                 let find = this.events.eventNames().find(el => el === idRequest);
                 if (find) {
                     if (retryCount < this.MAX_RETRY) {
                         retryCount++;
                         this.Run(sql, params, callback, idRequest, retryCount);
                     } else {
                         callback(new Error(`(Run)[${idRequest}] Database Timeout error - Timeout=${this.timeout} SQL-${sql ? sql : ''} PARAMS=${JSON.stringify(params)}`));
                     }
                 }
 
                 delete this.timeoutChecker[idRequest];
             }, this.timeout);
 
 
             this.sendPacketToServer({
                 sql: sql, id: idRequest, worker: Environment.config.worker, params: params, type: TYPE_DB_EXECUTIOM.RUN
             });*/
        }
    }

    public Get(sql: string, params: any[], callback?: (err: Error | null, row: any, ) => void, idRequest = undefined, retryCount = 0) {
        if (this.isDBMaster) {
            Logger.debug(`Database Execution: ${sql}`);
            this.connection.get(sql, params, callback);
        } else {
            this.sendRemoteExecution(sql, params, callback, TYPE_DB_EXECUTIOM.GET, idRequest, retryCount);
            /*let idRequest = uuidv1();
            Logger.debug(`Database Request Execution: ${sql}`);
            this.events.once(idRequest, callback);

            this.timeoutChecker[idRequest] = setTimeout(() => {
                let find = this.events.eventNames().find(el => el === idRequest);
                if (find) {
                    callback(new Error(`(Get)[${idRequest}]  Database Timeout error Timeout=${this.timeout} SQL-${sql ? sql : ''} PARAMS=${JSON.stringify(params)}`), undefined);
                }

                delete this.timeoutChecker[idRequest];
            }, this.timeout);

            this.sendPacketToServer({
                sql: sql, id: idRequest, worker: Environment.config.worker, params: params, type: TYPE_DB_EXECUTIOM.GET
            });*/
        }
    }

    public All(sql: string, params: any[], callback?: (err: Error | null, rows: any[]) => void, idRequest = undefined, retryCount = 0) {
        if (this.isDBMaster) {
            Logger.debug(`Database Execution: ${sql}`);
            this.connection.all(sql, params, callback);
        } else {
            this.sendRemoteExecution(sql, params, callback, TYPE_DB_EXECUTIOM.ALL, idRequest, retryCount);
            /* let idRequest = uuidv1();
             Logger.debug(`Database Request Execution: ${sql}`);
             this.events.once(idRequest, callback);
 
             let tryRequest = 0;
 
             this.timeoutChecker[idRequest] = setTimeout(() => {
                 let find = this.events.eventNames().find(el => el === idRequest);
                 if (find) {
                     callback(new Error(`(All)[${idRequest}]  Database Timeout error Timeout=${this.timeout} SQL-${sql ? sql : ''} PARAMS=${JSON.stringify(params)}`), undefined);
                 }
 
                 delete this.timeoutChecker[idRequest];
             }, this.timeout);
 
             this.sendPacketToServer({
                 sql: sql, id: idRequest, worker: Environment.config.worker, params: params, type: TYPE_DB_EXECUTIOM.ALL
             });*/
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