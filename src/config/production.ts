import { Config } from "./env";

export var production: Config = {
    version: '1.2.0',
    synchPath: "",
    useCluster: true,
    credentialsPath: "",
    logging: {
        type: ['console', 'file', 'sentry'],
        warn: true,
        info: true,
        dbug: false,
        error: true
    },
    credentials: {
        secretToken: "",
        credentialKey: ""
    },
    database: {
        filedb: './data/files.db',
    },
    queue: {
        uploader: {
            taskSize: 1,
            maxRetries: 30,
            retryDelay: 30000
        },
        fileAction: {
            taskSize: 10,
            maxRetries: 10,
            retryDelay: (30000)
        },
        renameAction: {
            taskSize: 1,
            maxRetries: 10,
            retryDelay: 30000
        },
        downloadTask: {
            taskSize: 1,
            maxRetries: 10,
            retryDelay: 30000
        }
    }, socket: {
        url: 'https://www.upaki.com.br'
    }
}