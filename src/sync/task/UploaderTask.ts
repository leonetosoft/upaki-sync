import { EntityUpload } from './../../persist/entities/EntityUpload';
import { File } from './../File';
import { Task } from './../../queue/task';
import { Util } from '../../util/Util';
import { Logger } from '../../util/Logger';
import { Upaki, UploadEvents } from 'upaki-cli';
import { Environment } from '../../config/env';
import { S3StreamSessionDetails } from 'upaki-cli';
import { S3StreamEvents, Parts } from 'upaki-cli';
import { EntityFolderMap } from '../../persist/entities/EntityFolderMap';
import { WorkerUpload } from '../../thread/WorkerUpload';
import { EntityFolderSync } from '../../persist/entities/EntityFolderSync';
import * as fs from 'fs';
import { EntityParameter } from '../../persist/entities/EntityParameter';
import { STATUS } from '../../queue/stat';
import { STOP_UPLOAD_DESCRIPTOR } from '../../api/stopUploadDescriptor';
import { EntityUploadData } from '../../api/entity';

export enum UploadState {
    AWAIT = 'AWAIT',
    PREPARE = 'PREPARE',
    ERROR = 'ERROR',
    UPLOADING = 'UPLOADING',
    PAUSING = 'PAUSING',
    STOP = 'PAUSING',
    PAUSED = 'PAUSED',
    FINISH = 'FINISH',
    REMOVED = 'REMOVED',
    REINIT = 'REINIT',
    AWAIT_COMPLETE_UPLOAD = 'AWAIT_COMPLETE_UPLOAD',
    LOCKED = 'LOCKED',
    SIGIN = 'SIGIN'
}

export enum UploadType {
    MULTIPART = 'MULTIPART',
    SIMPLE = 'SIMPLE'
}

export class UploaderTask extends Task {
    // filePath: string;
    // rootFolder: string;
    file: File;
    filePath: string;
    state: UploadState = UploadState.AWAIT;
    loaded: number;
    uploadType: UploadType = UploadType.SIMPLE;
    compactContent: boolean;

    dataLoaded = false;

    UPLOAD_TIMEOUT = 0;

    simpleUploadeEmitter: UploadEvents;
    multipartUploadEmitter: S3StreamEvents;

    numberErrors = 0;

    upaki: Upaki;

    preventTimeLeft: string;
    speedBps: number;
    speedType: string;
    speed: number;

    details: { Etag: string, file_id: string, folder_id: string };

    signatureId: string;

    file_id: string;
    folder_id: string;
    Etag: string;

    timeStamp = Date.now();
    lastLoaded = 0;

    parameters;

    preferred_folder_id;


    // para upload de varias partes
    session: S3StreamSessionDetails = {};

    constructor(file: File, session: S3StreamSessionDetails = {
        Parts: [],
        DataTransfered: 0
    }) {
        super();
        this.file = file;
        this.filePath = file.filePath;
        this.session = session;
        this.loaded = session.DataTransfered;
        this.upaki = new Upaki(Environment.config.credentials);
    }

    LoadDataFromDb(): Promise<EntityUploadData> {
        return EntityUpload.Instance.getFile(this.file.filePath);
    }

    StopOrPauseUpload() {
        if (this.simpleUploadeEmitter || this.multipartUploadEmitter) {
            if (this.simpleUploadeEmitter) {
                this.state = UploadState.PAUSING;
                this.simpleUploadeEmitter.emit('abort');
                this.simpleUploadeEmitter.once('aborted', () => {
                    this.state = UploadState.PAUSED;
                })
            } else {
                this.state = UploadState.PAUSING;
                this.multipartUploadEmitter.emit('pause', true);
                this.simpleUploadeEmitter.once('paused', () => {
                    this.state = UploadState.PAUSED;
                })
            }
        }
    }

    async OnUploadFinish() {
        let retryCount = 0;

        let requestDeletion = async () => {
            try {
                if (await EntityFolderSync.Instance.DeleteOnSend(this.file.rootFolder)) {

                    if (fs.existsSync(this.file.filePath)) {
                        fs.unlinkSync(this.file.filePath);
                    } else {
                        Logger.warn(`File ${this.file.filePath} not exits not possible fs.unlinkSync task ${this.id}`);
                    }

                    await EntityUpload.Instance.delete(this.file.filePath);
                    // if (this.file.rootFolder !== Util.getPathNameFromFile(this.file.filePath)) {
                    // Util.cleanEmptyFoldersRecursively(Util.getPathNameFromFile(this.file.filePath));
                    // }
                }
            } catch (error) {
                if (error.code && error.code === 'EBUSY' && retryCount < 4) {
                    retryCount++;
                    setTimeout(() => {
                        requestDeletion();
                    }, 2000);
                } else {
                    Logger.error(error);
                }
            }
        };

        requestDeletion();
    }

