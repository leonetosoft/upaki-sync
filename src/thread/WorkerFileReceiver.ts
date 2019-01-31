import { WorkProcess } from "../api/thread";
import { SystemWorker } from "./SystemWorker";
import { FileReceiverProcData } from "../api/filereceiver";
import { Logger } from "../util/Logger";
import { FileReceiverService } from "../module/FileReceiverService";
import * as moment from 'moment';
import { Util } from "../util/Util";

export class WorkerFileReceiver extends SystemWorker<FileReceiverProcData> {
    private static _instance: WorkerFileReceiver;
    private flRecv: FileReceiverService;
    constructor() {
        super(WorkProcess.WORKER_FILE_RECEIVER, process.env['PNAME'])
    }

    public static get Instance(): WorkerFileReceiver {
        return this._instance || (this._instance = new this());
    }

    PutLogData(type, dta: string) {
        if (this.pData.eventLog.length > 100) {
            this.pData.eventLog = [];
        }
        let hour = moment().format('HH:MM:ss');
        this.pData.eventLog.push(`[${hour}] - ${type}: ${dta}`);
    }

    OnShuttdown() {
        this.pData.ready = false;
        this.SaveData();
    }

    UpdateParams(port: number, destFolder: string, callback: (err, rs) => void) {
        try {
            if (destFolder) {
                this.pData.receivePath = destFolder;
            }
            if (port) {
                this.pData.port = port;
            }

            this.pData.ready = false;


            this.SaveData();

            if (this.flRecv) {
                this.flRecv.UpdateParams(port, destFolder, (err) => {
                    if (err) {
                        this.PutLogData('ERRO', err.message);
                    }
                    callback(undefined, 'Parametros atualizados');
                });
            } else {
                callback(undefined, 'Parametros atualizados');
            }
        } catch (error) {
            callback(error, undefined);
        }
    }

    public async InitService() {
        await this.LoadData();
        this.pData.ready = false;
        this.UpdateUiHandler();

        this.flRecv = new FileReceiverService(this.model.pdata.port, this.model.pdata.receivePath);
        this.flRecv.on('onCompleteFile', (filename, size) => {
            Logger.debug(`Complete receive ${filename} size ${size}`);
            this.pData.totalReceive += size;
            this.PutLogData('INFO', `Arquivo recebido ${filename} tamanho ${Util.elegantSize(size)}`);
        });
        this.flRecv.on('onCorruptedFile', (filename) => {
            Logger.warn(`File ${filename} corrupted!`);
            this.PutLogData('INFO', `Arquivo corrompido ${filename}, cancelando operação`);
        });
        this.flRecv.on('onListen', (ip, port) => {
            Logger.debug(`Started on ip ${ip} on port ${port}`);
            this.pData.ip = ip;
            this.pData.ready = true;
            this.PutLogData('INFO', `Servidor iniciado no IP[${ip}:${port}]`);
        });
        this.flRecv.on('onError', err => {
            Logger.error(err);
            this.PutLogData('ERRO', err.message);
        });
        this.flRecv.on('onClose', () => {
            this.PutLogData('INFO', `Servidor encerrado`);
        });
        this.flRecv.on('onStartTransfer', (filename, size) => {
            Logger.debug(`Start transfer ${filename} on size ${size}`);
            this.PutLogData('INFO', `Iniciado recebimento do arquivo ${filename} tamanho ${Util.elegantSize(size)}`);
        });

    }
}