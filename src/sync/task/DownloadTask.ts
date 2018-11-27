import { Task } from "../../queue/task";
import { Upaki } from "upaki-cli";
import { Environment } from "../../config/env";
import * as request from 'request';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from "../../util/Logger";
import * as mkdirp from 'mkdirp';
import { Util } from "../../util/Util";
import * as zlib from 'zlib';
import { setTimeout } from "timers";
import * as events from 'events';
import { PendingFile, DownloadFileState } from "../../api/download";


export interface DownloadEvents {
    //on(event: 'completeUpload', listener: (result: AWS.S3.CompleteMultipartUploadOutput) => void): this;
    emit(event: 'onPause', err): boolean;
    emit(event: 'onContinue', err): boolean;
    emit(event: 'onStop', err): boolean;
}

export class DownloadEvents extends events.EventEmitter implements DownloadEvents {

}

export class DownloadTask extends Task {
    fileDownload: PendingFile;
    upaki: Upaki;
    destFolder: string;
    /*received_bytes: number = 0;
    total_bytes: number;*/

    preventTimeLeft: string;
    speedBps: number;
    speedType: string;
    speed: number;
    //loaded: number;
    timeStamp = Date.now();
    lastLoaded = 0;
    lastPercent = 0;

    events: DownloadEvents;

    constructor(fileDownload: PendingFile, destFolder: string) {
        super();
        this.fileDownload = fileDownload;
        this.fileDownload.queueId = this.id;
        this.destFolder = destFolder;
        this.events = new DownloadEvents();
    }

