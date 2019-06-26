export interface BackupFile {
    backup_id: string;
    file: string;
    last_modifies: string;
    updated: number;
    pname: string;
    size: number;
    copied?: boolean;
}

export interface BackupProduct {
    backup_id: string;
    pathName: string;
}

export enum BackupType {
    FULL = 1,
    INCREMENTAL = 2,
    DIFERENCIAL = 3
}

export interface CopyFilesToBackup {
    diferencial: BackupFile[];
    incremental: BackupFile[];
    full: BackupFile[];
    source: string;
}

export interface Backup {
    id?: string;
    type?: number;
    date_time_execution?: string;
    size?: number;
    next_execution?: string;
    pname?: string;
    date_time_finish?: string;
    success?: number;
    errors?: number;
    product?: BackupProduct[];
}

export interface BackupProcData {
    sources: string[];
    dests: string[];
    backupType: BackupType;
    compact: boolean;
    eventLog: string[];
}