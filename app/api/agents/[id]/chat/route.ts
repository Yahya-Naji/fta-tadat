/**
 * POST /api/agents/[id]/chat — streamed chat with a single agent.
 *
 * Body: { messages: [{role, content}], parsed?: object, inputs?: any }
 *
 * The client passes its own conversation history + the agent's latest
 * parsed JSON (and the pre-aggregate SQL inputs the agent received).
 * The server builds a per-persona system prompt with that context and
 * the TADAT 2025 indicator definitions for the agent's POA, then proxies
 * the chat-completion call to Azure OpenAI with `stream: true` and pipes
 * the deltas back as Server-Sent Events.
 *
 *   event: token   data: {"v": "..."}     — every delta
 *   event: done    data: {}               — final
 *   event: fatal   data: {"error": "..."} — bad request / upstream fail
 */
import { NextRequest } from "next/server";
import OpenAI from "openai";

import {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_BASE_URL,
  AZURE_OPENAI_DEPLOYMENT_NAME,
} from "@/lib/config";
import type { AgentId } from "@/lib/personas";
import { buildChatSystemPrompt } from "@/lib/agents/chat-prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID: AgentId[] = ["registry", "risk", "service", "filing", "payments"];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatBody {
  messages?: ChatMessage[];
  parsed?: Record<string, unknown> | null;
  inputs?: unknown;
}

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!VALID.includes(id as AgentId)) {
    return new Response(
      sse("fatal", { error: `Unknown agent id: ${id}` }),
      {
        status: 400,
        headers: { "Content-Type": "text/event-stream" },
      },
    );
  }
  const agentId = id as AgentId;

  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return new Response(sse("fatal", { error: "invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const messages = body.messages ?? [];
  if (messages.length === 0) {
    return new Response(sse("fatal", { error: "no messages provided" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const system = buildChatSystemPrompt({
    agentId,
    parsed: body.parsed ?? null,
    inputs: body.inputs ?? null,
  });

  // Stream from Azure OpenAI.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sse(event, data)));
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 15_000);

      try {
        const client = new OpenAI({
          apiKey: AZURE_OPENAI_API_KEY,
          baseURL: AZURE_OPENAI_BASE_URL,
          defaultQuery: { "api-version": AZURE_OPENAI_API_VERSION },
          defaultHeaders: { "api-key": AZURE_OPENAI_API_KEY },
        });

        const completion = await client.chat.completions.create({
          model: AZURE_OPENAI_DEPLOYMENT_NAME,
          temperature: 0.2,
          stream: true,
          messages: [
            { role: "system", content: system },
            ...messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          ],
        });

        for await (const chunk of completion) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) send("token", { v: delta });
        }
        send("done", {});
      } catch (e) {
        send("fatal", { error: (e as Error).message });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