    Cancel(descriptor: STOP_UPLOAD_DESCRIPTOR) {
        if (this.job.stat === STATUS.FINISHED) {
            Logger.warn(`Request cancel uploading jog already finished ${this.file.getFullName()}`)
            return;
        }

        if (this.state === UploadState.STOP) {
            Logger.warn(`Request cancel uploading already STOPPED ${this.file.getFullName()}`)
            return;
        }

        // o arquivo mudou seu conteudo
        // o estado dele esta aguardando
        // nao foram feitas transferencias (this.session.DataTransfered === 0) 
        // entao ignora este evento 
        if ((descriptor === STOP_UPLOAD_DESCRIPTOR.FILE_CHANGE &&
            this.state === UploadState.AWAIT) && this.session.DataTransfered === 0) {
            return;
        }

        Logger.warn(`Request cancel uploading ${this.file.getFullName()} description ${descriptor}`);

        // tomar uma decisão dependendo do tipo do evento de cancelamento
        // caso for um evento de file change quer dizer que houve mudanca no conteudo
        // este deve ser zerado para posteriormente se reenviado do estado inicial
        let doAction = descriptor === STOP_UPLOAD_DESCRIPTOR.FILE_CHANGE ? () => {
            try {
                Logger.warn(`File ${this.file.filePath} reinit session by Cancel descriptor FILE_CHANGE ...`);
                this.session = {
                    Parts: [],
                    DataTransfered: 0
                };
                this.state = UploadState.REINIT;

            } catch (err) {
                Logger.error(err);
            } finally {
                try {
                    this.save();
                } catch (error) {
                    Logger.error(error);
                }
                this.job.Fail(5000);
            }
        } : () => {
            Logger.warn(`Job ${this.job.id} of file ${this.file.filePath} canceled by descriptor ${descriptor}`);

            /*
            FILE_UNLINK = 'File Unlink',
            FILE_CHANGE = 'File Change',
            FILE_NOT_FOUND_MULTIPART_READY = 'The file not found on ready',
            FILE_NOT_FOUND_MULTIPART_RETRY = 'The file not found in retry',
            FILE_NOT_FOUND_MULTIPART_UPLOAD_PART = 'The file removed on upload part',
            FILE_RENAME = 'File renamed'
            */

            this.job.Finish();
        };

        if (this.simpleUploadeEmitter || this.multipartUploadEmitter) {
            let deadLockCancel = setTimeout(() => {
                Logger.warn(`Stop upload of ${this.file.getFullName()} deadlock cencel detected, force closing!!!`);
                //this.job.Finish();
                doAction();
            }, 30000);

            this.state = UploadState.STOP;
            if (this.simpleUploadeEmitter) {
                // this.state = UploadState.STOP;
                this.simpleUploadeEmitter.once('aborted', () => {
                    //this.state = UploadState.STOP;
                    Logger.warn(`Job canceled, file changed ? ${this.file.getFullName()}`);
                    clearTimeout(deadLockCancel);
                    //this.job.Finish();
                    doAction();
                })
                this.simpleUploadeEmitter.emit('abort');
            } else {
                // this.state = UploadState.STOP;
                this.multipartUploadEmitter.once('aborted', () => {
                    //this.state = UploadState.STOP;
                    Logger.warn(`Job canceled, file changed ? ${this.file.getFullName()}`);
                    clearTimeout(deadLockCancel);
                    //this.job.Finish();
                    doAction();
                })
                this.multipartUploadEmitter.emit('abort');
            }
        } else {
            //this.job.Finish();
            doAction();
        }
    }

    ResumeUpload() {
        if (this.state === UploadState.PAUSED) {
            if (this.uploadType === UploadType.SIMPLE) {
                this.SinglePartUpload();
            } else {
                this.multipartUploadEmitter.emit('pause', false);
                this.multipartUploadEmitter.once('resume', () => {
                    this.state == UploadState.UPLOADING;
                });
            }
        }
    }

