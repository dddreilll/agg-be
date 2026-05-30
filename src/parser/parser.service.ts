import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Repository } from 'typeorm';
import type { Env } from '../config/env.validation';
import { Product } from '../database/entities/product.entity';

export interface ParsedItem {
  productId: string;
  productCode: string | null;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  notes: string | null;
}

export interface UnresolvedItem {
  rawText: string;
}

export interface ParsedDraft {
  customer: { name: string | null; contact: string | null; address: string | null };
  paymentMethod: 'CASH_ON_DELIVERY' | 'ONLINE_PAYMENT';
  items: ParsedItem[];
  unresolved: UnresolvedItem[];
  subtotalCents: number;
  grandTotalCents: number;
}

interface LlmItem {
  productId: string;
  quantity: number;
  notes?: string;
}

interface LlmResult {
  customer: { name?: string; contact?: string; address?: string };
  paymentMethod?: string;
  items: LlmItem[];
  unresolved: Array<{ rawText: string }>;
}

@Injectable()
export class ParserService {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async parse(text: string, storeId: string): Promise<ParsedDraft> {
    const apiKey = this.config.get('GEMINI_API_KEY', { infer: true });
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is not configured. Set it in your .env to enable order parsing.',
      );
    }
    const model = this.config.get('GEMINI_MODEL', { infer: true });

    const allProducts = await this.products.find({ where: { isAvailable: true } });

    const menu = allProducts.map((p) => ({
      id: p.id,
      code: p.productCode ?? null,
      name: p.name,
      priceCents: p.basePriceCents,
    }));

    const menuText = menu
      .map((p) => `  ${p.code ? `[${p.code}]` : '[-]'} ${p.name} — id:${p.id}`)
      .join('\n');

    const systemPrompt = `You are an order assistant for a Filipino food delivery business.
Extract order details from the customer's raw chat message.

Available menu (use product id as-is):
${menuText}

Rules:
- Match items by product code first (case-insensitive, e.g. "chk1" matches [CHK1]).
- If no code, match by product name (partial/Taglish is fine).
- If an item cannot be matched to any product, add it to unresolved.
- paymentMethod: "CASH_ON_DELIVERY" if cash/cod/bayad, "ONLINE_PAYMENT" otherwise. Default: "CASH_ON_DELIVERY".
- Return ONLY valid JSON, no markdown.

JSON schema:
{
  "customer": { "name": string|null, "contact": string|null, "address": string|null },
  "paymentMethod": "CASH_ON_DELIVERY" | "ONLINE_PAYMENT",
  "items": [{ "productId": string, "quantity": number, "notes": string? }],
  "unresolved": [{ "rawText": string }]
}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
      generationConfig: { responseMimeType: 'application/json' },
    });
    const geminiResponse = await geminiModel.generateContent(text);
    const rawContent = geminiResponse.response.text();
    let llm: LlmResult;
    try {
      llm = JSON.parse(rawContent) as LlmResult;
    } catch {
      llm = { customer: {}, items: [], unresolved: [] };
    }

    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    const resolvedItems: ParsedItem[] = [];
    const unresolvedItems: UnresolvedItem[] = [...(llm.unresolved ?? [])];

    for (const llmItem of llm.items ?? []) {
      const product = productMap.get(llmItem.productId);
      if (!product) {
        unresolvedItems.push({ rawText: llmItem.productId });
        continue;
      }
      const qty = Math.max(1, Math.round(llmItem.quantity ?? 1));
      resolvedItems.push({
        productId: product.id,
        productCode: product.productCode ?? null,
        productName: product.name,
        quantity: qty,
        unitPriceCents: product.basePriceCents,
        lineTotalCents: product.basePriceCents * qty,
        notes: llmItem.notes ?? null,
      });
    }

    const subtotalCents = resolvedItems.reduce((s, i) => s + i.lineTotalCents, 0);

    return {
      customer: {
        name: llm.customer?.name ?? null,
        contact: llm.customer?.contact ?? null,
        address: llm.customer?.address ?? null,
      },
      paymentMethod:
        llm.paymentMethod === 'ONLINE_PAYMENT' ? 'ONLINE_PAYMENT' : 'CASH_ON_DELIVERY',
      items: resolvedItems,
      unresolved: unresolvedItems,
      subtotalCents,
      grandTotalCents: subtotalCents,
    };
  }
}
