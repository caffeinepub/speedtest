import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface SpeedTestResult {
    ping: bigint;
    uploadSpeed: number;
    timestamp: Time;
    downloadSpeed: number;
}
export type Time = bigint;
export interface backendInterface {
    addResult(downloadSpeed: number, uploadSpeed: number, ping: bigint): Promise<void>;
    getResults(): Promise<Array<SpeedTestResult>>;
}
