var schedule = require('node-schedule');

import * as schedule from 'node-schedule';



/*
*    *    *    *    *    *
┬    ┬    ┬    ┬    ┬    ┬
│    │    │    │    │    │
│    │    │    │    │    └ day of week (0 - 7) (0 or 7 is Sun)
│    │    │    │    └───── month (1 - 12)
│    │    │    └────────── day of month (1 - 31)
│    │    └─────────────── hour (0 - 23)
│    └──────────────────── minute (0 - 59)
└───────────────────────── second (0 - 59, OPTIONAL)
*/
// diariamente as 00:28
schedule.scheduleJob('0 28 0 * * *',  () => {
    console.log('diariamente as 00:26');
});

// Uma unica vez as 00:34 dia 15/2
schedule.scheduleJob('0 0 0 15 2 *',  () => {
    console.log('Uma unica vez as 00:34 dia 15/2');
});

// semanalmente as 00:54:00 segunda e sexta
schedule.scheduleJob('0 54 0 * * 1,5',  () => {
    console.log('semanalmente as 1h segunda, quinta e sexta');
});

// a cada x minutos
schedule.scheduleJob('0 */1 * * * *',  () => {
    console.log('a cada 1 min');
});