    private async SinglePartUpload() {
        try {

            if (this.state === UploadState.AWAIT_COMPLETE_UPLOAD) {
                try {
                    Logger.info('Send upload complete');
                    await this.upaki.CompleteUpload(this.details.file_id);
                    this.completeUploadTask(this.details);
                    Logger.info('Send upload complete ----- OK');
                } catch (error) {
                    Logger.error(error);
                    this.numberErrors++;
                    this.job.Fail(Environment.config.queue.uploader.retryDelay);
                }
                return;
            }

            Logger.debug(`Upload ${this.file.getFullName()} single part to ${this.file.getKey()}`);
            this.uploadType = UploadType.SIMPLE;
            let upload = await this.upaki.Upload(this.file.getPath(), this.file.getKey(), {}, this.file.getLastModifies(), this.preferred_folder_id);

            upload.on('progress', (progress) => {
                // console.log(progress.loaded, progress.total);
                Logger.debug(`Upload ${this.file.getFullName()} bytes sent ${progress.loaded}/${progress.total}`);
                this.loaded = progress.loaded;
                this.PropressTime();
            });

            upload.on('uploaded', (data) => {
                /* Logger.debug(`Upload ${this.file.getFullName()} finished ${data}`);
                 this.folder_id = data.folder_id;
                 this.file_id = data.file_id;
                 this.Etag = data.Etag;
                 this.state = UploadState.FINISH;
                 // deletar somente após salvar
                 this.save((err) => {
                     this.OnUploadFinish();
                 });
                 this.job.Finish();*/
                this.completeUploadTask(data);
            });

            upload.on('error', (err: any) => {
                Logger.error(err);
                if (err.code === 'COMPLETE_UPLOAD_ERROR') {
                    this.state = UploadState.AWAIT_COMPLETE_UPLOAD;
                    this.details = err.details;
                    this.job.Fail(Environment.config.queue.uploader.retryDelay);
                    this.save();
                    return;
                }

                if ((<any>err).code && (<any>err).code === 'RequestAbortedError') {
                    this.state = UploadState.STOP;
                    setTimeout(() => { this.job.Finish(); }, 3000);
                } else {
                    this.state = UploadState.ERROR;
                    this.job.Fail(Environment.config.queue.uploader.retryDelay);
                }
            });

            this.simpleUploadeEmitter = upload;

            this.state = UploadState.UPLOADING;
        } catch (error) {
            if (error && error.code === 'EIO') {
                Logger.error(`File corrupted, Fail EIO file ${this.file.filePath} error code EIO`);
                this.job.Finish();
            } else {
                Logger.error(error);
                this.state = UploadState.ERROR;
                this.job.Fail(Environment.config.queue.uploader.retryDelay);
            }
        }
    }

    PropressTime() {
        try {
            let time = Date.now() - this.timeStamp;
            //var duration = (endTime - startTime) / 1000;

            let speedBps = ((this.loaded - this.lastLoaded) * 8) / Number((time / 1000).toFixed(2));
            if (speedBps != Infinity && speedBps != 0 && speedBps != undefined) {
                let speedKbps = Number((speedBps / 1024).toFixed(2));
                let speedMbps = Number((speedKbps / 1024).toFixed(2));

                let timeLeft = ((this.file.getSize() - this.loaded) * 8) / speedBps;
                this.preventTimeLeft = this.secondsToHms(timeLeft);
                this.speedBps = speedBps;

                if (speedMbps >= 1) {
                    this.speedType = 'Mb/s';
                    this.speed = speedMbps;
                } else if (speedKbps >= 1) {
                    this.speedType = 'Kb/s';
                    this.speed = speedKbps;
                } else {
                    this.speedType = 'b/s';
                    this.speed = speedBps;
                }
            }
            this.lastLoaded = this.loaded;
            this.timeStamp = Date.now();
        } catch (err) {
            Logger.error(err);
        }
    }

    secondsToHms(d) {
        d = Number(d);
        var h = Math.floor(d / 3600);
        var m = Math.floor(d % 3600 / 60);
        var s = Math.floor(d % 3600 % 60);

        var hDisplay = h > 0 ? h + (h == 1 ? " hora, " : " horas, ") : "";
        var mDisplay = m > 0 ? m + (m == 1 ? " minuto, " : " minutos, ") : "";
        var sDisplay = s > 0 ? s + (s == 1 ? " segundo" : " segundos") : "";
        return hDisplay + mDisplay + sDisplay;
    }

