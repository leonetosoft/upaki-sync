import { EntityUpload } from "../persist/entities/EntityUpload";
import { UploadState } from "../sync/task/UploaderTask";
import { Environment } from './../config/env';
import { development } from './../config/development';
import { Database } from "../persist/Database";
import { EntityFolderMap } from "../persist/entities/EntityFolderMap";

Environment.config = development;


async function folder(){
  /*  EntityFolderMap.Instance.save({
        key: 'leo/teste/php',
        id: 'ddd'
    }, (err, data) => {
        if (err) {
            console.log('erro');
            console.log(err);
        } else {
            console.log('salvo');
            console.log(data);
        }
    });*/

   /* let dta = await EntityFolderMap.Instance.getFolder('leo/teste/php');
    
        console.log(dta);*/

      /*  try {
            await EntityFolderMap.Instance.updateKey('leo/teste/php', 'leo/teste/php333');
            console.log('Alterado');
        } catch (error) {
         console.log(error);   
        }*/

      /*  try {
            await EntityFolderMap.Instance.delete('leo/teste/php333');
            console.log('Alterado');
        } catch (error) {
         console.log(error);   
        }*/
}
 async function inicia() {

    EntityUpload.Instance.save({
        key: 'leo/teste/php',
        lastModifies: '159',
        file_id: '12',
        folder_id: '55',
        state: UploadState.AWAIT,
        Etag: '????ASDASD',
        path: 'leo/teste/php',
        details: {Etag: '', file_id: '', folder_id: ''}
    }, (err, data) => {
        if (err) {
            console.log('erro');
            console.log(err);
        } else {
            console.log('salvo');
            console.log(data);
        }
    });

    let dta = await EntityUpload.Instance.getFile('leo/teste/php');

    console.log(dta);

    try {
        await EntityUpload.Instance.updateKey('leo/teste/php2', 'leo/teste/php333');
        console.log('Alterado');
    } catch (error) {
     console.log(error);   
    }

    try {
        await EntityUpload.Instance.delete('leo/teste/php333');
        console.log('Alterado');
    } catch (error) {
     console.log(error);   
    }
}

//inicia();

folder();