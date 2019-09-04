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
        /*try {
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
        }*/
    });
}

export function InfoQueueUploader() {
    let client = SocketClient.Instance.client;

    client.on('RequestQueueUploader', (clientId, data) => {
        try {
            client.emit('Response', 'ResponseQueueUploader', clientId, { queue: WorkerSocket.Instance.UPLOAD_LIST, sended: WorkerSocket.Instance.SIZE_SEND, total: WorkerSocket.Instance.TOTAL_SEND });
        }
        catch (err) {
            Logger.error(err);
        }
    });
}
