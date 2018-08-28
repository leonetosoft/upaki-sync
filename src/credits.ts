import * as chalk from 'chalk';
import { Environment } from './config/env';

export function PrintCredits() {
    let upaki = `
    █    ██  ██▓███   ▄▄▄       ██ ▄█▀ ██▓
    ██  ▓██▒▓██░  ██▒▒████▄     ██▄█▒ ▓██▒
   ▓██  ▒██░▓██░ ██▓▒▒██  ▀█▄  ▓███▄░ ▒██▒
   ▓▓█  ░██░▒██▄█▓▒ ▒░██▄▄▄▄██ ▓██ █▄ ░██░
   ▒▒█████▓ ▒██▒ ░  ░ ▓█   ▓██▒▒██▒ █▄░██░
   ░▒▓▒ ▒ ▒ ▒▓▒░ ░  ░ ▒▒   ▓▒█░▒ ▒▒ ▓▒░▓  
   ░░▒░ ░ ░ ░▒ ░       ▒   ▒▒ ░░ ░▒ ▒░ ▒ ░
    ░░░ ░ ░ ░░         ░   ▒   ░ ░░ ░  ▒ ░
      ░                    ░  ░░  ░    ░  
                                          
   SYNC Data | Version: ` + Environment.config.version;

    console.log(chalk.default.gray(upaki));
}