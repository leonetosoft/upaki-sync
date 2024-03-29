import { Logger } from "../util/Logger";

export function getSqlsStart() {
    return [
        `CREATE TABLE IF NOT EXISTS file (key NOT NULL, data TEXT, user_id TEXT, PRIMARY KEY ("key"))`,
        `CREATE TABLE IF NOT EXISTS folder (key NOT NULL, data TEXT, user_id TEXT, PRIMARY KEY ("key"))`,
        `CREATE TABLE IF NOT EXISTS sync_folder (folder NOT NULL, user_id TEXT, PRIMARY KEY ("folder","user_id"))`,
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
        `UPDATE parameter SET VALUE='file,sentry' WHERE KEY='LOGGER_TYPE' AND VALUE='file'`,
        `ALTER TABLE sync_folder ADD preferred_dest_folder_id TEXT`];
}

// groupedMaintence executa o grupo de query
// caso alguma sql do grupo falhar todas vao falhar 
// o proximo grupo executa normalmente
export function groupedMaintence() {
    return [
        [
            ["PRAGMA table_info('sync_folder')", (rs: { pk: number }[]) => {
                const contains = rs.findIndex(rs => rs.pk === 2);
                if (contains !== -1) {
                    Logger.debug('already fix primarykey of table sync_folder')
                    throw new Error('already fix primarykey of table sync_folder')
                }
            }],
            'CREATE TABLE sync_folder_v2 (folder NOT NULL, user_id TEXT, delete_file INTEGER DEFAULT 0, delete_on_finish INTEGER DEFAULT 0,  scan_delay INTEGER DEFAULT 0, realtime INTEGER DEFAULT 1, PRIMARY KEY ("folder", "user_id"));',
            'INSERT INTO sync_folder_v2(folder, user_id, delete_file, delete_on_finish, scan_delay, realtime) SELECT folder, user_id, delete_file, delete_on_finish, scan_delay, realtime FROM sync_folder;',
            'DROP table  sync_folder;',
            'ALTER TABLE sync_folder_v2 RENAME TO sync_folder;',
        ]
    ];
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
        SIGN_ID: '',
        UPLOAD_FOLDER_SHARED: 0
    };
}