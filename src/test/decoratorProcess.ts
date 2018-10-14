// https://gist.github.com/remojansen/16c661a7afd68e22ac6e
// https://netbasal.com/create-and-test-decorators-in-javascript-85e8d5cf879c


function Teste(a, b, c, j, z, f) {
    console.log(arguments[5].call());

    var args = [];
    for (let i = 0; i < (arguments.length - 1); i++) {
        args.push(arguments[i]);
    }
    console.log(args);
}

Teste(1, 2, 3, { j: 1, b: 2 }, ['h', 't'], function () {
    console.log('teste');


});