    private save(onFinishCallback: (err) => void = undefined) {
        try {
            EntityUpload.Instance.saveIpc({
                key: this.file.getKey(),
                path: this.file.getPath(),
                lastModifies: this.file.getLastModifies() ? this.file.getLastModifies() as any : '',
                sessionData: this.session,
                state: this.state,
                file_id: this.file_id,
                folder_id: this.folder_id,
                details: this.details,
                Etag: this.Etag
            }, (err, data) => {
                if (err) {
                    Logger.error(err);
                } else {
                    Logger.info(`Info saved ${this.file.getFullName()}`);
                }

                if (onFinishCallback) {
                    onFinishCallback(err);
                }
            });

            if (this.folder_id) {
                EntityFolderMap.Instance.saveIpcFolder({
                    key: Util.getPathNameFromFile(this.file.getPath()),
                    id: this.folder_id
                }, (err, data) => {
                    if (err) {
                        Logger.error(err);
                    } else {
                        Logger.info(`Folder saved ${Util.getPathNameFromFile(this.file.getPath())}`);
                    }
                });
            }
        } catch (error) {
            this.state = UploadState.ERROR;
            Logger.error(error);
            //this.job.Fail();
        }
    }

    private async SignFile() {
        this.state = UploadState.SIGIN;
        this.upaki.signFile({
            signatureId: this.signatureId,
            fileId: this.file_id
        }).then(rs => {
            this.state = UploadState.FINISH;
            this.save((err) => {
                this.OnUploadFinish();
            });
            this.job.Finish();
        }, err => {
            Logger.error(err);
            this.job.Fail(10000);
        });
    }

    completeUploadTask(details) {
        this.folder_id = details.folder_id;
        this.file_id = details.file_id;
        this.Etag = details.Etag;
        Logger.info(`Upload ${this.file.getFullName()} uploaded ${this.numberErrors} errors`);
        this.state = this.signatureId ? UploadState.SIGIN : UploadState.FINISH;
        if (this.signatureId && this.file.getExtension() && this.file.getExtension().toLowerCase() === 'pdf') {
            this.SignFile();
        } else {
            // deletar somente apos salvar
            this.save((err) => {
                this.OnUploadFinish();
            });

            this.job.Finish();
        }
        if (Environment.config.useCluster) {
            WorkerUpload.Instance.notifyUpload(this);
        }
    }

