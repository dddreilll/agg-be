import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Env } from '../config/env.validation';
import { GrabTokenService } from './grab-token.service';

const credentialsSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  grant_type: z.literal('client_credentials'),
  scope: z.string().optional(),
});

@ApiTags('Auth')
@Controller('auth')
export class GrabTokenController {
  private readonly logger = new Logger(GrabTokenController.name);

  constructor(
    private readonly tokenService: GrabTokenService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * GrabFood Partner OAuth endpoint.
   * GrabFood calls this to obtain a Bearer token which it then includes on every
   * webhook call to our /webhooks/grabfood endpoint.
   */
  @Post('grab-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'GrabFood partner OAuth — issue a webhook Bearer token',
    description:
      'GrabFood calls this endpoint with client_id + client_secret to obtain a short-lived ' +
      'Bearer token. The token is then included as Authorization: Bearer <token> on every ' +
      'inbound GrabFood webhook, allowing us to verify the request is genuinely from Grab.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['client_id', 'client_secret', 'grant_type'],
      properties: {
        client_id: { type: 'string' },
        client_secret: { type: 'string' },
        grant_type: { type: 'string', enum: ['client_credentials'] },
        scope: { type: 'string', example: 'food.partner_api' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        token_type: { type: 'string', example: 'Bearer' },
        expires_in: { type: 'number', example: 3600 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Malformed request body.' })
  @ApiResponse({ status: 401, description: 'Invalid client credentials.' })
  issue(@Body() body: unknown) {
    let creds: z.infer<typeof credentialsSchema>;
    try {
      creds = credentialsSchema.parse(body);
    } catch {
      throw new BadRequestException('Invalid request body');
    }

    const expectedId = this.config.get('GRABFOOD_CLIENT_ID', { infer: true });
    const expectedSecret = this.config.get('GRABFOOD_CLIENT_SECRET', { infer: true });

    if (!expectedId || !expectedSecret) {
      this.logger.error('GRABFOOD_CLIENT_ID / GRABFOOD_CLIENT_SECRET not configured');
      throw new InternalServerErrorException('GrabFood OAuth not configured');
    }

    if (!safeCompare(creds.client_id, expectedId) || !safeCompare(creds.client_secret, expectedSecret)) {
      this.logger.warn(`GrabFood OAuth: invalid credentials for client_id=${creds.client_id}`);
      throw new UnauthorizedException('Invalid client credentials');
    }

    return this.tokenService.issue();
  }
}

/** Constant-time string comparison to prevent timing attacks on credential checks. */
function safeCompare(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    // Still run a dummy comparison to avoid short-circuit timing leak on length alone.
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}
