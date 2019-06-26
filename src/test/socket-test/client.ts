import * as net from 'net';

var client = new net.Socket();
            client.connect({
                port: 5555,
                host: '127.0.0.1'
            });

            client.on('connect', () => {
                
                console.log('[Database TCP] Client: connection established with server');

                var address = client.address();
                var port = address.port;
                var family = address.family;
                var ipaddr = address.address;
                console.log('[Database TCP] Client is listening at port' + port);
                console.log('[Database TCP] Client ip :' + ipaddr);
                console.log('[Database TCP] Client is IP4/IP6 : ' + family);

         
            });

            client.setEncoding('utf8');

            client.on('data', (data) => {
                /*console.log('SERVER DIZ >>>>');
                console.log(data);*/
                var val = Number(data);
                client.write(String(val++));
                //this.clientOnReceivePacket(data);
            });

            client.on('error', (data) => {
               console.log(data);
            });