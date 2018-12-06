export function getSqlsStart() {
    return [
        `CREATE TABLE IF NOT EXISTS file (key NOT NULL, data TEXT, user_id TEXT, PRIMARY KEY ("key"))`,
        `CREATE TABLE IF NOT EXISTS folder (key NOT NULL, data TEXT, user_id TEXT, PRIMARY KEY ("key"))`,
        `CREATE TABLE IF NOT EXISTS sync_folder (folder NOT NULL, user_id TEXT, PRIMARY KEY ("folder"))`,
        `CREATE TABLE task (pname TEXT NOT NULL, ptype INTEGER NOT NULL, pdata text, pstate INTEGER DEFAULT 0 NOT NULL, pdesc TEXT, user_id TEXT, autostart INTEGER DEFAULT 0 NOT NULL, PRIMARY KEY ("pname"))`,
        `CREATE TABLE credential (device_id text NOT NULL, credential_key text, token text, user_id TEXT, PRIMARY KEY ("device_id"))`,
        `UPDATE task SET pstate = 0 WHERE pstate <> 4`
    ];
}

export function dbMaintance() {
    return [`ALTER TABLE task ADD COLUMN autostart INTEGER DEFAULT 0 NOT NULL`];
}