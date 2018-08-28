import * as chalk from 'chalk';
import { Environment } from '../config/env';
import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import * as moment from 'moment';
import { Sentry } from './Sentry';

export namespace Logger {
    // export declare var LogInfoWriter, LogErrorWriter, LogDebugWriter, LogWarnWritter;

    export function WriteFile(msg, type) {
        let pathLog = path.join('logs');
        if (!fs.existsSync(pathLog)) {
            fs.mkdirSync(pathLog);
        }
        pathLog = path.join(pathLog, moment().format('DD-MM-YYYY'));
        if (!fs.existsSync(pathLog)) {
            fs.mkdirSync(pathLog);
        }

        fs.appendFile(path.join(pathLog, `${type}.log`), `[${moment().format('DD/MM/YYYY - HH:mm')}]: ${util.format(msg)}\n`, (err) => {
            if (err) throw err;
        });
    }

    export function info(info) {
        try {
            if (Environment.config.logging.info) {

                if (Environment.config.logging.type.find(el => el === 'file')) {
                    this.WriteFile(info, 'info');
                }

                if (Environment.config.logging.type.find(el => el === 'console')) {
                    console.log(chalk.default.bold(info));
                }
            }
        } catch (error) {
            console.log(error);
        }
    }

    export function error(error: Error | string) {
        try {
            if (Environment.config.logging.error) {
                if (Environment.config.logging.type.find(el => el === 'file')) {
                    this.WriteFile(error, 'error');
                }
                if (Environment.config.logging.type.find(el => el === 'console')) {
                    console.log(chalk.default.red('=======  ERROR  ======='));
                    console.log(error);
                    console.log(chalk.default.red('=======  -----  ======='));
                }

                // Sentry.Instance.reportError(error);
            }
        } catch (error) {

        }
    }

    export function debug(info) {
        if (Environment.config.logging.dbug) {
            try {
                if (Environment.config.logging.type.find(el => el === 'file')) {
                    this.WriteFile(info, 'debug');
                }
                if (Environment.config.logging.type.find(el => el === 'console')) {
                    console.log(chalk.default.blue(info));
                }
            } catch (error) {
                console.log(error);
            }
        }
    }

    export function warn(info) {
        if (Environment.config.logging.warn) {
            try {
                if (Environment.config.logging.type.find(el => el === 'file')) {
                    this.WriteFile(info, 'warn');
                }
                if (Environment.config.logging.type.find(el => el === 'console')) {
                    console.log(chalk.default.yellow(info));
                }
            } catch (error) {
                console.log(error);
            }
        }
    }
}