import * as nsfw from 'nsfw';
import * as fs from 'fs';
import * as path from 'path';
import * as events from 'events';
import { Util } from '../util/Util';
import { Logger } from '../util/Logger';

export interface ChangesWhatch {
    action: Action;
    key: string;
    type: 'folder' | 'file';
    oldKey: string;
}

export enum Action {
    MODIFIED = 2,
    DELETED = 1,
    RENAMED = 3,
    CREATED = 0
}
export interface NativeEventsEmitter {
    on(event: 'CREATED', eventInfo: (result: ChangesWhatch) => void): this;
    on(event: 'DELETED', eventInfo: (result: ChangesWhatch) => void): this;
    on(event: 'MODIFIED', eventInfo: (result: ChangesWhatch) => void): this;
    on(event: 'RENAMED', eventInfo: (result: ChangesWhatch) => void): this;


    emit(event: 'CREATED', result: ChangesWhatch): boolean;
    emit(event: 'DELETED', result: ChangesWhatch): boolean;
    emit(event: 'MODIFIED', result: ChangesWhatch): boolean;
    emit(event: 'RENAMED', result: ChangesWhatch): boolean;

    on(event: 'stop', listener: () => void): this;
    emit(event: 'stop'): boolean;
    emit(event: 'dbug', result: string): boolean;
    emit(event: 'error', err: Error): boolean;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'dbug', listener: (text: string) => void): this;

    on(event: 'ready', listener: () => void): this;
    emit(event: 'ready'): boolean;
}

export class NativeEventsEmitter extends events.EventEmitter implements NativeEventsEmitter { }

export class NSFW extends NativeEventsEmitter {
    scan;
    rootDir: string;
    whatch: any;
    awaitingCopy: ChangesWhatch[] = [];
    changesDebounce;
    constructor(rootDir: string) {
        super();
        this.rootDir = rootDir;
    }

    private IsOpen(key): boolean {
        try {
            let openFile = fs.openSync(key, 'rs');
            fs.closeSync(openFile);
            return true;
        } catch (error) {
            return false;
        }
    }

    private awaitIsOpen() {

    }

    GetActionsStr(action: Action) {
        return action === Action.CREATED ? 'CREATED' : action === Action.DELETED ? 'DELETED' : action === Action.MODIFIED ? 'MODIFIED' : 'RENAMED';
    }

    PrintTest(filterChanges: ChangesWhatch[]) {
        filterChanges.forEach(act => {
            // Logger.info(`[${act.type}] - Action ${this.GetActionsStr(act.action)} IN ${act.key} OLD ${act.oldKey}`);
            this.emit('dbug', `[${act.type}] - Action ${this.GetActionsStr(act.action)} IN ${act.key} OLD ${act.oldKey}`);
        });
    }

    isPendingCopy(key) {
        return this.awaitingCopy.findIndex(el => el.key === key) !== -1;
    }
    /**
     * Organiza as soliciacoes
     * @param files 
     */
    ProcessChanges(files: ChangesWhatch[]) {
        let filterChanges: ChangesWhatch[] = [];
        files.forEach((change) => {
            // acoes de modificacao em pastas sao ignoradas!!
            if (change.type === 'folder' && change.action === Action.MODIFIED) {
                return;
            }

            let finder = filterChanges.find(el => (el.key === change.key && el.action === change.action));

            if (!finder) {

                // Pode acontecer do arquivo ser alterado porem nao poder ser aberto e vice versa
                // Quando um arquivo eh alterado e recebido no Whatcher ele aguarda até que a ultima alteracao valida entre 
                // Assim nao sao lancadas varios pacotes MODIFIED E CHANGED
                // Esta foi uma alteracao ? Em arquivo ? Estava aguardando copia ? Pode ser aberto ? Ai lanca ADD
                if (change.type === 'file' && change.action === Action.MODIFIED && this.isPendingCopy(change.key) && this.IsOpen(change.key)) {
                    let changeAwainting = this.awaitingCopy.find(el => el.key === change.key);
                    filterChanges.push(changeAwainting);
                    let removes = this.awaitingCopy.findIndex(el => el.key === change.key);
                    this.awaitingCopy.splice(removes, 1);
                }
                // arquivo sendo copiado pode ser lancado como uma criacao ou modificacao, nao da para saber porem ele nao podendo ser aberto
                // ja entra na lista de espera
                else if (change.type === 'file' && (change.action === Action.CREATED || Action.MODIFIED) && !this.IsOpen(change.key)) {
                    this.awaitingCopy.push(change);
                } else {
                    filterChanges.push(change);
                }

            } else {
                // se a acao contiver modificacao e vier criacao ele cria uma de criacao
                if (finder.action === Action.MODIFIED && change.action === Action.CREATED) {
                    finder.action = Action.CREATED;
                }
            }
        });

        filterChanges.forEach(evtEmit => {
            switch (evtEmit.action) {
                case Action.MODIFIED:
                    // debounce changes in file
                    if(this.changesDebounce) {
                        clearTimeout(this.changesDebounce);
                        this.changesDebounce = undefined;
                    }
                    this.changesDebounce = setTimeout(() => {
                        this.emit('MODIFIED', evtEmit);
                    }, 1500);
                    break;
                case Action.DELETED:
                    this.emit('DELETED', evtEmit);
                    break;
                case Action.RENAMED:
                    this.emit('RENAMED', evtEmit);
                    break;
                case Action.CREATED:
                    this.emit('CREATED', evtEmit);
                    break;
            }
        })
    }

