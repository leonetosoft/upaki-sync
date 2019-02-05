import * as fs from 'fs';
import * as crypto from 'crypto';
import * as moment from 'moment';
import * as os from 'os';
import * as path from 'path';
import { PRIORITY_QUEUE } from '../queue/task';
import { UploaderTask } from '../sync/task/UploaderTask';
import { Environment } from '../config/env';
import { Upaki, UpakiArchiveList, UpakiUserProfile } from 'upaki-cli';
import { Logger } from './Logger';

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

    export function elegantSize(bytes: any) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
        if (bytes === 0) return 'n/a'
        const i = parseInt((Math.floor(Math.log(bytes) / Math.log(1024))) as any, 10)
        if (i === 0) return `${bytes} ${sizes[i]}`
        return `${(bytes / (1024 ** i)).toFixed(1)} ${sizes[i]}`
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

    export function getIPAddress() {
        var interfaces = require('os').networkInterfaces();
        for (var devName in interfaces) {
            var iface = interfaces[devName];

            for (var i = 0; i < iface.length; i++) {
                var alias = iface[i];
                if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
                    return alias.address;
            }
        }

        return '0.0.0.0';
    }

    export function Etagv2(filename, algorithm = 'md5') {
        return new Promise((resolve, reject) => {
            // Algorithm depends on availability of OpenSSL on platform
            // Another algorithms: 'sha1', 'md5', 'sha256', 'sha512' ...
            let shasum = crypto.createHash(algorithm);
            try {
                let s = fs.createReadStream(filename);
                s.on('data', function (data) {
                    shasum.update(data)
                })
                // making digest
                s.on('end', function () {
                    const hash = shasum.digest('hex')
                    return resolve(hash);
                })
            } catch (error) {
                Logger.error(error);
                return resolve('');
            }
        });
    }

    export function rmdirAsync(path, callback) {
        fs.readdir(path, function(err, files) {
          if (err) {
            // Pass the error on to callback
            callback(err, []);
            return;
          }
          var wait = files.length,
            count = 0,
            folderDone = function(err) {
              count++;
              // If we cleaned out all the files, continue
              if (count >= wait || err) {
                fs.rmdir(path, callback);
              }
            };
          // Empty directory to bail early
          if (!wait) {
            folderDone(undefined);
            return;
          }
      
          // Remove one or more trailing slash to keep from doubling up
          path = path.replace(/\/+$/, "");
          files.forEach(function(file) {
            var curPath = path + "/" + file;
            fs.lstat(curPath, function(err, stats) {
              if (err) {
                callback(err, []);
                return;
              }
              if (stats.isDirectory()) {
                rmdirAsync(curPath, folderDone);
              } else {
                fs.unlink(curPath, folderDone);
              }
            });
          });
        });
      };

    export function cleanEmptyFoldersRecursively(folder) {
        if(folder.indexOf('System Volume Information') !== -1) {
            return;
        }
        var isDir = fs.statSync(folder).isDirectory();
        if (!isDir) {
          return;
        }
        var files = fs.readdirSync(folder);
        if (files.length > 0) {
          files.forEach((file) => {
            var fullPath = path.join(folder, file);
            
            cleanEmptyFoldersRecursively(fullPath);
          });
    
          // re-evaluate files; after deleting subfolder
          // we may have parent folder empty now
          files = fs.readdirSync(folder);
        }
    
        if (files.length == 0) {
          fs.rmdirSync(folder);
          return;
        }
      }

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

    export function getFolderSend() {
        return path.join(getAppData(), getUpakiFolder(), 'tempSync');
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
        let srt = '';
        for (let i = 0; i < folderPath.length; i++) {
            if (folderPath[i] !== rootFolder[i]) {
                srt += folderPath[i] === '\\' ? '/' : folderPath[i];
            }
        }
        if (srt[0] !== '/') {
            srt = addInStr(srt, 0, '/');
        }
        return srt;
    }
}