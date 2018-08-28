import { SocketClient } from './../socket/SocketClient';
import { production } from './../config/production';
import { Environment } from '../config/env';
Environment.config = production;
SocketClient.Instance;