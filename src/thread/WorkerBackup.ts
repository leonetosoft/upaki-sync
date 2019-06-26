import { BackupProcData } from "../api/backup";
import { SystemWorker } from "./SystemWorker";
import { WorkProcess, ProcTaskState } from "../api/thread";
import { BackupService } from "../module/BackupService";
import { Logger } from "../util/Logger";

export class WorkerBackup extends SystemWorker<BackupProcData> {
    private static _instance: WorkerBackup;

    constructor() {
        super(WorkProcess.WORKER_COPY_DIR, process.env['PNAME'])
    }

    public static get Instance(): WorkerBackup {
        return this._instance || (this._instance = new this());
    }

    private addEventLog(log: string) {
        this.pData.eventLog.push(log);
    }

    async Init() {
        await this.LoadData();
        this.UpdateUiHandler(500);
        // limpa o log de eventos
        this.pData.eventLog = [];


        let backup = new BackupService(this.pData.sources,
            this.pData.dests,
            this.model.pname,
            this.pData.backupType,
            this.pData.compact);

        backup.Init();

        backup.on(`debug`, (dbug) => {
            Logger.debug(dbug);
        });

        backup.on(`onCopySucces`, (file) => {
            //console.log(`onCopySuccess=`, file);
            this.addEventLog(`Arquivo copiado com sucesso ${file.file}`);
            Logger.info(`onCopySuccess=` + file.file);
        });

        backup.on(`onCriticalError`, (ctrErr) => {
            console.log(`OnCriticalError`, ctrErr);
            Logger.error(ctrErr);
            this.addEventLog(`Erro crítico na cópia: ${ctrErr.message}`);
            setTimeout(() => this.model.pstate = ProcTaskState.STOPPED, 5000);
        });

        backup.on(`onError`, (err) => {
            Logger.error(err);
            this.addEventLog(`Erro na cópia: ${err.message}`);
        });

        backup.on(`onFinish`, () => {
            setTimeout(() => this.model.pstate = ProcTaskState.COMPLETED, 5000);
        });

        backup.on(`onErrorCopy`, (err, file, dest) => {
            Logger.error(err);
            this.addEventLog(`Não foi possível copiar >>${file}<< para >>${dest}<< erro: ${err.message}`);
        });

        backup.on(`onInfo`, (info) => {
            Logger.info(info);
            this.addEventLog(info);
        });

        backup.on(`onScanFolder`, (folder) => {
            Logger.info(`Varrendo pasta ${folder}`);
        })
    }

}