import * as net from 'net';

var server = net.createServer();

server.on('close', () => {
    console.log(`Database server closed`);
});

server.on('connection', (socket) => {
    //socket.write('Echo server\r\n');
    //socket.pipe(socket);
    socket.setEncoding('utf-8');

    socket.on('data', (data) => {
        console.log('>>>> socket >>');
        console.log(data);
    });

    socket.on('end', () => {
        this.connections.splice(this.connections.indexOf(socket), 1);
        console.log(`Disconected ${socket.remotePort} `);
    });


    socket.on('close', (error) => {
        console.log(`Closed ${socket.remotePort} `);
    });

    socket.on('error', (error) => {
        console.log(error);
    });

    var inicio = 0;
    setInterval(() => {
       
        socket.write(String(inicio));
        console.log(inicio);
        inicio++;
    }, 150);
    
    //socket.pipe(socket);
});

server.on('error', (error: any) => {
    console.log(error.code);
    if(error.code === 'EADDRINUSE') {
        console.log('erro');
    }
    console.log(error);
});

server.on('listening', (err) => {
    console.log(err);
    console.log(`Server database listening`);
});

try {
    server.listen(5555, '127.0.0.1', (err) => {
        console.log('err');
        console.log(err);
    });
} catch (error) {
    console.log('deu');
    console.log(error);
}
