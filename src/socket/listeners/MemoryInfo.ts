import { SocketClient } from './../SocketClient';
import { Logger } from '../../util/Logger';
import * as os from 'os';


export function MemoryInfo() {
    let client = SocketClient.Instance.client;

    client.on('RequestMemoryInfo', (clientId, data) => {
        try {
            let total = os.totalmem();
            let free = os.freemem();
            let used = total - free;
            let human = Math.ceil(used / 1000000) + ' MB';

            client.emit('Response', 'ResponseMemoryInfo', clientId, {
                total: total,
                free: free,
                used: used,
                human: human
            });
        }
        catch (err) {
            Logger.error(err);
        }
    });
}
