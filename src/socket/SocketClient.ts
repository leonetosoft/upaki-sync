
import * as io from 'socket.io-client';
import { Environment } from '../config/env';
import { Logger } from '../util/Logger';
import * as os from 'os';
import { MemoryInfo } from './listeners/MemoryInfo';
import { InfoQueueFiles, InfoQueueUploader } from './listeners/QueueInfo';
import { ListenStorageInfo } from './listeners/SotorageInfo';
import { Upaki } from 'upaki-cli';
import * as HttpsProxyAgent from 'https-proxy-agent';

export class SocketClient {
    private static _instance: SocketClient;
    public client: SocketIOClient.Socket;

    constructor() {
        this.Connect()
    }
    public static get Instance(): SocketClient {
        return this._instance || (this._instance = new this());
    }

    private getToken() {
        return `JWT ${Environment.config.credentials.credentialKey} ${Environment.config.credentials.secretToken}`;
    }

    private Connect() {
        if(Upaki.PROXY_CONFIG && Upaki.PROXY_CONFIG !== '') {
            this.client = io(Environment.config.socket.url, {agent: (new HttpsProxyAgent(Upaki.PROXY_CONFIG)) as any});
        } else {
            this.client = io(Environment.config.socket.url);
        }

        this.client.on('connect', () => {
            Logger.info('Connect server estabilished!');
            this.client.emit('auth', this.getToken(), 'PC', os.hostname());
            this.client.on('authed', ()=>{
                this.Listen();
            });
        });

        this.client.on('disconnect', () => {
            Logger.warn('Connection losed socked!');
        })
    }

    private Listen() {
        MemoryInfo();
        InfoQueueFiles();
        InfoQueueUploader();
        ListenStorageInfo();
    }
}