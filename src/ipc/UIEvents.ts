import { UploadList } from "./IPCInterfaces";

export interface UIEvents {
    UploadList(list: UploadList);
    PathScan(src: string, actualScan: string);
    FinishScan(src: string);
    UpdateTaskDefinition(taskId: string, cacheSource: string);
}