import { SystemWorker } from "./SystemWorker";
import { CopyDirProcData } from "../api/copydir";
import { FileCopy } from "../module/FileCopy";
import { WorkProcess, ProcTaskState } from "../api/thread";
import { EntityFolderSync } from "../persist/entities/EntityFolderSync";
import { Util } from "../util/Util";
import { Logger } from "../util/Logger";

export class WorkerCopyDir extends SystemWorker<CopyDirProcData> {
    private static _instance: WorkerCopyDir;
    private flCp: FileCopy;

    constructor() {
        super(WorkProcess.WORKER_COPY_DIR, process.env['PNAME'])
    }

    public static get Instance(): WorkerCopyDir {
        return this._instance || (this._instance = new this());
    }

    UpdateUiHandler() {
        setInterval(async () => {
            this.SaveData();
        }, 1000);
    }

    AddEventInfo(msg) {
        if (!this.pData.eventInfo) {
            this.pData.eventInfo = [];
        }

        this.pData.eventInfo.push(msg);
    }
    
    Init() {
        this.UpdateUiHandler();
        let pathDest = path.join(Util.getFolderSend(), 'Deleta Ao Enviar');
        EntityFolderSync.Instance.AddFolder(pathDest, 0, 1, (err) => {
            if (!err) {
                let dest = path.join(pathDest, Util.getFolderNameByPath(this.pData.destDir));
                this.pData.destDir = dest;
                this.flCp = new FileCopy(dest, this.pData.destDir, this.pData.availableExtensions, this.pData.removeOnCopy, true);

                this.flCp.on('onCopyFile', (filename, size, dest) => {
                    // console.log(`Copiando arquivo ${filename} tamanho ${size} para ${dest}`);
                    this.AddEventInfo(`Copiando arquivo ${filename} tamanho ${size} para ${dest}`);
                });

                let total = 0;
                this.flCp.on('onScanFiles', (list) => {
                    total += list.length;
                    console.log(`Encontrados ${total} arquivos`);
                    this.AddEventInfo(`Encontrados ${total} arquivos`);
                });

                this.flCp.on('onError', (err) => {
                    console.log('Ocorreu um erro');
                    console.log(err);
                    Logger.error(err);
                    this.AddEventInfo(`Erro ao realizar a copia ${err.message}.`);
                    setTimeout(() => this.model.pstate = ProcTaskState.COMPLETED, 5000);
                });

                this.flCp.on('onComplete', () => {
                    console.log('Processamento Completo!');
                    this.AddEventInfo(`Copia completa.`);
                    setTimeout(() => this.model.pstate = ProcTaskState.COMPLETED, 5000);
                });

                this.flCp.Init();
            }else {
                this.AddEventInfo(`Erro ao realizar a copia ${err.message}.`);
                Logger.error(err);
                setTimeout(() => this.model.pstate = ProcTaskState.COMPLETED, 5000);
            }
        });

    }
}