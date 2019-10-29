export function getSqlsStart() {
    return [
        `CREATE TABLE IF NOT EXISTS file (key NOT NULL, data TEXT, user_id TEXT, PRIMARY KEY ("key"))`,
        `CREATE TABLE IF NOT EXISTS folder (key NOT NULL, data TEXT, user_id TEXT, PRIMARY KEY ("key"))`,
        `CREATE TABLE IF NOT EXISTS sync_folder (folder NOT NULL, user_id TEXT, PRIMARY KEY ("folder"))`,
        `CREATE TABLE task (pname TEXT NOT NULL, ptype INTEGER NOT NULL, pdata text, pstate INTEGER DEFAULT 0 NOT NULL, pdesc TEXT, user_id TEXT, autostart INTEGER DEFAULT 0 NOT NULL, PRIMARY KEY ("pname"))`,
        `CREATE TABLE credential (device_id text NOT NULL, credential_key text, token text, user_id TEXT, PRIMARY KEY ("device_id"))`,
        `UPDATE task SET pstate = 0 WHERE pstate <> 4`,
        `CREATE TABLE IF NOT EXISTS "parameter" ("KEY" TEXT NOT NULL, VALUE TEXT, PRIMARY KEY ("KEY"))`
    ];
}

export function dbMaintance() {
    return [`ALTER TABLE task ADD COLUMN autostart INTEGER DEFAULT 0 NOT NULL`,
        `ALTER TABLE sync_folder ADD delete_file INTEGER DEFAULT 0 NOT NULL`,
        `ALTER TABLE sync_folder ADD delete_on_finish INTEGER DEFAULT 0 NOT NULL`,
        `ALTER TABLE sync_folder ADD scan_delay INTEGER DEFAULT 0 NOT NULL`,
        `ALTER TABLE sync_folder ADD realtime INTEGER DEFAULT 1 NOT NULL`,
        `UPDATE parameter SET VALUE='file,sentry' WHERE KEY='LOGGER_TYPE' AND VALUE='file'`];
}

export function getDefaultParameters() {
    return {
        MAX_UPLOAD_QUEUE: 1,
        MAX_RETRY_UPLOAD: 10,
        UPLOAD_TIMEOUT: 600000,
        UPLOAD_RETRY_DELAY: 30000,
        MAX_PROCESS_FILES: 1000,
        UPLOAD_TYPE: 'PART',
        MAX_DISPLAY_UPLOAD_LIST: 10,
        COMPACT_CONTENT_UPLOAD: 1,
        LOGGER_TYPE: 'file,sentry',
        LOGGER_WARN: 1,
        LOGGER_INFO: 0,
        LOGGER_DBUG: 0,
        LOGGER_ERROR: 1,
        PROXY_SERVER: '',
        PROXY_PORT: 0,
        PROXY_PROTOCOL: 'http',
        PROXY_USER: '',
        PROXY_PASS: '',
        PROXY_ENABLE: 0,
        AUTO_SIGN: 0,
        SIGN_ID: ''
    };
}