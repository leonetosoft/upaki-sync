import { WorkerMaster } from "..";
import { EntityTask } from "../persist/entities/EntityTask";

export function TestDownloadTask() {
    EntityTask.Instance.getTask('test').then(rs => {
        if(rs === undefined) {
            WorkerMaster.Instance.CreateDownloadTask([{
                id: 'wBgqk01NYe',
                name: 'TES_PAUSE_START'
            }], 'test-download', 'C:\\Download2', 'test', true).then(p => {
                console.log(`Task started: ${p.WORKER.process.pid}`);
            }).catch(err => {
                console.log(`Err on start task:`);
                console.log(err);
            });
        }else {
            console.log('start task');
            WorkerMaster.Instance.StartTask('test');
        }
    }, err => {
        console.log(err);
    });
}