// inferencejs 1.3 does not expose its declarations through its package exports map.
declare module 'inferencejs' {
  export class InferenceEngine {
    startWorker(name: string, version: number, publishableKey: string): Promise<string>;
    infer(worker: string, image: ImageBitmap): Promise<unknown>;
    stopWorker(worker: string): Promise<boolean>;
  }
}
