import { UploadList } from "./IPCInterfaces";
import { TaskModel, TaskEvent } from "../api/thread";

export interface UIEvents {
    UploadList(list: UploadList);
    PathScan(src: string, actualScan: string);
    FinishScan(src: string);
    UpdateTaskDefinition(task: TaskModel<any>, cacheSource: string);
    OnTaskEvent(eventType: TaskEvent, pname: string);
    UpakiAlreadyOpen();
    UpakiRequestMaximize();
}