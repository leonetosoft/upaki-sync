import { SharedFuncion } from "./EventBinding";
import { WorkProcess } from "../thread/UtilWorker";
import { UploadList } from "./IPCInterfaces";
import { WorkerMaster } from "../thread/WorkerMaster";
import { Environment } from "..";
import { DownloadInfoUi } from "../thread/WorkerDownload";


export class UIFunctionsBinding {
    private static _instance: UIFunctionsBinding;

    public static get Instance(): UIFunctionsBinding {
        return this._instance || (this._instance = new this());
    }

    @SharedFuncion({
        mainWorter: WorkProcess.MASTER,
        response: false
    })
    UpdateUploadListUI(list: UploadList) {
        WorkerMaster.Instance.implUi.forEach((el) => {
            el.UploadList(list);
        });
    }

    @SharedFuncion({
        mainWorter: WorkProcess.MASTER,
        response: false
    })
    PathScan(src: string, actualScan: string) {
        WorkerMaster.Instance.implUi.forEach((el) => {
            el.PathScan(src, actualScan);
        });
    }

    @SharedFuncion({
        mainWorter: WorkProcess.MASTER,
        response: false
    })
    FinishScan(src: string) {
        WorkerMaster.Instance.implUi.forEach((el) => {
            el.FinishScan(src);
        });
    }

    @SharedFuncion({
        mainWorter: WorkProcess.MASTER,
        response: false
    })
    UpdateTaskDefinition(taskId: string, cacheSource: string) {
        WorkerMaster.Instance.implUi.forEach((el) => {
            el.UpdateTaskDefinition(taskId, cacheSource);
        });
    }

}