    private async MultiplePartUpload() {
        try {
            if (this.state === UploadState.ERROR && this.multipartUploadEmitter) {
                this.multipartUploadEmitter.emit('retry');
                this.state = UploadState.UPLOADING;
                return;
            }

            if (this.state === UploadState.LOCKED) {
                this.state = UploadState.UPLOADING;
            }

            if (this.state === UploadState.REINIT) {
                this.state = UploadState.UPLOADING;
                Logger.info(`REINIT upload ${this.file.getFullName()} !`);
            }

            if (this.state === UploadState.AWAIT_COMPLETE_UPLOAD) {
                try {
                    Logger.info('Send upload complete');
                    await this.upaki.CompleteUpload(this.details.file_id);
                    this.completeUploadTask(this.details);
                    Logger.info('Send upload complete ----- OK');
                } catch (error) {
                    Logger.error(error);
                    this.numberErrors++;
                    this.job.Fail(Environment.config.queue.uploader.retryDelay);
                }

                return;
            }

            this.uploadType = UploadType.MULTIPART;
            if (this.session.Parts) {
                Logger.debug(`Parts: ${JSON.stringify(this.session.Parts)} uploadId=${this.session.UploadId} sendedBytes=${this.session.DataTransfered}`);
            }

            if (Environment.config.useCluster) {
                WorkerUpload.Instance.notifyUpload(this);
            }

            let compressContent = ['webm', 'mp4'].indexOf(this.file.getExtension().toLowerCase()) === -1 && this.compactContent;

            let upload = await this.upaki.MultipartUpload(this.file.getPath(), this.file.getKey(), this.session, { maxPartSize: 5242880, concurrentParts: 1, uploadTimeout: this.UPLOAD_TIMEOUT, preferred_dest_folder_id: this.preferred_folder_id }, {}, this.file.getLastModifies(), compressContent);

            upload.on('error', (error) => {
                //if (error.code === 'CREATE_MULTIPART_ERROR') {
                //    this.state = UploadState.ERROR;

                //}
                if (error.code) {
                    Logger.warn(`Error ${error.code} in uploading ${this.file.getFullName()} details: ${error.err ? error.err.message : 'Unknow err'}`);
                    if (error.code === 'COMPLETE_UPLOAD_ERROR') {
                        this.state = UploadState.AWAIT_COMPLETE_UPLOAD;
                        this.details = error.details;
                    }
                    else if (error.code === 'FATAL_ERROR') {
                        // um erro fatal e o upload foi abortado
                        this.session = {};
                        //this.save();
                    }
                    else if (error.code === 'ABORT_MULTIPART') {
                        this.session = {};
                        //this.save();
                    }
                    else if (error.code === 'UPLOAD_ID_NO_FOUND') {
                        this.multipartUploadEmitter.emit('abort');
                        this.multipartUploadEmitter.once('aborted', () => {
                            //this.state = UploadState.STOP;
                            Logger.warn(`Job canceled, file changed ? ${this.file.getFullName()}`);
                            // this.job.Finish();
                        })
                        this.session = {
                            Parts: [],
                            DataTransfered: 0
                        };
                        this.state = UploadState.REINIT;
                    } else if (error.code === 'ABORT_REQUEST') {
                        /*this.session.Parts = [];
                        this.session.DataTransfered = 0;
                        this.save();*/
                        Logger.warn(`Upload ${this.file.getFullName()} upload ABORTED`);
                        // removido 17/09/2019 nao é necessario
                        //setTimeout(() => { this.job.Finish(); }, 3000);
                        return;
                    }
                    this.save();
                } else {
                    Logger.error(`Unknow error in upload file ${this.file.getFullName()}`);
                    Logger.error(error);
                }
                /*else if (error.code === 'CHECKSUM_ERROR') {
                    this.state = UploadState.ERROR;
                }
                else if (error.code === 'RETRY_ERROR') {
                    this.state = UploadState.ERROR;
                }
                else if (error.code === 'NETWORKING_ERROR') {
                    this.state = UploadState.ERROR;
                }*/
                if (this.state !== UploadState.STOP) {
                    if (this.state !== UploadState.REINIT && this.state !== UploadState.AWAIT_COMPLETE_UPLOAD) {
                        this.state = UploadState.ERROR;
                    }
                    this.numberErrors++;
                    this.job.Fail(Environment.config.queue.uploader.retryDelay);
                    // Logger.error(error.err);
                } else {
                    Logger.warn(`Upload ${this.file.getFullName()} upload STOPED`);
                }
            });

            upload.on('part', (details) => {
                if (!this.file.Exists()) {
                    this.state = UploadState.REMOVED;
                    this.Cancel(STOP_UPLOAD_DESCRIPTOR.FILE_NOT_FOUND_MULTIPART_UPLOAD_PART);
                    this.job.Finish();
                    return;
                }

                Logger.debug(`Part uploaded Etag=${details.ETag} PartNumber=${details.PartNumber} Uploaded size ${details.uploadedSize}`);
                this.loaded = details.uploadedSize;
                this.PropressTime();
                /*this.session.Parts.push({
                    PartNumber: details.PartNumber,
                    ETag: details.ETag
                });*/
                //console.log('Session Sized:', this.session.DataTransfered, 'Part size: ', details.uploadedSize);
                this.session.DataTransfered = details.uploadedSize;
                //console.log('Session Sized:', this.session.DataTransfered, 'Part size: ', details.uploadedSize);

                if (Environment.config.useCluster) {
                    WorkerUpload.Instance.notifyUpload(this);
                }

                this.save();
            });

            upload.on('dbug', (msg) => {
                Logger.debug(`MultipartUploader[DBUG]: ${msg}`);
            });

            upload.on('uploaded', (details) => {
                this.completeUploadTask(details);
                /* this.folder_id = details.folder_id;
                 this.file_id = details.file_id;
                 this.Etag = details.Etag;
                 Logger.info(`Upload ${this.file.getFullName()} uploaded ${this.numberErrors} errors`);
                 this.state = this.signatureId ? UploadState.SIGIN : UploadState.FINISH;
 
 
 
 
                 if (this.signatureId && this.file.getExtension() && this.file.getExtension().toLowerCase() === 'pdf') {
                     this.SignFile();
                 } else {
                     // deletar somente apos salvar
                     this.save((err) => {
                         this.OnUploadFinish();
                     });
 
                     this.job.Finish();
                 }
 
                 if (Environment.config.useCluster) {
                     WorkerUpload.Instance.notifyUpload(this);
                 }
 
 */
            });

            upload.on('pausing', (details) => {
                //console.log(details);
                Logger.warn(`Job pauing ${this.file.getFullName()}`)
                this.state = UploadState.PAUSING;

                if (Environment.config.useCluster) {
                    WorkerUpload.Instance.notifyUpload(this);
                }
            });

            upload.on('retrying', (partNumber, parts: Parts[]) => {
                if (!this.file.Exists()) {
                    this.state = UploadState.REMOVED;
                    this.Cancel(STOP_UPLOAD_DESCRIPTOR.FILE_NOT_FOUND_MULTIPART_RETRY);
                    this.job.Finish();
                    return;
                }
                Logger.warn(`Retry send partNumber=${partNumber} parts sended=${JSON.stringify(parts)}`);
            });

            upload.on('ready', (id) => {
                if (!this.file.Exists()) {
                    this.state = UploadState.REMOVED;
                    this.Cancel(STOP_UPLOAD_DESCRIPTOR.FILE_NOT_FOUND_MULTIPART_READY);
                    this.job.Finish();
                    return;
                }
                /*if (!this.session.UploadId) {
                    Logger.debug(`New upload ${this.file.getKey()}`);
                    this.session.UploadId = id;
                    // this.session.Parts = [];
                    // this.session.DataTransfered = 0;
                    this.save();
                } else {
                    Logger.debug(`Continue upload ${this.file.getKey()}`);
                }*/
                this.session.UploadId = id;
                this.save();
            });

            this.multipartUploadEmitter = upload;

            this.state = UploadState.UPLOADING;
        } catch (error) {
            if (error && error.code === 'EIO') {
                Logger.error(`File corrupted, Fail EIO file ${this.file.filePath} error code EIO`);
                // Logger.error(error);
                this.job.Finish();
            } else {
                Logger.error(error);
                this.job.Fail(Environment.config.queue.uploader.retryDelay);
            }
        }
    }

