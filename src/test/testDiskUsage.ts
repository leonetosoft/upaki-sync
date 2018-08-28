import * as diskusage from 'diskusage-ng';

diskusage('C:/', function(err, usage)  {
    if (err) return console.log(err);

    console.log(usage.total);
    console.log(usage.used);
    console.log(usage.available);
});
