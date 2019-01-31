import { SystemWorker } from "./SystemWorker";
import { CopyDirProcData } from "../api/copydir";
import { FileCopy } from "../module/FileCopy";
import { WorkProcess, ProcTaskState } from "../api/thread";
import { EntityFolderSync } from "../persist/entities/EntityFolderSync";
import { Util } from "../util/Util";
import { Logger } from "../util/Logger";
import * as path from 'path';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';

export class WorkerCopyDir extends SystemWorker<CopyDirProcData> {
    private static _instance: WorkerCopyDir;
    private flCp: FileCopy;

    constructor() {
        super(WorkProcess.WORKER_COPY_DIR, process.env['PNAME'])
    }

    public static get Instance(): WorkerCopyDir {
        return this._instance || (this._instance = new this());
    }

    AddEventInfo(msg) {
        if (!this.pData.eventInfo) {
            this.pData.eventInfo = [];
        }
        this.pData.eventInfo.push(msg);
    }
    
    async Init() {
        await this.LoadData();
        this.UpdateUiHandler(500);
        let pathDest = path.join(Util.getFolderSend(), this.pData.deviceName ? this.pData.deviceName : 'Deleta Ao Enviar');
        if(!fs.existsSync(pathDest)) {
            mkdirp.sync(pathDest);
        }

        EntityFolderSync.Instance.AddFolder(pathDest, 0, 1, (err) => {
            if (!err) {
                let dest = pathDest;
                this.pData.destDir = dest;
                this.flCp = new FileCopy(this.pData.sourceDir, this.pData.destDir, this.pData.availableExtensions, this.pData.removeOnCopy, true);

                this.flCp.on('onCopyFile', (filename, size, dest) => {
                    this.AddEventInfo(`Copiando ${filename} tamanho ${Util.elegantSize(size)}`);
                    this.pData.fileInfo = {name: filename, size: size};
                });

                let total = 0;
                this.flCp.on('onScanFiles', (list) => {
                    total += list.length;
                    this.AddEventInfo(`Encontrados ${total} arquivos`);
                });

                this.flCp.on('onError', (err) => {
                    Logger.error(err);
                    this.AddEventInfo(`Erro ao realizar a copia ${err.message}.`);
                    setTimeout(() => this.model.pstate = ProcTaskState.STOPPED, 5000);
                });

                this.flCp.on('onComplete', () => {
                    this.AddEventInfo(`Copia completa.`);
                    setTimeout(() => this.model.pstate = ProcTaskState.COMPLETED_DELETE, 5000);
                });

                this.flCp.Init();
            }else {
                this.AddEventInfo(`Erro ao realizar a copia ${err.message}.`);
                Logger.error(err);
                setTimeout(() => this.model.pstate = ProcTaskState.STOPPED, 5000);
            }
        });

    }
}