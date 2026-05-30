import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ParserService } from './parser.service';

const parseRequestSchema = z.object({
  text: z.string().min(1).max(4000),
  storeId: z.string().uuid(),
});

class ParseRequestDto extends createZodDto(parseRequestSchema) {}

@ApiTags('Parser')
@Controller('parse')
export class ParserController {
  constructor(private readonly parser: ParserService) {}

  @Post()
  @ApiOperation({
    summary: 'Parse raw Taglish/Filipino order text into a structured draft order',
    description:
      'Calls gpt-4o-mini to extract customer info and item codes/quantities from a pasted Facebook PM. ' +
      'Resolves codes against the product catalog and returns a validated draft ready for confirmation.',
  })
  @ApiResponse({ status: 200, description: 'Parsed draft order.' })
  @ApiResponse({ status: 400, description: 'Invalid request body.' })
  @ApiResponse({ status: 503, description: 'OPENAI_API_KEY not configured.' })
  parse(@Body() dto: ParseRequestDto) {
    return this.parser.parse(dto.text, dto.storeId);
  }
}
