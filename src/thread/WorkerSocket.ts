import { Logger } from "../util/Logger";
import { SocketClient } from "../socket/SocketClient";
import { SystemWorker } from './SystemWorker';
import { WorkProcess } from "../api/thread";

export class WorkerSocket extends SystemWorker<any> {
  UPLOAD_LIST = [];
  SIZE_SEND = 0;
  TOTAL_SEND = 0;
  private static _instance: WorkerSocket;

  constructor() {
    super(WorkProcess.WORKER_SOCKET);
    Logger.info(`[WorkerSocket] Worker ${process.pid} start!`);
  }

  public static get Instance(): WorkerSocket {
    return this._instance || (this._instance = new this());
  }

  Init() {
    SocketClient.Instance;
    // process.on('message', this.Listen.bind(this));
  }

  Listen(msg: any) {
    try {
      switch (msg.type) {
        /*case 'UPLOAD_STATE':
          this.UpdateUploadList(msg.data);
          break;

        case 'UPLOAD_NOTIFY':
          if (msg.data.stateType === 'ADD') {
            this.SIZE_SEND += Number(msg.data.size);
            this.TOTAL_SEND++;
          } else {
            let findIndex = this.UPLOAD_LIST.findIndex(el => el.path === msg.data.path);
            if (findIndex !== -1) {
              this.SIZE_SEND -= Number(msg.data.size);
              this.TOTAL_SEND--;
              this.UPLOAD_LIST.splice(findIndex, 1);
            }
          }
          break;*/

        case 'UPLOAD_LIST':
          this.UPLOAD_LIST = msg.data.list;
          this.SIZE_SEND = msg.data.totalSend;
          this.TOTAL_SEND = msg.data.numberOfUploads;
          break;

       /* case 'DATABASE_RESPONSE':
          Database.Instance.DbResponse(msg.data);
          break;*/
      }
    } catch (error) {
      Logger.error(error);
    }
  }

  UpdateUploadList(data: any) {
    let findIndex = this.UPLOAD_LIST.findIndex(el => el.path === data.path);
    if (findIndex !== -1) {
      this.UPLOAD_LIST[findIndex] = data;
    } else {
      this.UPLOAD_LIST.push(data);
    }
  }
}