    async Upload() {
        if (!this.file.Exists()) {
            this.state = UploadState.REMOVED;
            this.job.Finish();
            return;
        }

        if (!this.file.IsOpen()) {
            this.state = UploadState.LOCKED;
            this.job.Fail(Environment.config.queue.uploader.retryDelay);
            return;
        }

        if (this.file.getName() === undefined || this.file.getName() === '') {
            Logger.warn(`Invalid name of file ${this.file.getFullName()} !! removed queue!`);
            this.job.Finish();
            return;
        }

        if (!this.dataLoaded) {
            try {
                Logger.info(`Loading data from DB`);
                const dataDb = await this.LoadDataFromDb();
                if (dataDb) {
                    this.state = dataDb.state;
                    this.details = dataDb.details;
                }
                this.dataLoaded = true;
            } catch (error) {
                Logger.error(error);
            }
        }

        this.timeStamp = Date.now();
        this.lastLoaded = 0;

        Logger.info(`File ${this.file.getFullName()} start upload, length: ${this.file.getSize()}`);
        // if (this.file.getSize() < 5242880) { // se menor que 5MB
        //     this.SinglePartUpload();
        //} else {
        if (!this.parameters) {
            this.parameters = await EntityParameter.Instance.GetParams(['UPLOAD_TYPE', 'COMPACT_CONTENT_UPLOAD', 'UPLOAD_TIMEOUT', 'AUTO_SIGN', 'SIGN_ID']);
            this.compactContent = this.parameters['COMPACT_CONTENT_UPLOAD'] === '1' ? true : false;
            this.signatureId = this.parameters['AUTO_SIGN'] === '1' ? this.parameters['SIGN_ID'] : undefined;

            if (this.state === UploadState.SIGIN) {
                this.SignFile();
                return;
            }

            try {
                this.UPLOAD_TIMEOUT = Number(this.parameters['UPLOAD_TIMEOUT']);
                Logger.info(`Set UPLOAD_TIMEOUT to ${this.UPLOAD_TIMEOUT}`);
            } catch (error) {
                Logger.error(error);
            }
        }

        // load preferred folder_id
       this.preferred_folder_id = await EntityFolderSync.Instance.PreferredDestFolder(this.file.rootFolder)

        if (this.parameters['UPLOAD_TYPE'] === 'PART') {
            this.MultiplePartUpload();
        } else {
            this.SinglePartUpload();
        }
        // }
    }
}