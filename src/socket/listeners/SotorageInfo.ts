import { SocketClient } from './../SocketClient';
import * as os from 'os';
// import * as disk from 'diskusage';
import { Logger } from '../../util/Logger';
import * as diskusage from 'diskusage-ng';
export function ListenStorageInfo() {
    let client = SocketClient.Instance.client;
    let path = os.platform() === 'win32' ? 'c:' : '/';
    client.on('RequestStorageInfo', (clientId, data) => {
        try {
            /*let info = disk.checkSync(path);
            client.emit('Response', 'ResponseStorageInfo', clientId, {
                available: info.available,
                free: info.free,
                total: info.total
            });*/

            diskusage('C:/', function(err, usage) {
                if (err) return console.log(err);
            
                /*console.log(usage.total);
                console.log(usage.used);
                console.log(usage.available);*/

                client.emit('Response', 'ResponseStorageInfo', clientId, {
                    available: usage.available,
                    free: usage.available,
                    total: usage.total
                });
            });
        }
        catch (err) {
            Logger.error(err);
        }
    });
}
