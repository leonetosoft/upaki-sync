import * as Datastore from 'nedb';
import { EntityUpload } from "../persist/entities/EntityUpload";
import { Environment } from './../config/env';
import { development } from './../config/development';
import { Database } from "../persist/Database";
import { EntityFolderMap } from "../persist/entities/EntityFolderMap";
Environment.config = development;

let db: Datastore;
db = new Datastore({
    filename: 'folders.db',
    autoload: true
});

async function Salvar(data: any): Promise<any> {
    return new Promise((resolve, reject) => {
        EntityUpload.Instance.save(data, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    })
}
async function exportFiles() {
    db.find({ "table": 'file' }, async function (err, docs) {
        // docs contains Earth
        // console.log(docs[0]);
        console.log(docs.length);

        let inserted = 0;
        let erro = 0;
        for (let doc of docs) {
            try {
                delete doc._id;
                await Salvar(doc);
                console.log('Ok, ', doc.path);
                inserted++;
            } catch (error) {
                erro++;
                console.log('Fail, ', doc.path);
                console.log(doc);
            }
        }

        console.log('Err=', erro, ' Success=',  inserted);
    });
}

async function SalvarFolder(data: any): Promise<any> {
    return new Promise((resolve, reject) => {
        EntityFolderMap.Instance.save(data, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    })
}
async function exportFolders() {
    db.find({ }, async function (err, docs) {
        // docs contains Earth
        // console.log(docs[0]);
        console.log(docs.length);

        let inserted = 0;
        let erro = 0;
        for (let doc of docs) {
            try {
                delete doc._id;
             await SalvarFolder(doc);
                console.log('Ok, ', doc.key);
                inserted++;
            } catch (error) {
                erro++;
                console.log('Fail, ', doc.key);
                console.log(doc);
            }
        }

        console.log('Err=', erro, ' Success=',  inserted);
    });
}


exportFolders();