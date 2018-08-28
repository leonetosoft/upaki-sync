import * as nsfw from 'nsfw';
console.log(process.argv[2])
var watcher1;
nsfw(
    'E://',
  function(events) {
    // handle events
    // console.log(events); leo das    aadasd  da dasd 
    events.forEach(function(element) {
        console.log(element.action, ' in ', element.file);
    });
  })
  .then(function(watcher) {
    watcher1 = watcher;
    return watcher.start();
  })
  .then(function() {
    // we are now watching dir1 for events!
    
    // To stop watching
   // watcher1.stop()
  });
