import * as Raven from 'raven';
import { Environment } from '../config/env';
import * as os from 'os';
import { QueueUploader } from '../sync/queue/QueueUploader';
import { QueueFile } from '../sync/queue/QueueFile';


export class Sentry {
    private static _instance: Sentry;
    constructor() {
        Raven.config('').install();
    }

    public static get Instance(): Sentry {
        return this._instance || (this._instance = new this());
    }

    public reportError(error) {
        if (!Environment.config) {
            console.log('Error not report in raven, redentials is not defined!');
            return;
        }

        if(!(error instanceof Error)){
            error = new Error(error);
        }

        try {
            let total = os.totalmem();
            let free = os.freemem();
            let used = total - free;
            let human = Math.ceil(used / 1000000) + ' MB';

            Raven.setContext({
                user: {
                    credentialId: Environment.config.credentials.credentialKey,
                }
            });

            SentryLog.captureException(error, {
                extra: {
                    type: 'UpakiSync-Desktop-' + Environment.config.version,
                    uploadQueue: QueueFile.Instance.tasks.getTaskListByPriority().length,
                    fileQueue: QueueUploader.Instance.tasks.getTaskListByPriority().length,
                    liveRam: human,
                    device: os.hostname(),
                    config: Environment.config
                }
            });

        } catch (err) {
            console.log(err);
            SentryLog.captureException(err, { extra: { fails: 'Fail capture data extra ' + err.message } });
        }


    }

}




export var SentryLog = Raven;