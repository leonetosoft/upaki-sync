export enum CopyType {
    SUBDIR = 1,
    FILES = 2
}
export interface CopyDirProcData {
    deviceName?: string;
    copyType?: CopyType;
    sourceDir: string;
    destDir?: string;
    removeOnCopy: boolean;
    eventInfo: string[];
    fileInfo: {name: string, size: number};
    availableExtensions: string[];
}