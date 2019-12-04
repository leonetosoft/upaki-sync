import { NSFW } from "../sync/NSFW";

let sync = new NSFW(`C:\\Users\\Leonardo\\Desktop\\scheduled`);


sync.on('CREATED', (rs) => {
    console.log('EVENTO CREATED');
    //console.log(rs);
})

sync.on('DELETED', (rs) => {
    console.log('EVENTO DELETED');
    //console.log(rs);
})

sync.on('MODIFIED', (rs) => {
    console.log('EVENTO MODIFIED');
    //console.log(rs);
})

sync.on('RENAMED', (rs) => {
    console.log('EVENTO RENAMED');
    //console.log(rs);
})

sync.Init();