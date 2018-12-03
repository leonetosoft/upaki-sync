
import * as events from 'events';
import * as multer from 'multer';
import * as express from 'express';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { Util } from '../util/Util';
import * as http from "http";

export interface FileReceiverServiceEvents {
    on(event: 'onCompleteFile', listener: (filename: string, size: number) => void): this;
    emit(event: 'onCompleteFile', filename: string, size: number): boolean;

    on(event: 'onStartTransfer', listener: (filename: string, size: number) => void): this;
    emit(event: 'onStartTransfer', filename: string, size: number): boolean;

    on(event: 'onListen', listener: (ip: string, port: number) => void): this;
    emit(event: 'onListen', ip: string, port: number): boolean;

    on(event: 'onClose', listener: () => void): this;
    emit(event: 'onClose'): boolean;

    on(event: 'onCorruptedFile', listener: (filename: string) => void): this;
    emit(event: 'onCorruptedFile', filename: string): boolean;

    on(event: 'onError', listener: (err: NodeJS.ErrnoException) => void): this;
    emit(event: 'onError', err: NodeJS.ErrnoException): boolean;
}
export class FileReceiverServiceEvents extends events.EventEmitter implements FileReceiverServiceEvents {

}

export class MulterCustomStorageEngine implements multer.StorageEngine {
    getDestination;
    receiveAction: (filename: string, size: string) => void;
    constructor(opts, receiveAction: (filename: string, size: string) => void) {
        this.getDestination = (opts.destination || this.getDestination)
        this.receiveAction = receiveAction;
    }
    _handleFile(req: express.Request, file: Express.Multer.File | any, cb: (error?: any, info?: Partial<Express.Multer.File>) => void): void {
        this.getDestination(req, file, (err, pathDest) => {
            if (err) return cb(err);

            var outStream;
            try {
                outStream = fs.createWriteStream(path.join(pathDest));
            } catch (error) {
                console.log(error.code);
                if (error.code === 'EPERM') {
                    fs.unlinkSync(path.join(pathDest));
                    outStream = fs.createWriteStream(path.join(pathDest));
                } else {
                    throw error;
                }
            }

            this.receiveAction(file.originalname, req.headers['content-length']);

            file.stream.pipe(outStream);
            outStream.on('error', cb);
            req.on('close', () => {
                // delete most recent file ?
                try {
                    outStream.close();
                    fs.unlinkSync(path.join(pathDest));
                } catch (error) {

                }

            })
            outStream.on('data', (chunk) => {
                console.log(chunk);
            });
            outStream.on('finish', function () {
                cb(null, {
                    path: pathDest,
                    size: outStream.bytesWritten
                })
            })
        });

    }
    _removeFile(req: express.Request, file: Express.Multer.File, cb: (error: Error) => void): void {
        console.log('remove');
        fs.unlink(file.path, cb)
    }
}
export class FileReceiverService extends FileReceiverServiceEvents {
    private app: express.Express;
    public server: http.Server;
    private sourceUpload: string;
    private receivePath: string;
    private port: number;

    constructor(port: number, receivePath: string) {
        super();
        this.port = port;
        this.receivePath = receivePath;
        this.sourceUpload = path.join(os.tmpdir(), 'upaki_file_receiver');
        this.app = express();
        this.Init();
    }

    UpdateParams(port: number, destPath: string, callback: (err) => void) {
        if (destPath)
            this.receivePath = destPath;
        if (port)
            this.port = port;

        if (this.server && this.server.listening) {
            this.server.close(() => {
                callback(undefined);
                this.emit('onClose');
                this.listen();
            });
        } else {
            callback(new Error('Não foi possivel alterar os parametros do serviço porque ele não está iniciado'));
        }
    }

    private listen() {
        this.server = this.app.listen(this.port, () => {
            if (this.server.listening)
                this.emit('onListen', Util.getIPAddress(), this.port);
        }).on('error', (err: any) => {
            if (err.code == 'EADDRINUSE') {
                this.emit('onError', new Error(`Endereço já está em uso, altere a porta e tente novamente`));
            } else {
                this.emit('onError', err);
            }
        });
    }

    public Init() {
        this.sourceUpload = path.join(os.tmpdir(), 'upaki_file_receiver');
        if (!fs.existsSync(this.sourceUpload)) {
            fs.mkdirSync(this.sourceUpload);
        }
        let upload = multer({
            storage: new MulterCustomStorageEngine({
                destination: (req, file, cb) => {
                    cb(null, path.join(this.sourceUpload, file.originalname))
                },
                filename: (req, file, cb) => {
                    cb(null, file.originalname)
                }
            }, (filename: string, size: string) => {
                try {
                    this.emit('onStartTransfer', filename, Number(size))
                } catch (error) {

                }
            })
        });

        this.app.post('/single', async (req, res) => {
            upload.single('data')(req, res, async (err) => {
                if (err instanceof (multer as any).MulterError) {
                    // A Multer error occurred when uploading.
                    this.emit('onError', err);
                    res.status(500).send("Erro interno!");
                    return;
                } else if (err) {
                    // An unknown error occurred when uploading.
                    this.emit('onError', err);
                    res.status(500).send("Erro interno!");
                    return;
                }
                try {
                    let filePath = path.join(this.sourceUpload, req.file.originalname);
                    let md5 = await Util.Etagv2(filePath);
                    if (md5 && md5 !== req.body.md5) {
                        fs.unlinkSync(filePath);
                        res.status(500).send("Arquivo Corrompido!");
                        this.emit('onCorruptedFile', req.file.originalname);
                        return;
                    }

                    let destPath = path.join(this.receivePath, req.file.originalname);
                    //fs.renameSync(filePath, destPath);
                    fs.copyFileSync(filePath, destPath);
                    fs.unlinkSync(filePath);
                    this.emit('onCompleteFile', req.file.originalname, Util.getFileSize(destPath));
                    res.send();
                } catch (error) {
                    this.emit('onError', error);
                    res.status(500).send("Erro desconhecido");
                }
                // Everything went fine.
            });


        });

        /*this.app.listen(this.port, () => {
            this.emit('onListen', Util.getIPAddress(), this.port);
        }).on('error', (err: any) => {
            if (err.code == 'EADDRINUSE') {
                this.emit('onError', new Error(`Endereço já está em uso, altere a porta e tente novamente`));
            } else {
                this.emit('onError', err);
            }
        });*/
        this.listen();
    }
}