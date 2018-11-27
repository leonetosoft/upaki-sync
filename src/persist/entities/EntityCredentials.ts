import { Upaki, UPAKI_DEVICE_TYPE, DeviceAuthResponse } from "upaki-cli";
import * as os from 'os';
import { Database } from "../Database";
import { Environment } from '../../config/env';
import { WorkerMaster } from "../../thread/WorkerMaster";
import { Logger } from "../../util/Logger";
import { CredentialDevice } from "../../api/entity";

export class EntityCredentials {
    private static _instance: EntityCredentials;

    public static get Instance(): EntityCredentials {
        return this._instance || (this._instance = new this());
    }

    async Login(login: string, password: string, callback: (err, rs) => void) {
        let upaki = new Upaki(Environment.config.credentials);
        let name = os.hostname();
        try {
            let dbCredential = await this.getCredentials();
            upaki.authDevice(login, password, name, UPAKI_DEVICE_TYPE.DESKTOP, os.platform(), dbCredential ? dbCredential.device_id : undefined).then(requestLogin => {
                if (requestLogin.code === 1) {
                    this.saveCredential(requestLogin.data, dbCredential !== undefined && dbCredential.device_id !== undefined).then(async saveCredentials => {
                        try {
                            await this.RestoreCredentialsFromDb();
                            callback(undefined, true);
                        } catch (error) {
                            Logger.error(error);
                            callback('Erro ao restaurar as credenciais', false);
                        }
                    }).catch(errSaveCred => {
                        Logger.error(errSaveCred);
                        callback('Erro no armazenamento da credencial de segurança', false);
                    });
                } else {
                    callback(requestLogin.msg, false);
                }
            }).catch(err => {
                callback(err.message, false);
            });
        } catch (error) {
            Logger.error(error);
            callback('Erro na recuperação das credenciais', false);
        }

    }

    async RestoreCredentialsFromDb() {
        let credentials = await this.getCredentials();
        Environment.config.credentials = {
            deviceId: credentials.device_id,
            credentialKey: credentials.credential_key,
            secretToken: credentials.token,
            userId: credentials.user_id
        };
    }

    async CheckCredentials(): Promise<boolean> {
        let dbCredential = await this.getCredentials();
        if (dbCredential.device_id && dbCredential.token && dbCredential.credential_key) {
            return true;
        } else {
            return false;
        }
    }

    getCredentials(): Promise<CredentialDevice> {
        return new Promise((resolve, reject) => {
            Database.Instance.Get(`SELECT device_id, credential_key, token, user_id FROM credential`, [], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row) {
                        resolve(row);
                    } else {
                        resolve(undefined);
                    }
                }
            });
        })
    }

    logOff(callback: (err?) => void) {
        if (Environment.config.credentials.credentialKey && Environment.config.credentials.deviceId && Environment.config.credentials.secretToken) {

            Database.Instance.Run(`UPDATE credential SET credential_key=?, token=? WHERE device_id=?`,
                [undefined, undefined, Environment.config.credentials.deviceId], (errInsert) => {
                    if (errInsert) {
                        callback(errInsert);
                        return;
                    }

                    if (WorkerMaster.Instance.isReady()) {
                        WorkerMaster.Instance.CloseAllProcess().then(rs => {
                            WorkerMaster.Instance.ready = false;
                            callback();
                        }).catch(errCloseProcess => {
                            Logger.error(errCloseProcess);
                            callback('Erro ao fechar processos internos!');
                        })
                    } else {
                        callback();
                    }
                });

            callback();
        } else {
            callback('Device not logedIn');
        }
    }

    saveCredential(credential: DeviceAuthResponse, update: boolean): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (update) {
                Database.Instance.Run(`UPDATE credential SET credential_key=?, token=?, user_id=? WHERE device_id=?`,
                    [credential.credentialKey, credential.secretToken, credential.userId, credential.deviceId], (errInsert) => {
                        if (errInsert) {
                            reject(errInsert);
                            return;
                        }
                        resolve(true);
                    });
            } else {
                Database.Instance.Run(`INSERT INTO credential(device_id, credential_key, token, user_id) VALUES(?, ?, ?, ?)`,
                    [credential.deviceId, credential.credentialKey, credential.secretToken, credential.userId], (errInsert) => {
                        if (errInsert) {
                            reject(errInsert);
                            return;
                        }
                        resolve(true);
                    });
            }
        });
    }
}