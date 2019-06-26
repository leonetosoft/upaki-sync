import { SqliteRequestPacket, TYPE_DB_EXECUTIOM, Database } from "../Database";
import * as dgram from 'dgram';
import { Task } from "../../queue/task";

export class DatabaseExecutionTask extends Task{
    private requestPacket: SqliteRequestPacket;
    private rinfo: dgram.AddressInfo;

    constructor(requestPacket: SqliteRequestPacket, rinfo: dgram.AddressInfo) {
        super();
        this.requestPacket = requestPacket;
        this.rinfo = rinfo;
    }

    Execute() {
        switch (this.requestPacket.type) {
            case TYPE_DB_EXECUTIOM.RUN:
            Database.Instance.Run(this.requestPacket.sql, this.requestPacket.params, (err) => {
                    /*if (err) {
                        Logger.error(`Database Execution Error`);
                        Logger.error(err);
                    }*/

                    if(err) {
                        this.job.Fail(500);
                        return;
                    }

                  /*  Database.Instance.sendPacketToClient({
                        id: this.requestPacket.id,
                        rs: '',
                        err: err ? err.message : undefined
                    }, this.rinfo);*/

                    this.job.Finish();
                })
                break;

            case TYPE_DB_EXECUTIOM.GET:
            Database.Instance.Get(this.requestPacket.sql, this.requestPacket.params, (err, row) => {
                    /*if (err) {
                        Logger.error(`Database Execution Error`);
                        Logger.error(err);
                    }*/

                    if(err) {
                        this.job.Fail(500);
                        return;
                    }

                    /*Database.Instance.sendPacketToClient({
                        id: this.requestPacket.id,
                        rs: row,
                        err: err ? err.message : undefined
                    }, this.rinfo);*/

                    this.job.Finish();
                })
                break;

            case TYPE_DB_EXECUTIOM.ALL:
            Database.Instance.All(this.requestPacket.sql, this.requestPacket.params, (err, row) => {
                    /*if (err) {
                        Logger.error(`Database Execution Error`);
                        Logger.error(err);
                    }*/

                    if(err) {
                        this.job.Fail(500);
                        return;
                    }
                    
                  /*  Database.Instance.sendPacketToClient({
                        id: this.requestPacket.id,
                        rs: row,
                        err: err ? err.message : undefined
                    }, this.rinfo);
*/
                    this.job.Finish();
                })
                break;
        }
    }
}