import * as events from 'events';
import { BackupFile, Backup, BackupProduct, BackupType, CopyFilesToBackup } from '../api/backup';
import { ScanFast, ListFiles } from '../sync/ScanFast';
import { EntityBackup } from '../persist/entities/EntityBackup';
import { Util } from '../util/Util';
import * as moment from 'moment';
import * as fs from 'fs';
import * as path from 'path';
import * as mkdirp from 'mkdirp';
import * as archiver from 'archiver';



export interface BackupServiceEvents {
    emit(event: 'onInfo', string: string): boolean;
    on(event: 'onInfo', listener: (string: string) => void): this;

    emit(event: 'onFinish'): boolean;
    on(event: 'onFinish', listener: () => void): this;

    emit(event: 'debug', string: string): boolean;
    on(event: 'debug', listener: (string: string) => void): this;

    emit(event: 'onErrorCopy', err, file: string, dest: string): boolean;
    on(event: 'onErrorCopy', listener: (err, file: string, dest: string) => void): this;

    emit(event: 'onCopySucces', file: BackupFile): boolean;
    on(event: 'onCopySucces', listener: (file: BackupFile) => void): this;

    emit(event: 'onError', err): boolean;
    on(event: 'onError', listener: (err) => void): this;

    // um erro critico nao tratado
    emit(event: 'onCriticalError', err): boolean;
    on(event: 'onCriticalError', listener: (err) => void): this;

    emit(event: 'onScanFolder', folder: string): boolean;
    on(event: 'onScanFolder', listener: (folder: string) => void): this;
}

export class BackupServiceEvents extends events.EventEmitter implements BackupServiceEvents { }

export class BackupService extends BackupServiceEvents {
    dests: string[];
    sources: string[];
    backupInstance: Backup;
    pname: string;
    backupType: BackupType;
    backupProduct: BackupProduct[] = [];
    private firstExecution = false;
    compact: boolean;

    constructor(sources: string[], dests: string[], pname: string, backupType: BackupType, compact = false) {
        super();
        this.dests = dests;
        this.sources = sources;
        this.pname = pname;
        this.backupType = backupType;
        this.compact = compact;
    }


    async Init() {
        try {
            let countExecution = await EntityBackup.Instance.countExecution(this.pname);
            if (countExecution === 0) {
                this.firstExecution = true;
                this.backupType = BackupType.FULL;
            }

            this.backupInstance = {
                pname: this.pname,
                type: this.backupType,
                date_time_execution: moment().format('YYYY-MM-DD HH:mm:ss')
            };

            this.on('onCopySucces', async (file) => {
                try {
                    await EntityBackup.Instance.inserOrUpdateBackupFile(file);
                } catch (error) {
                    this.emit('onError', error);
                }
            });

            this.backupInstance.id = await EntityBackup.Instance.inserOrUpdateBackup(this.backupInstance);
            let backupFiles: CopyFilesToBackup[] = [];
            this.emit('onInfo', `Iniciando processo de backup.`);
            this.emit('onInfo', `Origens: [${this.sources.length}] Destinos: [${this.dests.length}]`);

            for (let source of this.sources) {
                this.emit('onInfo', `Processando ${source}`);
                let scannedFiles = await this.ScanSource(source);
                backupFiles = backupFiles.concat(scannedFiles);
                this.emit('onInfo', `Processar ${scannedFiles.diferencial.length + scannedFiles.full.length + scannedFiles.incremental.length}`);
            }

            let success = 0;
            let errors = 0;
            let bytesCopied = 0;
            for (let copyFile of backupFiles) {
                for (let dest of this.dests) {
                    let copyInfo = await this.StartCopy(dest, copyFile);
                    success += copyInfo.success;
                    errors += copyInfo.error;
                    bytesCopied += copyInfo.bytesCopied;
                    this.emit('onInfo', `Copiados (${copyInfo.success}) Erros (${copyInfo.error}) Total (${Util.elegantSize(copyInfo.bytesCopied)}) Novos(${copyFile.full.length}) Alterados(${copyFile.incremental.length}) Diferenciais(${copyFile.diferencial.length}).`);
                }

                let files = copyFile.incremental.concat(copyFile.full);

                // caso haja alterações no backup
                // ai sim incluir o diferencial
                if (BackupType.DIFERENCIAL && (copyFile.incremental.length !== 0 || copyFile.full.length !== 0)) {
                    files = files.concat(copyFile.diferencial);
                }

                for (let fl of files) {
                    this.emit('onCopySucces', fl);
                }


            }

            this.backupInstance.errors = errors;
            this.backupInstance.success = success;
            this.backupInstance.size = bytesCopied;
            this.backupInstance.date_time_finish = moment().format('YYYY-MM-DD HH:mm:ss');

            if (bytesCopied) {
                await EntityBackup.Instance.bulkInsertProduct(this.backupProduct);
            }

            await EntityBackup.Instance.inserOrUpdateBackup(this.backupInstance);

            this.emit('onFinish');
        } catch (error) {
            this.emit('onError', error);
            this.emit('onCriticalError', error);
        }
    }

