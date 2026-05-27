import {
  Controller,
  HttpStatus,
  Post,
  Req,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { IngestionProducer } from '../queue/ingestion.producer';
import { GrabFoodOrderDto } from './dto/grabfood-order.dto';
import { AcceptedResponseDto, DuplicateResponseDto } from './dto/ingestion-responses.dto';
import { IdempotencyInterceptor } from './idempotency.interceptor';

@ApiTags('Ingestion')
@Controller('webhooks')
export class IngestionController {
  constructor(private readonly producer: IngestionProducer) {}

  /**
   * Webhook front door. The interceptor has already validated the payload and run
   * the idempotency guard, so this handler stays tiny: ack a duplicate (200), or
   * enqueue and accept (202). Heavy work happens off the request thread.
   */
  @Post(':platform')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({
    summary: 'Ingest a delivery-platform order webhook',
    description:
      'Validates + dedupes the webhook, acks in <200ms, and enqueues it for async translation, ' +
      'persistence, and broadcast. Returns 202 for a new order or 200 for an idempotent replay.',
  })
  @ApiParam({
    name: 'platform',
    description: 'Source platform',
    enum: ['grabfood', 'foodpanda', 'fb_chatbot'],
    example: 'grabfood',
  })
  @ApiBody({
    type: GrabFoodOrderDto,
    description:
      "Raw platform webhook payload. The body schema is the source platform's native webhook " +
      '(GrabFood Submit Order or Foodpanda Dispatch Order). Stored verbatim; only the order id is ' +
      'read at ingestion — full validation happens during translation.',
    examples: {
      grabfood: {
        summary: 'GrabFood Submit Order',
        value: {
          orderID: '123-CYNKLPCVRN5',
          merchantID: '1-CYNGRUNGSBCCC',
          paymentType: 'CASH',
          items: [
            {
              id: 'item-1',
              quantity: 1,
              price: 2550,
              specifications: 'less sugar and chili',
              modifiers: [{ id: 'modifier-1', price: 175, quantity: 1 }],
            },
          ],
          price: { subtotal: 2550, total: 2075 },
        },
      },
      foodpanda: {
        summary: 'Foodpanda Dispatch Order',
        value: {
          token: '5f373562-591a-4db9-8609-7eec7880f28d',
          code: 'n0s1-w0k1',
          expeditionType: 'pickup',
          payment: { status: 'paid', type: 'paid' },
          platformRestaurant: { id: 'sq-abcd' },
          products: [
            {
              name: 'Double Cheese Burger',
              remoteCode: 'ID_FOR_DOUBLE_CHEESE_BURGER_ON_POS',
              quantity: '1',
              unitPrice: '6.42',
              comment: 'No cheese please',
              selectedToppings: [
                {
                  name: 'extra cheese',
                  remoteCode: 'ID_FOR_EXTRA_CHEESE_ON_POS',
                  price: '1.50',
                  quantity: 1,
                },
              ],
            },
          ],
          price: { grandTotal: '25.50' },
        },
      },
    },
  })
  @ApiResponse({
    status: 202,
    description: 'Accepted and enqueued (new order).',
    type: AcceptedResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Duplicate — idempotent replay; not re-enqueued.',
    type: DuplicateResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Unsupported platform or unparseable payload.' })
  @ApiResponse({
    status: 503,
    description: 'Idempotency store unavailable (only when IDEMPOTENCY_FAIL_OPEN=false).',
  })
  async ingest(@Req() req: Request, @Res() res: Response): Promise<void> {
    const parsed = req.parsedWebhook!;

    if (req.duplicate) {
      res.status(HttpStatus.OK).json({
        status: 'duplicate',
        idempotencyKey: parsed.dedupeKey,
      });
      return;
    }

    const jobId = await this.producer.enqueue({
      platform: parsed.platform,
      orderId: parsed.orderId,
      dedupeKey: parsed.dedupeKey,
      receivedAt: new Date().toISOString(),
      requestId: req.requestId ?? 'unknown',
      raw: parsed.raw,
    });

    res.status(HttpStatus.ACCEPTED).json({
      status: 'accepted',
      idempotencyKey: parsed.dedupeKey,
      jobId,
    });
  }
}
