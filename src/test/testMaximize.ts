import { Util } from "../util/Util";

Util.AlreadyStarted().then(rs => {
    console.log(rs);
}).catch(err => {
    console.log(err);
})