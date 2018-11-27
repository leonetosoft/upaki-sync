export interface Config {
    version: string;
    useCluster: boolean;
    logging: {
        type: string[],
        warn: boolean,
        info: boolean,
        dbug: boolean,
        error: boolean
    },
    synchPath: string,
    credentialsPath: string,
    credentials?: { secretToken: string, credentialKey: string, deviceId?: string, userId?: string };
    database: {
        filedb: string;
    },
    queue: {
        uploader: {
            taskSize: number;
            maxRetries: number;
            retryDelay: number;
        },
        fileAction: {
            taskSize: number;
            maxRetries: number;
            retryDelay: number;
        },
        renameAction: {
            taskSize: number;
            maxRetries: number;
            retryDelay: number;
        },
        downloadTask?: {
            taskSize: number;
            maxRetries: number;
            retryDelay: number;
        }
    },
    socket: {
        url: string
    }
    worker?: number;
}

export namespace Environment {
    export var config: Config;
}   