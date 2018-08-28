import { production } from './../config/production';
import { SyncData } from './../sync/SyncData';
import { Environment } from '../config/env';
Environment.config = production;
let sync = new SyncData('/home/leonetosoft/testesync');