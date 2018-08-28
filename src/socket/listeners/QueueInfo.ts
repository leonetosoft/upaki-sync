import { UploaderTask, UploadType, UploadState } from './../../sync/task/UploaderTask';
import { QueueUploader } from './../../sync/queue/QueueUploader';

import { File } from './../../sync/File';
import { QueueFile } from './../../sync/queue/QueueFile';
import { SocketClient } from './../SocketClient';
import { Logger } from '../../util/Logger';
import { Environment } from '../../config/env';
import { WorkerSocket } from '../../thread/WorkerSocket';
import { Parts } from 'upaki-cli';

export function InfoQueueFiles() {
    let client = SocketClient.Instance.client;

    client.on('RequestQueueFiles', (clientId, data) => {
        try {
            let filesAnalyse: [{ name: string, path: string, cloudpath: string, operation: string, size: number }];
            let filesUploadQueue: [{
                path: string,
                cloudpath: string,
                state: string,
                size: number,
                loaded: number,
                uploadType: string;
                parts: Parts[],
                name: string
            }];

            let MAX_SEND_LIST = 100;
            let TOTAL_UPLOAD_LIST = QueueFile.Instance.tasks.getTaskListByPriority().length;
            let SIZE_SEND = 0;
            QueueFile.Instance.tasks.getTaskListByPriority().forEach(job => {
                if (filesAnalyse && filesAnalyse.length < MAX_SEND_LIST) {
                    let file: File = job.task.file;
                    let objFormed = {
                        path: file.getPath(),
                        cloudpath: file.getKey(),
                        operation: job.task.action,
                        size: file.getSize(),
                        name: file.getFullName()
                    };

                    if (!filesAnalyse) {
                        filesAnalyse = [objFormed];
                    } else {
                        filesAnalyse.push(objFormed);
                    }
                }
            });

            if (filesAnalyse) {
                client.emit('Response', 'ResponseQueueFiles', clientId, filesUploadQueue);
            }
        }
        catch (err) {
            Logger.error(err);
        }
    });
}

export function InfoQueueUploader() {
    let client = SocketClient.Instance.client;

    client.on('RequestQueueUploader', (clientId, data) => {
        try {
            if (!Environment.config.useCluster) {
                let filesUploadQueue: [{
                    path: string,
                    cloudpath: string,
                    state: string,
                    size: number,
                    loaded: number,
                    key: string,
                    uploadType: string;
                    parts: Parts[],
                    name: string
                    preventTimeLeft: string;
                    speedBps: number;
                    speedType: string;
                    speed: number;
                }];

                let MAX_SEND_LIST = 20;
                let TOTAL_UPLOAD_LIST = 0;
                let SIZE_SEND = 0;

                QueueUploader.Instance.tasks.getTaskListByPriority().forEach(job => {
                    let uploader: UploaderTask = job.task;
                    TOTAL_UPLOAD_LIST++;
                    SIZE_SEND += uploader.file.getSize() - uploader.loaded;
                    if ((!filesUploadQueue || (filesUploadQueue && filesUploadQueue.length < MAX_SEND_LIST)) && uploader.state == UploadState.UPLOADING) {
                        let file: File = job.task.file;

                        let objFormed = {
                            path: file.getPath(),
                            cloudpath: file.getKey(),
                            state: uploader.state,
                            parts: uploader.session.Parts,
                            loaded: uploader.loaded,
                            uploadType: uploader.uploadType,
                            size: file.getSize(),
                            name: file.getFullName(),
                            key: file.getKey(),
                            preventTimeLeft: uploader.preventTimeLeft,
                            speedBps: uploader.speedBps,
                            speed: uploader.speed,
                            speedType: uploader.speedType
                        };

                        if (!filesUploadQueue) {
                            filesUploadQueue = [objFormed];
                        } else {
                            filesUploadQueue.push(objFormed);
                        }
                    }
                });

                client.emit('Response', 'ResponseQueueUploader', clientId, { queue: filesUploadQueue, sended: SIZE_SEND, total: TOTAL_UPLOAD_LIST });
            } else {
                client.emit('Response', 'ResponseQueueUploader', clientId, { queue: WorkerSocket.Instance.UPLOAD_LIST, sended: WorkerSocket.Instance.SIZE_SEND, total:  WorkerSocket.Instance.TOTAL_SEND });
            }
        }
        catch (err) {
            Logger.error(err);
        }
    });
}
