import * as fs from 'fs';
import * as crypto from 'crypto';
import * as moment from 'moment';
import * as os from 'os';
import * as path from 'path';
import { PRIORITY_QUEUE } from '../queue/task';
import { UploaderTask } from '../sync/task/UploaderTask';
import { Environment } from '../config/env';
import { Upaki, UpakiArchiveList, UpakiUserProfile } from 'upaki-cli';

export namespace Util {
    /**
     * Pega ext do arquivo
     * @param path 
     */
    export function getExtension(path): string {
        var basename = path.split(/[\\/]/).pop(),  // extract file name from full path ...
            // (supports `\\` and `/` separators)
            pos = basename.lastIndexOf(".");       // get last position of `.`

        if (basename === "" || pos < 1)            // if file name is empty or ...
            return "";                             //  `.` not found (-1) or comes first (0)

        return basename.slice(pos + 1);            // extract extension ignoring `.`
    }

    /**
     * Pega o nome do arquivo pelo path
     * sem extenssao!!!
     * @param prevname 
     */
    export function getFileNameByPath(prevname) {
        return prevname.replace(/^(.*[/\\])?/, '').replace(/(\.[^.]*)$/, '');
    }

    export function getFolderNameByPath(folderName) {
        return path.basename(folderName);
    }

    export function getPathNameFromFile(folderPath) {
        return path.dirname(folderPath);
    }

    /**
   * Splits whole path into segments and checks each segment for existence and recreates directory tree from the bottom.
   * If since some segment tree doesn't exist it will be created in series.
   * Existing directories will be skipped.
   * @param {String} directory
   */
    export function mkdirSyncRecursive(dir) {
        path
            .resolve(dir)
            .split(path.sep)
            .reduce((acc, cur) => {
                const currentPath = path.normalize(acc + path.sep + cur);
                try {
                    fs.statSync(currentPath);
                } catch (e) {
                    if (e.code === 'ENOENT') {
                        fs.mkdirSync(currentPath);
                    } else {
                        throw e;
                    }
                }
                return currentPath;
            }, '');
    }

    export function getFileSize(path: string) {
        const stats = fs.statSync(path);
        return stats.size;
    }

    export function MD5SRC(src) {
        return crypto.createHash('md5').update(src).digest("hex");
    }

    export function getLastModifies(filename) {
        const stats = fs.statSync(filename);
        const lastModifies = moment(stats.mtime).format('YYYY-MM-DD HH:mm:ss');
        return lastModifies;
    }

    export function Etag(buffer) {
        var hash = crypto.createHash('md5');
        hash.update(buffer);
        return hash.digest('hex');
    };

    export function getFileNameByFullPath(fullPath) {
        if (fullPath == undefined) {
            return undefined;
        }
        return fullPath.replace(/^.*[\\\/]/, '');
    }

    export function addInStr(str, index, string) {
        if (index > 0)
            return str.substring(0, index) + string + str.substring(index, str.length);
        else
            return string + str;
    };

    export function ProcessPriority(task: UploaderTask) {
        if (task.loaded > 0) {
            task.priority = PRIORITY_QUEUE.HIGH;
        } else if (task.file.getSize() < 5242880) {
            task.priority = PRIORITY_QUEUE.MEDIUM;
        } else {
            task.priority = PRIORITY_QUEUE.LOW;
        }
        return task;
    }

    export async function ListCloudFiles(folderId = undefined, next: string = undefined): Promise<UpakiArchiveList> {
        let upakiClient = new Upaki(Environment.config.credentials);
        let list = await upakiClient.getFiles(folderId, next);
        return list.data;
    }

    export async function getUserProfile(): Promise<UpakiUserProfile> {
        let upakiClient = new Upaki(Environment.config.credentials);
        let profile = await upakiClient.getUserProfile();
        return profile.data;
    }

    export function WriteCache(cacheName, data, callback: (err: NodeJS.ErrnoException, cacheSource: string) => void) {
        let source = path.join(os.tmpdir(), 'upaki-cache');

        if (!fs.existsSync(source)) {
            fs.mkdirSync(source);
        }

        source = path.join(source, cacheName);

        fs.writeFile(source, data, 'utf-8', (err) => {
            callback(err, source);
        });
    }

    export function getLogsPath() {
        return path.join(getAppData(), getUpakiFolder(), 'logs');
    }
    export function WriteTaskData(cacheName, data, callback: (err: NodeJS.ErrnoException, cacheSource: string) => void) {
        let source = path.join(getTaskStoreSource());
        if (!fs.existsSync(source)) {
            fs.mkdirSync(source);
        }

        source = path.join(source, cacheName);

        fs.writeFile(source, JSON.stringify(data), 'utf-8', (err) => {
            callback(err, source);
        });
    }

    export function getUpakiFolder() {
        return `upaki`;
    }

    export function getTaskStoreSource() {
        return path.join(getAppData(), getUpakiFolder(), 'tasks');
    }

    export function getDbSource(name?: string) {
        if (name)
            return path.join(getAppData(), getUpakiFolder(), 'data', name);
        else
            return path.join(getAppData(), getUpakiFolder(), 'data');
    }

    export function getAppData() {
        return process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + 'Library/Preferences' : '/var/local');
    }

    export function ReadTaskData<T>(taskName, callback: (err: NodeJS.ErrnoException, cacheSource: T, source) => void) {
        let source = path.join(getTaskStoreSource(), taskName);
        fs.readFile(source, 'utf8', (err, data) => {
            if (err) {
                callback(err, undefined, source);
                return;
            }
            try {
                callback(undefined, JSON.parse(data), source);
            } catch (error) {
                callback(error, undefined, source);
            }
        });
    }

    export function DumpTaskData(taskName, callback: (err: NodeJS.ErrnoException) => void) {
        let source = path.join(getTaskStoreSource(), taskName);
        fs.unlink(source, callback);
    }

    export function getAbsolutePath(folderPath, rootFolder/*, baseFolder = os.hostname()*/) {
        /*folderPath = folderPath.replace('\\', '/');
        rootFolder = rootFolder.replace('\\', '/');*/
        // let filedir = folderPath.match(/(.*)[\/\\]/)[1] || '';
        // var re = new RegExp(rootFolder,"g");
        // let abs = filedir.replace(re, "");
        /*console.log('folder path = ', folderPath);
        console.log('root path = ', rootFolder);
        console.log('base = ', baseFolder);*/
        let srt = '';
        for (let i = 0; i < folderPath.length; i++) {
            if (folderPath[i] !== rootFolder[i]) {
                srt += folderPath[i] === '\\' ? '/' : folderPath[i];
            }
        }
        //baseFolder = baseFolder.replace(/\\/g, "/");
        //let a  =path.join(baseFolder, srt);
        //  console.log(path.join(baseFolder, srt));
        // path.
        /*if (abs != "") {
            abs = abs.substring(1);
            abs = abs.replace(/\\/g, "/");
        }*/
        // return path.join(srt, abs);
        if (srt[0] !== '/') {
            srt = addInStr(srt, 0, '/');
        }
        return /*baseFolder +*/ srt /*path.join(baseFolder, srt)*/;
    }
}