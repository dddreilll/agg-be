import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** Renders every uncaught error as a consistent JSON envelope and logs 5xx with a stack. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const responseBody = isHttp ? exception.getResponse() : 'Internal server error';

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`Unhandled exception on ${req.method} ${req.url}`, stack);
    }

    const payload =
      typeof responseBody === 'string'
        ? { statusCode: status, message: responseBody }
        : { statusCode: status, ...(responseBody as Record<string, unknown>) };

    res.status(status).json({
      ...payload,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