    Stop() {
        if (this.scan) {
            this.scan.stop();
        }
    }

    Init() {
        this.whatch = nsfw(this.rootDir, (events) => {
            // handle events
            let files = [];
            events.forEach((element) => {
                try {
                    let pathCheck = element.action !== Action.RENAMED ? path.join(element.directory, element.file) : path.join(element.directory, element.newFile);

                    // ecluir valores simbolicos
                    if (Util.getExtension(pathCheck) === 'lnk' ||
                        Util.getExtension(pathCheck) === 'tmp' ||
                        (Util.getExtension(pathCheck) !== undefined && Util.getExtension(pathCheck).endsWith('#')) ||
                        pathCheck.indexOf('$Recycle.Bin') !== -1 ||
                        String(Util.getFileNameByFullPath(pathCheck)).startsWith('~$') ||
                        String(Util.getFileNameByFullPath(pathCheck)).startsWith('~') ||
                        String(Util.getFileNameByFullPath(pathCheck)).startsWith('$')) {
                        return;
                    }

                    if (fs.existsSync(pathCheck)) {
                        // pode acontecer de nao poder solicitar lstatSync!!!!
                        // Event 4093198934844ecf8286a498f0ae620f
                        try {
                            if (element.action !== Action.RENAMED) {
                                if (fs.existsSync(path.join(element.directory, element.file))) {
                                    let stat = fs.lstatSync(path.join(element.directory, element.file));
                                    if (!stat.isDirectory() && stat.isFile()) {
                                        files.push({ action: element.action, key: pathCheck, type: 'file' });
                                    } else if (!stat.isSymbolicLink()) {
                                        files.push({ action: element.action, key: pathCheck, type: 'folder' });
                                    }
                                }
                            } else {
                                if (fs.existsSync(path.join(element.directory, element.newFile))) {
                                    let stat = fs.lstatSync(path.join(element.directory, element.newFile));
                                    if (!stat.isDirectory() && stat.isFile()) {
                                        files.push({ action: element.action, key: pathCheck, type: 'file', oldKey: path.join(element.directory, element.oldFile) });
                                    } else if (!stat.isSymbolicLink()) {
                                        files.push({ action: element.action, key: pathCheck, type: 'folder', oldKey: path.join(element.directory, element.oldFile) });
                                    }
                                }
                            }
                        } catch (error) {
                            Logger.error(error);
                        }
                    } else {
                        if (element.action !== Action.CREATED) { // diretorio nem existe e acionou a criacao
                            if (element.action !== Action.RENAMED) {
                                files.push({ action: element.action, key: path.join(element.directory, element.file) });
                            } else if (element.action === Action.RENAMED) {
                                files.push({ action: element.action, key: path.join(element.directory, element.newFile), oldKey: path.join(element.directory, element.oldFile) });
                            } else if (element.action !== Action.DELETED) {
                                files.push({ action: element.action, key: path.join(element.directory, element.file), type: 'folder' });
                            }
                        }
                    }
                } catch (error) {
                    this.emit('error', error);
                }
            });
            this.ProcessChanges(files);
        }).then((watcher) => {
            this.scan = watcher;
            return watcher.start();
        }).then(() => {
            this.emit('ready');
        });

    }
}