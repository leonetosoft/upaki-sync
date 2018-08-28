import * as events from 'events';




let evt = new events.EventEmitter();

evt.prependOnceListener('teste', () => {
    console.log('A');
})

evt.prependOnceListener('teste', () => {
    console.log('B');
})


evt.prependOnceListener('teste é ///sjdffb ééé', () => {
    console.log('C');
})

evt.emit('teste é ///sjdffb ééé');