    Compact(dest: string, files: BackupFile[], copySource: CopyFilesToBackup, folderName: string): Promise<{ success: number, error: number, bytesCopied: number }> {
        return new Promise((resolve, reject) => {
            console.log('========= ', dest + '.zip');
            console.log('========= ', folderName + '.zip');
            console.log('ok ==', path.join(dest, folderName + '.zip'));
            var output = fs.createWriteStream(path.join(dest, folderName + '.zip'));
            var archive = archiver('zip', {
                zlib: { level: 9 } // Sets the compression level.
            });
            let success = 0;
            let error = 0;
            let bytesCopied = 0;
            output.on('close', () => {
                console.log(archive.pointer() + ' total bytes');
                console.log('archiver has been finalized and the output file descriptor has closed.');
                resolve({
                    success: success,
                    error: error,
                    bytesCopied: bytesCopied
                });
            });

            

            // good practice to catch warnings (ie stat failures and other non-blocking errors)
            archive.on('warning', (err) => {
                if (err.code === 'ENOENT') {
                    // log warning
                } else {
                    // throw error
                    reject(err);
                    throw err;
                }
            });

            // good practice to catch this error explicitly
            archive.on('error', (err) => {
                reject(err);
                throw err;
            });

            for (let file of files) {
                try {
                    archive.file(file.file, { name: Util.getAbsolutePath(file.file, copySource.source) });

                    file.copied = true;
                    success++;
                    bytesCopied += file.size;
                } catch (err) {
                    error++;
                    this.emit('onErrorCopy', error, file.file, dest);
                    this.emit('onError', error);
                }
            }
            // pipe archive data to the file
            archive.pipe(output);

            archive.finalize();
        });
    }

    StartCopy(dest: string, copySource: CopyFilesToBackup): Promise<{ success: number, error: number, bytesCopied: number }> {
        return new Promise((resolve, reject) => {
            try {
                let isDirExists = fs.existsSync(copySource.source) && fs.lstatSync(copySource.source).isDirectory();

                let legendFile = this.backupType === BackupType.FULL ?
                    '(Completo)' : this.backupType === BackupType.INCREMENTAL ? '(Incremental)' : '(Diferencial)';

                let sufixName = moment().format('DD-MM-YYYY HH;mm;ss') + ' ' + legendFile; //add no final


                let folderName = isDirExists ?
                    Util.getFolderNameByPath(copySource.source) + ' ' + sufixName :
                    Util.getFileNameByPath(copySource.source) + ' ' + sufixName + (Util.getExtension(copySource.source) &&
                        Util.getExtension(copySource.source) !== '' ? '.' + Util.getExtension(copySource.source) : '');

                this.emit('debug', `Folder name = ${folderName}`);
                /* let originalCopyTo = !isDirExists ?
                     path.join(dest, folderName) :
                     path.join(dest, destPathAbsolute,
                         Util.getAbsolutePath());*/
                let files = copySource.incremental.concat(copySource.full);

                // caso haja alterações no backup
                // ai sim incluir o diferencial
                if (BackupType.DIFERENCIAL && (copySource.incremental.length !== 0 || copySource.full.length !== 0)) {
                    files = files.concat(copySource.diferencial);
                }

                this.emit('onInfo', `Serão copiados ${files.length} arquivos para ${dest}`);


                let saveDest = path.join(dest, folderName);

                this.backupProduct.push({ backup_id: this.backupInstance.id, pathName: saveDest });

                if (this.compact) {
                    this.Compact(dest, files, copySource, folderName).then((rsCompact) => {
                        resolve({
                            error: rsCompact.error,
                            success: rsCompact.success,
                            bytesCopied: rsCompact.bytesCopied
                        });
                    });
                } else {

                    let success = 0;
                    let error = 0;
                    let bytesCopied = 0;

                    for (let file of files) {
                        try {
                            let srcDest = path.join(dest, folderName, Util.getAbsolutePath(file.file, copySource.source));
                            this.emit('debug', 'srcDest=' + srcDest);
                            let destFolder = Util.getPathNameFromFile(srcDest);
                            this.emit('debug', 'destFolder=' + destFolder);
                            if (!fs.existsSync(destFolder)) {
                                mkdirp.sync(destFolder);
                                this.emit('debug', `Diretório = ${destFolder} criado com sucesso`);
                            }

                            this.emit('debug', `Copiando = ${file.file} para ${srcDest}`);
                            fs.copyFileSync(file.file, srcDest);
                            file.copied = true;
                            //this.emit('onCopySucces', file);
                            success++;
                            bytesCopied += file.size;
                            this.emit('debug', `${srcDest} Finalizado !`);

                        } catch (error) {
                            error++;
                            this.emit('onErrorCopy', error, file.file, dest);
                            this.emit('onError', error);
                        }
                    }
                    resolve({
                        error: error,
                        success: success,
                        bytesCopied: bytesCopied
                    });
                }

            } catch (error) {
                this.emit('onError', error);
                reject(error);
            }

        });
    }



