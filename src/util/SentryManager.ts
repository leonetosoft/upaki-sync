import { Environment } from '../config/env';
import * as os from 'os';
import * as Sentry from '@sentry/node';
const packageJSON  = require('./../../package.json') ;

export class SentryManager {
    private static _instance: SentryManager;
    constructor() {
        Sentry.init({ dsn: 'https://ada19281e4374540abade01a172b9a1a@sentry.io/1193706' });
    }

    public static get Instance(): SentryManager {
        return this._instance || (this._instance = new this());
    }

    public reportError(error) {
        if (!Environment.config) {
            console.log('Error not report in raven, redentials is not defined!');
            return;
        }

        if (!(error instanceof Error)) {
            error = new Error(error);
        }

        try {
            let total = os.totalmem();
            let free = os.freemem();
            let used = total - free;
            let human = Math.ceil(used / 1000000) + ' MB';

            

            Sentry.configureScope(scope => {
                scope.clear();
                scope.setExtra('type', 'UpakiSync-Desktop-' + Environment.config ? Environment.config.version : 'NULL');
                scope.setExtra('liveRam', human);
                scope.setExtra('device', os.hostname());
                scope.setExtra('osUserInfo', os.userInfo());
                scope.setExtra('platform', os.platform());
                scope.setExtra('architecture', os.arch());

                // console.log(packageJSON);
                scope.setTag('version', packageJSON.version);
                scope.setTag('upaki-cli', packageJSON.dependencies["upaki-cli"]);
                scope.setTag('upaki-desktop', Environment.config.version);
     
                scope.setExtra('config', Environment.config);

                if (Environment.config && Environment.config.userProfile) {
                    scope.setUser({
                        id: Environment.config.userProfile.id,
                        username: Environment.config.userProfile.nickname,
                        email: Environment.config.userProfile.email
                    });
                }
                // scope.clear();
            });

            Sentry.captureException(error);
        } catch (err) {
            console.log(err);
            Sentry.configureScope(scope => {
                scope.setExtra('extra', 'Fail capture data extra ' + err.message);
            });
        }


    }

}




export var SentryLog = Sentry;