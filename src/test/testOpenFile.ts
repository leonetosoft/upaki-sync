import * as fs from 'fs';

try {
    
    fs.openSync(`C:\\Users\\leonetosoft\\Documents\\Pasta Sincronizada\\Circulo.De.Fogo.2013.720p.BluRay.x264.SPARKS.DUAL-BRENYS.mkv`, 'rs');
    console.log('abriu');
} catch (error) {
    console.log('n abriu');
}