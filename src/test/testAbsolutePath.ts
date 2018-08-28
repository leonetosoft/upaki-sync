import { Util } from "../util/Util";
import * as path from 'path';
import * as mkdirp from 'mkdirp';
// LINUX
//console.log(path.join(Util.getAbsolutePath('/home/leonetosoft/testesync/backups novos sistemas/upaki-sync.zip', '/home/leonetosoft/testesync/'), 'upaki-sync.zip'));
console.log(Util.getPathNameFromFile('E:\\CFC\\CFCSystem\\delphi\\acbr\\Fontes\\ACBrPAF\\ACBrPAF-change-log.txt'));
console.log(path.dirname('E:\\CFC\\leuuu\\netuu').normalize());

mkdirp.sync('E:\\CFC\\leuuu\\netuu');
// WIND
 // console.log(Util.getAbsolutePath('E:\\CFC\\CFCSystem\\delphi\\acbr\\Fontes\\ACBrPAF\\ACBrPAF-change-log.txt', 'E:\\'));