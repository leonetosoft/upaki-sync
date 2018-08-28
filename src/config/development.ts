import { Config } from "./env";

export var development: Config = {
    version: '1.0.0',
    useCluster: true,
    synchPath: "C:\\Users\\leonetosoft\\Documents\\FolderSincronize"/*"E:\\"*/,
    credentialsPath: "C:\\Users\\leonetosoft\\Documents\\vxMLNEYl5P.apikey.json",
    logging: {
        type: ['console', 'file', 'sentry'],
        warn: true,
        info: true,
        dbug: true,
        error: true
    },
    credentials: {
        secretToken: "",
        credentialKey: ""
    },
    database: {
        filedb: '.\\data\\sync.db',
    },
    queue: {
        uploader: {
            taskSize: 1,
            maxRetries: 30,
            retryDelay: 30000
        },
        fileAction: {
            taskSize: 100,
            maxRetries: 10,
            retryDelay: (30000)
        },
        renameAction: {
            taskSize: 1,
            maxRetries: 10,
            retryDelay: 30000
        }
    },
    socket: {
        url: 'https://www.upaki.com.br'
    }
}