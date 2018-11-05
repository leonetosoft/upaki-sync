import { Task } from "../../queue/task";
import { PendingFile, DownloadFileState } from "../../thread/WorkerDownload";
import { Upaki } from "upaki-cli";
import { Environment } from "../../config/env";
import * as request from 'request';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from "../../util/Logger";
import * as mkdirp from 'mkdirp';
import { Util } from "../../util/Util";
import * as zlib from 'zlib';

export class DownloadTask extends Task {
    fileDownload: PendingFile;
    upaki: Upaki;
    destFolder: string;
    received_bytes: number = 0;
    total_bytes: number;

    constructor(fileDownload: PendingFile, destFolder: string) {
        super();
        this.fileDownload = fileDownload;
        this.destFolder = destFolder;
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

    async Download() {
        try {
            if (!this.upaki) {
                this.upaki = new Upaki(Environment.config.credentials);
            }

            this.received_bytes = 0;

            Logger.debug(`Try Download ${this.fileDownload.name}`);

            let contentZip = false;

            let url = await this.upaki.GetSignedUrl(this.fileDownload.id, true);

            Logger.debug(`Signed URL ok start request ${this.fileDownload.name}`);
            let req = request({
                method: 'GET',
                uri: url,
                gzip: true,
                resolveWithFullResponse: true, // optional, otherwise replace `res.body` with just `res` below
                encoding: null
            });

            let folderDest = path.join(this.destFolder, this.fileDownload.path);

            if (!fs.existsSync(folderDest)) {
                mkdirp.sync(folderDest);
            }

            let dest = path.join(this.destFolder, this.fileDownload.path, `${this.fileDownload.name}.upakidownload`);

            Logger.debug(`Download file path dest: ${dest}`);

            let out = fs.createWriteStream(dest);

            this.fileDownload.state = DownloadFileState.DOWNLOADING;

            req.pipe(out);

            req.on('response', (data) => {
                // Change the total bytes value to get progress later.
                this.total_bytes = parseInt(data.headers['content-length']);
                this.fileDownload.etag = data.headers['etag'];
                contentZip = data.headers['content-encoding'] && data.headers['content-encoding'] === 'gzip';
            });


            req.on('data', (chunk) => {
                this.received_bytes += chunk.length;
                this.fileDownload.progress = (this.received_bytes * 100) / Number(this.total_bytes);
                Logger.debug(`${this.fileDownload.name}: Progress ${this.fileDownload.progress}`);
            });

            req.on('end', async () => {
                try {
                    Logger.debug(`End download ${this.fileDownload.name}`);
                    out.end();
                    console.log('ETAG GERADO=', Util.Etag(fs.readFileSync(dest)), 'comparar=', this.fileDownload.etag);

                    /*if (contentZip) {
                        console.log('descompacta');
                        await this.unzipFlush(dest);
                    }
                    console.log('ETAG GERADO=', Util.Etag(fs.readFileSync(dest)), 'comparar=', this.fileDownload.etag);
                    */
                    let etagObj = Util.Etag(fs.readFileSync(dest));


                    if (!contentZip && this.fileDownload.etag.indexOf(etagObj) === -1) {
                        Logger.error(`File ${this.fileDownload.name} corrupted !!! retry download`);
                        this.fileDownload.state = DownloadFileState.ERROR;
                        this.job.Fail(10000);
                        return;
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
        } catch (error) {
            Logger.error(error);
            this.fileDownload.state = DownloadFileState.ERROR;
            this.job.Fail(10000);
        }
    }
}