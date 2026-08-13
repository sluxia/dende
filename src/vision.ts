import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

export interface VisionRequest {
  prompt: string;
  base64: string;
  mimeType: string;
  /** JSON Schema to enforce via native structured output (Gemini only) */
  jsonSchema?: unknown;
}

export interface VisionResponse {
  text: string;
}

export interface VisionProvider {
  id: "gemini" | "mistral" | "groq";
  extract(request: VisionRequest): Promise<VisionResponse>;
}

const MAX_BASE64_LENGTH = 3_900_000; // Groq caps base64 payloads at 4 MB

/**
 * Shrinks oversized images (Groq's 4MB limit) and optionally caps the longest
 * side to keep vision token counts low on token-limited free tiers.
 */
async function prepareImage(
  base64: string,
  mimeType: string,
  maxDimension?: number
): Promise<{ base64: string; mimeType: string }> {
  let buffer = Buffer.from(base64, "base64");
  let mime = mimeType;

  const needs4mb = base64.length > MAX_BASE64_LENGTH;
  const needsSize = !!maxDimension;
  if (!needs4mb && !needsSize) {
    return { base64, mimeType };
  }

  if (maxDimension) {
    const meta = await sharp(buffer, { failOn: "none" }).metadata();
    const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (longest > maxDimension) {
      buffer = await sharp(buffer, { failOn: "none" })
        .resize({ width: maxDimension, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      mime = "image/jpeg";
    }
  }

  if (buffer.toString("base64").length > MAX_BASE64_LENGTH) {
    buffer = await sharp(buffer, { failOn: "none" })
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    mime = "image/jpeg";
  }

  return { base64: buffer.toString("base64"), mimeType: mime };
}

export class GeminiProvider implements VisionProvider {
  readonly id = "gemini" as const;
  private ai: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model = "gemini-2.5-flash") {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async extract(request: VisionRequest): Promise<VisionResponse> {
    const imagePart = {
      inlineData: { data: request.base64, mimeType: request.mimeType }
    };
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: [request.prompt, imagePart],
      config: {
        ...(request.jsonSchema
          ? {
              responseMimeType: "application/json",
              responseJsonSchema: request.jsonSchema
            }
          : {}),
        temperature: 0.1
      }
    });
    if (!response.text) {
      throw new Error("Gemini returned an empty response.");
    }
    return { text: response.text };
  }
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/**
 * Extracts a JSON object from model output that may contain markdown fences,
 * prose, or thinking blocks (<think>...</think>, e.g. qwen reasoning models).
 * Falls back to the raw text when no JSON is found.
 */
function extractJson(text: string): string {
  let clean = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const unclosedThink = clean.indexOf("<think");
  if (unclosedThink !== -1) {
    clean = clean.slice(0, unclosedThink);
  }
  const fenced = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : clean;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return candidate.slice(start, end + 1);
  }
  return clean;
}

interface ChatCompletionOptions {
  jsonMode?: boolean;
  /** OpenAI-style max_completion_tokens cap (Groq qwen thinking models need headroom) */
  maxTokens?: number;
  /** Cap the longest image side to keep vision token counts low */
  maxDimension?: number;
  /** Groq qwen: "none" switches to non-thinking mode; "hidden" returns only the final answer */
  reasoning?: { effort?: "none" | "low" | "medium" | "high"; format?: "hidden" | "parsed" };
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generic OpenAI-compatible vision client (used by Mistral and Groq).
 * Native JSON mode is tried first; if the provider rejects the response
 * (e.g. Groq's json_validate_failed on vision inputs), the request is retried
 * without it and the JSON is extracted from the raw output.
 */
async function chatCompletion(
  endpoint: string,
  apiKey: string,
  model: string,
  request: VisionRequest,
  options: ChatCompletionOptions = {},
  retryLeft = 2
): Promise<VisionResponse> {
  const jsonMode = options.jsonMode ?? true;
  const { base64, mimeType } = await prepareImage(request.base64, request.mimeType, options.maxDimension);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are an OCR/structured-extraction engine. Respond with ONLY a single valid JSON object that strictly follows the schema given by the user. No prose, no markdown, no code fences, no thinking blocks."
        },
        {
          role: "user",
          content: [
            { type: "text", text: request.prompt },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` }
            }
          ]
        }
      ],
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      ...(options.maxTokens ? { max_completion_tokens: options.maxTokens } : {}),
      ...(options.reasoning?.effort ? { reasoning_effort: options.reasoning.effort } : {}),
      ...(options.reasoning?.format ? { reasoning_format: options.reasoning.format } : {}),
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 429 && retryLeft > 0) {
      const retryAfterMs = Number(response.headers.get("retry-after")) * 1000 || 2000;
      console.warn(`⚠️ ${model} rate limited — retrying in ${Math.round(retryAfterMs / 1000)}s...`);
      await delay(retryAfterMs);
      return chatCompletion(endpoint, apiKey, model, request, options, retryLeft - 1);
    }
    if (jsonMode && response.status === 400 && body.includes("json_validate_failed")) {
      return chatCompletion(endpoint, apiKey, model, request, { ...options, jsonMode: false });
    }
    throw new Error(`${model} request failed (${response.status}): ${body.slice(0, 400)}`);
  }

  const json = (await response.json()) as ChatCompletionResponse;
  const text = json.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`${model} returned an empty response.`);
  }
  return { text: jsonMode ? text : extractJson(text) };
}

export class MistralProvider implements VisionProvider {
  readonly id = "mistral" as const;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "mistral-large-2512") {
    this.apiKey = apiKey;
    this.model = model;
  }

  extract(request: VisionRequest): Promise<VisionResponse> {
    return chatCompletion(
      "https://api.mistral.ai/v1/chat/completions",
      this.apiKey,
      this.model,
      request
    );
  }
}

export class GroqProvider implements VisionProvider {
  readonly id = "groq" as const;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "qwen/qwen3.6-27b") {
    this.apiKey = apiKey;
    this.model = model;
  }

  extract(request: VisionRequest): Promise<VisionResponse> {
    return chatCompletion(
      "https://api.groq.com/openai/v1/chat/completions",
      this.apiKey,
      this.model,
      request,
      {
        maxTokens: 4096,
        maxDimension: 1536,
        reasoning: { effort: "none", format: "hidden" }
      }
    );
  }
}
