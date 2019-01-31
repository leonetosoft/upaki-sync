import * as events from 'events';
import { ScanFast, ListFiles, ScanEvents } from "../sync/ScanFast";
import { Util } from "../util/Util";
import * as fs from 'fs';
import * as path from 'path';
import * as mkdirp from 'mkdirp';

export interface FileCopyEvents {
    on(event: 'onCopyFile', listener: (filename: string, size: number, dest: string) => void): this;
    emit(event: 'onCopyFile', filename: string, size: number, dest: string): boolean;

    on(event: 'onScanFiles', listener: (list: ListFiles[]) => void): this;
    emit(event: 'onScanFiles', list: ListFiles[]): boolean;

    on(event: 'onError', listener: (err) => void): this;
    emit(event: 'onError', err): boolean;

    on(event: 'onComplete', listener: () => void): this;
    emit(event: 'onComplete'): boolean;
}

export class FileCopyEvents extends events.EventEmitter implements FileCopyEvents {

}

export class FileCopy extends FileCopyEvents {
    sourcePath: string;
    destPath: string;
    deleteOnCopy: boolean;
    preservePath: boolean;
    availableExtensions: string[];
    scanner: ScanEvents;

    constructor(sourcePath: string, destPath: string, availableExtensions: string[] = [], deleteOnCopy: boolean = false, preservePath: boolean = false) {
        super();
        this.sourcePath = sourcePath;
        this.destPath = destPath;
        this.deleteOnCopy = deleteOnCopy;
        this.availableExtensions = availableExtensions.map(el => el.toLowerCase());
        this.preservePath = preservePath;
    }

    Init() {
        this.scanner = ScanFast(this.sourcePath, (file) => {
            if (((this.availableExtensions.length > 0 &&
                this.availableExtensions.indexOf(Util.getExtension(file).toLowerCase()) !== -1) ||
                (this.availableExtensions.length === 0)) && Util.getFileNameByPath(file) !== '' &&
                 file.indexOf('System Volume Information') == -1) {
                return true;
            } else {
                return false;
            }
        }, 50);

        this.scanner.on('onFile', this.OnFile.bind(this));
        this.scanner.on('onFolder', this.OnFolder.bind(this));
        this.scanner.on('onError', this.OnError.bind(this));
        this.scanner.on('onFinish', this.OnFinish.bind(this));
    }

    async OnFile(list: ListFiles[]) {
        this.emit('onScanFiles', list);

        Promise.all(list.map(el => this.StartCopy(el))).then(() => {
            this.scanner.emit('next');
        }).catch(err => {
            this.emit('onError', err);
        });
    }

    isEmpty(dirname) {
        let files = fs.readdirSync(dirname);
        return files.length === 0;
    }

    private StartCopy(fl: ListFiles) {
        return new Promise((resolve, reject) => {
            try {
                let destFolderPreserved = this.preservePath ? Util.getAbsolutePath(fl.filePath, this.sourcePath) : Util.getFileNameByFullPath(fl.filePath);

                let destFolder = path.join(this.destPath, Util.getPathNameFromFile(destFolderPreserved));
                if (this.preservePath && !fs.existsSync(destFolder)) {
                    mkdirp.sync(destFolder);
                }

                let destCopy = path.join(this.destPath, destFolderPreserved);
                this.emit('onCopyFile', Util.getFileNameByFullPath(fl.filePath), fl.lstat.size, destCopy);

                fs.copyFile(fl.filePath, destCopy, async (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        try {
                            if (await Util.Etagv2(fl.filePath) === await Util.Etagv2(destCopy)) {

                                if (this.deleteOnCopy) {
                                    fs.unlinkSync(fl.filePath);
                                    /*console.log(Util.getPathNameFromFile(fl.filePath));
                                    console.log(Util.getAbsolutePath(fl.filePath, this.sourcePath));
                                    if (this.isEmpty(Util.getPathNameFromFile(fl.filePath))) {
                                        fs.rmdirSync(Util.getPathNameFromFile(fl.filePath));
                                    }*/
                                }
                                resolve();

                            } else {
                                reject(new Error(`Arquivo ${fl.filePath} corrompeu ao copiar!`));
                            }
                        } catch (error) {
                            reject(error);
                        }
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    async OnFolder(dir: string) {

    }

    async OnError(err) {
        this.emit('onError', err);
    }

    async OnFinish() {
        this.emit('onComplete');
    }

}