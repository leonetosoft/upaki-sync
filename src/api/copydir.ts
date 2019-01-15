export enum CopyType {
    SUBDIR = 1,
    FILES = 2
}
export interface CopyDirProcData {
    copyType?: CopyType;
    sourceDir: string;
    destDir?: string;
    removeOnCopy: boolean;
    eventInfo: string[];
    fileInfo: string;
    availableExtensions: string[];
}