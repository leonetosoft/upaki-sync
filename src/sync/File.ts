import { Util } from "../util/Util";
import * as fs from 'fs';
import { Logger } from "../util/Logger";

export class File {
    filePath: string;
    lastModifies: string;
    rootFolder: string;
    key: string;
    sizeCache: number;

    constructor(filePath: string, rootFolder: string) {
        this.filePath = filePath;
        this.rootFolder = rootFolder;
        this.key = Util.getAbsolutePath(this.filePath, this.rootFolder);

        try {
            this.sizeCache = Util.getFileSize(filePath);
        } catch (error) {
            Logger.error(error);
        }
    }
    getSize(useCache = false): number {
        if (useCache) {
            return this.sizeCache;
        } else {
            return Util.getFileSize(this.filePath);
        }
    }
    getLastModifies() {
        return Util.getLastModifies(this.filePath);
    }
    /**
     * Retorna o nome do arquivo com extenssao
     */
    getFullName(): string {
        return Util.getFileNameByFullPath(this.filePath);
    }
    /**
     * Retorna o nome do arquivo sem ext
     */
    getName(): string {
        return Util.getFileNameByPath(this.filePath);
    }
    /**
     * Retorna extenssao
     */
    getExtension(): string {
        return Util.getExtension(this.filePath);
    }
    /**
     * Verifica se existe
     */
    Exists(): boolean {
        return fs.existsSync(this.filePath);
    }

    IsOpen(): boolean {
        try {
            let openFile = fs.openSync(this.filePath, 'rs');
            fs.closeSync(openFile);
            return true;
        } catch (error) {
            Logger.error(error);
            return false;
        }
    }
    /**
     * Coleta a key do arquivo, indica onde sera armazenado na nuvem
     */
    getKey(): string {
        // return path.join(Util.getAbsolutePath(this.filePath, this.rootFolder), this.getFullName());
        // return Util.getAbsolutePath(this.filePath, this.rootFolder);
        return this.key;
    }
    /**
     * Retorna o local de armazenamento em disco
     */
    getPath(): string {
        return this.filePath;
    }
}