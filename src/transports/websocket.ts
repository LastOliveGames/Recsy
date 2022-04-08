import type http from 'http';
import type ServerWebSocket from 'ws';
import type {Channel, Transport, VerifyFn} from './interfaces';
import ReconnectingWebSocket from 'reconnecting-websocket';


abstract class WebSocketChannel implements Channel {
  private messages: ArrayBuffer[];
  protected closedError: Error & {closed?: boolean, code?: number};

  constructor(readonly authToken?: string) {}

  protected onClose(reason: string, code: number) {
    if (this.closedError) return;
    this.closedError = new Error(`WebSocket closed: ${reason}`);
    this.closedError.closed = true;
    this.closedError.code = code;
  }

  protected onError(error: any) {
    if (this.closedError) return;
    this.closedError = new Error(`WebSocket error: ${error}`);
  }

  protected onMessage(message: ArrayBuffer) {
    this.messages.push(message);
  }

  abstract send(data: ArrayBuffer | ArrayBufferView): void;

  receive(): ArrayBuffer | void {
    if (this.messages.length) return this.messages.shift();
    if (this.closedError) throw this.closedError;
  }

  get connected() {
    return !this.closedError;
  }
}

class ServerWebSocketChannel extends WebSocketChannel {
  constructor(private readonly socket: ServerWebSocket, readonly authToken?: string) {
    super(authToken);
    socket.onclose = ev => {this.onClose(ev.reason, ev.code);};
    socket.onerror = ev => {this.onError(ev);};
    socket.onmessage = ev => {this.onMessage(ev.data as ArrayBuffer);};
  }

  send(data: ArrayBuffer | ArrayBufferView): void {
    if (!this.connected) return;
    this.socket.send(data);
  }
}


class ClientWebSocketChannel extends WebSocketChannel {
  constructor(private readonly socket: ReconnectingWebSocket, readonly authToken?: string) {
    super(authToken);
    socket.onclose = ev => {this.onClose(ev.reason, ev.code);};
    socket.onerror = ev => {this.onError(ev);};
    socket.onmessage = ev => {this.onMessage(ev.data);};
  }

  send(data: ArrayBuffer | ArrayBufferView): void {
    if (!this.connected) return;
    this.socket.send(data);
  }
}


export class WebSocketTransport implements Transport {
  private pendingChannels: Channel[] = [];
  private close: (() => Promise<void>) | void;

  constructor(
    private readonly host: string,
    private readonly port: number = 17923,
    public readonly maxPacketSize = 1200
  ) {}

  async startServer(verifyAuthToken?: VerifyFn): Promise<void> {
    const WebSocket = (await import('ws')).default;
    const urlParser = (await import('url'));

    return new Promise((resolve, reject) => {
      try {
        const options: any = {
          host: this.host, port: this.port, perMessageDeflate: false, verifyClient: undefined
        };
        if (verifyAuthToken) {
          options.verifyClient = (info: any) => {
            const req = info.req as http.IncomingMessage;
            const authToken = urlParser.parse(req.url!, true).query.auth as string;
            return Promise.resolve(verifyAuthToken(authToken));
          };
        }
        const server = new WebSocket.Server(options, () => {
          this.close = () => new Promise((resolveClose, rejectClose) => {
            server.close(error => {
              if (error) rejectClose(error); else resolveClose();
            });
          });
          resolve();
        });
        server.on('connection', (socket, req) => {
          socket.binaryType = 'arraybuffer';
          const authToken = urlParser.parse(req.url!, true).query.auth as string;
          this.pendingChannels.push(new ServerWebSocketChannel(socket, authToken));
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  async startClient(authToken?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let url = `ws://${this.host}:${this.port}/`;
      if (authToken) url += `?auth=${authToken}`;
      const socket = new ReconnectingWebSocket(
        url, undefined, {minReconnectionDelay: 1000, maxEnqueuedMessages: 0, startClosed: true});
      socket.binaryType = 'arraybuffer';
      this.close = () => Promise.resolve(socket.close());
      socket.onopen = ev => {
        this.pendingChannels.push(new ClientWebSocketChannel(socket, 'server'));
      };
      socket.reconnect();
      resolve();
    });
  }

  async stop(): Promise<void> {
    if (!this.close) return;
    await this.close();
    this.close = undefined;
  }

  acceptConnection() : Channel | void {
    if (this.pendingChannels.length) return this.pendingChannels.shift();
  }
}

