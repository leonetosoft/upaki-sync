export enum DownloadFileState {
    AWAIT = 1,
    DOWNLOADING = 2,
    COMPLETED = 3,
    REQUEST_PAUSE = 5,
    REQUEST_STOP = 7,
    PAUSE = 6,
    ERROR = 4,
    STOP = 8
}

export enum DownloadUiAction {
    STOP = 1,
    PAUSE = 2
}

export interface PendingFolder {
    id: string;
    name: string;
    dad?: string;
}

export interface PendingFile {
    id: string;
    name: string;
    state: DownloadFileState;
    size: number;
    progress?: number;
    info?: string;
    etag?: string;
    path?: string;
    receivedBytes?: number;
    downloadSpeed?: string;
    downloadTime?: string;
    queueId?: string;
}

export interface DownloadProcData {
    pendingFolders: PendingFolder[];
    pendingFiles: PendingFile[];
    actualFolder: PendingFolder;
    folder: string; //folder que esta sendo escaneado
    path: PendingFolder[]; // path em que é concatenado a cada varredura
    destFolder: string;
    state: ScanDownloadState;
}

export enum ScanDownloadState {
    SCAN = 1,
    AWAIT_NEXT = 2,
    COMPLETE_SCAN = 3,
    COMPLETE_DOWNLOAD = 4,
    CREATED = 5
}

export interface DownloadInfoUi {
    downloadList: PendingFile[];
    folder: string;
    state: ScanDownloadState;
    await: number;
    concluded: number;
    errors: number;
}
