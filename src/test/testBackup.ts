import { Database } from "../persist/Database";
import { development } from "../config/development";
import { Environment } from "../config/env";
import { BackupService } from "../module/BackupService";
import { BackupType } from "../api/backup";
Environment.config = development;
Database.Instance.setMaster();

let backup = new BackupService([`C:\\Users\\Leonardo\\Documents\\Source`,
`C:\\Users\\Leonardo\\Documents\\enviar`,
/*`C:\\Users\\Leonardo\\Documents\\medicpress-pt.zip`*/],
 [`C:\\Users\\Leonardo\\Documents\\Dest`,
 `C:\\Users\\Leonardo\\Documents\\Dest2`,
  `C:\\Users\\Leonardo\\Documents\\Dest12`], 'TESTE', BackupType.FULL, true);
backup.Init();

backup.on(`debug`, (dbug) => {
  console.log(`dbug=`, dbug);  
});

backup.on(`onCopySucces`, (file) => {
    console.log(`onCopySuccess=`, file);
});

backup.on(`onCriticalError`, (ctrErr) => {
    console.log(`OnCriticalError`, ctrErr);
});

backup.on(`onError`, (err) => {
    console.log(`Error=`,err);
});

backup.on(`onFinish`, () => {
    console.log(`Cabo`);
});

backup.on(`onErrorCopy`, (err, file, dest) => {
    console.log(`ErrOnCopy=`, err);
    console.log(file);
    console.log(dest);
});

backup.on(`onInfo`, (info) => {
    console.log(info);
});

backup.on(`onScanFolder`, (folder) => {
    console.log(folder);
})