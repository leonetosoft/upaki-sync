import { FileCopy } from "../module/FileCopy";

let cp = new FileCopy('C:\\source', 'C:\\dest', ['zip'], true, true);


cp.on('onCopyFile', (filename, size, dest) => {
    console.log(`Copiando arquivo ${filename} tamanho ${size} para ${dest}`);
});

let total = 0;
cp.on('onScanFiles', (list) => {
    total += list.length;
    console.log(`Encontrados ${total} arquivos`);
});

cp.on('onError', (err) => {
    console.log('Ocorreu um erro');
    console.log(err);
});

cp.on('onComplete', () => {
    console.log('Processamento Completo!');
});

cp.Init();