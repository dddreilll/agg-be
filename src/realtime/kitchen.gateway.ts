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
import { Order } from '../database/entities/order.entity';
import { serializeOrder } from '../orders/dto/order-response.dto';

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
  broadcastOrder(order: Order): void {
    const room = storeRoom(order.storeId);
    this.server.to(room).emit('order.incoming', serializeOrder(order));
    this.logger.log(`broadcast order ${order.id} → ${room}`);
  }

  /** Notify kitchen displays that an order's status changed. */
  broadcastStatusUpdate(storeId: string, orderId: string, status: string): void {
    const room = storeRoom(storeId);
    this.server.to(room).emit('order.status_updated', { orderId, status });
    this.logger.log(`broadcast status_updated order ${orderId} → ${status} (${room})`);
  }

  private storeIdFromHandshake(client: Socket): string | undefined {
    const q = client.handshake.query?.storeId;
    const fromQuery = Array.isArray(q) ? q[0] : q;
    const fromAuth = (client.handshake.auth as { storeId?: string } | undefined)?.storeId;
    return fromQuery || fromAuth || undefined;
  }
}