    MtimeToString(mtime): string {
        return moment(mtime).format('YYYY-MM-DD HH:mm:ss');
    }

    CheckAcessPermission(pathSource): boolean {
        try {
            fs.accessSync(pathSource, fs.constants.R_OK);
            return true;
        } catch (error) {
            return false;
        }
    }
    ScanSource(pathSource: string): Promise<CopyFilesToBackup> {
        return new Promise<CopyFilesToBackup>(async (resolve, reject) => {
            let isDirExists = fs.existsSync(pathSource) && fs.lstatSync(pathSource).isDirectory();

            let backupFiles: CopyFilesToBackup = {
                incremental: [],
                diferencial: [],
                full: [],
                source: pathSource
            };

            console.log(pathSource, ' -- ', isDirExists);

            // Source is a file
            // Not necessary scan!
            // Check file directly
            if (!isDirExists) {

                if (!this.CheckAcessPermission(pathSource)) {
                    this.emit('onError', new Error(`Permissão de leitura negada para ${pathSource}`));
                    return backupFiles;
                }
                let lstat = fs.lstatSync(pathSource);

                let flPush = {
                    backup_id: this.backupInstance.id,
                    last_modifies: this.MtimeToString(lstat.mtime),
                    file: pathSource,
                    pname: this.pname,
                    size: lstat.size,
                    updated: 0
                };

                if (this.backupType === BackupType.FULL) {
                    backupFiles.full.push(flPush);
                    resolve(backupFiles);
                    return;
                }

                let dbList = await EntityBackup.Instance.getFilesByKey([pathSource]);

                let inDb = dbList.find(el => el.file === Util.MD5SRC(pathSource));


                if (inDb) {
                    if (BackupType.DIFERENCIAL && Number(inDb.updated) && inDb.last_modifies === this.MtimeToString(lstat.mtime)) {
                        backupFiles.diferencial.push(flPush);
                    } else if (inDb.last_modifies !== this.MtimeToString(lstat.mtime)) {
                        // inDb.last_modifies = this.MtimeToString(lstat.mtime);
                        flPush.updated = 1;
                        backupFiles.incremental.push(flPush);
                    }
                } else {
                    if (!this.firstExecution && this.backupType === BackupType.DIFERENCIAL) {
                        flPush.updated = 1;
                    }
                    backupFiles.full.push(flPush);
                }
                resolve(backupFiles);
                return;
                //return backupFiles;
            }

            let scan = ScanFast(pathSource, (file) => {

                if (!this.CheckAcessPermission(file)) {
                    this.emit('onError', new Error(`Permissão de leitura negada para ${file}`));
                    return false;
                }
                return true;
            }, 50);




            scan.on('onFile', async (list: ListFiles[]) => {
                try {
                    this.emit('debug', `Find db`);
                    let dbList = await EntityBackup.Instance.getFilesByKey(list.map(el => { return el.filePath }), this.backupType);
                    // }

                    this.emit('debug', `Complete find db ${dbList.length}`);
                    for (let file of list) {
                        let flPush = {
                            backup_id: this.backupInstance.id,
                            last_modifies: this.MtimeToString(file.lstat.mtime),
                            file: file.filePath,
                            pname: this.pname,
                            size: file.lstat.size,
                            updated: 0
                        };

                        if (this.backupType === BackupType.FULL) {
                            backupFiles.full.push(flPush);
                            continue;
                        }

                        let inDb = dbList.find(el => el.file === Util.MD5SRC(file.filePath));

                        if (inDb) {
                            if (BackupType.DIFERENCIAL && Number(inDb.updated) && inDb.last_modifies === this.MtimeToString(file.lstat.mtime)) {
                                flPush.updated = 1;
                                backupFiles.diferencial.push(flPush);
                            } else if (inDb.last_modifies !== this.MtimeToString(file.lstat.mtime)) {
                                flPush.updated = 1;
                                // await EntityBackup.Instance.inserOrUpdateBackupFile(inDb);
                                backupFiles.incremental.push(flPush);
                            }
                        } else {
                            if (!this.firstExecution && this.backupType === BackupType.DIFERENCIAL) {
                                flPush.updated = 1;
                            }

                            backupFiles.full.push(flPush);
                        }
                    }
                } catch (error) {
                    this.emit(`onError`, error);
                } finally {
                    console.log('next');
                    scan.emit('next');
                }
            });
            scan.on('onFolder', (dir: string) => {
                this.emit('onScanFolder', dir);
            });
            scan.on('onError', (err) => {
                console.log('err', err);
                reject(err);
            });
            scan.on('onFinish', () => {
                console.log('resolveu');
                resolve(backupFiles);
            });
        })
    }
}