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
        secretToken: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7InVzZXJfaWQiOjF9LCJpYXQiOjE1MjE4NzcxODd9.PqMe0hiIHF8fAY5uPFd39-jGQeX7UhBXYDJvHG44UAV6ATMHwUmtvZNVYvyiyP0CLKOF1ojhydcewGxUTTHEOzC3cqSn12rjX1kfY9_uLBwRcqwES7IPSQpHlDqeBLL8JnkmNFoQvRyw23ddbcX1nmU7RKTBmb7_VrUFmYrGAmE",
        credentialKey: "3wQYKXLaqj"
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
        }
    }, socket: {
        url: 'https://www.upaki.com.br'
    }
}