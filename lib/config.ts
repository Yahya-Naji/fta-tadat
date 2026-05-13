// lib/config.ts
// Q Task — environment configuration. OpenAI Agents SDK + Azure OpenAI only.

/**
 * Application
 */
export const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
export const NODE_ENV = process.env.NODE_ENV ?? "development";

/**
 * Azure OpenAI — backs the OpenAI Agents SDK (gpt-4o-mini)
 */
export const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY!;
export const AZURE_OPENAI_BASE_URL = process.env.AZURE_OPENAI_BASE_URL!;
export const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION!;
export const AZURE_OPENAI_DEPLOYMENT_NAME = process.env.AZURE_OPENAI_DEPLOYMENT_NAME!;

/**
 * Feature flags
 */
export const NEXT_PUBLIC_DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "1";
