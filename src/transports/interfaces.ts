export type VerifyFn = (authToken: string) => boolean | Promise<boolean>;

export interface Channel {
  readonly authToken?: string;
  readonly connected: boolean;
  send(data: ArrayBuffer | ArrayBufferView): void;
  receive(): ArrayBuffer | void;
}

export interface Transport {
  readonly maxPacketSize: number;
  startServer(verifyAuthToken?: VerifyFn): Promise<void>;
  startClient(authToken?: string): Promise<void>;
  stop(): Promise<void>;
  acceptConnection(): Channel | void;
}
