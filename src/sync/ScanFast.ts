import * as fs from 'fs';
import * as junk from 'junk';
import * as path from 'path';
import * as events from 'events';
import * as crypto from 'crypto';
export interface ScanEvents {
    on(event: 'onFile', listener: (files: ListFiles[]) => void): this;
    emit(event: 'onFile', files: ListFiles[]): boolean;
    emit(event: 'next'): boolean;
    on(event: 'onFinish', listener: () => void): this;
    emit(event: 'onFinish'): boolean;
    on(event: 'onFolder', listener: (src: string) => void): this;
    emit(event: 'onFolder', src: string): boolean;
    on(event: 'onError', listener: (err: Error) => void): this;
    emit(event: 'onError', err: Error): boolean;
}

export interface ListFiles {
    filePath: string;
    lstat: fs.Stats;
}

export interface NextAttr {
    pendingPoint: number;
}

export class ScanEvents extends events.EventEmitter implements ScanEvents {
}

export interface InternalEvent {

}
export class InternalEvent extends events.EventEmitter implements ScanEvents {
    /*constructor(){
        super();
        super.setMaxListeners(500000);
    }*/
}

export function MD5SRC(src) {
    return crypto.createHash('md5').update(src).digest("hex");
}
export function ScanFast(src, callbackTest: ((pathOfFile: string) => boolean), limit = 2, evt: ScanEvents = new ScanEvents(), internalEvent: InternalEvent = new InternalEvent(), caller = undefined, mainProcess = true): ScanEvents {
    fs.readdir(src, (err, list) => {

        if (err) {
            if (mainProcess) {
                evt.emit('onError', err);
                evt.emit('onFinish');
            } else {
                caller(false);
                internalEvent.emit('completeDir_' + src);
            }
            return;
        }

        evt.emit('onFolder', src);
        list = list.filter(junk.not); // remove arquivos ocultos
        list = list.filter(item => !(/(^|\/)\.[^\/\.]/g).test(item));

        let scaned: ListFiles[] = list.map(item => {
            try {
                let filePath = path.resolve(src, item);
                let fileStat = fs.lstatSync(filePath);
                if (fileStat) {
                    if (callbackTest && callbackTest(filePath)) {
                        return { filePath: filePath, lstat: fileStat };
                    } else {
                        return { filePath: filePath, lstat: fileStat };
                    }
                } else {
                    return undefined;
                }
            } catch (errorStat) {
                return undefined;
            }
        });

        scaned = scaned.filter(el => el !== undefined);

        let folders = scaned.filter(item => item.lstat.isDirectory());
        let files = scaned.filter(item => item.lstat.isFile());

        if (mainProcess) {
            let pendingTask = 1;
            caller = (start) => {
                if (start) {
                    pendingTask++;
                }
                if (!start) {
                    pendingTask--;
                }

                if (pendingTask === 0) {
                    evt.emit('onFinish');
                }
            }
        }

        let processFolders = (pos = 0) => {
            if (pos < folders.length) {
                // console.log('Tem folders::', folders.length);
                caller(true);

                ScanFast(folders[pos].filePath, callbackTest, limit, evt, internalEvent, caller, false);
                internalEvent.setMaxListeners(internalEvent.getMaxListeners() + 1);
                internalEvent.once(/*'completeDir_' + folders[pos].filePath*/MD5SRC(folders[pos].filePath), () => {
                    processFolders(pos + 1);
                    internalEvent.setMaxListeners(Math.max(internalEvent.getMaxListeners() - 1, 0));
                });
            } else {
                caller(false);
                internalEvent.emit(/*'completeDir_' + src*/MD5SRC(src));
            }
        }
        // let position = 0;
        let nextFuncion = (startPosition = 0) => {
            let sendFiles: ListFiles[] = [];

            while (startPosition < files.length && sendFiles.length < limit) {
                sendFiles.push(files[startPosition]);
                startPosition++;
            }

            if (sendFiles.length > 0) {
                evt.emit('onFile', sendFiles);
                evt.setMaxListeners(evt.getMaxListeners() + 1);
                evt.once('next', () => {

                    if (startPosition < files.length) {
                        nextFuncion(startPosition);
                    } else {
                        processFolders();
                    }

                    evt.setMaxListeners(Math.max(evt.getMaxListeners() - 1, 0));
                });
            } else {
                processFolders();
            }
        }

        nextFuncion();
    });

    return evt;
}