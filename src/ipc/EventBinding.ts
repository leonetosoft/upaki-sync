import { Environment } from '../config/env';
import { MessageToWorker } from '../thread/UtilWorker';
import * as uuidv1 from 'uuid/v1';
import * as events from 'events';
import { Logger } from '../util/Logger';
import { WorkProcess } from '../api/thread';

export interface CallFunc {
    key: string;
    caller: any;
}

let callEvents: events.EventEmitter = new events.EventEmitter();
let registerFuncions: CallFunc[] = [];
function logMethod(target, key, descriptor) {

    // save a reference to the original method this way we keep the values currently in the
    // descriptor and don't overwrite what another decorator might have done to the descriptor.
    if (descriptor === undefined) {
        descriptor = Object.getOwnPropertyDescriptor(target, key);
    }
    var originalMethod = descriptor.value;

    //editing the descriptor/value parameter
    descriptor.value = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        var a = args.map(function (a) { return JSON.stringify(a); }).join();
        // note usage of originalMethod here
        var result = originalMethod.apply(this, args);
        var r = JSON.stringify(result);
        console.log("Call: " + key + "(" + a + ") => " + r);
        return result;
    };

    // return edited descriptor as opposed to overwriting the descriptor
    return descriptor;
}

// recebeu uma requisicao de um worker
export function SharedReceiveCall(msg: { args: any[], id: string, key: string, workerRequest: number }) {
    let findFunction = registerFuncions.find(el => el.key === msg.key);
    if (findFunction) {
        // Logger.debug(`Request call ${msg.key} id = ${msg.id}`);
        if (msg.id !== '') {
            msg.args.push((err, rs) => {
                // Logger.debug(`Response OK for request call ${msg.key}`);
                MessageToWorker(msg.workerRequest, { type: 'RECEIVE_CALL_RESPONSE', data: { id: msg.id, err: err, rs: rs } });
            });
        }
        try {
            findFunction.caller.apply(this, msg.args);
        } catch (error) {
            Logger.error(error);
        }
    } else {
        Logger.error(`Not found SharedReceiveCall key: ${msg.key}`);
    }
}

export function SharedResponseCall(msg: { id: string, err: string, rs: any }) {
    // Logger.debug(`Response OK in origin worker`);
    callEvents.emit(msg.id, msg.err, msg.rs);
}

export interface SharedFuncionParameters {
    mainWorter: WorkProcess,
    response: boolean
}
export function SharedFuncion(params: SharedFuncionParameters) {

    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        // save a reference to the original method this way we keep the values currently in the
        // descriptor and don't overwrite what another decorator might have done to the descriptor.
        if (descriptor === undefined) {
            descriptor = Object.getOwnPropertyDescriptor(target, propertyKey);
        }
        var originalMethod = descriptor.value;

        // console.log(`Function ${propertyKey} register on sharedFuncions`);

        // if (params.mainWorter === Environment.config.worker) {
        let findFunction = registerFuncions.find(el => el.key === propertyKey);

        if (findFunction) {
            throw new Error(`Function ${propertyKey} duplicated SharedFuncion, please fix function`);
        }


        registerFuncions.push({
            key: propertyKey,
            caller: descriptor.value
        });

        // return originalMethod;
        // } else {
        let a = this;
        descriptor.value = function () {
            if (!Environment.config) {
                throw new Error(`Function ${propertyKey} worker not set, please set Environment.config.worker`);
            }
            if (params.mainWorter === Environment.config.worker) {
                return originalMethod.apply(this, arguments);
            }
            if (params.response) {
                const idRequest = uuidv1();
                // ultimo argumento eh a funcao call
                callEvents.once(idRequest, arguments[arguments.length - 1]);
                var args = [];
                for (let i = 0; i < (arguments.length - 1); i++) {
                    args.push(arguments[i]);
                }
                MessageToWorker(params.mainWorter, { type: `SEND_REQUEST_CALL`, data: { workerRequest: Environment.config.worker, args: args, id: idRequest, key: propertyKey } });
            } else {

                var args = [];
                for (let i = 0; i < arguments.length; i++) {
                    args.push(arguments[i]);
                }
                MessageToWorker(params.mainWorter, { type: `SEND_REQUEST_CALL`, data: { workerRequest: Environment.config.worker, args: args, id: '', key: propertyKey } });
            }
            return true;
        }

        return descriptor;
    }

}