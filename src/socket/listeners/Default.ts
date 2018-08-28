import { SocketClient } from './../SocketClient';
import { Logger } from '../../util/Logger';
export namespace Listenners {
    export function ListennerName() {
        let client = SocketClient.Instance.client;

        client.on('[ListenerEvent]', () => {
            try {

            }
            catch (err) {
                Logger.error(err);
            }
        });
    }
}