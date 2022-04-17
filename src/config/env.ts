export interface Config {
    version: string;
    useCluster: boolean;
    ignoreLoggerParams: boolean;
    logging: {
        type: string[],
        warn: boolean,
        info: boolean,
        dbug: boolean,
        error: boolean
    },
    userProfile: {
        busines_id: string;
        email: string;
        id: string;
        name: string;
        nickname: string;
        view_first_on_order: string;
        view_order_name_items: string;
        view_share_user: string;
        view_share_workgroup: string;
        view_type: string;
    },
    uploadFolderShared: boolean,
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
        },
        database: {
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