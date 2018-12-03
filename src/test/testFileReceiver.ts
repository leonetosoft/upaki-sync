import { FileReceiverService } from "../module/FileReceiverService";


let flRecv = new FileReceiverService(3000, `C:\\filereceiver`);
flRecv.on('onCompleteFile', (filename, size) => {
    console.log(`Complete receive ${filename} size ${size}`);
})
flRecv.on('onCorruptedFile', (filename) => {
    console.log(`File ${filename} corrupted!`);
})
flRecv.on('onListen', (ip, port) => {
    console.log(`Started on ip ${ip} on port ${port}`);
})
flRecv.on('onError', err => {
    console.log(err);
})
flRecv.on('onStartTransfer', (filename, size) => {
    console.log(`Start transfer ${filename} on size ${size}`);
})