    private unzipFlush(dest) {
        Logger.debug(`Unzip flush ${dest}`);
        return new Promise((resolve, reject) => {
            const fileContents = fs.createReadStream(dest);
            const writeStream = fs.createWriteStream(dest.replace('upakidownload', 'upakidownload.unzip'));
            const unzip = zlib.createGunzip();

            fileContents.pipe(unzip).pipe(writeStream).on('finish', (err) => {
                try {
                    if (err) {
                        return reject(err);
                    }
                    else {
                        fs.unlinkSync(dest);
                        fs.renameSync(dest.replace('upakidownload', 'upakidownload.unzip'), dest);
                        resolve();
                    }
                } catch (error) {
                    reject(error);
                }
            })
        })

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

    ContinueDownload() {
        if (this.fileDownload.state !== DownloadFileState.PAUSE) {
            Logger.warn(`Not restart download .... Download not paused!`);
        } else {
            this.Download();
        }
    }

    Pause(){
        if (this.fileDownload.state !== DownloadFileState.DOWNLOADING) {
            Logger.warn(`Not pause download .... Download not started!`);
        } else {
            this.fileDownload.state = DownloadFileState.REQUEST_PAUSE;
        }
    }

    Continue(){
        if (this.fileDownload.state !== DownloadFileState.PAUSE) {
            Logger.warn(`Not pause download .... Download not continue!`);
        } else {
            this.Download();
        }
    }

    Stop() {
        if(this.fileDownload.state === DownloadFileState.DOWNLOADING) {
            this.fileDownload.state = DownloadFileState.REQUEST_STOP;
        }else {
            this.fileDownload.state = DownloadFileState.STOP;
            this.job.Finish();
            this.events.emit('onStop', undefined);
        }
    }

    PropressTime() {
        try {
            let time = Date.now() - this.timeStamp;
            //var duration = (endTime - startTime) / 1000;

            let speedBps = ((this.fileDownload.receivedBytes - this.lastLoaded) * 8) / Number((time / 1000).toFixed(2));
            if (speedBps != Infinity && speedBps != 0 && speedBps != undefined) {
                let speedKbps = Number((speedBps / 1024).toFixed(2));
                let speedMbps = Number((speedKbps / 1024).toFixed(2));

                let timeLeft = ((this.fileDownload.size - this.fileDownload.receivedBytes) * 8) / speedBps;
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
            this.lastLoaded = this.fileDownload.receivedBytes;
            this.timeStamp = Date.now();
        } catch (err) {
            Logger.error(err);
        }
    }

    async Download() {
        try {
            // foi interrompido o download ... 
            if (this.fileDownload.state === DownloadFileState.DOWNLOADING) {
                Logger.warn(`Restart download ${this.fileDownload.name}`);
                this.fileDownload.state = DownloadFileState.PAUSE;
            }

            if (!this.upaki) {
                this.upaki = new Upaki(Environment.config.credentials);
            }

            let isPausedRequest = this.fileDownload.state === DownloadFileState.PAUSE;
            //this.received_bytes = 0;

            this.lastPercent = 0;

            Logger.debug(`Try Download ${this.fileDownload.name}`);

            let contentZip = false;
            let x_amz_meta_mymd5;

            let url = await this.upaki.GetSignedUrl(this.fileDownload.id, true);

            Logger.debug(`Signed URL ok start request ${this.fileDownload.name}`);

            let folderDest = path.join(this.destFolder, this.fileDownload.path);

            if (!fs.existsSync(folderDest)) {
                mkdirp.sync(folderDest);
            }

            let dest = path.join(this.destFolder, this.fileDownload.path, `${this.fileDownload.name}.upakidownload`);

            let headers = {};

            if (this.fileDownload.state === DownloadFileState.PAUSE) {
                if (!fs.existsSync(dest)) {
                    Logger.warn(`Not continue download ${dest} not exists !! restart download from scratch`);
                    return;
                }
                this.fileDownload.receivedBytes = fs.statSync(dest).size;
                headers['Range'] = `bytes=${this.fileDownload.receivedBytes}-${this.fileDownload.size}`;
                console.log(headers);
                //this.received_bytes = this.fileDownload.receivedBytes;
                this.lastPercent = Number((this.fileDownload.progress).toFixed(0));
                //this.total_bytes = this.fileDownload.size;
            } else {
                this.fileDownload.receivedBytes = 0;
                this.fileDownload.progress = 0;
            }

            let req = request({
                method: 'GET',
                uri: url,
                /*gzip: true,*/
                /* resolveWithFullResponse: true,*/ // optional, otherwise replace `res.body` with just `res` below
                /*encoding: null,*/
                headers: headers
            });

            Logger.debug(`Download file path dest: ${dest}`);

            // this.fileDownload.progress = this.fileDownload.state === DownloadFileState.PAUSE ? this.fileDownload.progress : 0;

            let out = this.fileDownload.state === DownloadFileState.PAUSE ? fs.createWriteStream(dest, { flags: 'a' }) : fs.createWriteStream(dest);

            this.fileDownload.state = DownloadFileState.DOWNLOADING;

            req.pipe(out);


            /*setTimeout(() => {
                 console.log('Pausar');
                 this.Pause();
 
                 setTimeout(() => {
                     if (this.fileDownload.state === DownloadFileState.PAUSE) {
                         console.log('Continuar');
                         this.ContinueDownload();
                     } else {
                         console.log('not paused');
                     }
                 }, 1000);
             }, 20000);*/

            req.on('response', (data) => {
                console.log(data.headers);

                // Change the total bytes value to get progress later.
                if (!isPausedRequest) {
                    this.fileDownload.size = parseInt(data.headers['content-length']);
                }else {
                    this.events.emit('onContinue', undefined);
                }
                this.fileDownload.etag = data.headers['etag'] as string;
                contentZip = data.headers['content-encoding'] && data.headers['content-encoding'] === 'gzip';
                x_amz_meta_mymd5 = data.headers['x-amz-meta-mymd5'];
                if (!contentZip && !this.fileDownload.etag) {
                    try {
                        this.fileDownload.progress = 0;
                        // out.end();
                        req.abort();
                    } catch (error) {
                        Logger.error(error);
                    }
                    Logger.warn(`File ${this.fileDownload.name} not correct response headers!`);
                    this.fileDownload.state = DownloadFileState.ERROR;
                    // this.job.Finish();
                }
            });

            req.on('data', (chunk) => {
                this.fileDownload.receivedBytes += chunk.length;
                this.fileDownload.progress = (this.fileDownload.receivedBytes * 100) / Number(this.fileDownload.size);
                let fixedPercent = Number((this.fileDownload.progress).toFixed(0));

                if (this.lastPercent !== fixedPercent) {
                    this.PropressTime();
                    Logger.debug(`Speed=${this.speedBps} Type: ${this.speedType} Speed: ${this.speed} preventTimeLeft: ${this.preventTimeLeft}`);
                    this.lastPercent = fixedPercent;

                    this.fileDownload.downloadSpeed = `${this.speed} ${this.speedType}`;
                    this.fileDownload.downloadTime = `${this.preventTimeLeft}`;
                    Logger.debug(`${this.fileDownload.name}: Progress ${this.fileDownload.progress}`);
                }

                // this.fileDownload.receivedBytes = this.received_bytes;

                if (this.fileDownload.state === DownloadFileState.REQUEST_PAUSE || this.fileDownload.state === DownloadFileState.REQUEST_STOP) {
                    req.abort();
                }

            });

            out.on('finish', async () => {
                try {
                    if (this.fileDownload.state === DownloadFileState.REQUEST_PAUSE) {
                        Logger.debug(`Stream paused ${this.fileDownload.name}`);
                        this.fileDownload.state = DownloadFileState.PAUSE;
                        this.events.emit('onPause', undefined);
                        return;
                    }

                    if (this.fileDownload.state === DownloadFileState.REQUEST_STOP) {
                        Logger.debug(`Stream stoped ${this.fileDownload.name}`);
                        this.fileDownload.state = DownloadFileState.STOP;
                        this.events.emit('onStop', undefined);
                        return;
                    }
                    Logger.debug(`End download ${this.fileDownload.name}`);
                    // out.end();
                    console.log('ETAG GERADO=', Util.Etag(fs.readFileSync(dest)), 'comparar=', this.fileDownload.etag);

                    if (contentZip) {
                        console.log('descompacta');
                        await this.unzipFlush(dest);
                    }

                    console.log('ETAG GERADO=', Util.Etag(fs.readFileSync(dest)), 'comparar=', this.fileDownload.etag);

                    let etagObj = Util.Etag(fs.readFileSync(dest));

                    if (!contentZip && !this.fileDownload.etag) { // arquivo corrompido na nuvem
                        Logger.error(`File ${this.fileDownload.name} corrupted in cloud!`);
                        fs.unlinkSync(dest);
                        this.job.Finish();
                        return;
                    }

                    if (!contentZip && this.fileDownload.etag.indexOf(etagObj) === -1) {
                        Logger.error(`File ${this.fileDownload.name} corrupted !!! retry download`);
                        this.fileDownload.state = DownloadFileState.ERROR;
                        //fs.unlinkSync(dest);
                        this.job.Fail(100000);
                        return;
                    }

                    if (contentZip && x_amz_meta_mymd5 && etagObj.indexOf(x_amz_meta_mymd5) === -1) {
                        Logger.error(`File ${this.fileDownload.name} corrupted !!! retry download`);
                        this.fileDownload.state = DownloadFileState.ERROR;
                        fs.unlinkSync(dest);
                        this.job.Fail(10000);
                    }

                    fs.renameSync(dest, dest.replace('.upakidownload', ''));

                    this.fileDownload.state = DownloadFileState.COMPLETED;

                    setTimeout(() => { this }, 5000);
                    this.job.Finish();
                } catch (error) {
                    Logger.error(error);
                    this.fileDownload.state = DownloadFileState.ERROR;
                    this.job.Fail(10000);
                }

            });

            req.on('end', async () => {
                Logger.debug(`Request Complete`);
            });
        } catch (error) {
            Logger.error(error);
            this.fileDownload.state = DownloadFileState.ERROR;
            this.job.Fail(10000);
        }
    }
}