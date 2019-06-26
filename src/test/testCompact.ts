import * as archiver from 'archiver';
import * as fs from 'fs';

function Compact(source, dest) {
    return new Promise((resolve, reject) => {
        var output = fs.createWriteStream(dest);
        var archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        });

        output.on('close', () => {
            console.log(archive.pointer() + ' total bytes');
            console.log('archiver has been finalized and the output file descriptor has closed.');
            resolve();
        });

        // good practice to catch warnings (ie stat failures and other non-blocking errors)
        archive.on('warning', (err) => {
            if (err.code === 'ENOENT') {
                // log warning
            } else {
                // throw error
                reject(err);
                throw err;
            }
        });

        // good practice to catch this error explicitly
        archive.on('error', (err) => {
            reject(err);
            throw err;
        });

        // pipe archive data to the file
        archive.pipe(output);

        //archive.directory(source);

        archive.file(source, { name: source });

        archive.finalize();
    });
    //https://github.com/isaacs/minimatch <- math
}
Compact(`C:\\filereceiver\\20150109_154936(0).jpg`, `C:\\filereceiver\\test.zip`).then(rs => {
    console.log(`terminou`);
}).catch(err => {
    console.log(err);
});