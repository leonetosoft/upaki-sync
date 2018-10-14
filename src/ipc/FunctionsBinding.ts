import { SharedFuncion } from "./EventBinding";
import { WorkProcess } from "../thread/UtilWorker";
import { WorkerScanProcess } from "../thread/WorkerScanProcess";
import { WorkerWatcher } from "../thread/WorkerWatcher";
import { WorkerUpload } from "../thread/WorkerUpload";
import { Logger } from "../util/Logger";
import { S3StreamSessionDetails } from "upaki-cli";
import { WorkerProcessFile } from "../thread/WorkerProcessFile";
import { UploadList } from "./IPCInterfaces";
import { WorkerSocket } from "../thread/WorkerSocket";
import { FileTypeAction } from "../sync/task/FileTask";

export class FunctionsBinding {
    private static _instance: FunctionsBinding;

    public static get Instance(): FunctionsBinding {
        return this._instance || (this._instance = new this());
    }

    @SharedFuncion({
        mainWorter: WorkProcess.WORKER_SCAN_PROCESS,
        response: true
    })
    TestaEvento(a: number, b: number, c: { k: number }, callback: (err, rs) => void) {
        callback(`deu merda`, (a + b) * c.k);
    }

    @SharedFuncion({
        mainWorter: WorkProcess.WORKER_SCAN_PROCESS,
        response: false
    })
    StopScan(src: string) {
        WorkerScanProcess.Instance.StopScan(src);
    }

    @SharedFuncion({
        mainWorter: WorkProcess.WORKER_SCAN_PROCESS,
        response: false
    })
    AddScanDir(src: string) {
        WorkerScanProcess.Instance.ScanDir(src);
    }

    @SharedFuncion({
        mainWorter: WorkProcess.WORKER_WHATCHER,
        response: false
    })
    AddWatch(src: string) {
        WorkerWatcher.Instance.AddWatch(src)
    }

    @SharedFuncion({
        mainWorter: WorkProcess.WORKER_PROCESS_FILE,
        response: true
    })
    ProcessFile(files: string[], rootFolder: string, callback: (err, rs) => void) {
        try {
            WorkerProcessFile.Instance.PutFilesQueue(files, rootFolder);
            callback(undefined, '');
        } catch (error) {
            callback('Erro ao inserir arquivo para processamento', undefined);
            Logger.error(error);
        }
    }

    @SharedFuncion({
        mainWorter: WorkProcess.WORKER_WHATCHER,
        response: false
    })
    StopWatch(src: string) {
        WorkerWatcher.Instance.StopWhatch(src)
    }

    @SharedFuncion({
        mainWorter: WorkProcess.WORKER_UPLOAD,
        response: true
    })
    UploadFile(src: string, session: S3StreamSessionDetails, rootFolder: string, callback: (err, rs) => void) {
        try {
            WorkerUpload.Instance.StartUpload(src, session, rootFolder);
            callback(undefined, undefined);
        } catch (error) {
            Logger.error(error);
            callback('Erro to add upload', undefined);
        }
    }

    @SharedFuncion({
        mainWorter: WorkProcess.WORKER_UPLOAD,
        response: false
    })
    StopUpload(src: string) {
        try {
            WorkerUpload.Instance.StopUploadsOfPath(src);
        } catch (error) {
            Logger.error(error);
        }
    }

    @SharedFuncion({
        mainWorter: WorkProcess.WORKER_SOCKET,
        response: false
    })
    UpdateUploadList(list: UploadList) {
        WorkerSocket.Instance.UPLOAD_LIST = list.list;
        WorkerSocket.Instance.SIZE_SEND = list.totalSend;
        WorkerSocket.Instance.TOTAL_SEND = list.numberOfUploads;
    }

    @SharedFuncion({
        mainWorter: WorkProcess.WORKER_PROCESS_FILE,
        response: false
    })
    WatchFileEvent(data: { key: string, action: FileTypeAction, item: 'folder' | 'file', oldKey: string, rootFolder: string }) {
        WorkerProcessFile.Instance.ProcessFileWhatched(data);
    }

}