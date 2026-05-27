import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type WsResponse,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { CanonicalOrder } from '../translation/canonical.types';

/** Kitchen displays subscribe per store; orders are emitted only to that store's room. */
const storeRoom = (storeId: string): string => `store:${storeId}`;

@WebSocketGateway({ namespace: '/kitchen', cors: { origin: '*' } })
export class KitchenGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() private readonly server!: Server;
  private readonly logger = new Logger(KitchenGateway.name);

  /** A display may pass its store via the handshake (?storeId= or auth.storeId) to auto-join. */
  handleConnection(client: Socket): void {
    const storeId = this.storeIdFromHandshake(client);
    if (storeId) {
      void client.join(storeRoom(storeId));
      this.logger.log(`client ${client.id} connected → joined ${storeRoom(storeId)}`);
    } else {
      this.logger.log(`client ${client.id} connected (awaiting subscribe)`);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`client ${client.id} disconnected`);
  }

  @SubscribeMessage('subscribe')
  onSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { storeId: string },
  ): WsResponse<{ storeId: string }> {
    void client.join(storeRoom(body.storeId));
    this.logger.log(`client ${client.id} subscribed to store ${body.storeId}`);
    return { event: 'subscribed', data: { storeId: body.storeId } };
  }

  @SubscribeMessage('unsubscribe')
  onUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { storeId: string },
  ): void {
    void client.leave(storeRoom(body.storeId));
  }

  /** Push a newly-accepted order to every kitchen display subscribed to its store. */
  broadcastOrder(order: CanonicalOrder): void {
    const room = storeRoom(order.order_details.internal_store_id);
    this.server.to(room).emit('order.incoming', order);
    this.logger.log(`broadcast order ${order.meta.order_id} → ${room}`);
  }

  private storeIdFromHandshake(client: Socket): string | undefined {
    const q = client.handshake.query?.storeId;
    const fromQuery = Array.isArray(q) ? q[0] : q;
    const fromAuth = (client.handshake.auth as { storeId?: string } | undefined)?.storeId;
    return fromQuery || fromAuth || undefined;
  }
}
