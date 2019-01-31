import { SharedFuncion } from "./EventBinding";
import { WorkerScanProcess } from "../thread/WorkerScanProcess";
import { WorkerWatcher } from "../thread/WorkerWatcher";
import { WorkerUpload } from "../thread/WorkerUpload";
import { Logger } from "../util/Logger";
import { S3StreamSessionDetails } from "upaki-cli";
import { WorkerProcessFile } from "../thread/WorkerProcessFile";
import { UploadList } from "./IPCInterfaces";
import { WorkerSocket } from "../thread/WorkerSocket";
import { FileTypeAction } from "../sync/task/FileTask";
import * as fs from 'fs';
import * as readline from 'readline';
import * as os from 'os';
import { Util } from "../util/Util";
import * as path from 'path';
import { WorkerDownload } from "../thread/WorkerDownload";
import { DownloadUiAction } from "../api/download";
import { WorkProcess } from "../api/thread";
import { WorkerFileReceiver } from "../thread/WorkerFileReceiver";

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
        mainWorter: WorkProcess.WORKER_PROCESS_FILE,
        response: false
    })
    ProcessFileLote(rootFolder: string/*, callback: (err, rs) => void*/) {
        try {
            let source = path.join(os.tmpdir(), `upaki_read_${Util.MD5SRC(rootFolder)}.json`);
            if (!fs.existsSync(source)) {
                Logger.warn(`File ${source} not exists in loc !!! realtime sinc not upload ...`);
                return;
            }
            var instream = fs.createReadStream(source);
            var rl = readline.createInterface(instream);

            rl.on('line', (line) => {
                // console.log(line);
                if (line && line !== '') {
                    WorkerProcessFile.Instance.PutFileQueue(line, rootFolder);
                }
            });

            rl.on('close', () => {
                try {
                    fs.unlinkSync(source);
                } catch (error) {
                    Logger.error(error);
                }
            });
        } catch (error) {
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

    @SharedFuncion({
        mainWorter: WorkProcess.WORKER_UPLOAD,
        response: false
    })
    DownloadAction(taskId: string, queueId: string, action: DownloadUiAction, callback: (err, rs) => void) {
        try {
            WorkerDownload.Instance.uiAction(queueId, action, callback);
        } catch (error) {
            Logger.error(error);
        }
    }

    @SharedFuncion({
        mainWorter: WorkProcess.WORKER_FILE_RECEIVER,
        response: true
    })
    UpdateParamsFileReceiver(taskId: string, port: number, destFolder: string, callback: (err, rs) => void) {
        try {
            WorkerFileReceiver.Instance.UpdateParams(port, destFolder, callback);
        } catch (error) {
            Logger.error(error);
        }
    }

    @SharedFuncion({
        mainWorter: WorkProcess.WORKER_UPLOAD,
        response: false
    })
    RequestUpdateUiUpload() {
        try {
           WorkerUpload.Instance.UpdateUiList();
        } catch (error) {
            Logger.error(error);
        }
    }

}