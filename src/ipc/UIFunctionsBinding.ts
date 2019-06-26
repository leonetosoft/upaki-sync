import { SharedFuncion } from "./EventBinding";
import { UploadList } from "./IPCInterfaces";
import { WorkerMaster } from "../thread/WorkerMaster";
import { WorkProcess, TaskModel, TaskEvent } from "../api/thread";


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
    UpakiAlreadyOpen() {
        WorkerMaster.Instance.implUi.forEach((el) => {
            el.UpakiAlreadyOpen();
        });
    }

    @SharedFuncion({
        mainWorter: WorkProcess.MASTER,
        response: false
    })
    UpakiRequestMaximize() {
        WorkerMaster.Instance.implUi.forEach((el) => {
            el.UpakiRequestMaximize();
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
    UpdateTaskDefinition(task: TaskModel<any>, cacheSource: string) {
        WorkerMaster.Instance.implUi.forEach((el) => {
            el.UpdateTaskDefinition(task, cacheSource);
        });
    }

    @SharedFuncion({
        mainWorter: WorkProcess.MASTER,
        response: false
    })
    OnTaskEvent(eventType: TaskEvent, pname: string) {
        WorkerMaster.Instance.implUi.forEach((el) => {
            el.OnTaskEvent(eventType, pname);
        });
    }

}