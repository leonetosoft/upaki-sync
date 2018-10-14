import { UploadState } from "../sync/task/UploaderTask";


export interface UploadItem {
    path: string,
    cloudpath: string,
    state: UploadState,
    parts: any,
    loaded: number,
    uploadType: any,
    size: number,
    name: string,
    key: string,
    preventTimeLeft: string,
    speedBps: number,
    speed: number,
    speedType: string
}

export interface UploadList {
    numberOfUploads: number;
    totalSend: number;
    list: UploadItem[];
}