import { UploadState } from './../sync/task/UploaderTask';
import { EntityUpload, EntityUploadData } from './../persist/entities/EntityUpload';
import { production } from './../config/production';
import { Environment } from '../config/env';
Environment.config = production;

/*let insertTest: EntityUploadData = {
    key: 'teste/casa.cad',
    lastModifies: '2018',
    sessionData: {
        UploadId: 'kkk',
        Parts: [{
            PartNumber: 1,
            ETag: 'X1'
        }]
    },
    state: UploadState.UPLOADING,
    path: '/home/user/teste/casa.cad'
};*/

async function Insere(flUp: EntityUploadData) {
    return new Promise((resolve, reject) => {

        EntityUpload.Instance.save(flUp, (err, data) => {
            if (err) {
                console.log(err);
                reject(err);
            }
            else {
                console.log(data);
                resolve(data);
            }
        });
    });
}

async function InsereWhile() {
    let i = 0;
    let insertTest =  await EntityUpload.Instance.getFile('/home/user/teste/casa.cad');
    while (i <= 10) {
        insertTest.sessionData.Parts.push({
            PartNumber: insertTest.sessionData.Parts.length + 1,
            ETag: 'X1'
        })
        await Insere(insertTest);
        i++;
    }
    try {

        let resultado = await EntityUpload.Instance.getFile(insertTest.path);

        console.log(resultado);
        console.log(resultado.sessionData.Parts);
    } catch (error) {
        console.log(error);
    }
}

InsereWhile();