var path = require('path');
let src = 'c:/gabriela/teste.txt';
var x = path.normalize('c:\\gabriela\\teste.txt');
console.log(x);
console.log(x.indexOf(`c:/`));
