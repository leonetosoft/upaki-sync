export interface FileReceiverProcData {
    ip: string;
    port: number;
    receivePath: string;
    totalReceive: number;
    eventLog: string[];
    ready: boolean;
}