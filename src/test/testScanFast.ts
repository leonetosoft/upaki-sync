import { ScanFast } from "./../sync/ScanFast";

let scanner = ScanFast('/home/leonetosoft/nodejs/balanco', (path) => {
    return true;
}, 10);

let count = 0;
scanner.on('onFile', (list) => {
    for (let i of list) {
       // console.log(i.filePath);
    }

    count += list.length;
    console.log('qtde: ', count);

   /* if(count > 265){
        console.log('pause');
    return;
    }*/
    setTimeout(() => {
        scanner.emit('next');
    }, 300);
});

scanner.on('onFolder', (src) => {
    console.log('Escaneando folder: ', src);
});

scanner.on('onError', (err) => {
    console.log('Erro!!!');
    console.log(err);
});

scanner.on('onFinish', () => {
    console.log('Finalizado!');
});

