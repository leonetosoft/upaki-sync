import { Logger } from "../util/Logger";
import { Environment } from '../config/env';
import { development } from "../config/development";
Environment.config = development;

Logger.error('Erru gente');

setInterval(() => {
    Logger.info('Ola');
    Logger.debug('Bom?');    
    Logger.warn('Warnn');
    Logger.error(new Error('Erru gente'));
}, 1000);