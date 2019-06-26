function prom() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(5);
        }, 3000);
    });
}
async function test() {
    let t = await prom();
    console.log(t);
}

test();
console.log(`ddd`);