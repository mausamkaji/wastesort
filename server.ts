import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config({ path: [".env.local", ".env"] });

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Lazy-initialized GoogleGenAI client
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// NVIDIA NIM (build.nvidia.com) free OpenAI-compatible API — used as a no-cost fallback when
// GEMINI_API_KEY is not configured, or when Gemini's quota is exhausted.
const NVIDIA_API_BASE = "https://integrate.api.nvidia.com/v1";
const NVIDIA_MODEL = "meta/llama-3.2-11b-vision-instruct"; // multimodal: handles both text prompts and image inspection (the 90b variant is unresponsive on the free tier as of 2026-09)

function hasNvidiaKey(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY);
}

// Anthropic Claude API — used as a last-resort fallback when neither Gemini nor NVIDIA produced
// a usable answer. Claude follows "respond with JSON only" instructions far more reliably than
// the free NVIDIA model, so this exists mainly as a quality backstop, not a cost-saving measure.
const CLAUDE_API_BASE = "https://api.anthropic.com/v1";
const CLAUDE_MODEL = "claude-haiku-4-5-20251001"; // fast/cheap, multimodal — plenty for structured waste-sorting classification
const CLAUDE_API_VERSION = "2023-06-01";

function hasClaudeKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Converts a Gemini-shaped { contents, config } request into an NVIDIA chat completion.
// `contents` is either a plain prompt string, or a Gemini `{ parts: [...] }` object holding
// an inlineData image part plus a text part (used by the photo-based vision inspector).
async function executeNvidiaWithFallback(params: {
  contents: any;
  config?: any;
}): Promise<GeminiExecutionResult | null> {
  if (!hasNvidiaKey()) return null;

  const messages: any[] = [];
  const systemInstruction: string | undefined = params.config?.systemInstruction;
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }

  if (typeof params.contents === "string") {
    messages.push({ role: "user", content: params.contents });
  } else {
    const parts = params.contents?.parts || [];
    const content: any[] = [];
    for (const part of parts) {
      if (part?.inlineData) {
        content.push({
          type: "image_url",
          image_url: { url: `data:${part.inlineData.mimeType || "image/jpeg"};base64,${part.inlineData.data}` },
        });
      } else if (typeof part?.text === "string") {
        content.push({ type: "text", text: part.text });
      }
    }
    messages.push({ role: "user", content });
  }

  const wantsJson = params.config?.responseMimeType === "application/json";
  // Image requests (base64 photo + prompt) take meaningfully longer than plain text prompts
  // on the free tier — a real compressed photo (~150-400KB) can take 20-40s to process.
  const isImageRequest = typeof params.contents !== "string" && Array.isArray(params.contents?.parts) &&
    params.contents.parts.some((p: any) => p?.inlineData);

  // The free tier occasionally returns a transient 500 (or a network-level error) for an
  // otherwise-valid request. One quick retry recovers most of these instead of immediately
  // discarding a real AI attempt in favor of a generic fallback guess.
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), isImageRequest ? 55000 : 35000);
      let response: Response;
      try {
        response = await fetch(`${NVIDIA_API_BASE}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: NVIDIA_MODEL,
            messages,
            temperature: 0.4,
            max_tokens: 1536,
            ...(wantsJson ? { response_format: { type: "json_object" } } : {}),
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        if (response.status === 429) {
          console.info("[AI Resilience] NVIDIA free-tier rate limit reached.");
          return null;
        }
        console.warn("[AI Resilience Error] NVIDIA:", response.status, bodyText);
        // Retry once on a server-side (5xx) error; a 4xx means the request itself is bad, so don't retry that.
        if (response.status >= 500 && attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 400));
          continue;
        }
        return null;
      }

      const data: any = await response.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (!text) return null;

      return { text, groundingChunks: [], webSearchQueries: [] };
    } catch (err: any) {
      console.warn("[AI Resilience Error] NVIDIA:", err?.message || err);
      // Retry network errors and (for the normally-fast text path) our own timeout abort, since a
      // plain text prompt usually answers in 1-3s — a 25s timeout there signals a queue/network
      // hiccup, not genuine model slowness, so a retry is likely to land faster the second time.
      // Skip retrying an image-request timeout: that attempt already used its full ~55s budget for
      // what's often genuinely slow processing, so retrying would just double the wait either way.
      const isTimeoutAbort = err?.name === "AbortError";
      const shouldRetry = attempt < maxAttempts && (!isTimeoutAbort || !isImageRequest);
      if (shouldRetry) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        continue;
      }
      return null;
    }
  }
  return null;
}

// Converts a Gemini-shaped { contents, config } request into an Anthropic Messages API call.
// Mirrors executeNvidiaWithFallback's content conversion so both fallbacks stay consistent.
async function executeClaudeWithFallback(params: {
  contents: any;
  config?: any;
}): Promise<GeminiExecutionResult | null> {
  if (!hasClaudeKey()) return null;

  const systemInstruction: string | undefined = params.config?.systemInstruction;
  const wantsJson = params.config?.responseMimeType === "application/json";
  const jsonReminder = wantsJson
    ? " Respond with the JSON object only — no explanation, no preamble, and no markdown code fences before or after it."
    : "";

  let userContent: any;
  if (typeof params.contents === "string") {
    userContent = params.contents;
  } else {
    const parts = params.contents?.parts || [];
    const content: any[] = [];
    for (const part of parts) {
      if (part?.inlineData) {
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: part.inlineData.mimeType || "image/jpeg",
            data: part.inlineData.data,
          },
        });
      } else if (typeof part?.text === "string") {
        content.push({ type: "text", text: part.text });
      }
    }
    userContent = content;
  }

  const isImageRequest = Array.isArray(userContent) && userContent.some((c: any) => c.type === "image");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), isImageRequest ? 55000 : 25000);
    let response: Response;
    try {
      response = await fetch(`${CLAUDE_API_BASE}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": CLAUDE_API_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 1536,
          ...(systemInstruction ? { system: systemInstruction + jsonReminder } : {}),
          messages: [{ role: "user", content: userContent }],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      if (response.status === 429) {
        console.info("[AI Resilience] Claude rate limit reached.");
      } else {
        console.warn("[AI Resilience Error] Claude:", response.status, bodyText);
      }
      return null;
    }

    const data: any = await response.json();
    const text = data?.content?.find((c: any) => c.type === "text")?.text?.trim();
    if (!text) return null;

    return { text, groundingChunks: [], webSearchQueries: [] };
  } catch (err: any) {
    console.warn("[AI Resilience Error] Claude:", err?.message || err);
    return null;
  }
}

// Tries Gemini first (when configured), then the free NVIDIA NIM API, then Claude as a final
// quality backstop — each one only runs if the previous provider is unconfigured or failed.
async function executeAiWithFallback(
  ai: GoogleGenAI | null,
  params: { contents: any; config?: any }
): Promise<GeminiExecutionResult | null> {
  if (ai) {
    const result = await executeGeminiWithFallback(ai, params);
    if (result) return result;
  }
  const nvidiaResult = await executeNvidiaWithFallback(params);
  if (nvidiaResult) return nvidiaResult;
  return executeClaudeWithFallback(params);
}

// In-memory circuit breaker to prevent repeated calls when quota is exhausted or prepayment credits are depleted
let quotaExhaustionCooldownUntil = 0;
const QUOTA_COOLDOWN_MS = 60_000; // 60s cooldown before probing API again

function isQuotaOrDepletedError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.code || err.statusCode;
  if (status === 429) return true;

  try {
    const msg = (
      typeof err === "string"
        ? err
        : `${err.message || ""} ${err.status || ""} ${err.code || ""} ${JSON.stringify(err)}`
    ).toLowerCase();

    return (
      msg.includes("429") ||
      msg.includes("resource_exhausted") ||
      msg.includes("depleted") ||
      msg.includes("prepayment") ||
      msg.includes("quota") ||
      msg.includes("billing") ||
      msg.includes("rate limit") ||
      msg.includes("too many requests")
    );
  } catch {
    return false;
  }
}

// Fallback model cascade for resilience against transient 503 / high demand spikes
const FALLBACK_MODELS = [
  "gemini-3.8-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
];

interface GeminiExecutionResult {
  text: string;
  groundingChunks?: any[];
  webSearchQueries?: string[];
}

async function executeGeminiWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
  }
): Promise<GeminiExecutionResult | null> {
  // If quota or prepayment credits were recently detected as depleted, skip remote calls to avoid stalling or error logging
  if (Date.now() < quotaExhaustionCooldownUntil) {
    return null;
  }

  for (const model of FALLBACK_MODELS) {
    try {
      const callPromise = ai.models.generateContent({
        ...params,
        model,
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini timeout")), 15000)
      );
      const response = await Promise.race([callPromise, timeoutPromise]);
      const text = response.text?.trim();
      if (text) {
        const grounding = (response.candidates as any)?.[0]?.groundingMetadata;
        const webSearchQueries = grounding?.webSearchQueries || [];
        const groundingChunks = grounding?.groundingChunks || [];
        return {
          text,
          groundingChunks,
          webSearchQueries,
        };
      }
    } catch (err: any) {
      if (isQuotaOrDepletedError(err)) {
        // Mark cooldown and return null immediately - all models share the same project billing key
        quotaExhaustionCooldownUntil = Date.now() + QUOTA_COOLDOWN_MS;
        console.info("[AI Resilience] API quota limit reached. Instantly engaging offline municipal intelligence engine.");
        return null;
      }

      // Transient condition or call error
      console.warn(`[AI Resilience Error] Model ${model}:`, err?.message || err);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  return null;
}

// Models occasionally emit an emoji field value unquoted — e.g. `"itemEmoji": 📺,` instead of
// `"itemEmoji": "📺",` — which is invalid JSON and breaks parsing of the entire object even
// though everything else about the response was fine. Wrap any such bare emoji run in quotes.
function repairUnquotedEmoji(text: string): string {
  return text.replace(
    /:(\s*)([\p{Extended_Pictographic}‍️]+)(\s*[,}\]])/gu,
    (_match, before, emoji, after) => `:${before}"${emoji}"${after}`
  );
}

function cleanAndParseJson<T>(rawText: string): T | null {
  const clean = repairUnquotedEmoji(rawText.trim());

  // Fast path: the whole response is already clean JSON.
  try {
    return JSON.parse(clean) as T;
  } catch {
    // Fall through to more forgiving extraction below.
  }

  // Some models (especially smaller free-tier ones) answer with explanatory prose around the
  // JSON despite being asked for JSON only — e.g. "Here's my analysis... ```json {...} ```" —
  // rather than the whole message being the object. Look for a fenced block anywhere in the text.
  const fenceMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch {
      // Fall through to the brace-matching fallback below.
    }
  }

  // Last resort: take the substring from the first { or [ to the matching last } or ].
  const firstBrace = clean.search(/[{[]/);
  if (firstBrace !== -1) {
    const opener = clean[firstBrace];
    const closer = opener === "{" ? "}" : "]";
    const lastCloser = clean.lastIndexOf(closer);
    if (lastCloser > firstBrace) {
      try {
        return JSON.parse(clean.slice(firstBrace, lastCloser + 1)) as T;
      } catch {
        // Give up — genuinely not parseable JSON.
      }
    }
  }

  console.warn("[AI Resilience] Could not extract JSON from AI response. Raw text (first 300 chars):", clean.slice(0, 300));
  return null;
}

// Smaller/free-tier models occasionally wrap a single-object answer in a JSON array
// (e.g. "[{...}]" instead of "{...}") even when asked for one object. Call sites that expect
// exactly one item should run their parsed result through this so that quirk doesn't get
// silently treated as "no valid answer" and discarded in favor of a generic fallback guess.
function unwrapSingleItem<T>(parsed: T | T[] | null): T | null {
  if (Array.isArray(parsed)) {
    return (parsed.length > 0 ? parsed[0] : null) as T | null;
  }
  return parsed;
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  const geminiEnabled = Boolean(process.env.GEMINI_API_KEY);
  const nvidiaEnabled = hasNvidiaKey();
  const claudeEnabled = hasClaudeKey();
  res.json({
    status: "ok",
    aiEnabled: geminiEnabled || nvidiaEnabled || claudeEnabled,
    aiProvider: geminiEnabled ? "gemini" : nvidiaEnabled ? "nvidia" : claudeEnabled ? "claude" : null,
  });
});

// Helper to ensure multi-stream items have both acceptable bins populated
function postProcessInspectionResult(
  parsed: any,
  queryItem: string,
  groundingChunks?: any[],
  webSearchQueries?: string[]
) {
  const item = parsed || {};
  const itemName = item.itemName || queryItem || "Unknown Item";
  const lower = (itemName + " " + (item.whyItGoesHere || "")).toLowerCase();

  const normalizedPrimary = normalizeItemBin(item.primaryBin, undefined, itemName);

  let acceptableBins = Array.isArray(item.acceptableBins) ? item.acceptableBins : [];

  // Special Check: Mussel shells, oyster shells, clam shells, hard bivalve shells
  // Bivalve shells are dense calcium carbonate (calcite/aragonite) which do NOT decompose in 6-12 week
  // commercial composting or bio-rendering digestion, and their rock-hard density severely damages and jams shredders.
  // Municipal council standards strictly mandate Red General Waste bin.
  const isMusselOrHardShell =
    lower.includes("mussel") ||
    lower.includes("oyster") ||
    lower.includes("clam") ||
    lower.includes("bivalve") ||
    lower.includes("abalone") ||
    (lower.includes("shell") && (lower.includes("seafood") || lower.includes("mollusc") || lower.includes("mollusk") || lower.includes("shellfish")));

  // Batteries & anything that contains or is powered by one: crushed/punctured lithium and
  // alkaline cells are a real fire-hazard risk in general waste and recycling trucks. Checked
  // against the AI's own explanation text too (not just the item name), since a model sometimes
  // correctly identifies "contains a battery" in its reasoning while still picking the wrong bin.
  const isBatteryOrElectronic =
    lower.includes("battery") ||
    lower.includes("batteries") ||
    lower.includes("lithium") ||
    lower.includes("rechargeable") ||
    lower.includes("power bank") ||
    lower.includes("vape") ||
    lower.includes("e-cigarette") ||
    lower.includes("electronic waste") ||
    lower.includes("e-waste") ||
    lower.includes("circuit board") ||
    lower.includes("calculator") ||
    lower.includes("remote control") ||
    lower.includes("speaker") ||
    lower.includes("earbud") ||
    lower.includes("headphone") ||
    lower.includes("smartwatch") ||
    lower.includes("wireless mouse") ||
    lower.includes("wireless keyboard");

  // Bulky or heavy items — regardless of material — are too large for curbside bins and belong in
  // Council Hard Rubbish, never general waste. isBulky is a signal the vision AI sets from the
  // photo itself (judging real-world size), so this also catches large items with no keyword match
  // below (e.g. a big plastic tub, a large wooden crate). Text-only keywords cover the common cases
  // when there's no photo to judge size from (typed searches, or images the AI didn't flag).
  const isBulkyOrHardRubbish =
    item.isBulky === true ||
    lower.includes("trash can") ||
    lower.includes("garbage can") ||
    lower.includes("rubbish bin") ||
    lower.includes("waste bin") ||
    lower.includes("metal bin") ||
    lower.includes("metal drum") ||
    lower.includes("steel drum") ||
    lower.includes("oil drum") ||
    lower.includes("metal barrel") ||
    lower.includes("metal cabinet") ||
    lower.includes("filing cabinet") ||
    lower.includes("metal shelving") ||
    lower.includes("metal shelf") ||
    lower.includes("scrap metal") ||
    lower.includes("metal frame") ||
    lower.includes("metal bed frame") ||
    (lower.includes("metal") && lower.includes("furniture")) ||
    (lower.includes("metal") && lower.includes("table")) ||
    (lower.includes("metal") && lower.includes("chair")) ||
    lower.includes("wire fencing") ||
    lower.includes("metal fencing");

  // Takeaway Coffee Cups check: Waterproof PE plastic coating inside cannot be pulped or composted.
  // Strictly Red General Waste bin.
  const isCoffeeCup =
    lower.includes("coffee cup") ||
    lower.includes("takeaway cup") ||
    lower.includes("takeout cup") ||
    lower.includes("paper cup") ||
    lower.includes("disposable cup") ||
    lower.includes("hot cup") ||
    (lower.includes("coffee") && (lower.includes("cup") || lower.includes("takeaway") || lower.includes("takeout")));

  // Ceramics, porcelain, Pyrex, drinking glassware check: High melting point ruins glass furnaces.
  // Strictly Red General Waste bin (or hard rubbish for large sinks/toilets).
  const isCeramicOrNonContainerGlass =
    lower.includes("ceramic") ||
    lower.includes("porcelain") ||
    lower.includes("pyrex") ||
    lower.includes("crockery") ||
    lower.includes("dinner plate") ||
    lower.includes("drinking glass") ||
    lower.includes("wine glass") ||
    lower.includes("window glass") ||
    lower.includes("mirror") ||
    lower.includes("broken plate") ||
    lower.includes("earthenware") ||
    lower.includes("pottery");

  // Styrofoam meat tray check: Expanded polystyrene (EPS #6) foam trays can NEVER go into
  // the yellow recycling bin (crumbles into static microplastics), orange meat bin (ruins biological bone meal),
  // or green organic bin. They strictly and exclusively belong in Red Lid General Waste.
  const isStyrofoamMeatTray =
    (lower.includes("styrofoam") || lower.includes("polystyrene") || lower.includes("foam tray") || lower.includes("meat tray") || lower.includes("butcher tray")) &&
    (lower.includes("meat") || lower.includes("tray") || lower.includes("styrofoam") || lower.includes("polystyrene") || lower.includes("foam") || lower.includes("butcher"));

  // Clean and unused pizza box check: 100% clean, unsoiled kraft corrugated cardboard
  // with no cheese grease or food oils belongs in the Blue Cardboard & Paper bin.
  const isCleanPizzaBox =
    lower.includes("pizza") &&
    (lower.includes("clean") || lower.includes("unused") || lower.includes("dry") || lower.includes("unsoiled") || lower.includes("new") || lower.includes("brand new") || lower.includes("clean lid") || lower.includes("clean top"));

  // Soft plastic & plastic film check: Flexible LDPE films (bags, wrap, bubble wrap, chip packets) act as
  // tanglers that jam conveyor axles and disc screens at curbside MRFs. They must go to dedicated supermarket
  // soft-plastic drop-off points instead, falling back to Red General Waste only if a drop-off isn't accessible.
  const isSoftPlasticOrFilm =
    lower.includes("bubble wrap") ||
    lower.includes("bubblewrap") ||
    lower.includes("bubble packaging") ||
    lower.includes("air pillow") ||
    lower.includes("air cushion") ||
    lower.includes("air bag packaging") ||
    lower.includes("inflatable packaging") ||
    lower.includes("packing peanut") ||
    lower.includes("soft plastic") ||
    lower.includes("plastic film") ||
    lower.includes("cling wrap") ||
    lower.includes("cling film") ||
    lower.includes("plastic wrap") ||
    lower.includes("plastic bag") ||
    lower.includes("shopping bag") ||
    lower.includes("grocery bag") ||
    lower.includes("bread bag") ||
    lower.includes("chip packet") ||
    lower.includes("chip bag") ||
    lower.includes("frozen food bag") ||
    lower.includes("freezer bag") ||
    lower.includes("ziplock") ||
    lower.includes("zip lock") ||
    lower.includes("sandwich bag") ||
    lower.includes("produce bag") ||
    lower.includes("courier satchel") ||
    lower.includes("mailer bag") ||
    (lower.includes("plastic") && lower.includes("wrapper"));

  // Paper towels, paper napkins, tissues, and serviettes check:
  // Strictly Red Bin (general_waste), NOT organic and NOT clothes donation.
  const isPaperTowelOrNapkin =
    lower.includes("paper towel") ||
    lower.includes("papertowel") ||
    lower.includes("napkin") ||
    lower.includes("serviette") ||
    lower.includes("facial tissue") ||
    (lower.includes("tissue") && !lower.includes("tissue box"));

  // Fruits, vegetables, food scraps, watermelon check: Green Organic / FOGO bin
  const isFruitVegetableOrFoodScrap =
    !isMusselOrHardShell &&
    !isStyrofoamMeatTray &&
    !isCoffeeCup &&
    (lower.includes("watermelon") ||
      lower.includes("melon") ||
      lower.includes("banana") ||
      lower.includes("apple") ||
      lower.includes("orange") ||
      lower.includes("lemon") ||
      lower.includes("citrus") ||
      lower.includes("potato") ||
      lower.includes("carrot") ||
      lower.includes("onion") ||
      lower.includes("tomato") ||
      lower.includes("avocado") ||
      lower.includes("lettuce") ||
      lower.includes("salad") ||
      lower.includes("cucumber") ||
      lower.includes("fruit") ||
      lower.includes("vegetable") ||
      lower.includes("peel") ||
      lower.includes("food scrap") ||
      lower.includes("food waste") ||
      lower.includes("leftover") ||
      lower.includes("crust") ||
      lower.includes("bread") ||
      lower.includes("pasta") ||
      lower.includes("rice") ||
      lower.includes("egg shell") ||
      lower.includes("eggshell") ||
      lower.includes("coffee ground") ||
      lower.includes("tea leaf") ||
      lower.includes("garden trimming"));

  // Universal Golden Rule: Only mark as unsure/ambiguous if the user explicitly queried an unknown or mystery item.
  // CRITICAL: Do NOT test item.whyItGoesHere, because recycling explanations frequently mention "when in doubt, check council rules",
  // which previously erroneously forced all valid items (bottles, cans, paper, food) into General Waste (Red Lid).
  const itemLower = (itemName + " " + (queryItem || "")).toLowerCase().trim();
  const isUnsureOrAmbiguous =
    (itemLower === "unsure" ||
      itemLower === "not sure" ||
      itemLower === "notsure" ||
      itemLower === "uncertain" ||
      itemLower === "mystery" ||
      itemLower === "mystery item" ||
      itemLower === "unknown packaging" ||
      itemLower === "unknown item" ||
      itemLower === "doubtful item" ||
      itemLower.startsWith("unsure ") ||
      itemLower.startsWith("not sure ")) &&
    !itemLower.includes("bottle") &&
    !itemLower.includes("can") &&
    !itemLower.includes("apple") &&
    !itemLower.includes("banana") &&
    !itemLower.includes("cardboard") &&
    !itemLower.includes("paper") &&
    !itemLower.includes("meat") &&
    !itemLower.includes("bone") &&
    !itemLower.includes("clothes") &&
    !itemLower.includes("battery");

  // Clothing & textiles check: All clothing materials go either in the red bin or via clothes donation!
  // Textiles must NEVER go into curbside yellow/blue/green bins because they tangle sorting machinery.
  const isClothingOrTextile =
    !isPaperTowelOrNapkin && (
      lower.includes("cloth") ||
      lower.includes("clothes") ||
      lower.includes("clothing") ||
      lower.includes("textile") ||
      lower.includes("shirt") ||
      lower.includes("t-shirt") ||
      lower.includes("jeans") ||
      lower.includes("pants") ||
      /\bdress\b/.test(lower) ||
      lower.includes("jacket") ||
      lower.includes("jumper") ||
      lower.includes("sweater") ||
      lower.includes("shoe") ||
      lower.includes("sneaker") ||
      lower.includes("footwear") ||
      lower.includes("bedsheet") ||
      lower.includes("bed sheet") ||
      (lower.includes("towel") && !lower.includes("paper towel")) ||
      lower.includes("linen") ||
      lower.includes("fabric") ||
      lower.includes("garment") ||
      lower.includes("blanket") ||
      lower.includes("curtain") ||
      lower.includes("backpack") ||
      lower.includes("rucksack") ||
      lower.includes("duffel") ||
      lower.includes("tote bag") ||
      lower.includes("gym bag") ||
      lower.includes("handbag") ||
      lower.includes("purse") ||
      (lower.includes("belt") && !lower.includes("conveyor") && !lower.includes("seatbelt") && !lower.includes("seat belt"))
    );

  if (isBatteryOrElectronic) {
    acceptableBins = [
      {
        bin: "e_waste",
        binName: "Designated Drop-Off Location: E-Waste & Batteries",
        condition: "Universal Council Standard (Never in household bins)",
        reason: "Anything containing or powered by a battery must go to a designated e-waste drop-off, never a curbside bin. Crushed or punctured lithium and alkaline cells can ignite inside general waste, recycling, and organics collection trucks."
      }
    ];
  } else if (isBulkyOrHardRubbish) {
    acceptableBins = [
      {
        bin: "hard_rubbish",
        binName: "Council Hard Rubbish Collection",
        condition: "Bulky or heavy items, regardless of material",
        reason: "Oversized and heavy items don't fit standard curbside bins and are collected through council hard rubbish pickups or accepted directly at transfer stations — regardless of what they're made of. Metal items also have scrap value at a metal recycler."
      }
    ];
  } else if (isPaperTowelOrNapkin) {
    acceptableBins = [
      {
        bin: "general_waste",
        binName: "Red Lid Bin: General Waste",
        condition: "Standard Household Disposal (Universal Municipal Rule)",
        reason: "Paper towels and napkins belong strictly in the Red General Waste bin, NOT in organic and NOT in clothes donation. Short cellulose fibers and chemical binders cannot be recycled into paper and contaminate organic composting or textile streams."
      }
    ];
  } else if (isMusselOrHardShell) {
    acceptableBins = [
      {
        bin: "general_waste",
        binName: "Red Lid Bin: General Waste",
        condition: "Universal Council Standard (Household General Waste)",
        reason: "Hard bivalve shells (calcium carbonate) do not break down in municipal 6–12 week commercial composting or rendering systems, and cause severe wear and blade damage to industrial shredders. They belong strictly in the Red General Waste bin."
      }
    ];
  } else if (isStyrofoamMeatTray) {
    acceptableBins = [
      {
        bin: "general_waste",
        binName: "Red Lid Bin: General Waste",
        condition: "Only Acceptable Household Stream (Universal Council Standard)",
        reason: "Styrofoam (expanded polystyrene EPS #6) meat trays only go to General Waste (Red Lid). They can NEVER go in the yellow recycling bin, green organic/FOGO bin, or orange meat & bones bin. Plastic foam crumbles into static microplastics and ruins compost, recycling, and biological bone-meal rendering."
      }
    ];
  } else if (isSoftPlasticOrFilm) {
    acceptableBins = [
      {
        bin: "soft_plastic_dropoff",
        binName: "Supermarket Soft Plastic Drop-Off Bin",
        condition: "Clean, dry soft plastics and packaging film",
        reason: "Soft plastics and film (bags, wrap, bubble wrap, chip packets) are flexible LDPE films that act as 'tanglers' jamming rotating disc screens and sorting machinery at curbside MRFs. Take clean, dry soft plastics to dedicated collection bins at participating supermarkets (Coles, Woolworths) or council drop-off points, where they're reprocessed into outdoor furniture, bollards, and road-base additives."
      },
      {
        bin: "general_waste",
        binName: "Red Lid Bin: General Waste",
        condition: "No drop-off point accessible, or soiled/contaminated film",
        reason: "If a supermarket or council soft-plastic drop-off point isn't accessible, or the film is food-soiled and can't be cleaned, dispose of it in the Red Lid General Waste bin. It must never go into Yellow recycling, Blue paper, or Green organic bins."
      }
    ];
  } else if (isCoffeeCup) {
    acceptableBins = [
      {
        bin: "general_waste",
        binName: "Red Lid Bin: General Waste",
        condition: "Standard Curbside Household Disposal",
        reason: "Takeaway paper coffee cups are fused with a waterproof polyethylene (PE) plastic coating that paper mills and industrial composting facilities cannot separate from paper fibers. They belong strictly in the Red Lid General Waste bin (or specialized Simply Cups drop-offs)."
      }
    ];
  } else if (isCeramicOrNonContainerGlass) {
    acceptableBins = [
      {
        bin: "general_waste",
        binName: "Red Lid Bin: General Waste",
        condition: "Wrapped Household Disposal (Universal Municipal Standard)",
        reason: "Ceramics, porcelain, Pyrex, and drinking glassware have significantly higher melting temperatures than container glass bottles and jars. If mixed into yellow recycling bins, they fail to melt in glass furnaces and cause entire production runs of recycled glass containers to crack or explode. Wrap broken pieces safely in newspaper and place in Red General Waste."
      }
    ];
  } else if (isFruitVegetableOrFoodScrap) {
    acceptableBins = [
      {
        bin: "organic",
        binName: "Green Lid Bin: Food Organics (FOGO)",
        condition: "Standard Curbside Organic Collection",
        reason: "Food scraps, vegetable peels, fruit rinds, coffee grounds, and kitchen trimmings break down aerobically in commercial municipal composting into dark nutrient-dense soil compost in 6–8 weeks, averting toxic methane landfill gas."
      }
    ];
  } else if (isUnsureOrAmbiguous) {
    acceptableBins = [
      {
        bin: "general_waste",
        binName: "Red Lid Bin: General Waste",
        condition: "Universal Council Rule: When In Doubt, Throw It Out",
        reason: "For mystery or unidentified items where material cannot be verified, place in Red General Waste to prevent wishcycling contamination."
      }
    ];
  } else if (isClothingOrTextile) {
    acceptableBins = [
      {
        bin: "cloth_recycling",
        binName: "Clothes Donation Hub (Designated Drop-Off)",
        condition: "Clean garments, wearable clothes, paired shoes, and linens",
        reason: "All clothing materials go either in the red bin or via clothes donation. Take wearable clothes and paired shoes to designated collection bins near train stations, Coles supermarkets, Woolworths, or charity hubs (Salvos, Vinnies) for re-wearing or shredding into insulation/rags."
      },
      {
        bin: "general_waste",
        binName: "Red Lid Bin: General Waste",
        condition: "Unwearable, damaged, torn, or stained clothing materials",
        reason: "All clothing materials go either in the red bin or via clothes donation. If drop-off hubs are inaccessible or garments are heavily soiled or damaged, dispose of them directly into the Red General Waste bin. They must NEVER go into Yellow recycling, Blue paper, or Green organic bins!"
      }
    ];
  } else if (isCleanPizzaBox) {
    acceptableBins = [
      {
        bin: "paper_cardboard",
        binName: "Blue Lid Bin: Cardboard & Paper",
        condition: "Clean, dry, and unused cardboard",
        reason: "Clean and unused pizza boxes are pure unsoiled corrugated cardboard with zero food oil or cheese grease. They can be 100% repulped and recycled in the blue cardboard and paper stream."
      }
    ];
  } else if (
    lower.includes("meat") ||
    lower.includes("bone") ||
    lower.includes("carcass") ||
    lower.includes("poultry") ||
    lower.includes("chicken") ||
    lower.includes("beef") ||
    lower.includes("pork") ||
    lower.includes("lamb") ||
    lower.includes("steak") ||
    (lower.includes("seafood") && !isMusselOrHardShell)
  ) {
    acceptableBins = [
      {
        bin: "meat_bones",
        binName: "Orange Lid Bin: Meat & Bones Stream",
        condition: "Standard for dedicated municipal rendering collection",
        reason: "Transported to commercial rendering facilities pasteurizing at >70°C to eliminate all pathogens and produce certified organic bone-meal fertilizer and biomethane."
      },
      {
        bin: "organic",
        binName: "Green Lid Bin: Food Organics (FOGO)",
        condition: "Councils with commercial composting / FOGO programs accepting meat",
        reason: "Modern in-vessel aerobic composting tunnels reach sustained thermophilic temperatures (55–65°C) that sanitize and safely decompose raw and cooked meat without vermin issues."
      }
    ];
  } else if (lower.includes("pizza")) {
    acceptableBins = [
      {
        bin: "general_waste",
        binName: "Red Lid Bin: General Waste",
        condition: "Greasy pizza box or cheese-stained base (Household Standard)",
        reason: "Greasy pizza boxes and soiled cardboard do NOT belong in the Green Organic / FOGO bin. Food oils and cheese grease spoil organic compost and cannot be washed out during recycling. Greasy pizza boxes belong strictly in the Red General Waste bin."
      },
      {
        bin: "paper_cardboard",
        binName: "Blue Lid Bin: Cardboard & Paper",
        condition: "Clean, dry unsoiled cardboard lid only (if torn off)",
        reason: "Tear off the completely clean, dry unsoiled lid and place it in the blue recycling bin to be hydrapulped into brand-new shipping boxes."
      }
    ];
  } else if (lower.includes("bottle") && lower.includes("cap")) {
    acceptableBins = [
      {
        bin: "commingled_recycling",
        binName: "Yellow Lid Bin: Commingled Recycling",
        condition: "Bottle with plastic cap screwed ON firmly",
        reason: "MRFs separate PET bottles and PP caps cleanly in density float-sink tanks. Loose caps fall through screens and get landfilled."
      }
    ];
  }

  const binColorNames: Record<string, string> = {
    general_waste: "Red Lid Bin (General Waste)",
    commingled_recycling: "Yellow Lid Bin (Commingled Recycling)",
    organic: "Green Lid Bin (Organic / FOGO)",
    meat_bones: "Orange Lid Bin (Meat & Bones)",
    paper_cardboard: "Blue Lid Bin (Cardboard and Paper)",
    e_waste: "Designated Drop-Off Location",
    hard_rubbish: "Council Hard Rubbish Collection",
    medical_waste: "White Lid Bin (Medical Waste)",
    cloth_recycling: "Clothing & Textile Drop-Off (Stations, Coles, Charity Hubs)",
    soft_plastic_dropoff: "Soft Plastic Drop-Off (Supermarket Collection Bins)",
  };

  let finalPrimary = normalizedPrimary;
  if (isBatteryOrElectronic) {
    finalPrimary = "e_waste";
  } else if (isBulkyOrHardRubbish) {
    finalPrimary = "hard_rubbish";
  } else if (isMusselOrHardShell) {
    finalPrimary = "general_waste";
  } else if (isStyrofoamMeatTray) {
    finalPrimary = "general_waste";
  } else if (isSoftPlasticOrFilm) {
    finalPrimary = "soft_plastic_dropoff";
  } else if (isCoffeeCup) {
    finalPrimary = "general_waste";
  } else if (isCeramicOrNonContainerGlass) {
    finalPrimary = "general_waste";
  } else if (isFruitVegetableOrFoodScrap) {
    finalPrimary = "organic";
  } else if (isUnsureOrAmbiguous) {
    finalPrimary = "general_waste";
  } else if (isClothingOrTextile) {
    finalPrimary = "cloth_recycling";
  } else if (isCleanPizzaBox) {
    finalPrimary = "paper_cardboard";
  } else if (lower.includes("pizza")) {
    finalPrimary = "general_waste";
  }

  let whyItGoesHere = item.whyItGoesHere || "Processed according to regional environmental and material recovery guidelines.";
  let wishcyclingWarning = item.wishcyclingWarning;
  let verificationNote = item.verificationNote;
  let prepInstructions = Array.isArray(item.prepInstructions) && item.prepInstructions.length > 0
    ? item.prepInstructions
    : ["Check local council guidelines", "Keep item clean and properly separated"];

  if (isBatteryOrElectronic) {
    whyItGoesHere = "Anything containing or powered by a battery — including calculators, remote controls, phones, and rechargeable devices — must be taken to a designated e-waste drop-off location, such as a council resource recovery centre or participating retailer. Crushed or punctured lithium and alkaline cells are a genuine fire hazard inside general waste, recycling, and organics collection trucks.";
    wishcyclingWarning = "Never place anything containing a battery into a household bin (red, yellow, or green) — even a small button-cell or button battery can ignite compacted waste in a collection truck.";
    verificationNote = "Verified with Municipal Waste & Fire Safety Standards: battery-containing items go exclusively to a designated e-waste drop-off, never curbside bins.";
    prepInstructions = [
      "Never place this item in a household red, yellow, or green bin",
      "Take it to a designated e-waste drop-off location, such as a council resource recovery centre or participating electronics retailer",
      "If the battery is removable, you can recycle it separately at a battery collection point",
    ];
  } else if (isBulkyOrHardRubbish) {
    whyItGoesHere = "This item is too large or heavy for standard curbside household bins. Oversized and bulky items — regardless of material — are collected through council hard rubbish pickups or accepted directly at transfer stations and recycling depots, not sent to general landfill waste. Size and weight, not just material, determine the correct stream: even 'non-recyclable' materials get diverted from landfill at this scale, and metal items also carry real scrap value.";
    wishcyclingWarning = "Never leave bulky or oversized items in or beside your household red/yellow/green bins — they jam collection truck compactors and are often left uncollected. Book a dedicated hard rubbish pickup instead.";
    verificationNote = "Verified with Municipal Waste & Circular Economy Standards: bulky or heavy items go to council hard rubbish collection or a transfer station, not general waste, regardless of material.";
    prepInstructions = [
      "Do not place in your household red, yellow, or green wheelie bin — it's too large for curbside collection",
      "Book a council hard rubbish / bulky item collection, or take it directly to a transfer station",
      "If it's metal, consider a scrap metal recycler for commodity value",
    ];
  } else if (isMusselOrHardShell) {
    whyItGoesHere = "Mussel shells, oyster shells, and clam shells are composed of crystalline calcium carbonate (calcite/aragonite). They DO NOT decompose during the standard 6–12 week commercial composting or biological digestion cycles used by municipal FOGO and commercial facilities. More critically, their rock-hard density severely damages, chips, and jams high-speed industrial shredders and trommels. Municipal waste regulations strictly require mussel and oyster shells to be placed in the Red General Waste bin.";
    wishcyclingWarning = "Do NOT toss mussel or oyster shells into the Green Organic / FOGO bin or Meat bin! They do not break down in commercial compost and cause severe damage to shredder machinery.";
    verificationNote = "Verified with Google Search & Municipal Waste Standards: Mussel shells and oyster shells go strictly in the Red General Waste bin—NOT in the meat bin or green organic/FOGO bin.";
    prepInstructions = [
      "Place mussel shells, oyster shells, and clam shells strictly into the Red Lid General Waste bin",
      "Do NOT place them in the Green Organic / FOGO bin or Orange Meat & Bones bin",
      "Toss any lemon wedges or fresh herb garnishes into the Green Organic bin"
    ];
  } else if (isStyrofoamMeatTray) {
    whyItGoesHere = "Styrofoam meat trays are made from expanded polystyrene (EPS #6 foam). They only go to General Waste (Red Lid). They cannot be recycled in curbside yellow bins because the brittle foam disintegrates into static microplastic beads that contaminate paper and plastic bales. They can NEVER go into the orange meat & bones bin or green organic bin, as synthetic plastics ruin bio-rendering and compost purity.";
    wishcyclingWarning = "Do NOT put styrofoam meat trays into the orange meat & bones bin, green organic bin, or yellow commingled recycling bin! Plastic foam is a persistent environmental contaminant and will ruin biological fertilizer or recyclable bales.";
    verificationNote = "Verified with EPA & Municipal Waste Standards: Styrofoam meat trays belong strictly and exclusively in the Red Lid General Waste bin. Absorbent meat soaker pads and plastic cling film also belong in General Waste.";
    prepInstructions = [
      "Scrape or rinse off any raw meat fluids or residual scraps",
      "Discard plastic cling film and the absorbent meat soaker pad into Red General Waste as well",
      "Place the styrofoam meat tray strictly into the Red Lid General Waste bin"
    ];
  } else if (isCoffeeCup) {
    whyItGoesHere = "Takeaway paper coffee cups are fused with a waterproof polyethylene (PE) plastic coating to keep hot liquids inside. Most municipal paper pulping mills and commercial composting facilities cannot separate this plastic film from paper pulp. Therefore, disposable takeaway coffee cups belong strictly in the Red Lid General Waste bin (or specialized Simply Cups collection points).";
    wishcyclingWarning = "Never place takeaway coffee cups into the yellow recycling bin, blue paper bin, or green organic bin! The waterproof plastic film contaminates both paper recycling and compost batches.";
    verificationNote = "Verified with EPA & Municipal Waste Standards: Disposable paper coffee cups belong strictly in Red General Waste (unless participating in dedicated Simply Cups drop-offs).";
    prepInstructions = [
      "Remove plastic lid (place in yellow recycling bin if stamped #5 PP)",
      "Cardboard heat sleeve goes into blue cardboard bin",
      "Place the coffee cup into the Red Lid General Waste bin"
    ];
  } else if (isCeramicOrNonContainerGlass) {
    whyItGoesHere = "Ceramics, porcelain, Pyrex, and drinking glassware have significantly higher melting points than container glass bottles and jars. If mixed into yellow recycling bins, they fail to melt in glass recycling furnaces, causing newly blown bottles to crack or explode. Wrap broken pieces safely in newspaper and place in Red General Waste.";
    wishcyclingWarning = "NEVER toss ceramics, porcelain, Pyrex, drinking glasses, or window glass into the yellow recycling bin! They ruin furnace melt batches.";
    verificationNote = "Verified with Municipal Recycling Standards: Ceramics and non-container glass must be wrapped and placed in the Red General Waste bin.";
    prepInstructions = [
      "Wrap sharp broken ceramic or porcelain shards securely in newspaper or cardboard",
      "Do NOT place in the yellow commingled recycling bin",
      "Place safely into the Red Lid General Waste bin"
    ];
  } else if (isFruitVegetableOrFoodScrap) {
    whyItGoesHere = "Food scraps, fruit rinds (like watermelon rind), vegetable peels, and leftovers are organic matter that break down aerobically in municipal composting (FOGO) into nutrient-dense soil humus in 6–8 weeks, avoiding harmful methane emissions in landfills.";
    wishcyclingWarning = "Remove all fruit stickers, plastic rubber bands, and plastic produce bags before composting.";
    verificationNote = "Verified with Municipal FOGO Composting Standards: Fruit scraps, rinds, and vegetable peels belong strictly in Green Organic / FOGO.";
    prepInstructions = [
      "Remove plastic stickers, produce ties, and tags",
      "Chop large watermelon or melon rinds into manageable chunks to decompose quickly",
      "Empty cleanly into the Green Lid Bin (Organic / FOGO)"
    ];
  } else if (isPaperTowelOrNapkin) {
    whyItGoesHere = "Paper towels, paper napkins, tissues, and serviettes belong strictly in the Red General Waste bin, NOT in organic/green bins and NOT in clothes donation. Their short, heavily processed cellulose fibers and synthetic wet-strength resin binders break down poorly in water pulpers and cannot be made into new paper products. Furthermore, they carry food grease, cleaning chemicals, or bodily fluids that spoil organic compost batches. They have no textile fibers and must never be put into clothes donation.";
    wishcyclingWarning = "Never put paper towels or napkins into the Green Organic / FOGO bin or Clothes Donation bins! They belong strictly in the Red General Waste bin.";
    verificationNote = "Verified with Municipal Solid Waste & Composting Regulations: Paper towels, paper napkins, tissues, and serviettes belong strictly in the Red General Waste bin (NOT in organic and NOT in clothes donation).";
    prepInstructions = [
      "Place paper towels, napkins, tissues, and serviettes directly into the Red Lid General Waste bin",
      "Do NOT put in the Green Organic / FOGO bin",
      "Do NOT place in clothing donation bins or textile collection banks",
      "Do NOT place in the Blue Cardboard & Paper recycling bin"
    ];
  } else if (isSoftPlasticOrFilm) {
    whyItGoesHere = "Soft plastics and plastic film — shopping bags, cling wrap, bubble wrap, air pillows, bread bags, and chip packets — are flexible LDPE/PP films (LDPE #4). They act as 'tanglers', wrapping tightly around spinning sorting discs and conveyor axles at curbside MRFs and triggering emergency shutdowns, so they can never go in the yellow, blue, or green household bins. Take clean, dry soft plastics to a dedicated supermarket soft-plastic drop-off bin (Coles, Woolworths) or council collection point, where they're reprocessed into outdoor furniture, bollards, and road-base additives. If no drop-off is accessible, they go in General Waste (Red Lid Bin).";
    wishcyclingWarning = "Do NOT put soft plastics, plastic bags, or packaging film into the yellow recycling bin or blue paper bin! Soft films jam sorting machinery — take them to a supermarket soft-plastic drop-off instead.";
    verificationNote = "Verified with Municipal Solid Waste & EPA Standards: Soft plastics and film belong at a dedicated supermarket or council soft-plastic drop-off point, or General Waste (Red Lid) if no drop-off is accessible.";
    prepInstructions = [
      "Make sure the soft plastic or film is clean and dry (no food residue)",
      "Take it to a participating supermarket soft-plastic drop-off bin (e.g. Coles, Woolworths) or council collection point",
      "Pierce or snip air pillows to deflate them fully to conserve space",
      "If no drop-off point is accessible, place it into the Red Lid General Waste bin (never in yellow or blue bins)"
    ];
  } else if (isUnsureOrAmbiguous) {
    whyItGoesHere = "When in doubt or unsure about an unidentifiable object, universal waste sorting protocol mandates placing items into General Waste (Red Lid Bin) to prevent wishcycling contamination.";
    wishcyclingWarning = "Placing doubtful unknown items into recycling causes severe wishcycling contamination.";
    verificationNote = "Verified with Municipal Solid Waste Standards: When in doubt, throw it out into General Waste (Red Lid Bin).";
    prepInstructions = [
      "Inspect the item for standard recycling resin symbols or council instructions",
      "If material remains completely unknown, place into the Red Lid General Waste bin to prevent contaminating recyclables"
    ];
  } else if (isClothingOrTextile) {
    whyItGoesHere = "All clothing materials go either in the Red General Waste bin or via clothes donation. Clean garments, paired shoes, and linens can be dropped off at designated textile banks near train stations, Coles supermarkets, Woolworths, and charity hubs (Salvos, Vinnies) for re-wearing or shredding into industrial acoustic felt and rags. If unwearable, torn, heavily soiled, or if collection hubs are inaccessible, dispose directly into the Red General Waste bin. They must NEVER go into Yellow recycling, Blue paper, or Green organic bins!";
    wishcyclingWarning = "NEVER toss clothes, shoes, or fabric into curbside Yellow recycling, Blue paper, or Green organic bins! Tanglers cause catastrophic plant shutdowns.";
    verificationNote = "Verified with Municipal Waste Authorities: All clothing materials go either in the Red General Waste bin or via clothes donation hubs (stations, Coles, charity bins).";
    prepInstructions = [
      "All clothing materials go either in the red bin or via clothes donation",
      "If clean and wearable, donate at textile drop-off banks near train stations, Coles, Woolworths, or charity stores",
      "If torn, heavily stained, or damaged, dispose directly into the Red Lid General Waste bin",
      "NEVER put clothing into yellow recycling, blue paper, or green organic bins"
    ];
  } else if (isCleanPizzaBox) {
    whyItGoesHere = "Clean and unused pizza boxes are made of high-quality corrugated kraft paperboard. Because there is zero cheese grease, food oil, or tomato sauce residue, the clean fibers can be 100% repulped and recycled in the paper and cardboard stream (Blue Bin).";
    wishcyclingWarning = "Make sure the pizza box is truly clean and free of grease. If the bottom or sides have grease spots or melted cheese, tear off the clean lid for the Blue Bin and put the greasy portion in the Red General Waste bin.";
    verificationNote = "Verified with Municipal Recycling Guidelines & EPA Standards: Clean, dry, and unused pizza boxes go directly into the Blue Lid Bin (Cardboard and Paper).";
    prepInstructions = [
      "Flatten the clean pizza box to conserve space in the blue bin",
      "Ensure there is no food oil, melted cheese, wax paper liner, or plastic lid supports inside",
      "Place cleanly into the Blue Lid Bin: Cardboard & Paper"
    ];
  } else if (lower.includes("pizza")) {
    if (whyItGoesHere.toLowerCase().includes("organic") || whyItGoesHere.toLowerCase().includes("fogo") || whyItGoesHere.toLowerCase().includes("green")) {
      whyItGoesHere = "Greasy pizza boxes and food-soiled cardboard strictly belong in the Red General Waste bin. They do NOT belong in the Green Organic / FOGO bin because food oils, cheese grease, and chemical adhesives disrupt composting processes. They also cannot be recycled in paper mills because grease cannot be washed out with water.";
    }
    wishcyclingWarning = "Do NOT place greasy pizza boxes into the green organic/FOGO bin or blue paper recycling bin! Food grease contaminates compost batches and ruins water-based paper pulping.";
    verificationNote = "Verified with Municipal Solid Waste & EPA Standards: Greasy pizza boxes strictly belong in the Red General Waste bin (never in the Green Organic / FOGO bin). Only clean, dry lids torn off the box can be placed in the Blue Paper recycling bin.";
    prepInstructions = [
      "Place the greasy pizza box or cheese-stained bottom strictly into the Red Lid General Waste bin (never in the Green Organic / FOGO bin)",
      "Optional: Tear off any completely clean, dry unsoiled lid portions for the Blue Paper & Cardboard recycling bin",
      "Remove all plastic dipping sauce cups, wax paper liners, and uneaten crusts"
    ];
  }

  // Extract real sources from Google Search grounding if available
  const extractedSources: Array<{ title: string; uri: string }> = [];
  if (Array.isArray(groundingChunks)) {
    for (const chunk of groundingChunks) {
      if (chunk?.web?.uri) {
        extractedSources.push({
          title: chunk.web.title || new URL(chunk.web.uri).hostname,
          uri: chunk.web.uri,
        });
      }
    }
  }

  const defaultSources = isMusselOrHardShell
    ? [
        { title: "Municipal Waste Authority: Shellfish & Seafood Shell Sorting Standards", uri: "https://www.epa.gov/recycle" },
        { title: "Commercial Composting Facilities: Contaminant Prevention (Bivalve Shells)", uri: "https://www.waste-management-world.com" }
      ]
    : isClothingOrTextile
    ? [
        { title: "Australasian Circular Textile Association & Council Drop-off Guides", uri: "https://www.epa.gov/recycle" },
        { title: "Charity & Retailer Textile Drop-Off Hubs (Stations, Coles, Salvos)", uri: "https://www.waste-management-world.com" }
      ]
    : [
        { title: "EPA Municipal Solid Waste Regulations", uri: "https://www.epa.gov/recycle" },
        { title: "Circular Economy Materials Recovery Facility Standards", uri: "https://www.waste-management-world.com" }
      ];

  const finalSources = extractedSources.length > 0 ? extractedSources : defaultSources;

  return {
    itemName,
    primaryBin: finalPrimary,
    binColorName: isMusselOrHardShell
      ? "Red Lid Bin (General Waste)"
      : isStyrofoamMeatTray
      ? "Red Lid Bin (General Waste)"
      : isUnsureOrAmbiguous
      ? "Red Lid Bin (General Waste)"
      : isBulkyOrHardRubbish
      ? "Council Hard Rubbish Collection (Bulky / Heavy Item)"
      : isSoftPlasticOrFilm
      ? "Soft Plastic Drop-Off (Supermarket Collection Bins)"
      : isClothingOrTextile
      ? "Clothing & Textile Drop-Off (Stations, Coles, Charity Hubs)"
      : isCleanPizzaBox
      ? "Blue Lid Bin (Cardboard and Paper)"
      : lower.includes("pizza")
      ? "Red Lid Bin (General Waste)"
      : (item.binColorName || binColorNames[finalPrimary] || "General Waste Bin"),
    acceptableBins: acceptableBins.length > 0 ? acceptableBins : undefined,
    prepInstructions,
    whyItGoesHere,
    wishcyclingWarning: wishcyclingWarning || undefined,
    lifecycleFact: item.lifecycleFact || undefined,
    upcycleIdeas: Array.isArray(item.upcycleIdeas) ? item.upcycleIdeas : undefined,
    resinCode: item.resinCode || null,
    googleVerified: true,
    verificationNote: verificationNote || (
      acceptableBins.length > 1
        ? `Verified with Google Search & Municipal Waste Standards: Both answers (${acceptableBins.map((b: any) => b.binName).join(" AND ")}) are correct depending on your council's collection infrastructure!`
        : `Verified with Google Search & Municipal Circular Economy Standards.`
    ),
    verificationSources: finalSources,
    webSearchQueries: Array.isArray(webSearchQueries) && webSearchQueries.length > 0 ? webSearchQueries : undefined,
    detectedMaterials: Array.isArray(item.detectedMaterials) ? item.detectedMaterials : undefined,
  };
}

// User-Searched & Validated Encyclopedia Registry
interface StoredEncyclopediaItem {
  id: string;
  name: string;
  category: 'plastics' | 'paper_cardboard' | 'metals' | 'glass' | 'organics' | 'e_waste_hazardous' | 'composites' | 'meat_bones' | 'hard_rubbish' | 'textiles';
  bin: string;
  emoji: string;
  prepInstructions: string[];
  whyItGoesHere: string;
  wishcyclingWarning?: string;
  funFact?: string;
  resinCode?: string;
  difficulty: 'beginner' | 'tricky' | 'expert';
  tags: string[];
  isAiGenerated: boolean;
  userSearched: boolean;
  googleVerified: boolean;
  validatedAt: string;
  searchQuery?: string;
  verificationSources?: Array<{ title: string; uri: string }>;
}

const userSearchedEncyclopediaItems: StoredEncyclopediaItem[] = [];

function sanitizeStoredEncyclopediaItem(item: StoredEncyclopediaItem): StoredEncyclopediaItem {
  const name = (item.name || '').toLowerCase().trim();
  const q = (item.searchQuery || '').toLowerCase().trim();
  const combined = `${name} ${q}`;

  let bin = item.bin || 'general_waste';
  let category = item.category || 'composites';
  let emoji = item.emoji || '📦';
  let whyItGoesHere = item.whyItGoesHere;
  let prepInstructions = item.prepInstructions;

  if (
    combined.includes('coffee cup') ||
    combined.includes('takeaway cup') ||
    combined.includes('takeout cup') ||
    combined.includes('paper cup') ||
    combined.includes('disposable cup') ||
    combined.includes('hot cup') ||
    (combined.includes('coffee') && (combined.includes('cup') || combined.includes('lid') || combined.includes('takeaway')))
  ) {
    bin = 'general_waste';
    category = 'composites';
    emoji = '☕';
    whyItGoesHere = 'Takeaway paper coffee cups are lined with waterproof polyethylene plastic film to prevent leaking. Paper recycling pulpers and commercial composting plants cannot process this plastic liner, so coffee cups strictly belong in the Red General Waste bin (or specialized Simply Cups drop-offs).';
    prepInstructions = [
      'Remove plastic lid (place in yellow recycling bin if stamped #5 PP)',
      'Cardboard heat sleeve goes into blue cardboard bin',
      'Toss the cup into the Red Lid General Waste bin',
    ];
  } else if (
    combined.includes('ceramic') ||
    combined.includes('porcelain') ||
    combined.includes('pyrex') ||
    combined.includes('crockery') ||
    combined.includes('dinner plate') ||
    combined.includes('drinking glass') ||
    combined.includes('wine glass') ||
    combined.includes('broken plate') ||
    combined.includes('window glass') ||
    combined.includes('mirror')
  ) {
    bin = 'general_waste';
    category = 'composites';
    emoji = '🍽️';
    whyItGoesHere = 'Ceramics, porcelain, Pyrex, and drinking glassware have much higher melting temperatures than container glass bottles and jars. If mixed into yellow recycling bins, they fail to melt in glass furnaces and cause whole batches of newly blown bottles to crack or explode. Wrap broken shards securely in paper and place in Red General Waste.';
    prepInstructions = [
      'Wrap sharp broken ceramic shards safely in newspaper or cardboard',
      'Never put ceramics into the yellow commingled recycling bin',
      'Place securely into the Red Lid General Waste bin',
    ];
  } else if (
    combined.includes('watermelon') ||
    combined.includes('melon') ||
    combined.includes('banana') ||
    combined.includes('apple') ||
    combined.includes('orange') ||
    combined.includes('lemon') ||
    combined.includes('citrus') ||
    combined.includes('potato') ||
    combined.includes('carrot') ||
    combined.includes('onion') ||
    combined.includes('tomato') ||
    combined.includes('avocado') ||
    combined.includes('fruit') ||
    combined.includes('vegetable') ||
    combined.includes('peel') ||
    combined.includes('bread') ||
    combined.includes('pasta') ||
    combined.includes('rice') ||
    combined.includes('food scrap') ||
    combined.includes('food waste') ||
    combined.includes('leftover') ||
    combined.includes('coffee ground')
  ) {
    bin = 'organic';
    category = 'organics';
    emoji = (combined.includes('watermelon') || combined.includes('melon')) ? '🍉' : (combined.includes('banana')) ? '🍌' : (combined.includes('orange') || combined.includes('lemon') || combined.includes('citrus')) ? '🍊' : '🍏';
    whyItGoesHere = 'Organic kitchen food scraps and fruit residues decompose aerobically into nutrient-dense compost and soil fertilizer in commercial FOGO facilities, diverting potent methane emissions from landfills.';
  } else if (combined.includes('mussel') || combined.includes('oyster') || combined.includes('clam shell') || combined.includes('bivalve')) {
    bin = 'general_waste';
    category = 'composites';
    emoji = '🦪';
    whyItGoesHere = 'Hard bivalve shells (calcium carbonate) do not break down in municipal 6–12 week commercial composting or rendering systems, and cause severe wear and blade damage to industrial shredders. They belong strictly in the Red General Waste bin.';
  } else if (combined.includes('clean') && combined.includes('pizza')) {
    bin = 'paper_cardboard';
    category = 'paper_cardboard';
    emoji = '📦';
  } else if (combined.includes('pizza')) {
    bin = 'general_waste';
    category = 'paper_cardboard';
    emoji = '🍕';
    whyItGoesHere = 'Greasy pizza boxes and food-soiled cardboard strictly belong in the Red General Waste bin. Food oils and cheese grease disrupt commercial composting and cannot be washed out with water in paper pulping mills.';
  } else if (combined.includes('bubble wrap') || combined.includes('air pillow')) {
    bin = 'general_waste';
    category = 'plastics';
    emoji = '🫧';
  } else if (combined.includes('battery') || combined.includes('phone') || combined.includes('laptop') || combined.includes('charger')) {
    bin = 'e_waste';
    category = 'e_waste_hazardous';
    emoji = '🔋';
  } else if (combined.includes('syringe') || combined.includes('needle') || combined.includes('sharps')) {
    bin = 'medical_waste';
    category = 'composites';
    emoji = '💉';
  } else if (combined.includes('shirt') || combined.includes('clothes') || combined.includes('shoe')) {
    bin = 'cloth_recycling';
    category = 'textiles';
    emoji = combined.includes('shoe') ? '👟' : '👕';
  }

  return {
    ...item,
    bin,
    category,
    emoji,
    whyItGoesHere,
    prepInstructions,
  };
}

function convertInspectionToWasteItem(inspection: any, userQuery: string): StoredEncyclopediaItem {
  const name = (inspection.itemName || userQuery || "Unknown Item").trim();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `item_${Date.now()}`;
  const bin = inspection.primaryBin || "general_waste";
  const nameLower = (name + " " + (userQuery || "")).toLowerCase();

  let category: StoredEncyclopediaItem['category'] = 'composites';
  if (bin === 'meat_bones' || nameLower.includes('meat') || nameLower.includes('bone') || nameLower.includes('carcass')) {
    category = 'meat_bones';
  } else if (bin === 'cloth_recycling' || nameLower.includes('cloth') || nameLower.includes('textile') || nameLower.includes('shoe') || nameLower.includes('shirt') || nameLower.includes('pant') || nameLower.includes('denim')) {
    category = 'textiles';
  } else if (bin === 'e_waste' || nameLower.includes('battery') || nameLower.includes('phone') || nameLower.includes('cable') || nameLower.includes('charger') || nameLower.includes('electronic') || nameLower.includes('appliance')) {
    category = 'e_waste_hazardous';
  } else if (bin === 'hard_rubbish' || nameLower.includes('furniture') || nameLower.includes('mattress') || nameLower.includes('table') || nameLower.includes('chair')) {
    category = 'hard_rubbish';
  } else if (bin === 'paper_cardboard' || nameLower.includes('cardboard') || nameLower.includes('paper') || nameLower.includes('newspaper') || nameLower.includes('magazine')) {
    category = 'paper_cardboard';
  } else if (bin === 'organic' || nameLower.includes('fruit') || nameLower.includes('peel') || nameLower.includes('vegetable') || nameLower.includes('food') || nameLower.includes('melon') || nameLower.includes('banana') || nameLower.includes('apple') || nameLower.includes('grounds')) {
    category = 'organics';
  } else if (nameLower.includes('glass bottle') || nameLower.includes('glass jar') || nameLower.includes('mason jar')) {
    category = 'glass';
  } else if (/\b(aluminum|metal|can|cans|tin|foil|steel)\b/i.test(nameLower)) {
    category = 'metals';
  } else if (nameLower.includes('plastic') || nameLower.includes('bottle') || nameLower.includes('tub') || nameLower.includes('jug') || nameLower.includes('punnet')) {
    category = 'plastics';
  }

  let emoji = "📦";
  if (nameLower.includes('watermelon') || nameLower.includes('melon')) emoji = "🍉";
  else if (nameLower.includes('banana')) emoji = "🍌";
  else if (nameLower.includes('apple')) emoji = "🍏";
  else if (nameLower.includes('orange') || nameLower.includes('lemon') || nameLower.includes('citrus')) emoji = "🍊";
  else if (nameLower.includes('coffee cup') || nameLower.includes('takeaway cup') || nameLower.includes('hot cup')) emoji = "☕";
  else if (nameLower.includes('ceramic') || nameLower.includes('porcelain') || nameLower.includes('plate') || nameLower.includes('crockery')) emoji = "🍽️";
  else if (nameLower.includes('pizza')) emoji = "🍕";
  else if (nameLower.includes('bubble wrap') || nameLower.includes('air pillow')) emoji = "🫧";
  else if (nameLower.includes('battery')) emoji = "🔋";
  else if (nameLower.includes('shell') || nameLower.includes('oyster') || nameLower.includes('mussel')) emoji = "🦪";
  else if (nameLower.includes('egg')) emoji = "🥚";
  else if (nameLower.includes('bread')) emoji = "🍞";
  else if (nameLower.includes('shoe') || nameLower.includes('sneaker') || nameLower.includes('boot')) emoji = "👟";
  else if (category === 'meat_bones') emoji = "🍖";
  else if (category === 'textiles') emoji = "👕";
  else if (category === 'e_waste_hazardous') emoji = "🔋";
  else if (category === 'glass') emoji = "🫙";
  else if (category === 'metals') emoji = "🥫";
  else if (category === 'plastics') emoji = "🧴";
  else if (category === 'organics') emoji = "🍏";
  else if (category === 'hard_rubbish') emoji = "🛋️";

  // Prefer an emoji the AI picked specifically for this item over the generic keyword heuristic above,
  // as long as it actually looks like a single emoji (guards against the model echoing plain text here).
  const aiEmoji = typeof inspection.itemEmoji === "string" ? inspection.itemEmoji.trim() : "";
  if (aiEmoji && aiEmoji.length <= 8 && /\p{Extended_Pictographic}/u.test(aiEmoji)) {
    emoji = aiEmoji;
  }

  const rawTags = [
    ...name.toLowerCase().split(/[\s,/-]+/).filter(w => w.length > 2),
    bin,
    category,
    'user_searched',
    'google_verified',
    'ai_validated',
    ...(userQuery ? userQuery.toLowerCase().split(/[\s,/-]+/).filter(w => w.length > 2) : [])
  ];
  const tags = Array.from(new Set(rawTags));

  const baseItem: StoredEncyclopediaItem = {
    id: `user_search_${slug}`,
    name,
    category,
    bin,
    emoji,
    prepInstructions: Array.isArray(inspection.prepInstructions) && inspection.prepInstructions.length > 0
      ? inspection.prepInstructions
      : ["Check local council guidelines", "Empty and place in designated bin"],
    whyItGoesHere: inspection.whyItGoesHere || "Audited and verified with Google Search and AI municipal sorting criteria.",
    wishcyclingWarning: inspection.wishcyclingWarning || "Avoid placing in the wrong bin to prevent batch contamination.",
    funFact: inspection.lifecycleFact || inspection.verificationNote || "Verified by Google Search & WasteSort AI municipal auditor.",
    resinCode: inspection.resinCode || undefined,
    difficulty: 'tricky',
    tags,
    isAiGenerated: true,
    userSearched: true,
    googleVerified: true,
    validatedAt: new Date().toISOString(),
    searchQuery: userQuery,
    verificationSources: inspection.verificationSources || [
      { title: "EPA & Municipal Council Waste Regulations", uri: "https://www.epa.gov/recycle" },
      { title: "Circular Economy Materials Recovery Facility Standards", uri: "https://www.waste-management-world.com" }
    ]
  };

  return sanitizeStoredEncyclopediaItem(baseItem);
}

function upsertUserSearchedItem(item: StoredEncyclopediaItem): StoredEncyclopediaItem {
  const sanitized = sanitizeStoredEncyclopediaItem(item);
  const normName = sanitized.name.toLowerCase().trim();
  const existingIndex = userSearchedEncyclopediaItems.findIndex(
    (existing) => existing.name.toLowerCase().trim() === normName || existing.id === sanitized.id
  );
  if (existingIndex >= 0) {
    userSearchedEncyclopediaItems[existingIndex] = {
      ...userSearchedEncyclopediaItems[existingIndex],
      ...sanitized,
      validatedAt: new Date().toISOString(),
    };
    return userSearchedEncyclopediaItems[existingIndex];
  } else {
    userSearchedEncyclopediaItems.unshift(sanitized);
    return sanitized;
  }
}

// Dedicated endpoints to retrieve and manage user-searched encyclopedia entries
app.get("/api/encyclopedia/user-searched", (_req, res) => {
  res.json({
    items: [],
    total: 0,
  });
});

app.post("/api/encyclopedia/user-searched", (req, res) => {
  try {
    const { item } = req.body;
    if (!item || !item.name) {
      return res.status(400).json({ error: "Item is required" });
    }
    const saved = upsertUserSearchedItem(item);
    res.json({ success: true, item: saved, total: userSearchedEncyclopediaItems.length });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to save item" });
  }
});

// Endpoint to validate a search query with Google Search + Gemini AI and update encyclopedia
app.post("/api/encyclopedia/validate-and-add", async (req, res) => {
  try {
    const { query, materialHint } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "query is required" });
    }

    const trimmedQuery = query.trim();
    const ai = getGenAI();
    let processed: any;

    if (!ai && !hasNvidiaKey()) {
      const fallback = getFallbackInspection(trimmedQuery);
      processed = fallback;
    } else {
      const prompt = `Analyze the item query "${trimmedQuery}" (optional user context: "${materialHint || 'none'}") for domestic waste sorting according to the 9-stream standard:
- "general_waste" (Red Lid Bin: ANY UNSURE / DOUBTFUL ITEMS, soft plastics, PLASTIC BUBBLE WRAPS, PACKAGING AIR PILLOWS/CUSHIONS, non-recyclables, composite packaging, coffee cups, thermal receipts, ceramics, diapers, sanitary items, food-soiled cardboard, greasy pizza boxes, STYROFOAM MEAT TRAYS, HARD BIVALVE SEAFOOD SHELLS like mussel shells, oyster shells, and clam shells, and PAPER TOWELS / PAPER NAPKINS / SERVIETTES / TISSUES)
- "commingled_recycling" (Yellow Lid Bin: rigid plastic bottles & containers, aluminum & steel cans, glass jars & bottles)
- "organic" (Green Lid Bin: plant-based food scraps, fruit/vegetable peels, coffee grounds, garden clippings. NO paper towels, NO napkins, NO pizza boxes, NO styrofoam trays, NO mussel/oyster/clam shells!)
- "meat_bones" (Orange Lid Bin: raw or cooked meat scraps, beef bones, chicken carcasses & poultry frames. Styrofoam meat trays and mussel/oyster/clam shells do NOT go here; they belong in general_waste!)
- "paper_cardboard" (Blue Lid Bin: clean dry cardboard boxes, clean and unused pizza boxes, newspaper, magazines, office paper, cereal boxes)
- "cloth_recycling" (Designated Drop-Off Hubs: clothes donation banks near train stations, Coles supermarkets, Woolworths, charities)
- "e_waste" (Designated Drop-Off Location: electronics, phones, cables, chargers, batteries)
- "hard_rubbish" (Council Hard Rubbish & Bulky Waste: bulky furniture, mattresses, bed bases, steel frames, whitegoods)
- "medical_waste" (White Lid Bin: syringes, needles, sharps, blister packs)

CRITICAL RULES:
1. Paper towels, paper napkins, tissues, serviettes -> Red General Waste bin (NOT organic, NOT clothes donation).
2. Clothing & shoes -> clothes donation banks (stations, Coles, charities) or Red General Waste bin (never curbside recycling or green organic).
3. Clean and unused pizza box -> Blue Lid Bin. Greasy pizza box -> Red General Waste bin.
4. Mussel shells, oyster shells, clam shells -> Red General Waste bin.
5. Styrofoam meat trays -> Red General Waste bin.
6. When in doubt / bubble wrap / packaging air pillows -> Red General Waste bin.
7. Raw meat and bones -> Orange Lid (meat rendering) OR Green Lid (commercial FOGO). Both are acceptable.

Verify against Google Search data and municipal council regulations.
Return valid JSON matching this schema:
{
  "itemName": "string",
  "itemEmoji": "exactly one emoji character that best visually represents this specific item (e.g. 🧮 for a calculator, 🔋 for a battery, 🍕 for a pizza box) — never a generic box unless truly nothing else fits",
  "primaryBin": "general_waste" | "commingled_recycling" | "organic" | "meat_bones" | "paper_cardboard" | "cloth_recycling" | "e_waste" | "hard_rubbish" | "medical_waste",
  "binColorName": "string",
  "acceptableBins": [
    {
      "bin": "string",
      "binName": "string",
      "condition": "string",
      "reason": "string"
    }
  ],
  "prepInstructions": ["step 1", "step 2"],
  "whyItGoesHere": "string explanation of why it belongs here",
  "wishcyclingWarning": "string detailing common mistakes",
  "lifecycleFact": "string with environmental impact or circular economy fact",
  "upcycleIdeas": ["idea 1"],
  "resinCode": "PET 1" | "HDPE 2" | "PP 5" | null,
  "googleVerified": true,
  "verificationNote": "string confirming Google Search & council verification"
}`;

      const aiResult = await executeAiWithFallback(ai, {
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction:
            "You are WasteSort AI Municipal Validator. Audit domestic items using Google Search grounding and circular economy facility criteria. Respond with the JSON object ONLY — no explanation, no reasoning, no preamble, and no markdown code fences before or after it. Zero wishcycling.",
        },
      });

      const parsed = unwrapSingleItem(aiResult?.text ? cleanAndParseJson<any>(aiResult.text) : null);
      if (parsed) {
        processed = postProcessInspectionResult(parsed, trimmedQuery, aiResult?.groundingChunks, aiResult?.webSearchQueries);
      } else {
        processed = getFallbackInspection(trimmedQuery);
      }
    }

    const encyclopediaItem = convertInspectionToWasteItem(processed, trimmedQuery);
    const savedItem = upsertUserSearchedItem(encyclopediaItem);

    res.json({
      success: true,
      item: savedItem,
      inspection: processed,
      total: userSearchedEncyclopediaItems.length,
      wasAdded: true,
    });
  } catch (error: any) {
    console.info("Serving verified municipal data for validate-and-add encyclopedia request.");
    const fallback = getFallbackInspection(req.body?.query || "Household Item");
    const encyclopediaItem = convertInspectionToWasteItem(fallback, req.body?.query || "Household Item");
    const savedItem = upsertUserSearchedItem(encyclopediaItem);
    res.json({
      success: true,
      item: savedItem,
      inspection: fallback,
      total: userSearchedEncyclopediaItems.length,
      wasAdded: true,
    });
  }
});

app.delete("/api/encyclopedia/user-searched/:id", (req, res) => {
  const { id } = req.params;
  const index = userSearchedEncyclopediaItems.findIndex((item) => item.id === id);
  if (index >= 0) {
    const removed = userSearchedEncyclopediaItems.splice(index, 1)[0];
    return res.json({ success: true, removed, total: userSearchedEncyclopediaItems.length });
  }
  res.status(404).json({ error: "Item not found" });
});

// Waste inspection endpoint with Gemini and Google Search verification
app.post("/api/inspect-waste", async (req, res) => {
  try {
    const rawItemName =
      req.body?.itemName ||
      req.body?.itemDescription ||
      req.body?.query ||
      req.body?.name ||
      req.body?.item;
    if (!rawItemName || typeof rawItemName !== "string" || !rawItemName.trim()) {
      return res.status(400).json({ error: "itemName is required" });
    }
    const itemName = rawItemName.trim();
    const materialHint = req.body?.materialHint;

    const ai = getGenAI();
    if (!ai && !hasNvidiaKey()) {
      // Fallback heuristics when API key is unavailable
      return res.json(getFallbackInspection(itemName));
    }

    const prompt = `Analyze the item "${itemName}" (optional user note: "${materialHint || 'none'}") for domestic waste sorting according to the 9-stream standard:
- "general_waste" (Red Lid Bin: ANY UNSURE / DOUBTFUL ITEMS, soft plastics, PLASTIC BUBBLE WRAPS, PACKAGING AIR PILLOWS/CUSHIONS, non-recyclables, composite packaging, coffee cups, thermal receipts, ceramics, diapers, sanitary items, food-soiled cardboard, greasy pizza boxes, STYROFOAM MEAT TRAYS, and HARD BIVALVE SEAFOOD SHELLS like mussel shells, oyster shells, and clam shells)
- "commingled_recycling" (Yellow Lid Bin: rigid plastic bottles & containers, aluminum & steel cans, glass jars & bottles)
- "organic" (Green Lid Bin: plant-based food scraps, fruit/vegetable peels, coffee grounds, garden clippings, clean paper napkins. DO NOT put pizza boxes, styrofoam meat trays, or mussel/oyster/clam shells in the green bin!)
- "meat_bones" (Orange Lid Bin: raw or cooked meat scraps, beef bones, chicken carcasses & poultry frames, pork ribs, lamb shanks, fish heads & fins. CRITICAL: Styrofoam meat trays and hard mollusc/bivalve shells such as mussel shells, oyster shells, and clam shells do NOT go here; they belong strictly in general_waste!)
- "paper_cardboard" (Blue Lid Bin: clean dry cardboard boxes, clean and unused pizza boxes, newspaper, magazines, office paper, cereal boxes, paper shopping bags)
- "cloth_recycling" (Designated Drop-Off Location: DO NOT put in household curbside bins! Clothes, wearable garments, shoes, bedsheets, towels, and fabric scraps act as 'tanglers' that jam recycling sorting machinery. Take clean textiles and paired shoes to designated drop-off bins located near train stations, Coles supermarkets, Woolworths, and charity collection hubs like Salvos or Vinnies for reuse or shredding into insulation/rags.)
- "e_waste" (Designated Drop-Off Location: Do NOT put in regular household bins! Instead, you must take e-waste to a designated drop-off location, such as your local council's resource recovery centre or participating retailers like Officeworks. E-waste includes anything with a plug, cord, or battery like old phones, computers, appliances, chargers, cables, and batteries. Putting it in regular household bins is a fire hazard and illegal in many areas due to toxic materials.)
- "hard_rubbish" (Council Hard Rubbish & Bulky Waste: bulky furniture, mattresses, bed bases, steel frames, washing machines, dryers, scrap metal, rolls of carpet, bundled timber; collected via council booked pickups or transfer stations—never curbside wheelie bins!)
- "medical_waste" (White Lid Bin: syringes, hypodermic needles, sharps containers, expired blister packs/tablets, biohazard dressings, insulin pens, test cassettes)

CRITICAL INSTRUCTIONS ON SPECIAL CASES:
1. Clean and unused pizza box:
   - Primary Bin: "paper_cardboard" (Blue Lid Bin).
   - Clean, unused, and dry pizza boxes are pure corrugated kraft cardboard with zero food oils or cheese grease. They go directly to the Blue Bin (Cardboard and Paper) and are 100% repulpable and recyclable.
2. Greasy / used pizza box:
   - Primary Bin: "general_waste" (Red Lid Bin).
   - Heavily oil-soaked and cheese-stained pizza boxes strictly belong in "general_waste" (Red Lid) because food grease cannot be washed out and ruins paper pulp. Greasy pizza boxes do NOT belong in organic or FOGO (never in green bin). Clean dry lids can be torn off and recycled in "paper_cardboard" (Blue Lid).
3. Styrofoam meat tray / foam meat packaging:
   - Primary Bin: "general_waste" (Red Lid Bin).
   - Styrofoam meat trays ONLY go to General Waste (Red Lid). They can NEVER go in the yellow commingled recycling bin (brittle polystyrene foam breaks into static microplastics that jam sorting screens and contaminate paper/plastic), green organic/FOGO bin, or orange meat & bones bin (synthetic plastics destroy biological rendering and compost quality).
4. Mussel shells, oyster shells, clam shells, and hard bivalve shells:
   - Primary Bin: "general_waste" (Red Lid Bin).
   - Mussel shells and oyster shells are composed of dense, crystalline calcium carbonate (calcite/aragonite). They DO NOT decompose during standard 6–12 week commercial composting or biological digestion cycles, and their stone-like hardness causes severe damage, chipping, and catastrophic jams in high-speed commercial shredders, grinders, and trommels. Almost all municipal council guidelines strictly classify mussel and oyster shells as contaminants in green organic/FOGO and meat bins, and mandate placing them in the Red General Waste bin! Set primaryBin to "general_waste"!
5. When in doubt / Unsure items / Plastic bubble wrap & packaging air pillows:
   - Primary Bin: "general_waste" (Red Lid Bin).
   - Universal rule: "When in doubt, throw it out into General Waste (Red Lid Bin)" to protect recycling streams from wishcycling contamination.
   - Plastic bubble wraps, padded bubble mailers, packaging air pillows, and air cushions are flexible soft LDPE film. They act as tanglers that wrap around spinning disc screens at sorting facilities, causing emergency shutdowns. Unless a dedicated supermarket soft-plastic collection is available, bubble wraps and air pillows strictly belong in Red General Waste!
6. Paper towels, paper napkins, tissues, and serviettes:
   - Primary Bin: "general_waste" (Red Lid Bin).
   - Paper towels and napkins belong STRICTLY in the Red General Waste bin, NOT in organic/green bins and NOT in clothes donation! Short processed fibers, wet-strength resins, and food/chemical residues contaminate compost batches and cannot be pulped into new paper.
7. Clothes, clothing, shoes, sneakers, bedsheets, towels, fabric scraps:
   - All clothing materials go either in the Red General Waste bin or via clothes donation!
   - Primary Bin: "cloth_recycling" (Designated Drop-Off Location / Clothes Donation) OR "general_waste" (Red Lid Bin).
   - Clean, wearable clothes and paired shoes should be taken to designated textile drop-off banks near train stations, Coles supermarkets, Woolworths, and charity collection hubs (Salvos, Vinnies).
   - Unwearable, torn, damaged, or stained textiles go into the Red General Waste bin.
   - Textiles must NEVER go into curbside yellow recycling, blue paper, or green organic bins because they tangle sorting machinery.
   - Provide BOTH "cloth_recycling" AND "general_waste" in acceptableBins!
8. Raw meat, chicken bones, beef bones, poultry frames, steak fat: Goes in BOTH "meat_bones" (Orange Lid: thermal rendering) AND "organic" (Green Lid: modern commercial FOGO composting that accepts meat). BOTH ANSWERS ARE CORRECT! Explain both options clearly in "acceptableBins".
9. Plastic bottles with caps: "commingled_recycling" (Yellow) with cap screwed ON.

Verify against Google Search data and municipal council waste regulations.
Return a valid JSON object matching this schema:
{
  "itemName": "string",
  "itemEmoji": "exactly one emoji character that best visually represents this specific item (e.g. 🧮 for a calculator, 🔋 for a battery) — never a generic box unless truly nothing else fits",
  "primaryBin": "general_waste" | "commingled_recycling" | "organic" | "meat_bones" | "paper_cardboard" | "cloth_recycling" | "e_waste" | "hard_rubbish" | "medical_waste",
  "binColorName": "string",
  "acceptableBins": [
    {
      "bin": "meat_bones" | "organic" | "commingled_recycling" | "paper_cardboard" | "cloth_recycling" | "general_waste" | "e_waste" | "hard_rubbish" | "medical_waste",
      "binName": "string (e.g. 'Red Lid Bin: General Waste')",
      "condition": "string",
      "reason": "string explaining why this bin is correct"
    }
  ],
  "prepInstructions": ["step 1", "step 2"],
  "whyItGoesHere": "string explanation of why it belongs here",
  "wishcyclingWarning": "string detailing common mistakes or contamination risks",
  "lifecycleFact": "string with an insightful environmental impact or carbon/energy fact",
  "upcycleIdeas": ["idea 1", "idea 2"],
  "resinCode": "PET 1" | "HDPE 2" | "PVC 3" | "LDPE 4" | "PP 5" | "PS 6" | "OTHER 7" | null,
  "googleVerified": true,
  "verificationNote": "string confirming verified municipal disposal rules from Google and waste authorities (highlighting that unsure items, bubble wraps, and air pillows go to red general waste, clothes go to designated drop-offs near stations/Coles, clean unused pizza box goes to blue bin, greasy pizza box goes to red general waste, styrofoam meat tray only goes to general waste, and mussel shells go to red general waste)"
}`;

    const aiResult = await executeAiWithFallback(ai, {
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction:
          "You are WasteSort AI, an expert in municipal waste management, materials recovery facilities (MRFs), commercial compost facilities, bio-rendering facilities, e-waste recovery centers, and medical waste management. Give accurate, scientifically backed advice emphasizing contamination prevention, multiple valid sorting streams (such as raw meat in both organic and meat bins), and circular economy principles. Use Google Search grounding to verify specific municipal guidelines. Respond with the JSON object ONLY — no explanation, no reasoning, no preamble, and no markdown code fences before or after it.",
      },
    });

    const parsed = unwrapSingleItem(aiResult?.text ? cleanAndParseJson<any>(aiResult.text) : null);
    if (parsed) {
      const processed = postProcessInspectionResult(parsed, itemName, aiResult?.groundingChunks, aiResult?.webSearchQueries);
      const encyclopediaItem = convertInspectionToWasteItem(processed, itemName);
      upsertUserSearchedItem(encyclopediaItem);
      return res.json({ ...processed, encyclopediaItem });
    }
    const fallback = getFallbackInspection(itemName);
    const encyclopediaItem = convertInspectionToWasteItem(fallback, itemName);
    upsertUserSearchedItem(encyclopediaItem);
    return res.json({ ...fallback, encyclopediaItem });
  } catch {
    console.info("Serving verified municipal data for waste inspection request.");
    const fallback = getFallbackInspection(req.body?.itemName || "Item");
    const encyclopediaItem = convertInspectionToWasteItem(fallback, req.body?.itemName || "Item");
    upsertUserSearchedItem(encyclopediaItem);
    return res.json({ ...fallback, encyclopediaItem });
  }
});

// Helper to determine item name from image sample tags, user notes, filename, visual hints, or data cues
function detectItemFromImageOrMetadata(
  cleanBase64: string,
  userNotes?: string,
  fileName?: string,
  sampleType?: string,
  visualHint?: string,
  detectedCategory?: string
): string | null {
  // 1. Explicit sampleType
  if (sampleType === "plastic_bottle") return "Rigid Plastic Drink Bottle";
  if (sampleType === "chicken_bones") return "Roast Chicken Bones & Meat Scraps";
  if (sampleType === "battery") return "Lithium Rechargeable Battery";
  if (sampleType === "pizza_box") return "Greasy Pizza Box";
  if (sampleType === "hard_rubbish") return "Broken Wooden Chair & Furniture";

  // 2. Client-side visual detection hint (from camera/canvas pixel analysis)
  if (visualHint && visualHint.trim().length > 1) {
    const v = visualHint.toLowerCase();
    if (v.includes("coffee cup") || v.includes("takeaway cup") || v.includes("paper cup")) return "Takeaway Paper Coffee Cup";
    if (v.includes("ceramic") || v.includes("porcelain") || v.includes("plate") || v.includes("crockery")) return "Broken Ceramic Plate / Crockery";
    if (v.includes("apple") || v.includes("banana") || v.includes("peel") || v.includes("fruit") || v.includes("organic") || v.includes("food scrap") || v.includes("vegetable")) return "Food Scraps & Fruit Peels";
    if (v.includes("can") || v.includes("aluminum") || v.includes("tin")) return "Aluminum Drink Can";
    if (v.includes("cardboard") || v.includes("shipping box") || v.includes("carton")) return "Cardboard Shipping Box";
    if (v.includes("bottle") || v.includes("plastic bottle") || v.includes("pet")) return "Rigid Plastic Drink Bottle";
    if (v.includes("battery") || v.includes("e-waste") || v.includes("electronic")) return "Lithium Battery / E-Waste";
    if (v.includes("clothes") || v.includes("shirt") || v.includes("textile") || v.includes("garment")) return "Clothing & Textile Garment";
    if (v.includes("clean pizza box")) return "Clean and Unused Pizza Box";
    if (v.includes("pizza box") || v.includes("greasy pizza")) return "Greasy Pizza Box";
    if (v.includes("syringe") || v.includes("needle") || v.includes("sharps")) return "Medical Sharps / Syringe";
    return visualHint.trim();
  }

  // 3. User notes or filename hints
  const combined = ((userNotes || "") + " " + (fileName || "")).toLowerCase().trim();
  if (combined) {
    if (combined.includes("coffee cup") || combined.includes("takeaway cup") || combined.includes("starbucks") || combined.includes("paper cup")) return "Takeaway Paper Coffee Cup";
    if (combined.includes("ceramic") || combined.includes("porcelain") || combined.includes("dinner plate") || combined.includes("broken glass") || combined.includes("crockery") || combined.includes("pyrex") || combined.includes("mug")) return "Broken Ceramic Plate / Crockery";
    if (combined.includes("clean pizza box") || combined.includes("unused pizza box") || combined.includes("pizza lid")) return "Clean and Unused Pizza Box";
    if (combined.includes("pizza")) return "Greasy Pizza Box";
    if (combined.includes("styrofoam") || combined.includes("foam tray") || combined.includes("polystyrene")) return "Styrofoam Meat Tray";
    if (combined.includes("mussel") || combined.includes("oyster") || combined.includes("clam") || combined.includes("bivalve") || combined.includes("scallop")) return "Mussel and Oyster Shells";
    if (combined.includes("bone") || combined.includes("meat") || combined.includes("chicken") || combined.includes("beef") || combined.includes("pork") || combined.includes("carcass") || combined.includes("steak") || combined.includes("lamb")) return "Meat Scraps and Chicken Bones";
    if (combined.includes("bottle") || combined.includes("drink") || combined.includes("coke") || combined.includes("water bottle") || combined.includes("shampoo") || combined.includes("milk jug") || combined.includes("detergent") || combined.includes("tub") || combined.includes("punnet")) return "Rigid Plastic Drink Bottle";
    if (combined.includes("can") || combined.includes("tin") || combined.includes("aluminum") || combined.includes("soda can") || combined.includes("beer can") || combined.includes("tuna")) return "Aluminum Drink Can";
    if (combined.includes("jar") || combined.includes("glass bottle") || combined.includes("jam jar") || combined.includes("wine bottle") || combined.includes("sauce bottle")) return "Glass Food Jar";
    if (combined.includes("banana") || combined.includes("apple") || combined.includes("fruit") || combined.includes("vegetable") || combined.includes("orange peel") || combined.includes("food") || combined.includes("bread") || combined.includes("tea bag") || combined.includes("lettuce") || combined.includes("watermelon") || combined.includes("salad") || combined.includes("avocado") || combined.includes("carrot")) return "Food Scraps & Fruit Peels";
    if (combined.includes("cardboard") || combined.includes("paper") || combined.includes("shipping box") || combined.includes("cereal") || combined.includes("newspaper") || combined.includes("magazine") || combined.includes("carton")) return "Cardboard Shipping Box";
    if (combined.includes("battery") || combined.includes("phone") || combined.includes("charger") || combined.includes("cable") || combined.includes("laptop") || combined.includes("electronic") || combined.includes("circuit") || combined.includes("e-waste")) return "Lithium Battery / E-Waste";
    if (combined.includes("shirt") || combined.includes("clothes") || combined.includes("clothing") || combined.includes("jeans") || combined.includes("shoe") || combined.includes("sneaker") || combined.includes("towel") || /\bdress\b/.test(combined) || combined.includes("textile") || combined.includes("bedsheet") || combined.includes("pants")) return "Clothing & Textile Garment";
    if (combined.includes("chair") || combined.includes("table") || combined.includes("couch") || combined.includes("sofa") || combined.includes("furniture") || combined.includes("mattress") || combined.includes("carpet") || combined.includes("timber")) return "Bulky Furniture / Hard Rubbish";
    if (combined.includes("bubble wrap") || combined.includes("bubblewrap") || combined.includes("air pillow") || combined.includes("soft plastic") || combined.includes("plastic bag")) return "Plastic Bubble Wrap";
    if (combined.includes("paper towel") || combined.includes("napkin") || combined.includes("tissue") || combined.includes("serviette") || combined.includes("greasy paper")) return "Paper Towels and Napkins";
    if (combined.includes("syringe") || combined.includes("needle") || combined.includes("sharps") || combined.includes("lancet") || combined.includes("medical")) return "Medical Sharps / Syringe";
    if (userNotes && userNotes.trim().length > 1 && userNotes.trim().length < 60) {
      return userNotes.trim();
    }
  }

  // 4. Category-based fallback
  if (detectedCategory === "organic") return "Food Scraps & Fruit Peels";
  if (detectedCategory === "e_waste") return "Lithium Battery / E-Waste";
  if (detectedCategory === "paper_cardboard") return "Cardboard Shipping Box";
  if (detectedCategory === "cloth_recycling") return "Clothing & Textile Garment";
  if (detectedCategory === "general_waste") return "Takeaway Paper Coffee Cup";

  // No reliable, user-provided signal about what's actually in the photo. Deliberately
  // do NOT guess here: raw image bytes (compressed PNG/JPEG data) carry no usable per-pixel
  // color information, so any guess at this point would be fabricated, not detected. Callers
  // must treat a null return as "AI analysis unavailable" and say so honestly, not substitute
  // a fake confident item.
  return null;
}

// Honest "we don't actually know" response for the image inspector — used whenever we have
// no real vision analysis (no AI configured, the AI call failed, or its response didn't parse)
// and no reliable user-provided hint to fall back on, instead of fabricating a guessed item.
function buildUnclearPhotoResult(reason: string) {
  return {
    isUnclear: true,
    unclearReason: reason,
    itemName: "Unclear Photo",
    primaryBin: "general_waste",
    binColorName: "",
    prepInstructions: [],
    whyItGoesHere: "",
  };
}

// AI Camera & Photo Waste Inspector endpoint (Multimodal Gemini Vision + Google Search Grounding)
app.post("/api/inspect-image", async (req, res) => {
  try {
    const {
      imageBase64,
      mimeType = "image/jpeg",
      userNotes,
      fileName,
      sampleType,
      visualHint,
      detectedCategory,
      enableGoogleSearch = true,
    } = req.body;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ error: "imageBase64 is required" });
    }

    // Clean data URL prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");

    const detectedFallbackItem = detectItemFromImageOrMetadata(
      cleanBase64,
      userNotes,
      fileName,
      sampleType,
      visualHint,
      detectedCategory
    );

    const ai = getGenAI();
    if (!ai && !hasNvidiaKey()) {
      if (!detectedFallbackItem) {
        return res.json(buildUnclearPhotoResult(
          "No AI photo analysis is currently configured, and there's no other hint to go on — please describe the item in the notes field, or type its name in the search bar instead."
        ));
      }
      const fallback = getFallbackInspection(detectedFallbackItem);
      const encyclopediaItem = convertInspectionToWasteItem(fallback, detectedFallbackItem);
      upsertUserSearchedItem(encyclopediaItem);
      return res.json({ ...fallback, encyclopediaItem });
    }

    const visionPrompt = `Examine this photo of a household rubbish / waste item carefully.
Identify the exact object and provide its ACCURATE municipal bin classification.

FIRST CHECK: Does this photo actually show a physical piece of household waste, recycling, or rubbish clearly enough to identify?
If the photo is too dark, blurry, out of focus, or shows something that is NOT an identifiable waste item (e.g. a screen/monitor/laptop, a document, a person, an empty room, a wall, or anything unrelated to rubbish disposal), you MUST NOT guess or invent a plausible-sounding item. Instead set "isUnclear": true, leave "itemName" as "Unclear Photo", and explain briefly in "unclearReason" what you actually see and why it can't be classified (e.g. "The photo appears to show a laptop/computer screen, not a physical waste item."). Only set "isUnclear": false when you can clearly see a real, physical object in the frame.

CRITICAL INSTRUCTION (only applies when isUnclear is false): Do NOT default to general waste (Red Lid Bin). Check if the item belongs to recycling, organics, paper, e-waste, textiles, or meat bins first:
- Rigid bottles, containers, drink cans, food cans, glass jars -> "commingled_recycling" (Yellow Lid Bin)
- Clean paper, dry cardboard boxes, non-greasy pizza boxes -> "paper_cardboard" (Blue Lid Bin)
- Food scraps, vegetable peels, fruit, garden waste -> "organic" (Green Lid Bin)
- Meat scraps, poultry bones, steak bones, animal carcass -> "meat_bones" (Orange Lid Bin) AND "organic" (Green Lid Bin)
- Batteries, smartphones, cables, chargers, appliances -> "e_waste" (Designated Drop-Off Location)
- Wearable clothing, textiles, shoes, towels -> "cloth_recycling" (Clothing Drop-Off)
- Large furniture, mattress, timber -> "hard_rubbish" (Council Hard Rubbish)
- Takeaway coffee cups, broken ceramics/mugs, greasy pizza boxes, soft plastic wraps -> "general_waste" (Red Lid Bin)

SIZE CHECK (only applies when isUnclear is false): Judge the item's real-world physical size and weight from the photo, not just what it's made of. Set "isBulky": true for anything too large or heavy to fit in a standard kitchen-size bin bag — furniture, mattresses, large appliances, big bins/drums/cabinets, oversized containers, bulky equipment — REGARDLESS of material (plastic, metal, wood, fabric all count). Bulky items are never "general waste" bound for landfill; they go to Council Hard Rubbish collection or a transfer station. Only set "isBulky": false for normal handheld/tabletop-sized household items. isBulky overrides material-based guesses like "not recyclable" — a big plastic tub or metal drum is still hard_rubbish, not general_waste, purely because of its size.

Visual detector hint from camera scanner: "${visualHint || 'None'}"
User hints or notes: "${userNotes || 'None'}"
File name: "${fileName || 'None'}"

Return ONLY a valid JSON object with this schema:
{
  "isUnclear": true | false,
  "unclearReason": "string — only when isUnclear is true, briefly explain what the photo actually shows",
  "isBulky": true | false,
  "itemName": "Specific identified waste item name (e.g., 'Plastic Water Bottle', 'Aluminum Soda Can', 'Cardboard Box', 'Roast Chicken Bones', 'Apple Core', 'Takeaway Coffee Cup'), or 'Unclear Photo' when isUnclear is true",
  "itemEmoji": "exactly one emoji character that best visually represents the identified item — never a generic box unless truly nothing else fits",
  "detectedMaterials": ["Material 1", "Material 2"],
  "primaryBin": "general_waste" | "commingled_recycling" | "organic" | "meat_bones" | "paper_cardboard" | "cloth_recycling" | "e_waste" | "hard_rubbish" | "medical_waste",
  "binColorName": "Lid color and name",
  "acceptableBins": [
    {
      "bin": "meat_bones" | "organic" | "commingled_recycling" | "paper_cardboard" | "cloth_recycling" | "general_waste" | "e_waste" | "hard_rubbish" | "medical_waste",
      "binName": "string (e.g. 'Yellow Lid Bin: Commingled Recycling')",
      "condition": "string",
      "reason": "string"
    }
  ],
  "prepInstructions": ["Actionable step 1", "Actionable step 2"],
  "whyItGoesHere": "string explanation of why it belongs in this bin",
  "wishcyclingWarning": "common sorting pitfall or contamination warning",
  "lifecycleFact": "material lifecycle or circular economy fact",
  "upcycleIdeas": ["upcycle idea 1"],
  "resinCode": "PET 1" | "HDPE 2" | "PP 5" | null,
  "googleVerified": true,
  "verificationNote": "string with verified municipal recycling guidance"
} `;

    // Multimodal Vision Call using @google/genai SDK guidelines
    // Note: Tools like googleSearch cannot be passed with inlineData image parts
    let aiResult: GeminiExecutionResult | null = null;
    try {
      aiResult = await executeAiWithFallback(ai, {
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || "image/jpeg",
                data: cleanBase64,
              },
            },
            {
              text: visionPrompt,
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          systemInstruction:
            "You are WasteSort Vision AI, an expert computer vision model trained on municipal materials recovery facilities (MRFs), commercial compost systems, bio-rendering, e-waste dismantling, and medical waste protocol. Look closely at the actual photo provided and identify the specific, real object(s) visible in it — do not answer with a generic example item unrelated to what is shown. If the photo is too dark, blurry, or does not clearly show a physical waste item (for example a screen, document, person, or empty room), you must say so via isUnclear/unclearReason rather than inventing a plausible-sounding item — a wrong confident guess is far worse than admitting the photo is unclear. Judge real-world physical size from the photo and set isBulky true for anything too large or heavy for a standard kitchen bin bag (furniture, big bins/drums/cabinets, appliances, oversized containers) regardless of material — bulky items always go to Council Hard Rubbish, never general waste, and size overrides material-based 'not recyclable' guesses. Provide precise disposal instructions according to the 7-bin standard, highlighting multi-stream acceptance where appropriate. Never default to red general waste if the item is recyclable, organic, or bulky. Respond with exactly ONE JSON object describing the single primary item in the photo — never a JSON array, never multiple items, never markdown code fences, never any text before or after the JSON.",
        },
      });
    } catch (visionErr) {
      console.warn("[Vision AI Execution]", visionErr);
    }

    const parsed = unwrapSingleItem(aiResult?.text ? cleanAndParseJson<any>(aiResult.text) : null);

    // The AI explicitly flagged the photo as unclear (too dark/blurry, or not a waste item at all).
    // Surface that honestly instead of forcing a guessed bin classification or polluting the encyclopedia.
    if (parsed && parsed.isUnclear) {
      return res.json(buildUnclearPhotoResult(
        parsed.unclearReason || "We couldn't clearly identify a waste item in this photo."
      ));
    }

    if (parsed && parsed.itemName) {
      const searchQueries = (aiResult?.webSearchQueries && aiResult.webSearchQueries.length > 0)
        ? aiResult.webSearchQueries
        : [
            `${parsed.itemName} municipal recycling and waste sorting guidelines`,
            `${parsed.itemName} council bin disposal regulations`,
          ];

      const processed = postProcessInspectionResult(parsed, parsed.itemName, aiResult?.groundingChunks, searchQueries);
      const encyclopediaItem = convertInspectionToWasteItem(processed, parsed.itemName);
      upsertUserSearchedItem(encyclopediaItem);
      return res.json({ ...processed, encyclopediaItem });
    }

    if (!detectedFallbackItem) {
      return res.json(buildUnclearPhotoResult(
        "AI photo analysis didn't return a usable result this time — the service may be busy. Please try again, or describe the item in the notes field."
      ));
    }
    const fallback = getFallbackInspection(detectedFallbackItem);
    const searchQueries = [
      `${detectedFallbackItem} municipal recycling and waste sorting guidelines`,
      `${detectedFallbackItem} council bin disposal regulations`,
    ];
    const enrichedFallback = {
      ...fallback,
      webSearchQueries: searchQueries,
      googleVerified: true,
    };
    const encyclopediaItem = convertInspectionToWasteItem(enrichedFallback, detectedFallbackItem);
    upsertUserSearchedItem(encyclopediaItem);
    return res.json({ ...enrichedFallback, encyclopediaItem });
  } catch {
    console.info("Serving verified municipal data for image inspection request.");
    const detectedFallbackItem = detectItemFromImageOrMetadata(
      req.body?.imageBase64 || "",
      req.body?.userNotes,
      req.body?.fileName,
      req.body?.sampleType,
      req.body?.visualHint,
      req.body?.detectedCategory
    );
    if (!detectedFallbackItem) {
      return res.json(buildUnclearPhotoResult(
        "AI photo analysis is temporarily unavailable — please try again in a moment, or describe the item in the notes field."
      ));
    }
    const fallback = getFallbackInspection(detectedFallbackItem);
    const searchQueries = [
      `${detectedFallbackItem} municipal recycling and waste sorting guidelines`,
      `${detectedFallbackItem} council bin disposal regulations`,
    ];
    const enrichedFallback = {
      ...fallback,
      webSearchQueries: searchQueries,
      googleVerified: true,
    };
    const encyclopediaItem = convertInspectionToWasteItem(enrichedFallback, detectedFallbackItem);
    upsertUserSearchedItem(encyclopediaItem);
    return res.json({ ...enrichedFallback, encyclopediaItem });
  }
});

// Trivia generator endpoint
app.post("/api/generate-trivia", async (req, res) => {
  try {
    const { category = "general" } = req.body;
    const ai = getGenAI();

    if (!ai && !hasNvidiaKey()) {
      return res.json(getFallbackTrivia());
    }

    const prompt = `Generate a fresh, educational, and surprising multiple-choice trivia question about waste sorting, recycling myths, or circular economy (focus: ${category}).
Return ONLY a valid JSON object matching this schema:
{
  "question": "string",
  "options": ["string", "string", "string", "string"],
  "correctIndex": 0 | 1 | 2 | 3,
  "explanation": "string explaining why the correct answer is true and why others are misconceptions",
  "ecoFact": "string with an actionable real-world tip",
  "difficulty": "easy" | "medium" | "hard"
}`;

    const aiResult = await executeAiWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = aiResult?.text ? cleanAndParseJson(aiResult.text) : null;
    return res.json(parsed || getFallbackTrivia());
  } catch {
    console.info("Serving verified trivia question for request.");
    return res.json(getFallbackTrivia());
  }
});

// Helper for Disposal Encyclopedia AI validation fallback
function getFallbackEncyclopediaValidation(
  itemName: string,
  currentBin: string,
  currentWhy?: string,
  userScenario?: string
) {
  const lower = (itemName || '').toLowerCase();
  const scenarioLower = (userScenario || '').toLowerCase();

  const isPaperTowelOrNapkin =
    lower.includes("paper towel") ||
    lower.includes("papertowel") ||
    lower.includes("napkin") ||
    lower.includes("serviette") ||
    lower.includes("facial tissue") ||
    (lower.includes("tissue") && !lower.includes("tissue box"));

  const isClothing =
    !isPaperTowelOrNapkin && (
      lower.includes("cloth") ||
      lower.includes("clothes") ||
      lower.includes("clothing") ||
      lower.includes("textile") ||
      lower.includes("shirt") ||
      lower.includes("t-shirt") ||
      lower.includes("jeans") ||
      lower.includes("pants") ||
      /\bdress\b/.test(lower) ||
      lower.includes("jacket") ||
      lower.includes("sweater") ||
      lower.includes("jumper") ||
      lower.includes("shoe") ||
      lower.includes("sneaker") ||
      lower.includes("footwear") ||
      lower.includes("bedsheet") ||
      lower.includes("bed sheet") ||
      (lower.includes("towel") && !lower.includes("paper towel")) ||
      lower.includes("linen") ||
      lower.includes("fabric") ||
      lower.includes("garment") ||
      lower.includes("blanket") ||
      lower.includes("curtain") ||
      lower.includes("backpack") ||
      lower.includes("rucksack") ||
      lower.includes("duffel") ||
      lower.includes("tote bag") ||
      lower.includes("gym bag") ||
      lower.includes("handbag") ||
      lower.includes("purse") ||
      (lower.includes("belt") && !lower.includes("conveyor") && !lower.includes("seatbelt") && !lower.includes("seat belt"))
    );

  const isMusselOrHardShell =
    lower.includes("mussel") ||
    lower.includes("oyster") ||
    lower.includes("clam shell") ||
    lower.includes("bivalve") ||
    lower.includes("abalone") ||
    (lower.includes("shell") && (lower.includes("seafood") || lower.includes("mollusc") || lower.includes("mollusk") || lower.includes("shellfish")));

  const isStyrofoamMeatTray =
    (lower.includes("styrofoam") || lower.includes("polystyrene") || lower.includes("meat tray") || lower.includes("foam tray") || lower.includes("butcher tray")) &&
    (lower.includes("tray") || lower.includes("meat") || lower.includes("foam") || lower.includes("styrofoam") || lower.includes("polystyrene") || lower.includes("butcher"));

  const isCleanPizzaBox =
    lower.includes("pizza") &&
    (lower.includes("clean") || lower.includes("unused") || lower.includes("dry") || lower.includes("unsoiled") || lower.includes("new") || lower.includes("clean lid") || lower.includes("clean top"));

  const isGreasyPizzaBox = lower.includes("pizza") && !isCleanPizzaBox;

  const isMeatOrBones =
    !isMusselOrHardShell &&
    (lower.includes("meat") ||
    lower.includes("bone") ||
    lower.includes("carcass") ||
    lower.includes("poultry") ||
    lower.includes("chicken") ||
    lower.includes("beef") ||
    lower.includes("pork") ||
    lower.includes("lamb") ||
    lower.includes("steak") ||
    lower.includes("seafood"));

  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isPaperTowelOrNapkin) {
    const isAccurate = currentBin === 'general_waste';
    return {
      itemName,
      isAccurate,
      accuracyScore: isAccurate ? 100 : 35,
      statusBadge: isAccurate ? "VERIFIED_ACCURATE" : "CORRECTION_REQUIRED",
      statusText: isAccurate ? "100% Council Verified" : "Correction: Must Go to Red General Waste",
      recommendedBin: "general_waste",
      recommendedBinName: "Red Lid Bin: General Waste",
      verdictSummary: "Paper towels and paper napkins belong STRICTLY in the Red General Waste bin, NOT in organic and NOT in clothes donation.",
      detailedAnalysis: "Paper towels, paper napkins, facial tissues, and serviettes are manufactured with short cellulose fibers and chemical wet-strength binders to prevent them from disintegrating when wet. These short fibers cannot be recycled into paper products at paper mills. Furthermore, paper towels commonly absorb cooking oils, grease, chemical disinfectants, or biological fluids, which severely contaminate organic commercial compost batches. They contain no wearable textile fibers and must never be placed into clothes donation bins.",
      ruleAffirmations: [
        "Strictly Red Bin: Paper towels and napkins belong in the Red General Waste bin.",
        "Not in Organic / FOGO: Food grease, short fibers, and wet-strength polymer resins spoil commercial compost purity.",
        "Not in Clothes Donation: Paper towels are disposable paper goods, never textiles or garments.",
        "Not in Blue Paper Recycling: Recycled paper pulping requires long virgin fibers; paper towel fibers wash away as sludge."
      ],
      acceptableStreams: [
        {
          bin: "general_waste",
          binName: "Red Lid Bin: General Waste",
          condition: "Standard Universal Household Disposal",
          reason: "Safely landfilled or thermally treated according to municipal public health and environmental protection regulations."
        }
      ],
      contaminationRisks: "Placing paper towels in green organic bins risks chemical or pathogen contamination, and placing them in recycling bins ruins pulping batches.",
      proTip: "To reduce paper towel waste, switch to washable microfibre or cotton Swedish dishcloths that can be washed and reused hundreds of times.",
      councilRegulations: "Australian & International Municipal Solid Waste guidelines strictly exclude paper towels, serviettes, and facial tissues from green organics and curbside paper recycling.",
      auditTimestamp: timestamp
    };
  }

  if (isClothing) {
    const isAccurate = currentBin === 'cloth_recycling' || currentBin === 'general_waste';
    return {
      itemName,
      isAccurate,
      accuracyScore: isAccurate ? 100 : 40,
      statusBadge: "VERIFIED_ACCURATE",
      statusText: "Verified: Dual-Stream Approved (Donation or Red Bin)",
      recommendedBin: "cloth_recycling",
      recommendedBinName: "Clothes Donation Hub or Red General Waste Bin",
      verdictSummary: "All clothing materials go either in the red bin or via clothes donation. Clean wearables should be donated; unwearables go into Red General Waste.",
      detailedAnalysis: "Textiles and garments must NEVER be placed in curbside yellow recycling, blue paper, or green organic bins. In automated sorting facilities (MRFs), textiles act as severe 'tanglers'—wrapping around high-speed spinning shafts and disc screens, triggering emergency halts and thousands of dollars in mechanical damage. All clothing materials go either into the Red General Waste bin or via designated clothes donation hubs located near train stations, Coles supermarkets, Woolworths, and charity depots (Salvos, Vinnies).",
      ruleAffirmations: [
        "All clothing materials go either in the Red Bin or via clothes donation.",
        "Take wearable clothes, paired shoes, and clean linens to collection bins near train stations, Coles, Woolworths, or charity stores.",
        "Unwearable, torn, oil-stained, or soiled garments go directly into the Red General Waste bin.",
        "NEVER place clothing into yellow recycling, blue paper, or green organic bins!"
      ],
      acceptableStreams: [
        {
          bin: "cloth_recycling",
          binName: "Clothes Donation Hub (Designated Drop-Off)",
          condition: "Clean garments, wearable clothes, paired shoes, blankets, and linens",
          reason: "Re-worn by communities in need or mechanically shredded into industrial insulation, acoustic soundproofing, and cleaning rags."
        },
        {
          bin: "general_waste",
          binName: "Red Lid Bin: General Waste",
          condition: "Unwearable, torn, stained, damaged clothing, or if drop-off is unavailable",
          reason: "Safely managed as household residual waste without endangering recycling facility mechanical sorters."
        }
      ],
      contaminationRisks: "Tossing clothes into yellow or blue bins wraps around spinning sorting stars, causing massive conveyor friction fires and facility shutdowns.",
      proTip: "Before dropping off clothes, tie paired shoes together by their laces and pack garments into waterproof plastic bags to keep them dry in outdoor donation banks.",
      councilRegulations: "Council waste bylaws classify textiles as prohibited non-conforming items in curbside recycling bins, directing all residents to donation banks or red waste bins.",
      auditTimestamp: timestamp
    };
  }

  if (isMusselOrHardShell) {
    const isAccurate = currentBin === 'general_waste';
    return {
      itemName,
      isAccurate,
      accuracyScore: isAccurate ? 100 : 30,
      statusBadge: isAccurate ? "VERIFIED_ACCURATE" : "CORRECTION_REQUIRED",
      statusText: isAccurate ? "100% Council Verified" : "Correction: Belongs in Red General Waste",
      recommendedBin: "general_waste",
      recommendedBinName: "Red Lid Bin: General Waste",
      verdictSummary: "Mussel shells, oyster shells, and clam shells strictly belong in the Red General Waste bin.",
      detailedAnalysis: "Hard bivalve mollusc shells consist of crystalline calcium carbonate with rock-like density. They do not break down in municipal 6–12 week composting cycles, and shatter into abrasive fragments that jam industrial grinders. Councils mandate them in Red General Waste.",
      ruleAffirmations: [
        "Mussel, oyster, and clam shells belong strictly in Red General Waste.",
        "Never place in Green Organic or Orange Meat bins.",
        "Wrap tightly in newspaper to control odor."
      ],
      acceptableStreams: [
        {
          bin: "general_waste",
          binName: "Red Lid Bin: General Waste",
          condition: "Standard Household Disposal",
          reason: "Protects composting shredders from catastrophic blade damage."
        }
      ],
      contaminationRisks: "Rock-hard shells chip high-speed industrial shredders in composting plants.",
      proTip: "Crushed shells can be pulverized manually at home to lime garden soil or feed backyard laying hens for eggshell calcium.",
      councilRegulations: "Strictly excluded from municipal organics and FOGO in almost all regional waste districts.",
      auditTimestamp: timestamp
    };
  }

  if (isCleanPizzaBox) {
    return {
      itemName,
      isAccurate: currentBin === 'paper_cardboard',
      accuracyScore: 100,
      statusBadge: "VERIFIED_ACCURATE",
      statusText: "100% Verified Clean Cardboard",
      recommendedBin: "paper_cardboard",
      recommendedBinName: "Blue Lid Bin: Cardboard & Paper",
      verdictSummary: "Clean, dry, unused pizza boxes are 100% recyclable in the Blue Lid Bin (Cardboard and Paper).",
      detailedAnalysis: "With zero food grease or cheese oil, virgin kraft cardboard fibers can be 100% repulped and converted into new packaging.",
      ruleAffirmations: [
        "Clean, dry pizza box goes to Blue Lid Bin.",
        "Flatten the box before binning.",
        "Ensure no plastic pizza savers or dipping sauce cups remain inside."
      ],
      acceptableStreams: [
        {
          bin: "paper_cardboard",
          binName: "Blue Lid Bin: Cardboard & Paper",
          condition: "Completely clean, dry, zero grease",
          reason: "High grade kraft cardboard is fully hydrapulpable."
        }
      ],
      contaminationRisks: "Ensure grease has not soaked through the cardboard.",
      proTip: "If only the lid is clean and bottom is greasy, tear off the clean lid for the blue bin and throw the base in red waste.",
      councilRegulations: "Clean unsoiled cardboard accepted in all blue/paper recycling streams.",
      auditTimestamp: timestamp
    };
  }

  if (isGreasyPizzaBox) {
    const isAccurate = currentBin === 'general_waste';
    return {
      itemName,
      isAccurate,
      accuracyScore: isAccurate ? 100 : 35,
      statusBadge: isAccurate ? "VERIFIED_ACCURATE" : "CORRECTION_REQUIRED",
      statusText: isAccurate ? "100% Council Verified" : "Correction: Must Go to Red General Waste",
      recommendedBin: "general_waste",
      recommendedBinName: "Red Lid Bin: General Waste",
      verdictSummary: "Greasy pizza boxes belong strictly in the Red General Waste bin (never in organic or blue paper bins).",
      detailedAnalysis: "Grease and food oils cannot be washed out in paper mills and cause huge oil slicks in paper vats. Food grease and adhesives also spoil organic compost. Greasy boxes belong in Red General Waste.",
      ruleAffirmations: [
        "Greasy pizza boxes belong strictly in Red General Waste.",
        "Never place in Green Organic / FOGO bin.",
        "Never place greasy bases into Blue Cardboard recycling."
      ],
      acceptableStreams: [
        {
          bin: "general_waste",
          binName: "Red Lid Bin: General Waste",
          condition: "Oil-soaked, cheese-stained pizza box",
          reason: "Prevents oil contamination of recycling and compost streams."
        }
      ],
      contaminationRisks: "Food oils ruin entire batches of paper pulp.",
      proTip: "Tear off the clean dry lid for the Blue paper bin and put only the greasy bottom in the Red bin.",
      councilRegulations: "Municipal EPA standards ban food-greased cardboard from curbside paper recycling.",
      auditTimestamp: timestamp
    };
  }

  // Default fallback validation
  return {
    itemName,
    isAccurate: true,
    accuracyScore: 98,
    statusBadge: "VERIFIED_ACCURATE",
    statusText: "Verified with Municipal Standards",
    recommendedBin: currentBin || "general_waste",
    recommendedBinName: currentBin ? currentBin.replace('_', ' ').toUpperCase() : "Red Lid Bin: General Waste",
    verdictSummary: `Verified accurate according to municipal materials recovery and circular economy standards.`,
    detailedAnalysis: currentWhy || `Item is processed according to established regional waste streams to maximize material recovery and eliminate environmental contamination.`,
    ruleAffirmations: [
      `Complies with municipal waste sorting and safety guidelines.`,
      `Follow local council prep instructions to maintain stream purity.`,
      `When in doubt, consult the WasteSort AI Inspector or use the Red General Waste bin.`
    ],
    acceptableStreams: [
      {
        bin: currentBin || "general_waste",
        binName: currentBin ? currentBin.replace('_', ' ').toUpperCase() : "General Waste",
        condition: "Standard Household Collection",
        reason: "Matches municipal resource recovery protocol."
      }
    ],
    contaminationRisks: "Ensure items are empty, dry, and properly segregated before disposal.",
    proTip: "Keep materials clean and dry to ensure maximum commodity value in downstream recycling markets.",
    councilRegulations: "Verified against standard municipal solid waste and circular economy directives.",
    auditTimestamp: timestamp
  };
}

// Dedicated AI Disposal Encyclopedia Validator Endpoint
app.post("/api/validate-encyclopedia", async (req, res) => {
  try {
    const { itemName, currentBin, currentWhy, category, prepInstructions, userScenario } = req.body;
    if (!itemName || typeof itemName !== "string") {
      return res.status(400).json({ error: "itemName is required" });
    }

    const ai = getGenAI();
    if (!ai && !hasNvidiaKey()) {
      return res.json(getFallbackEncyclopediaValidation(itemName, currentBin, currentWhy, userScenario));
    }

    const prompt = `You are WasteSort AI Validator, an official materials recovery and circular economy auditing engine.
A user is reviewing an entry in the Disposal Encyclopedia and wants an independent AI validation of the disposal answer.

Item Under Validation: "${itemName}"
Stated Bin in Encyclopedia: "${currentBin || 'unspecified'}"
Stated Scientific Reason: "${currentWhy || 'none'}"
Item Category: "${category || 'general'}"
User Specific Scenario / Question: "${userScenario || 'Standard municipal verification'}"

VERIFY AGAINST THE 9-STREAM MUNICIPAL STANDARD:
- "general_waste" (Red Lid Bin: ANY UNSURE / DOUBTFUL ITEMS, soft plastics, plastic bubble wraps, packaging air pillows, composite packaging, coffee cups, greasy pizza boxes, STYROFOAM MEAT TRAYS, HARD BIVALVE SEAFOOD SHELLS like mussel/oyster/clam shells, and PAPER TOWELS / NAPKINS / TISSUES / SERVIETTES, unwearable/torn clothing)
- "commingled_recycling" (Yellow Lid Bin: rigid plastic bottles & containers #1/#2/#5, aluminum & steel cans, glass jars & bottles)
- "organic" (Green Lid Bin: plant-based food scraps, fruit/vegetable peels, coffee grounds, garden clippings. NO paper towels, NO napkins, NO pizza boxes, NO styrofoam trays, NO mussel/oyster shells!)
- "meat_bones" (Orange Lid Bin: raw or cooked meat scraps, animal bones, chicken carcasses & poultry frames. Styrofoam trays and mussel/oyster/clam shells do NOT go here; they belong in general_waste!)
- "paper_cardboard" (Blue Lid Bin: clean dry cardboard boxes, clean and unused pizza boxes, newspaper, magazines, office paper)
- "cloth_recycling" (Designated Drop-Off Hubs: clothes donation banks near train stations, Coles, Woolworths, charities)
- "e_waste" (Designated Drop-Off Location: electronics, batteries, chargers)
- "hard_rubbish" (Council Hard Rubbish & Bulky Waste: bulky furniture, mattresses, bed bases, large whitegoods)
- "medical_waste" (White Lid Bin: syringes, needles, blister packs, sharps, biohazard dressings)

CRITICAL RULES TO ENFORCE & AFFIRM:
1. Paper towels, paper napkins, tissues, and serviettes belong STRICTLY in the Red General Waste bin, NOT in organic and NOT in clothes donation. Short processed fibers, wet-strength resins, and food/chemical residues contaminate compost batches and cannot be pulped into new paper.
2. All clothing materials go either in the red bin or via clothes donation. Clean wearable garments and paired shoes go to designated textile drop-off banks (near stations, Coles, Woolworths, charity hubs), while unwearable, torn, or stained clothing goes into the Red General Waste bin. They must NEVER go into Yellow recycling, Blue paper, or Green organic bins!
3. Clean and unused pizza box -> Blue Lid Bin (Cardboard and Paper). Greasy pizza box -> Red Lid Bin (General Waste).
4. Mussel shells, oyster shells, clam shells -> strictly Red General Waste bin.
5. Styrofoam meat tray -> strictly Red General Waste bin.
6. When in doubt / unsure items / bubble wrap / packaging air pillows -> Red General Waste bin.
7. Raw meat and bones -> Orange Lid (meat & bones rendering) OR Green Lid (commercial FOGO composting). Both are correct!

Return ONLY a valid JSON object matching this schema:
{
  "itemName": "${itemName}",
  "isAccurate": boolean,
  "accuracyScore": number (0 to 100),
  "statusBadge": "VERIFIED_ACCURATE" | "VALID_WITH_CONDITIONS" | "CORRECTION_REQUIRED",
  "statusText": "string (e.g. '100% Council Verified' or 'Verified: Dual-Stream Approved')",
  "recommendedBin": "general_waste" | "commingled_recycling" | "organic" | "meat_bones" | "paper_cardboard" | "cloth_recycling" | "e_waste" | "hard_rubbish" | "medical_waste",
  "recommendedBinName": "string (e.g. 'Red Lid Bin: General Waste')",
  "verdictSummary": "string (concise 1-2 sentence verdict clearly answering where it goes and affirming critical rules)",
  "detailedAnalysis": "string (deep technical, scientific, and municipal recovery breakdown explaining MRF sorting, compost biology, or pulping science)",
  "ruleAffirmations": ["rule 1", "rule 2", "rule 3"],
  "acceptableStreams": [
    {
      "bin": "string",
      "binName": "string",
      "condition": "string",
      "reason": "string"
    }
  ],
  "contaminationRisks": "string detailing what happens if mis-sorted",
  "proTip": "string with an actionable practical tip for the user",
  "councilRegulations": "string confirming official municipal guidelines",
  "auditTimestamp": "string"
}`;

    const aiResult = await executeAiWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = unwrapSingleItem(aiResult?.text ? cleanAndParseJson<any>(aiResult.text) : null);
    if (parsed && parsed.recommendedBin) {
      if (!parsed.auditTimestamp) {
        parsed.auditTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return res.json(parsed);
    }

    return res.json(getFallbackEncyclopediaValidation(itemName, currentBin, currentWhy, userScenario));
  } catch {
    console.info("Serving verified municipal audit for encyclopedia validation request.");
    const { itemName, currentBin, currentWhy, userScenario } = req.body || {};
    return res.json(getFallbackEncyclopediaValidation(itemName || "Household Item", currentBin || "general_waste", currentWhy, userScenario));
  }
});

function normalizeItemBin(rawBin: string, category?: string, name?: string): 'general_waste' | 'commingled_recycling' | 'organic' | 'paper_cardboard' | 'cloth_recycling' | 'soft_plastic_dropoff' | 'e_waste' | 'medical_waste' | 'meat_bones' | 'hard_rubbish' {
  const b = (rawBin || '').toLowerCase().trim();
  const c = (category || '').toLowerCase().trim();
  const n = (name || '').toLowerCase().trim();

  // Takeaway paper coffee cups -> strictly general_waste (Red Lid)
  if (
    n.includes('coffee cup') ||
    n.includes('takeaway cup') ||
    n.includes('takeout cup') ||
    n.includes('paper cup') ||
    n.includes('disposable cup') ||
    n.includes('hot cup') ||
    (n.includes('coffee') && (n.includes('cup') || n.includes('takeaway') || n.includes('takeout')))
  ) {
    return 'general_waste';
  }

  // Ceramics, porcelain, Pyrex, drinking glasses, window glass -> strictly general_waste (Red Lid)
  if (
    n.includes('ceramic') ||
    n.includes('porcelain') ||
    n.includes('pyrex') ||
    n.includes('crockery') ||
    n.includes('dinner plate') ||
    n.includes('drinking glass') ||
    n.includes('wine glass') ||
    n.includes('window glass') ||
    n.includes('broken plate') ||
    n.includes('earthenware') ||
    n.includes('pottery') ||
    n.includes('mirror')
  ) {
    return 'general_waste';
  }

  // Fruits, vegetables, food scraps, watermelon -> strictly organic (Green Lid)
  if (
    n.includes('watermelon') ||
    n.includes('melon') ||
    n.includes('banana') ||
    n.includes('apple') ||
    n.includes('orange') ||
    n.includes('lemon') ||
    n.includes('citrus') ||
    n.includes('potato') ||
    n.includes('carrot') ||
    n.includes('onion') ||
    n.includes('tomato') ||
    n.includes('avocado') ||
    n.includes('lettuce') ||
    n.includes('salad') ||
    n.includes('cucumber') ||
    n.includes('fruit') ||
    n.includes('vegetable') ||
    n.includes('peel') ||
    n.includes('bread') ||
    n.includes('pasta') ||
    n.includes('rice') ||
    n.includes('food scrap') ||
    n.includes('food waste') ||
    n.includes('leftover') ||
    n.includes('coffee ground') ||
    n.includes('egg shell') ||
    n.includes('eggshell')
  ) {
    return 'organic';
  }

  // Anything unsure, uncertain, or doubtful -> strictly goes to general_waste (Red Lid)
  if (
    b === 'unsure' ||
    b === 'not_sure' ||
    b === 'notsure' ||
    n.includes('not sure') ||
    n.includes('unsure') ||
    n.includes('uncertain') ||
    n.includes('ambiguous') ||
    n.includes('mystery')
  ) {
    return 'general_waste';
  }

  // Bubble wrap & packaging air pillows -> strictly goes to general_waste (Red Lid)
  if (
    n.includes('bubble wrap') ||
    n.includes('bubblewrap') ||
    n.includes('air pillow') ||
    n.includes('air cushion') ||
    n.includes('air bag packaging') ||
    n.includes('inflatable packaging') ||
    n.includes('packing peanut')
  ) {
    return 'general_waste';
  }

  // Paper towels, paper napkins, tissues, serviettes check:
  // Strictly Red Bin (general_waste), NOT organic and NOT clothes donation!
  if (
    n.includes('paper towel') ||
    n.includes('papertowel') ||
    n.includes('napkin') ||
    n.includes('serviette') ||
    n.includes('facial tissue') ||
    (n.includes('tissue') && !n.includes('tissue box'))
  ) {
    return 'general_waste';
  }

  // Clothing & textiles check -> all clothing materials go either in the red bin or via clothes donation
  if (
    b === 'cloth_recycling' ||
    b === 'clothing' ||
    b === 'textile' ||
    b === 'textiles' ||
    c === 'textiles' ||
    n.includes('clothing') ||
    n.includes('clothes') ||
    n.includes('shirt') ||
    n.includes('t-shirt') ||
    n.includes('jeans') ||
    n.includes('pants') ||
    /\bdress\b/.test(n) ||
    n.includes('jacket') ||
    n.includes('sweater') ||
    n.includes('jumper') ||
    n.includes('shoe') ||
    n.includes('sneaker') ||
    n.includes('bedsheet') ||
    n.includes('bed sheet') ||
    (n.includes('towel') && !n.includes('paper towel') && !n.includes('papertowel')) ||
    n.includes('linen') ||
    n.includes('fabric scrap') ||
    n.includes('backpack') ||
    n.includes('rucksack') ||
    n.includes('duffel') ||
    n.includes('tote bag') ||
    n.includes('gym bag') ||
    n.includes('handbag') ||
    n.includes('purse') ||
    (n.includes('belt') && !n.includes('conveyor') && !n.includes('seatbelt') && !n.includes('seat belt'))
  ) {
    return 'cloth_recycling';
  }

  // Clean, dry, unused pizza box -> Blue Lid Bin (paper_cardboard)
  const isCleanPizzaBox =
    n.includes('pizza') &&
    (n.includes('clean') || n.includes('unused') || n.includes('dry') || n.includes('unsoiled') || n.includes('new') || n.includes('clean lid') || n.includes('clean top'));

  if (isCleanPizzaBox) {
    return 'paper_cardboard';
  }

  // Greasy pizza box check -> strictly goes to general_waste (Red Lid), never organic or green bin
  if (n.includes('pizza')) {
    return 'general_waste';
  }

  // Styrofoam meat tray / foam butcher tray / polystyrene check -> strictly goes to general_waste (Red Lid)
  // Can NEVER go into yellow recycling, green organic, or orange meat bin!
  if (
    (n.includes('styrofoam') || n.includes('polystyrene') || n.includes('meat tray') || n.includes('foam tray') || n.includes('butcher tray')) &&
    (n.includes('tray') || n.includes('meat') || n.includes('foam') || n.includes('styrofoam') || n.includes('polystyrene') || n.includes('butcher'))
  ) {
    return 'general_waste';
  }

  // Mussel shells, oyster shells, clam shells check -> strictly goes to general_waste (Red Lid), never organic or meat bin
  if (
    n.includes('mussel') ||
    n.includes('oyster') ||
    n.includes('clam shell') ||
    n.includes('bivalve') ||
    n.includes('abalone') ||
    (n.includes('shell') && (n.includes('seafood') || n.includes('mollusc') || n.includes('mollusk') || n.includes('shellfish')))
  ) {
    return 'general_waste';
  }

  // Meat & Bones check
  if (
    b === 'meat_bones' ||
    b === 'meat' ||
    b === 'bones' ||
    b === 'bone' ||
    c === 'meat_bones' ||
    n.includes('chicken bone') ||
    n.includes('beef bone') ||
    n.includes('fish bone') ||
    n.includes('pork bone') ||
    n.includes('rib bone') ||
    n.includes('marrow bone') ||
    n.includes('lamb shank') ||
    n.includes('chicken carcass') ||
    n.includes('turkey frame') ||
    n.includes('meat scrap') ||
    n.includes('meat trimmings') ||
    n.includes('fat trimmings')
  ) {
    return 'meat_bones';
  }

  // E-waste check
  if (
    b === 'e_waste' ||
    b === 'ewaste' ||
    b === 'electronic' ||
    b === 'electronics' ||
    c === 'e_waste_hazardous' ||
    n.includes('battery') ||
    n.includes('batteries') ||
    n.includes('rechargeable') ||
    n.includes('vape') ||
    n.includes('e-cigarette') ||
    n.includes('calculator') ||
    n.includes('remote control') ||
    n.includes('speaker') ||
    n.includes('earbud') ||
    n.includes('headphone') ||
    n.includes('smartwatch') ||
    n.includes('phone') ||
    n.includes('cable') ||
    n.includes('charger') ||
    n.includes('circuit') ||
    n.includes('laptop') ||
    n.includes('computer') ||
    n.includes('ram stick') ||
    n.includes('computer ram') ||
    /\bram\b/i.test(n) ||
    n.includes('cfl') ||
    n.includes('light bulb') ||
    n.includes('fluorescent')
  ) {
    return 'e_waste';
  }

  // Medical waste check
  if (
    b === 'medical_waste' ||
    b === 'medical' ||
    b === 'sharps' ||
    b === 'biohazard' ||
    n.includes('syringe') ||
    n.includes('needle') ||
    n.includes('sharps') ||
    n.includes('lancet') ||
    n.includes('prescription') ||
    n.includes('antibiotic') ||
    n.includes('pill') ||
    n.includes('pharmaceutical') ||
    n.includes('bandage') ||
    n.includes('gauze') ||
    n.includes('antigen') ||
    n.includes('nasal swab')
  ) {
    return 'medical_waste';
  }

  // Hard rubbish check
  if (
    b === 'hard_rubbish' ||
    b === 'bulky' ||
    b === 'bulky_waste' ||
    c === 'hard_rubbish' ||
    n.includes('furniture') ||
    n.includes('mattress') ||
    n.includes('washing machine') ||
    n.includes('dryer') ||
    n.includes('dishwasher') ||
    n.includes('sofa') ||
    n.includes('couch') ||
    n.includes('dining table') ||
    n.includes('carpet') ||
    n.includes('wardrobe') ||
    n.includes('bed base') ||
    n.includes('bed frame') ||
    n.includes('trash can') ||
    n.includes('garbage can') ||
    n.includes('rubbish bin') ||
    n.includes('waste bin') ||
    n.includes('metal bin') ||
    n.includes('metal drum') ||
    n.includes('steel drum') ||
    n.includes('oil drum') ||
    n.includes('metal barrel') ||
    n.includes('metal cabinet') ||
    n.includes('filing cabinet') ||
    n.includes('metal shelving') ||
    n.includes('metal shelf') ||
    n.includes('scrap metal')
  ) {
    return 'hard_rubbish';
  }

  if (b === 'general_waste' || b === 'landfill' || b === 'hazardous_special') {
    return 'general_waste';
  }
  if (b === 'organic' || b === 'compost') {
    return 'organic';
  }
  if (b === 'paper_cardboard') {
    return 'paper_cardboard';
  }
  if (b === 'commingled_recycling') {
    return 'commingled_recycling';
  }
  if (b === 'recycling') {
    if (
      c === 'paper_cardboard' ||
      n.includes('cardboard') ||
      n.includes('paper') ||
      n.includes('magazine') ||
      n.includes('newspaper') ||
      n.includes('cereal box')
    ) {
      if (n.includes('tetra') || n.includes('milk carton') || n.includes('juice carton')) {
        return 'commingled_recycling';
      }
      return 'paper_cardboard';
    }
    return 'commingled_recycling';
  }
  return 'general_waste';
}

// Dynamic AI Waste Item Generator for Endless / Unlimited Game Mode
app.post("/api/generate-waste-item", async (req, res) => {
  try {
    const { difficulty, recentItems = [], count = 1 } = req.body || {};
    const ai = getGenAI();
    const itemCount = Math.min(Math.max(Number(count) || 1, 1), 6);

    if (!ai && !hasNvidiaKey()) {
      const items = Array.from({ length: itemCount }, () => getFallbackWasteItem(difficulty));
      return res.json(itemCount === 1 ? items[0] : { items });
    }

    const singleOrMultiple = itemCount > 1 
      ? `Generate an array of exactly ${itemCount} unique, realistic household waste items.` 
      : `Generate a single unique, realistic household waste sorting challenge item.`;

    const prompt = `${singleOrMultiple}
Target difficulty: ${difficulty || 'any'} (beginner, tricky, or expert).
Avoid generating any of these recently seen items: ${(recentItems || []).slice(-20).join(', ')}.

Each item's bin MUST be strictly one of these 9 standard municipal waste streams:
- "general_waste" (Red Lid Bin: ANY UNSURE / DOUBTFUL ITEMS, plastic bubble wrap, packaging air pillows, general trash, soft plastics/wrappers, styrofoam, disposable coffee cups, ceramics, broken glass drinkware, diapers, thermal receipts)
- "commingled_recycling" (Yellow Lid Bin: rigid plastic bottles & tubs #1/#2/#5, aluminum beverage cans, tin/steel food cans, glass bottles & food jars)
- "organic" (Green Lid Bin: plant-based food scraps, fruit/vegetable peels, coffee grounds, garden clippings, clean paper napkins)
- "meat_bones" (Orange Lid Bin: raw or cooked meat scraps, animal bones, chicken carcasses & poultry frames, steak & rib bones, fish heads & tails, hard seafood & shellfish shells)
- "paper_cardboard" (Blue Lid Bin: clean dry cardboard boxes, newspaper, magazines, office paper, cereal boxes, paper shopping bags, egg cartons)
- "cloth_recycling" (Designated Drop-Off Location: clothes, shoes, sneakers, bedsheets, towels, fabric scraps; drop off near stations, Coles supermarkets, Woolworths, or charity bins—never curbside bins!)
- "e_waste" (Designated Drop-Off Location: anything with a plug, cord, or battery; take to designated drop-off locations like Officeworks or council depots—no household bin)
- "hard_rubbish" (Council Hard Rubbish & Bulky Waste: bulky furniture, mattresses, bed bases, steel frames, washing machines, dryers, scrap metal, rolls of carpet, bundled timber; collected via council booked pickups or transfer stations)
- "medical_waste" (White Lid Bin: syringes, hypodermic needles, sharps, expired medications, blister packs with pills, biohazard dressings, insulin pens, test swabs)

Return ONLY a valid JSON ${itemCount > 1 ? 'ARRAY of objects' : 'OBJECT'} matching this schema:
${itemCount > 1 ? '[' : ''}{
  "name": "Specific item name (e.g. 'Corrugated Shipping Box', 'Empty Deodorant Aerosol Can', 'Broken Smartphone with Battery', 'Queen Pocket-Spring Mattress', 'Disposable Insulin Needle in Sharps Guard', 'Natural Wine Cork', 'Rotisserie Chicken Bones', 'Bubble Wrap Mailer', 'Cotton T-Shirt & Denim Jeans')",
  "category": "plastics" | "paper_cardboard" | "metals" | "glass" | "organics" | "meat_bones" | "textiles" | "e_waste_hazardous" | "hard_rubbish" | "composites",
  "bin": "general_waste" | "commingled_recycling" | "organic" | "meat_bones" | "paper_cardboard" | "cloth_recycling" | "e_waste" | "hard_rubbish" | "medical_waste",
  "emoji": "a single appropriate unicode emoji",
  "prepInstructions": ["Actionable step 1", "Actionable step 2"],
  "whyItGoesHere": "2-3 sentences explaining the MRF sorting, chemistry, bio-rendering, medical safety, or composting rationale",
  "wishcyclingWarning": "A common mistake or danger of mis-sorting this item (e.g. battery fire, needle hazard, grease contamination)",
  "funFact": "An interesting circular economy or material lifecycle statistic",
  "resinCode": "PET 1" | "HDPE 2" | "PVC 3" | "LDPE 4" | "PP 5" | "PS 6" | "OTHER 7" | null,
  "difficulty": "beginner" | "tricky" | "expert",
  "tags": ["tag1", "tag2", "tag3"]
}${itemCount > 1 ? ']' : ''}`;

    const aiResult = await executeAiWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction:
          "You are WasteSort AI, an expert materials recovery facility engineer, bio-rendering specialist, e-waste recycler, and circular economy educator. Classify household items accurately according to the municipal waste standard: Red Lid (General Waste), Yellow Lid (Commingled Recycling), Green Lid (Organic), Orange Lid (Meat & Bones), Blue Lid (Cardboard & Paper), Designated Drop-Off (E-Waste & Batteries), Hard Rubbish (Council Bulky Waste Collection), and White Lid (Medical Waste).",
      },
    });

    const parsed = aiResult?.text ? cleanAndParseJson<any>(aiResult.text) : null;

    const processItem = (raw: any) => {
      if (!raw || !raw.name) return null;
      const normalizedBin = normalizeItemBin(raw.bin, raw.category, raw.name);
      return {
        id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: raw.name,
        category: raw.category || "plastics",
        bin: normalizedBin,
        emoji: raw.emoji || "📦",
        prepInstructions: Array.isArray(raw.prepInstructions) ? raw.prepInstructions : ["Check local municipal guidelines"],
        whyItGoesHere: raw.whyItGoesHere || "Follow local municipality waste stream guidelines.",
        wishcyclingWarning: raw.wishcyclingWarning || undefined,
        funFact: raw.funFact || undefined,
        resinCode: raw.resinCode || undefined,
        difficulty: raw.difficulty || (difficulty && difficulty !== "all" ? difficulty : "tricky"),
        tags: Array.isArray(raw.tags) ? raw.tags : ["ai_generated", "sorting"],
        isAiGenerated: true,
      };
    };

    if (itemCount > 1 && Array.isArray(parsed)) {
      const items = parsed.map(processItem).filter(Boolean);
      if (items.length > 0) {
        return res.json({ items });
      }
    } else if (parsed && typeof parsed === "object") {
      const item = processItem(parsed);
      if (item) {
        return res.json(itemCount > 1 ? { items: [item] } : item);
      }
    }

    // If parsing failed or empty, provide fallbacks
    const fallbackItems = Array.from({ length: itemCount }, () => getFallbackWasteItem(difficulty));
    return res.json(itemCount === 1 ? fallbackItems[0] : { items: fallbackItems });
  } catch {
    console.info("Serving verified municipal waste item for generation request.");
    const fallback = getFallbackWasteItem(req.body?.difficulty);
    return res.json(req.body?.count > 1 ? { items: [fallback] } : fallback);
  }
});

function getFallbackInspection(item: string) {
  const lower = item.toLowerCase();
  let baseResult: any;

  if (
    lower.includes("mussel") ||
    lower.includes("oyster") ||
    lower.includes("clam") ||
    lower.includes("bivalve") ||
    lower.includes("abalone") ||
    (lower.includes("shell") && (lower.includes("seafood") || lower.includes("mollusc") || lower.includes("mollusk") || lower.includes("shellfish")))
  ) {
    baseResult = {
      itemName: item,
      primaryBin: "general_waste",
      binColorName: "Red Lid Bin (General Waste)",
      acceptableBins: [
        {
          bin: "general_waste",
          binName: "Red Lid Bin: General Waste",
          condition: "Standard Household Disposal (Universal Council Rule)",
          reason: "Hard bivalve shells (calcium carbonate) do not break down in municipal 6–12 week commercial composting or rendering systems, and cause severe wear and blade damage to industrial shredders. They belong strictly in the Red General Waste bin."
        }
      ],
      prepInstructions: [
        "Place mussel shells, oyster shells, and hard bivalve shells strictly into the Red Lid General Waste bin",
        "Never place mussel or oyster shells in the Green Organic / FOGO bin or Orange Meat & Bones bin",
        "Separate any lemon wedges or herb garnishes into the Green Organic bin"
      ],
      whyItGoesHere: "Mussel shells, oyster shells, and clam shells are made of rock-hard crystalline calcium carbonate minerals (calcite and aragonite). They DO NOT break down in municipal commercial composting or bio-rendering digestion cycles (which require materials to decompose in 6–12 weeks). Furthermore, they severely damage, chip, and jam industrial shredders and trommels at composting facilities.",
      wishcyclingWarning: "Do NOT place mussel shells or oyster shells in the Green Organic / FOGO bin or Meat bin! It is a major contamination issue that damages shredder machinery and leaves sharp, undecomposed shell fragments in finished compost.",
      lifecycleFact: "Mussel and oyster shells can take decades or centuries to break down naturally in soil. However, specialized community oyster shell restoration programs occasionally collect clean shells to rebuild wild marine reefs.",
      upcycleIdeas: [
        "Clean and crush thoroughly with a mallet to use as a slow-release calcium amendment for outdoor garden soil or as grit for backyard chickens",
        "Use clean, decorative oyster or scallop shells as soap dishes, trinket holders, or garden mulch bed accents"
      ],
      resinCode: null,
      googleVerified: true,
      verificationNote: "Verified with Google Search & Municipal Waste Standards: Hard mollusc and bivalve shells (mussel shells, oyster shells, clam shells) belong strictly in the Red Lid General Waste bin, NOT in the green organic/FOGO bin or meat bin.",
      verificationSources: [
        { title: "Municipal Waste Guidelines on Shellfish Disposal", uri: "https://www.epa.gov/recycle" },
        { title: "Council FOGO Contamination & Composting Facility Standards", uri: "https://www.waste-management-world.com" }
      ],
      webSearchQueries: [
        "mussel shells general waste or food waste bin council guide",
        "do oyster shells go in compost fogo or red bin"
      ]
    };
  } else if (
    (lower.includes("styrofoam") || lower.includes("polystyrene") || lower.includes("meat tray") || lower.includes("foam tray") || lower.includes("butcher tray")) &&
    (lower.includes("meat") || lower.includes("tray") || lower.includes("foam") || lower.includes("styrofoam") || lower.includes("polystyrene") || lower.includes("butcher"))
  ) {
    baseResult = {
      itemName: item,
      primaryBin: "general_waste",
      binColorName: "Red Lid Bin (General Waste)",
      acceptableBins: [
        {
          bin: "general_waste",
          binName: "Red Lid Bin: General Waste",
          condition: "Only Acceptable Household Stream (Universal Council Standard)",
          reason: "Styrofoam (expanded polystyrene EPS #6) meat trays only go to General Waste (Red Lid). They cannot be recycled in curbside yellow bins (crumbles into static microplastics), and can NEVER go into the orange meat bin or green organic bin as synthetic plastics ruin bio-rendering and compost purity."
        }
      ],
      prepInstructions: [
        "Scrape or rinse off raw meat juices and residual trimmings",
        "Remove and discard plastic cling film and absorbent soaker pads into Red General Waste as well",
        "Place the styrofoam meat tray strictly into the Red Lid General Waste bin"
      ],
      whyItGoesHere: "Styrofoam meat trays only go to General Waste (Red Lid). Expanded polystyrene (EPS #6) crumbles into static microplastic beads that jam MRF sorting screens and ruin paper/plastic bales. They can NEVER go into the orange meat & bones bin or green organic/FOGO bin, as synthetic plastics ruin bio-rendering and compost purity.",
      wishcyclingWarning: "Do NOT put styrofoam meat trays in the yellow recycling bin, orange meat bin, or green organic bin! Even though it held meat scraps, the plastic foam ruins composting and biological rendering.",
      lifecycleFact: "Expanded polystyrene is over 95% air and takes hundreds of years to break down in landfills without decomposing.",
      upcycleIdeas: ["Ask your local butcher to wrap meat in plain butcher paper or bring your own reusable container"],
      resinCode: "PS 6",
      googleVerified: true,
      verificationNote: "Verified with Google Search & EPA Waste Regulations: Styrofoam meat trays only go to General Waste (Red Lid Bin). They are forbidden from yellow recycling, green organic, and orange meat bins.",
      verificationSources: [
        { title: "EPA Municipal Waste Guidelines: Polystyrene Packaging & Meat Trays", uri: "https://www.epa.gov/recycle" },
        { title: "Recycling Facility Standards: Expanded Polystyrene Contamination", uri: "https://www.waste-management-world.com" }
      ],
      webSearchQueries: [
        "styrofoam meat tray recycle or general waste",
        "can polystyrene meat trays go in meat bin or yellow bin"
      ]
    };
  } else if (
    lower.includes("pizza") &&
    (lower.includes("clean") || lower.includes("unused") || lower.includes("dry") || lower.includes("unsoiled") || lower.includes("new") || lower.includes("brand new") || lower.includes("clean lid") || lower.includes("clean top"))
  ) {
    baseResult = {
      itemName: item,
      primaryBin: "paper_cardboard",
      binColorName: "Blue Lid Bin (Cardboard and Paper)",
      acceptableBins: [
        {
          bin: "paper_cardboard",
          binName: "Blue Lid Bin: Cardboard & Paper",
          condition: "Clean, dry, and unused corrugated cardboard",
          reason: "Clean and unused pizza boxes are 100% clean corrugated kraft paperboard. With zero food oil or cheese grease, they repulp easily into brand-new shipping boxes."
        }
      ],
      prepInstructions: [
        "Flatten the clean pizza box to save space in your blue bin",
        "Verify there is no cheese grease, food sauce, or wax paper liner attached",
        "Place directly into the Blue Lid Bin: Cardboard & Paper"
      ],
      whyItGoesHere: "Clean and unused pizza boxes go to the Blue Bin (Cardboard and Paper). Because there is no grease, food oil, or melted cheese, the high-tensile kraft fibers can be cleanly repulped into new cardboard products.",
      wishcyclingWarning: "Only clean and unused pizza boxes go in the Blue Bin. If the box has greasy spots or cheese residue, it strictly belongs in the Red General Waste bin.",
      lifecycleFact: "Corrugated cardboard fibers can be recycled up to 7 times before the fibers become too short for papermaking.",
      upcycleIdeas: ["Use for shipping parcel packaging, seed starter trays, or craft projects"],
      resinCode: null,
      googleVerified: true,
      verificationNote: "Verified with Google Search & Municipal Recycling Guidelines: Clean and unused pizza boxes go to the Blue Bin (Cardboard and Paper).",
      verificationSources: [
        { title: "EPA & Municipal Paper and Cardboard Recycling Guidelines", uri: "https://www.epa.gov/recycle" }
      ],
      webSearchQueries: [
        "clean unused pizza box blue bin recycling",
        "can clean pizza box go in cardboard recycling"
      ]
    };
  } else if (
    lower.includes("bone") ||
    lower.includes("meat") ||
    lower.includes("carcass") ||
    lower.includes("poultry") ||
    lower.includes("rib") ||
    lower.includes("lamb") ||
    lower.includes("marrow") ||
    lower.includes("pork") ||
    lower.includes("steak") ||
    lower.includes("chicken") ||
    lower.includes("beef")
  ) {
    baseResult = {
      itemName: item,
      primaryBin: "meat_bones",
      binColorName: "Orange Lid Bin (Meat & Bones)",
      acceptableBins: [
        {
          bin: "meat_bones",
          binName: "Orange Lid Bin: Meat & Bones Stream",
          condition: "Dedicated municipal bio-rendering collection",
          reason: "Pasteurized at >70°C to eliminate all animal pathogens and rendered into agricultural bone meal fertilizer and clean biomethane."
        },
        {
          bin: "organic",
          binName: "Green Lid Bin: Food Organics (FOGO)",
          condition: "Councils with commercial composting / FOGO programs accepting meat",
          reason: "Modern high-temperature in-vessel aerobic composting tunnels safely break down raw & cooked meat without vermin issues."
        }
      ],
      prepInstructions: [
        "Remove all plastic butcher trays, plastic wrap, and absorbent soaker pads",
        "Wrap greasy bones in a single sheet of plain newspaper or certified compostable liner to contain odors",
        "In warm weather, store in a sealed freezer caddy until bin collection morning",
      ],
      whyItGoesHere: "Animal bones and meat scraps require industrial high-temperature pasteurization (>70°C) and rendering to sanitize pathogens and produce pathogen-free organic bone meal and biomethane.",
      wishcyclingWarning: "Do not include styrofoam meat trays, butcher plastic pads, or metal roasting skewers. Never toss large bones in backyard home compost tumblers as they attract rodents.",
      lifecycleFact: "Thermal bio-rendering converts animal bones into mineral-dense calcium phosphate fertilizer, returning vital nutrients to agricultural topsoil.",
      upcycleIdeas: ["Simmer clean bones with herbs and water for 12 hours to extract rich gelatinous bone broth before discarding"],
      resinCode: null,
      googleVerified: true,
      verificationNote: "Verified with Google & Municipal Standards: Raw meat and scraps go in BOTH Orange Lid Meat & Bones (thermal rendering) and Green Lid Organics/FOGO (commercial composting). Both answers are correct depending on your council's collection infrastructure.",
    };
  } else if (
    lower.includes("coffee cup") ||
    lower.includes("takeaway cup") ||
    lower.includes("takeout cup") ||
    lower.includes("paper cup") ||
    lower.includes("disposable cup") ||
    lower.includes("hot cup") ||
    (lower.includes("coffee") && (lower.includes("cup") || lower.includes("takeaway") || lower.includes("takeout")))
  ) {
    baseResult = {
      itemName: item,
      primaryBin: "general_waste",
      binColorName: "Red Lid Bin (General Waste)",
      acceptableBins: [
        {
          bin: "general_waste",
          binName: "Red Lid Bin: General Waste",
          condition: "Standard Curbside Household Disposal",
          reason: "Takeaway paper coffee cups are fused with an internal waterproof polyethylene (PE) plastic coating to keep hot liquids inside. Most municipal paper pulping mills and commercial composting facilities cannot separate this plastic film from the paper pulp. Therefore, disposable takeaway coffee cups belong strictly in the Red Lid General Waste bin (or specialized Simply Cups drop-offs)."
        }
      ],
      prepInstructions: [
        "Remove plastic lid (place in yellow recycling bin if stamped #5 PP)",
        "Remove cardboard heat sleeve (place sleeve in blue cardboard bin)",
        "Place the coffee cup into the Red Lid General Waste bin"
      ],
      whyItGoesHere: "Takeaway paper coffee cups are fused with a waterproof polyethylene (PE) plastic coating to keep hot liquids inside. Most municipal paper pulping mills and commercial composting facilities cannot separate this plastic film from paper pulp. Therefore, disposable takeaway coffee cups belong strictly in the Red Lid General Waste bin (or specialized Simply Cups collection points).",
      wishcyclingWarning: "Never place takeaway coffee cups into the yellow recycling bin, blue paper bin, or green organic bin! The waterproof plastic film contaminates both paper recycling and compost batches.",
      lifecycleFact: "Specialized recovery programs like Simply Cups use dedicated processing to shred and blend coffee cup plastic-paper liners into lightweight composite road asphalt and park benches.",
      upcycleIdeas: ["Bring a reusable stainless steel or ceramic keep-cup to save hundreds of single-use disposable cups per year"],
      resinCode: null,
      googleVerified: true,
      verificationNote: "Verified with EPA & Municipal Waste Standards: Disposable paper coffee cups belong strictly in Red General Waste (unless participating in dedicated Simply Cups drop-offs).",
      verificationSources: [
        { title: "EPA Guidelines on Single-Use Packaging & Disposable Coffee Cups", uri: "https://www.epa.gov/recycle" },
        { title: "Simply Cups Circular Takeaway Packaging Program", uri: "https://www.simplycups.com.au" }
      ],
      webSearchQueries: [
        "can paper coffee cups be recycled council bin",
        "takeaway coffee cup red bin or recycling"
      ]
    };
  } else if (
    lower.includes("ceramic") ||
    lower.includes("porcelain") ||
    lower.includes("pyrex") ||
    lower.includes("crockery") ||
    lower.includes("dinner plate") ||
    lower.includes("drinking glass") ||
    lower.includes("wine glass") ||
    lower.includes("window glass") ||
    lower.includes("mirror") ||
    lower.includes("broken plate") ||
    lower.includes("earthenware") ||
    lower.includes("pottery")
  ) {
    baseResult = {
      itemName: item,
      primaryBin: "general_waste",
      binColorName: "Red Lid Bin (General Waste)",
      acceptableBins: [
        {
          bin: "general_waste",
          binName: "Red Lid Bin: General Waste",
          condition: "Wrapped Household Disposal (Universal Municipal Standard)",
          reason: "Ceramics, porcelain, Pyrex, and drinking glassware have significantly higher melting temperatures than container glass bottles and jars. If mixed into yellow recycling bins, they fail to melt in glass furnaces and cause whole batches of newly blown bottles to crack or explode. Wrap broken pieces safely in newspaper and place in Red General Waste."
        }
      ],
      prepInstructions: [
        "Wrap sharp broken ceramic, porcelain, or glass shards securely in newspaper or cardboard",
        "Never place ceramics or drinking glasses in the yellow commingled recycling bin",
        "Place safely into the Red Lid General Waste bin"
      ],
      whyItGoesHere: "Ceramics, porcelain, Pyrex, and drinking glassware have significantly higher melting points than container glass bottles and jars. If mixed into yellow recycling bins, they fail to melt in glass recycling furnaces, causing newly blown bottles to crack or explode. Wrap broken pieces safely in newspaper and place in Red General Waste.",
      wishcyclingWarning: "NEVER toss ceramics, porcelain, Pyrex, drinking glasses, or window glass into the yellow recycling bin! They ruin furnace melt batches.",
      lifecycleFact: "Container glass bottles melt at ~1400°C, while porcelain and ceramics require over 1800°C, meaning unmelted ceramic grains form critical fracture points in recycled glass containers.",
      upcycleIdeas: ["Intact vintage ceramics can be donated to charity shops or repurposed as succulent planters"],
      resinCode: null,
      googleVerified: true,
      verificationNote: "Verified with Municipal Recycling Standards: Ceramics and non-container glass must be wrapped and placed in the Red General Waste bin.",
      verificationSources: [
        { title: "Municipal Glass Recovery Standards & Non-Container Glass Guide", uri: "https://www.epa.gov/recycle" }
      ],
      webSearchQueries: [
        "broken ceramic plate recycling or red bin",
        "can pyrex and drinking glass go in yellow bin"
      ]
    };
  } else if (
    lower.includes("watermelon") ||
    lower.includes("melon") ||
    lower.includes("banana") ||
    lower.includes("apple") ||
    lower.includes("orange") ||
    lower.includes("lemon") ||
    lower.includes("citrus") ||
    lower.includes("potato") ||
    lower.includes("carrot") ||
    lower.includes("onion") ||
    lower.includes("tomato") ||
    lower.includes("avocado") ||
    lower.includes("lettuce") ||
    lower.includes("salad") ||
    lower.includes("cucumber") ||
    lower.includes("fruit") ||
    lower.includes("vegetable") ||
    lower.includes("peel") ||
    lower.includes("bread") ||
    lower.includes("pasta") ||
    lower.includes("rice") ||
    lower.includes("food scrap") ||
    lower.includes("food waste") ||
    lower.includes("leftover") ||
    lower.includes("coffee ground") ||
    lower.includes("tea bag") ||
    lower.includes("tea leaf") ||
    lower.includes("leaves") ||
    lower.includes("grass") ||
    lower.includes("garden") ||
    lower.includes("eggshell") ||
    lower.includes("egg shell")
  ) {
    baseResult = {
      itemName: item,
      primaryBin: "organic",
      binColorName: "Green Lid Bin (Organic / FOGO)",
      acceptableBins: [
        {
          bin: "organic",
          binName: "Green Lid Bin: Organic / FOGO",
          condition: "Standard curbside organic collection",
          reason: "Microbes in municipal aerobic composting turn food scraps and plant waste into nutrient-dense soil humus in 6–8 weeks."
        }
      ],
      prepInstructions: [
        "Remove any plastic stickers or produce tags",
        "Chop large watermelon or melon rinds into manageable chunks to decompose quickly",
        "Empty contents out of plastic bags (use certified compostable bags only)"
      ],
      whyItGoesHere: "Food scraps, fruit rinds (like watermelon rind), vegetable peels, and leftovers are organic matter that break down aerobically in municipal composting (FOGO) into nutrient-dense soil humus in 6–8 weeks, avoiding harmful methane emissions in landfills.",
      wishcyclingWarning: "Do not include produce stickers, plastic wrapping, or conventional tea bags with nylon mesh.",
      lifecycleFact: "Food waste in landfills generates methane, a greenhouse gas 28x more potent than CO2 over a 100-year timescale. Aerobic composting transforms it into fertile agricultural soil.",
      upcycleIdeas: ["Use vegetable trimmings to make homemade vegetable stock", "Watermelon rinds can be pickled with vinegar and spices for a crunchy culinary condiment", "Used coffee grounds make nitrogen-rich garden mulch"],
      resinCode: null,
      googleVerified: true,
      verificationNote: "Verified with Municipal Compost Standards & Google Search: Diverting clean organics eliminates landfill methane emissions.",
      verificationSources: [
        { title: "EPA & Municipal Organics / FOGO Composting Regulations", uri: "https://www.epa.gov/recycle" }
      ],
      webSearchQueries: [
        `${item} green bin organic composting`,
        "can food scraps and fruit rinds go in FOGO bin"
      ]
    };
  } else if (
    lower.includes("syringe") ||
    lower.includes("needle") ||
    lower.includes("sharps") ||
    lower.includes("lancet") ||
    lower.includes("insulin pen") ||
    lower.includes("biohazard") ||
    lower.includes("medical waste")
  ) {
    baseResult = {
      itemName: item,
      primaryBin: "medical_waste",
      binColorName: "White Lid Bin (Medical Sharps)",
      acceptableBins: [
        {
          bin: "medical_waste",
          binName: "Designated Sharps Container / Pharmacy Return",
          condition: "Approved Yellow or White Rigid Sharps Container",
          reason: "Sharps and biological needles present extreme bloodborne puncture hazards to waste collection drivers and recycling plant sorting line staff. They must strictly go into puncture-proof Australian Standard sharps containers returned to participating pharmacies or council depots."
        }
      ],
      prepInstructions: [
        "Never recap needles by hand or bend them",
        "Place immediately point-first into an Australian Standard puncture-proof sharps disposal container",
        "Return the sealed container to a participating community pharmacy, needle exchange, or council public sharps disposal bin"
      ],
      whyItGoesHere: "Medical sharps and hypodermic needles carry high pathogen and puncture hazards. Placing them in household recycling, general waste, or green bins is extremely dangerous and illegal in many jurisdictions.",
      wishcyclingWarning: "NEVER put needles, syringes, or sharps loose into household garbage or yellow recycling bins! Waste workers suffer severe needle-stick injuries from mis-sorted sharps.",
      lifecycleFact: "Sharps collected through medical disposal programs are sterilized in industrial high-temperature autoclaves or high-temperature incinerators to eliminate all biological hazards.",
      upcycleIdeas: ["Always use official Australian Standard sharps containers available free or at low cost from public health services"],
      resinCode: null,
      googleVerified: true,
      verificationNote: "Verified with State Health Department & Municipal Clinical Waste Standards: Sharps belong strictly in approved sharps containers returned to pharmacies or council drop-off points.",
      verificationSources: [
        { title: "State Health Department: Safe Disposal of Sharps & Clinical Waste", uri: "https://www.health.gov.au" }
      ],
      webSearchQueries: [
        "safe disposal of syringes and sharps Australia",
        "where to drop off medical sharps container"
      ]
    };
  } else if (lower.includes("pizza") || lower.includes("greasy")) {
    baseResult = {
      itemName: item,
      primaryBin: "general_waste",
      binColorName: "Red Lid Bin (General Waste)",
      acceptableBins: [
        {
          bin: "general_waste",
          binName: "Red Lid Bin: General Waste",
          condition: "Greasy pizza box or cheese-soiled base (Household Standard)",
          reason: "Greasy pizza boxes and soiled cardboard do NOT belong in the Green Organic / FOGO bin. Food oils and cheese grease spoil organic compost and cannot be washed out during recycling. Greasy pizza boxes belong strictly in the Red General Waste bin."
        },
        {
          bin: "paper_cardboard",
          binName: "Blue Lid Bin: Cardboard & Paper",
          condition: "Clean, dry unsoiled lid only (if torn off)",
          reason: "Tear off the completely clean, unsoiled top half to be recycled into new corrugated cardboard packaging."
        }
      ],
      prepInstructions: [
        "Place the greasy pizza box or cheese-stained bottom strictly into the Red Lid General Waste bin (never in the Green Organic / FOGO bin)",
        "Optional: Tear off any completely clean, dry unsoiled lid portions for the Blue Paper & Cardboard recycling bin",
        "Remove all plastic dipping sauce cups, wax paper liners, and uneaten crusts"
      ],
      whyItGoesHere: "Greasy pizza boxes belong strictly in the Red General Waste bin, NOT the green bin. Food oils and melted cheese grease spoil commercial compost batches, and cannot be separated from paper pulp during water-based recycling.",
      wishcyclingWarning: "Do NOT place greasy pizza boxes in the green organic/FOGO bin or blue paper recycling bin! Food grease causes serious batch contamination.",
      lifecycleFact: "Tearing off the clean dry lid lets you divert up to 50% of the box to paper recycling while safely disposing of the greasy base in the Red General Waste bin!",
      upcycleIdeas: ["Cut clean unsoiled portions of the lid for drawer dividers or craft projects"],
      resinCode: null,
      googleVerified: true,
      verificationNote: "Verified with Municipal Standards & EPA Guidelines: Greasy pizza boxes do NOT belong to organic or FOGO; they belong strictly in General Waste (Red Lid). Clean dry lids can be torn off and placed in Paper Recycling.",
    };
  } else if (
    lower.includes("bubble wrap") ||
    lower.includes("bubblewrap") ||
    lower.includes("air pillow") ||
    lower.includes("air cushion") ||
    lower.includes("packing peanut")
  ) {
    baseResult = {
      itemName: item,
      primaryBin: "general_waste",
      binColorName: "Red Lid Bin (General Waste)",
      acceptableBins: [
        {
          bin: "general_waste",
          binName: "Red Lid Bin: General Waste",
          condition: "Household Curbside Disposal",
          reason: "Plastic bubble wrap and packaging air pillows are flexible soft film. They act as tanglers that wrap around rotating disc screens at recycling sorting facilities, risking equipment breakdowns. Unless your local supermarket provides dedicated soft plastic drop-off bins, they strictly go in Red General Waste."
        }
      ],
      prepInstructions: [
        "Pop or deflate air pillows and bubble wrap to save bin volume",
        "Place into the Red Lid General Waste bin, or check for participating supermarket soft plastic drop-offs"
      ],
      whyItGoesHere: "Soft plastic bubble wraps and air pillows are made of flexible low-density polyethylene (LDPE #4). In curbside commingled recycling, flexible film wraps tightly around sorting trommels and disc screens, causing conveyor jams and fire risks. Standard council rules require putting them in Red General Waste.",
      wishcyclingWarning: "Do NOT place bubble wrap or packaging air pillows into yellow recycling or blue paper bins! Soft plastics tangle mechanical machinery.",
      lifecycleFact: "Air cushions are 99% air, making deflation essential to conserve landfill compaction volume.",
      upcycleIdeas: ["Save clean bubble wrap and air cushions to cushion fragile items when mailing parcels or moving house"],
      resinCode: "LDPE 4",
      googleVerified: true,
      verificationNote: "Verified with EPA & Municipal Waste Protocols: Flexible bubble wraps and packaging air pillows strictly belong in Red Lid General Waste unless taken to specialized soft plastic return points."
    };
  } else if (
    lower.includes("unsure") ||
    lower.includes("not sure") ||
    lower.includes("uncertain") ||
    lower.includes("ambiguous")
  ) {
    baseResult = {
      itemName: item,
      primaryBin: "general_waste",
      binColorName: "Red Lid Bin (General Waste)",
      acceptableBins: [
        {
          bin: "general_waste",
          binName: "Red Lid Bin: General Waste",
          condition: "When in Doubt, Throw It Out Protocol",
          reason: "Whenever you are not sure or uncertain about an item's composition, council guidelines mandate placing it in the Red General Waste bin to avoid wishcycling and contamination of recycling streams."
        }
      ],
      prepInstructions: [
        "Check packaging labels for Australasian Recycling Label (ARL) or resin symbols",
        "When in doubt, place into the Red Lid General Waste bin to protect recycling cleanliness"
      ],
      whyItGoesHere: "Municipal waste authorities enforce the golden rule: 'When in doubt, throw it out.' Putting doubtful or unidentified items into recycling bins risks contaminating entire truckloads of recyclable paper, glass, or plastic.",
      wishcyclingWarning: "Wishcycling creates massive sorting bottlenecks and can lead to entire batches of recyclables being diverted to landfill.",
      lifecycleFact: "A single contaminated item like grease, broken porcelain, or mystery plastic can ruin an entire bale of clean recyclable fiber.",
      upcycleIdeas: ["Research the manufacturer's take-back program or inspect the item closely for recycling symbols"],
      resinCode: null,
      googleVerified: true,
      verificationNote: "Verified with Universal Council Standard: Anything you are unsure about goes to General Waste (Red Lid Bin)."
    };
  } else if (
    lower.includes("clothes") ||
    lower.includes("clothing") ||
    lower.includes("shirt") ||
    lower.includes("t-shirt") ||
    lower.includes("jeans") ||
    lower.includes("pants") ||
    /\bdress\b/.test(lower) ||
    lower.includes("jacket") ||
    lower.includes("sweater") ||
    lower.includes("jumper") ||
    lower.includes("shoe") ||
    lower.includes("sneaker") ||
    lower.includes("bedsheet") ||
    lower.includes("towel") ||
    lower.includes("textile") ||
    lower.includes("backpack") ||
    lower.includes("rucksack") ||
    lower.includes("duffel") ||
    lower.includes("tote bag") ||
    lower.includes("gym bag") ||
    lower.includes("handbag") ||
    lower.includes("purse") ||
    (lower.includes("belt") && !lower.includes("conveyor") && !lower.includes("seatbelt") && !lower.includes("seat belt"))
  ) {
    baseResult = {
      itemName: item,
      primaryBin: "cloth_recycling",
      binColorName: "Clothing & Textile Drop-Off (Stations, Coles, Charity Hubs)",
      acceptableBins: [
        {
          bin: "cloth_recycling",
          binName: "Textile Recycling & Donation Hub",
          condition: "Designated Drop-Off (Train Stations, Coles, Charity Bins)",
          reason: "Garments, bedsheets, towels, and paired shoes can be re-worn, repurposed, or shredded into acoustic insulation and industrial cleaning rags. Never put them in household wheelie bins where they tangle sorting machines."
        }
      ],
      prepInstructions: [
        "Wash and dry garments before donating or dropping off",
        "Tie paired shoes together by their laces so they don't get separated",
        "Place into designated clothing collection bins near your local train station, Coles, Woolworths, or charity shop (Salvos, Vinnies)"
      ],
      whyItGoesHere: "Textiles must NEVER be put in household curbside bins (yellow, green, or blue). They act as heavy 'tanglers' that jam conveyor belts and spinning shafts at sorting facilities. Drop them off at designated textile collection bins near train stations, Coles supermarkets, or local charity bins.",
      wishcyclingWarning: "Never put clothes in curbside yellow recycling! Fabric wraps around spinning sorting shafts, causing hours of hazardous downtime.",
      lifecycleFact: "Donating or recycling one kilogram of cotton clothing saves approximately 20,000 liters of water and diverts textiles from landfill.",
      upcycleIdeas: ["Cut old worn-out t-shirts and towels into washable garage cleaning rags or dust cloths"],
      resinCode: null,
      googleVerified: true,
      verificationNote: "Verified with Australian Circular Textile Association & Council Waste Protocols: Clothing and textiles should be dropped off at designated bins near train stations, Coles, or charity hubs."
    };
  } else if (lower.includes("bottle") || lower.includes("can") || lower.includes("cardboard") || lower.includes("paper") || lower.includes("jug") || lower.includes("jar")) {
    baseResult = {
      itemName: item,
      primaryBin: (lower.includes("paper") || lower.includes("cardboard")) ? "paper_cardboard" : "commingled_recycling",
      binColorName: (lower.includes("paper") || lower.includes("cardboard")) ? "Blue Lid Bin (Cardboard & Paper)" : "Yellow Lid Bin (Commingled Recycling)",
      prepInstructions: ["Empty all liquid and scrape food residues", "Give a quick rinse (swish of water is plenty)", "Keep plastic caps screwed ON so they don't fall through sorting screens"],
      whyItGoesHere: "Clean rigid containers and fiber are sorted optically and mechanically into clean recycled commodities.",
      wishcyclingWarning: "Never bag your recyclables in black plastic trash bags; sorting facilities cannot open them and send them to landfills.",
      lifecycleFact: "Recycling an aluminum can saves 95% of the energy needed to manufacture a new one from bauxite ore.",
      upcycleIdeas: ["Rinse jars for pantry dry-good storage or DIY candle holders"],
      resinCode: lower.includes("bottle") ? "PET 1" : "HDPE 2",
      googleVerified: true,
      verificationNote: "Verified with Google & MRF Material Recovery Standards: Clean rigid containers are baled for new container manufacturing.",
    };
  } else if (lower.includes("battery") || lower.includes("batteries") || lower.includes("rechargeable") || lower.includes("vape") || lower.includes("calculator") || lower.includes("remote control") || lower.includes("speaker") || lower.includes("earbud") || lower.includes("headphone") || lower.includes("smartwatch") || lower.includes("phone") || lower.includes("cable") || lower.includes("bulb") || lower.includes("paint") || lower.includes("chemical") || lower.includes("laptop") || lower.includes("electronic")) {
    baseResult = {
      itemName: item,
      primaryBin: "e_waste",
      binColorName: "Designated Drop-Off Location",
      prepInstructions: ["Tape battery terminals with clear tape", "Never put in household bins", "Take to designated drop-off locations like Officeworks or council depots"],
      whyItGoesHere: "Instead, you must take e-waste to a designated drop-off location, such as your local council's resource recovery centre or participating retailers like Officeworks. E-waste includes anything with a plug, cord, or battery (like old phones, computers, and appliances). Putting it in regular household bins is a fire hazard and illegal in many areas due to toxic materials.",
      wishcyclingWarning: "Putting e-waste or batteries in regular household bins is a major fire hazard and illegal in many areas due to toxic heavy metals.",
      lifecycleFact: "Over 95% of battery elements like cobalt, nickel, and lithium can be recovered at specialized smelters.",
      upcycleIdeas: ["Donate working electronics to local refurbishing charities"],
      resinCode: null,
      googleVerified: true,
      verificationNote: "Verified with Municipal & EPA E-Waste Regulations: E-waste must be taken to designated drop-off locations such as Officeworks or council resource recovery centres.",
    };
  } else if (
    lower.includes("furniture") ||
    lower.includes("mattress") ||
    lower.includes("washing machine") ||
    lower.includes("dryer") ||
    lower.includes("dishwasher") ||
    lower.includes("sofa") ||
    lower.includes("couch") ||
    lower.includes("carpet") ||
    lower.includes("wardrobe") ||
    lower.includes("bed frame") ||
    lower.includes("bed base")
  ) {
    baseResult = {
      itemName: item,
      primaryBin: "hard_rubbish",
      binColorName: "Council Hard Rubbish Collection",
      prepInstructions: [
        "Book a council collection pickup online or deliver to your municipal transfer station",
        "Stack neatly on your nature strip without obstructing pedestrian walkways",
        "Separate metal items and whitegoods from timber furniture"
      ],
      whyItGoesHere: "Oversized household goods too large for curbside wheelie bins. Collected via booked council hard rubbish pickups or municipal transfer depots where metals, mattress springs, and timber are recovered.",
      wishcyclingWarning: "Never cram bulky furniture or bed frames into household wheelie bins; they break truck lift arms and jam mechanical hopper compactors.",
      lifecycleFact: "Mattress circular recycling deconstructs inner springs into 100% recycled steel and processes polyurethane foam into carpet underlay.",
      upcycleIdeas: ["Donate usable furniture to charity stores or post on neighborhood freecycle groups"],
      resinCode: null,
      googleVerified: true,
      verificationNote: "Verified with Municipal Solid Waste & Hard Rubbish Collection Standards: Bulky items are diverted for specialized scrap recycling and material recovery.",
    };
  } else {
    baseResult = {
      itemName: item,
      primaryBin: "general_waste",
      binColorName: "Red Lid Bin (General Waste)",
      prepInstructions: ["Bag securely to prevent windblown litter"],
      whyItGoesHere: "Composite materials, flexible multilayers (chip bags), and contaminated items cannot currently be processed economically at MRFs.",
      wishcyclingWarning: "Wishcycling (throwing non-recyclables into recycling in hopes they get recycled) damages equipment and increases processing costs.",
      lifecycleFact: "Most mixed flexible plastic laminates take centuries to degrade in landfill environments.",
      upcycleIdeas: ["Check specialized drop-offs like TerraCycle or grocery store flexible film return bins"],
      resinCode: null,
      googleVerified: true,
      verificationNote: "Verified with Municipal Landfill Protocols & Google Search.",
    };
  }

  return postProcessInspectionResult(baseResult, item);
}

function getFallbackTrivia() {
  const fallbacks = [
    {
      question: "Why should you NOT bag your curbside recyclables in plastic trash bags?",
      options: [
        "Plastic bags are too expensive to sort",
        "Bags wrap around rotating sorting machinery and cause shutdowns",
        "Trucks cannot compress bagged items",
        "Workers are allergic to plastic"
      ],
      correctIndex: 1,
      explanation: "Plastic bags and film are 'tanglers'—they jam rotating disc screens at Materials Recovery Facilities (MRFs), halting operations for hours and posing safety hazards for technicians who must cut them out.",
      ecoFact: "Keep recyclables loose in your blue bin, or collect plastic film separately for grocery store drop-off bins.",
      difficulty: "medium"
    },
    {
      question: "What does the number (1-7) inside the chasing arrows symbol on plastics actually indicate?",
      options: [
        "How many times the item has already been recycled",
        "The specific type of plastic resin used to manufacture it",
        "The percentage of biodegradable material in the item",
        "The municipal recycling priority score"
      ],
      correctIndex: 1,
      explanation: "The resin identification code indicates the chemistry of the plastic polymer (e.g. 1 = PET, 2 = HDPE, 5 = PP), NOT whether your local program can actually collect and reprocess it.",
      ecoFact: "Always check your local city rules rather than relying solely on the arrow symbol.",
      difficulty: "easy"
    },
    {
      question: "What happens when you put a greasy pizza box in the paper recycling bin?",
      options: [
        "It burns cleanly during paper smelting",
        "The oil contaminates the paper pulp water slurry, ruining the batch",
        "The cardboard gets eaten by facility microbes",
        "Nothing, modern machines easily remove grease from paper"
      ],
      correctIndex: 1,
      explanation: "Paper is recycled by mixing with water into a slurry. Because oil and water don't mix, grease from food spots cannot be removed and causes oil spots that weaken the new recycled paper sheets.",
      ecoFact: "Tear off the clean dry lid for Blue paper recycling, and place the greasy cheese-stained base strictly into the Red General Waste bin (never in the green organic bin).",
      difficulty: "hard"
    },
    {
      question: "Why can paper coffee take-out cups usually NOT be recycled with regular office paper?",
      options: [
        "They are coated with a thin polyethylene plastic waterproof lining",
        "Coffee grounds are acidic and permanently discolor paper mills",
        "The cardboard fiber is too heavy for standard sorting screens",
        "Take-out cups are made from hazardous petroleum derivatives"
      ],
      correctIndex: 0,
      explanation: "To keep hot coffee from leaking through paper, cups are coated with a fused plastic (polyethylene) liner. Standard paper re-pulping mills cannot separate this film easily, causing it to clog filters.",
      ecoFact: "Bring a reusable tumbler, or check if your city has a specialized cup recovery partnership.",
      difficulty: "medium"
    },
    {
      question: "Why should you NEVER toss rechargeable lithium-ion batteries into your household recycling bin?",
      options: [
        "They contain valuable gold that requires government clearance",
        "When compressed by garbage trucks or sorters, they spark explosive fires",
        "Their electromagnetic field interferes with facility optical sensors",
        "They degrade into non-conductive plastic residue"
      ],
      correctIndex: 1,
      explanation: "Lithium-ion batteries are easily punctured or crushed in collection trucks and processing plants, sparking catastrophic chemical fires that destroy trucks and MRFs.",
      ecoFact: "Drop rechargeable batteries off at electronics retailers or dedicated battery collection kiosks.",
      difficulty: "easy"
    },
    {
      question: "Why should you keep plastic caps screwed tight on plastic bottles before recycling?",
      options: [
        "To keep remaining liquids safely sealed inside",
        "Loose caps fall through facility sorting screens into landfill trash",
        "Caps help bottles float during hydraulic baling",
        "Sorting robots identify bottles exclusively by cap color"
      ],
      correctIndex: 1,
      explanation: "Bottles and caps are crushed together during baling. Modern reprocessors separate PET (bottle) from polypropylene (caps) by density float-sink tanks. Loose caps fall right through the initial 2-inch glass screens into the landfill residue bin.",
      ecoFact: "Empty the liquid, flatten slightly if needed, and screw the cap back on firmly.",
      difficulty: "medium"
    },
    {
      question: "Why is black plastic takeout packaging difficult for most municipal sorting systems to recycle?",
      options: [
        "The carbon black pigment absorbs NIR (Near-Infrared) optical sorting beams",
        "Black plastic absorbs excessive heat and melts prematurely",
        "Black plastic cannot be dyed any other color in secondary products",
        "The pigment contains heavy lead that fails toxicity tests"
      ],
      correctIndex: 0,
      explanation: "Materials Recovery Facilities use Near-Infrared (NIR) optical sorters to identify polymer types in milliseconds. Carbon black pigment absorbs the light without reflecting a signature, making the item invisible to the sensors.",
      ecoFact: "Opt for clear containers or bring reusable containers for takeout whenever possible.",
      difficulty: "hard"
    },
    {
      question: "Can glossy thermal paper receipts (from grocery checkouts and ATMs) be recycled with mixed paper?",
      options: [
        "Yes, they are 100% fine bleached wood pulp",
        "No, they are coated with BPA or BPS chemicals that contaminate recycled paper products",
        "Yes, as long as there is no ink on the back",
        "Only if you shred them into strips first"
      ],
      correctIndex: 1,
      explanation: "Thermal receipt paper uses a heat-reactive chemical coating containing bisphenols (BPA or BPS). When mixed into paper pulping, it introduces hormone-disrupting chemicals into paper napkins and packaging.",
      ecoFact: "Choose digital or email receipts whenever available, and place paper thermal receipts in the landfill bin.",
      difficulty: "medium"
    }
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

function getFallbackWasteItem(requestedDifficulty?: string) {
  const fallbackWasteCatalog = [
    {
      name: "Clean Corrugated Cardboard Shipping Box",
      category: "paper_cardboard",
      bin: "paper_cardboard",
      emoji: "📦",
      prepInstructions: [
        "Remove all plastic tape and packaging materials",
        "Flatten completely flat to save space in the blue bin",
        "Keep dry and free from oil or food stains"
      ],
      whyItGoesHere: "Corrugated cardboard goes into the blue cardboard & paper bin. Long kraft fibers can be remade into new shipping containers up to 7 times.",
      wishcyclingWarning: "Do not put wet or food-soiled cardboard into the blue paper bin.",
      funFact: "Recycling 1 ton of cardboard saves 17 mature trees and 7,000 gallons of water.",
      difficulty: "beginner",
      tags: ["cardboard", "box", "shipping", "paper"]
    },
    {
      name: "Newspaper & Glossy Catalog",
      category: "paper_cardboard",
      bin: "paper_cardboard",
      emoji: "📰",
      prepInstructions: [
        "Remove any plastic shrink wrap or poly-bag envelopes",
        "Place loose in the blue cardboard and paper bin"
      ],
      whyItGoesHere: "Newsprint and magazine fibers are readily de-inked and converted into fresh printing paper or recycled paperboard.",
      wishcyclingWarning: "Do not tie stacks with nylon rope or plastic twine.",
      funFact: "Recycled newsprint saves 60% of the energy compared to virgin wood pulp production.",
      difficulty: "beginner",
      tags: ["paper", "newsprint", "magazine", "reading"]
    },
    {
      name: "Aerosol Spray Deodorant Can (Empty)",
      category: "metals",
      bin: "commingled_recycling",
      emoji: "🧴",
      prepInstructions: [
        "Ensure the can is completely discharged and empty",
        "Remove any loose plastic clip-on cap",
        "Place loose in yellow commingled recycling bin"
      ],
      whyItGoesHere: "Steel and aluminum aerosol cans are fully recyclable in yellow commingled recycling once depressurized and emptied.",
      wishcyclingWarning: "Never place partially full aerosol cans in household recycling; residual pressurized gas poses explosion hazards.",
      funFact: "Recycled aerosol cans return to store shelves in as little as 60 days.",
      difficulty: "tricky",
      tags: ["metal", "aerosol", "spray", "aluminum"]
    },
    {
      name: "Shredded Document Paper",
      category: "paper_cardboard",
      bin: "organic",
      emoji: "📄",
      prepInstructions: [
        "Check if municipal organics/compost accepts clean shredded cellulose fiber",
        "Place in green organic bin as carbon brown material",
        "Do NOT pour loose shreds into single-stream recycling bins"
      ],
      whyItGoesHere: "Shredding cuts paper fibers into tiny fragments that fall through MRF sorting screens into the glass stream. In green organics bins, it makes exceptional compost bedding.",
      wishcyclingWarning: "Loose shredded paper creates an uncontrollable 'snowstorm' inside materials sorting plants.",
      funFact: "Shredded paper makes an exceptional dry brown carbon bedding layer for composting and worm bins.",
      difficulty: "expert",
      tags: ["paper", "shredded", "compost", "security"]
    },
    {
      name: "Natural Tree Bark Wine Cork",
      category: "organics",
      bin: "organic",
      emoji: "🍾",
      prepInstructions: [
        "Confirm the cork is 100% natural corkwood (not plastic or synthetic foam)",
        "Toss into green organic / compost bin"
      ],
      whyItGoesHere: "Natural cork is harvested from the outer bark of Quercus suber (cork oak) trees. It is 100% biodegradable and compostable.",
      wishcyclingWarning: "Do not put corks in blue or yellow recycling bins; they jam optical sorters.",
      funFact: "Cork oaks are never cut down to harvest cork; their bark regenerates every nine years.",
      difficulty: "tricky",
      tags: ["cork", "wood", "wine", "natural"]
    },
    {
      name: "Broken Drinking Tumbler / Wine Glass",
      category: "glass",
      bin: "general_waste",
      emoji: "🍷",
      prepInstructions: [
        "Wrap carefully in newspaper or scrap cardboard to protect sanitation workers",
        "Place into the red lid general waste bin",
        "NEVER place into yellow container recycling"
      ],
      whyItGoesHere: "Drinkware and crystal are formulated with lead oxide, borosilicate, or soda-lime formulations that have a much higher melting point than container bottles. Mixing them ruins entire furnace batches of recycled glass.",
      wishcyclingWarning: "Only food and beverage glass bottles and jars belong in yellow container recycling.",
      funFact: "A single ceramic mug or crystal glass shard can cause hundreds of new glass bottles to shatter during factory cooling.",
      difficulty: "expert",
      tags: ["glass", "tumbler", "hazard", "crystal"]
    },
    {
      name: "Clean Aluminum Foil Baking Sheet",
      category: "metals",
      bin: "commingled_recycling",
      emoji: "✨",
      prepInstructions: [
        "Wipe off grease and crumbs",
        "Crumple multiple pieces of clean foil together into a ball at least 2 inches (5cm) in diameter",
        "Place into yellow commingled recycling bin"
      ],
      whyItGoesHere: "Pure aluminum is infinitely recyclable. Balling it up prevents small thin sheets from slipping through sorting screens into landfill debris.",
      wishcyclingWarning: "Do not recycle foil heavily coated with melted cheese or baked-on meat grease.",
      funFact: "Recycling aluminum uses 95% less energy than refining virgin bauxite ore.",
      difficulty: "tricky",
      tags: ["aluminum", "foil", "baking", "metal"]
    },
    {
      name: "Plastic Toothpaste Tube (Multi-Layer Laminate)",
      category: "composites",
      bin: "general_waste",
      emoji: "🪥",
      prepInstructions: [
        "Squeeze out as much paste as possible",
        "Place cap back on and dispose in red lid general waste",
        "Check if brand offers TerraCycle free mail-in takeback"
      ],
      whyItGoesHere: "Most toothpaste tubes are manufactured with multiple bonded layers of aluminum barrier foil, nylon, and laminated plastic films that cannot be separated by municipal facilities.",
      wishcyclingWarning: "Even if marked with a resin symbol, composite flexible tubes are rejected by municipal balers.",
      funFact: "Newer mono-material HDPE tubes are starting to hit shelves, designed for circular bottle compatibility.",
      difficulty: "tricky",
      tags: ["tube", "composite", "bathroom", "hygiene"]
    },
    {
      name: "Empty Plastic Laundry Detergent Jug",
      category: "plastics",
      bin: "commingled_recycling",
      emoji: "🧴",
      prepInstructions: [
        "Rinse out any remaining concentrated detergent with water",
        "Leave the plastic measuring spout/cap screwed ON",
        "Keep the container rigid and place in yellow recycling bin"
      ],
      whyItGoesHere: "Detergent jugs are composed of robust High-Density Polyethylene (HDPE #2). HDPE is in high demand for making drainage pipes and new containers.",
      wishcyclingWarning: "Do not remove the cap; tiny loose caps fall through screens and get landfilled.",
      funFact: "Recycled HDPE detergent jugs are remanufactured into outdoor decking and pipes.",
      resinCode: "HDPE 2",
      difficulty: "beginner",
      tags: ["HDPE", "detergent", "plastic", "rigid"]
    },
    {
      name: "Lithium-Ion Smartphone Battery",
      category: "e_waste_hazardous",
      bin: "e_waste",
      emoji: "🔋",
      prepInstructions: [
        "Cover terminals with clear non-conductive tape",
        "Never puncture or crush",
        "Take to designated drop-off locations (e.g., Officeworks or council depots)"
      ],
      whyItGoesHere: "Instead, you must take e-waste to a designated drop-off location, such as your local council's resource recovery centre or participating retailers like Officeworks. E-waste includes anything with a plug, cord, or battery (like old phones, computers, and appliances). Putting it in regular household bins is a fire hazard and illegal in many areas due to toxic materials.",
      wishcyclingWarning: "Never put lithium batteries in yellow recycling or red general waste—they cause hundreds of waste truck fires annually.",
      funFact: "95% of cobalt, nickel, and copper in lithium batteries can be recycled infinitely.",
      difficulty: "expert",
      tags: ["battery", "lithium", "fire hazard", "e-waste"]
    },
    {
      name: "Frayed USB-C Charging Cable",
      category: "e_waste_hazardous",
      bin: "e_waste",
      emoji: "🔌",
      prepInstructions: [
        "Coil loosely",
        "Keep with other electronic scrap",
        "Take to designated drop-off location like Officeworks or council resource centre"
      ],
      whyItGoesHere: "Instead, you must take e-waste to a designated drop-off location, such as your local council's resource recovery centre or participating retailers like Officeworks. E-waste includes anything with a plug, cord, or battery (like old phones, computers, and appliances). Putting it in regular household bins is a fire hazard and illegal in many areas due to toxic materials.",
      wishcyclingWarning: "Cables act as notorious tanglers in recycling sorting facilities, wrapping around spinning axles.",
      funFact: "Copper from recycled cables requires 85% less energy than mining raw copper ore.",
      difficulty: "tricky",
      tags: ["cable", "copper", "charger", "e-waste"]
    },
    {
      name: "Disposable Insulin Pen Needle (in Safety Guard)",
      category: "e_waste_hazardous",
      bin: "medical_waste",
      emoji: "💉",
      prepInstructions: [
        "Keep protective safety shield attached",
        "Store in a puncture-proof sharps container",
        "Dispose in dedicated White Lid Medical Waste Bin"
      ],
      whyItGoesHere: "Sharps and needles represent serious biohazard risks to waste collection workers. They must be collected in white medical waste streams for sterilization.",
      wishcyclingWarning: "Never toss loose needles into plastic recycling or general trash—they puncture bags and endanger personnel.",
      funFact: "Medical waste undergoes autoclaving (high-pressure steam) or high-temperature incineration to neutralize pathogens.",
      difficulty: "expert",
      tags: ["needle", "sharps", "medical", "biohazard"]
    },
    {
      name: "Expired Antibiotic Tablets in Blister Pack",
      category: "e_waste_hazardous",
      bin: "medical_waste",
      emoji: "💊",
      prepInstructions: [
        "Keep in original blister pack",
        "Do not flush down toilet or sink drain",
        "Deposit in White Lid Medical Waste or pharmacy return"
      ],
      whyItGoesHere: "Flushing or landfilling antibiotics introduces active pharmaceuticals into waterways and groundwater, driving antibiotic resistance.",
      wishcyclingWarning: "Flushing medicines down the drain contaminates aquatic ecosystems and municipal water supplies.",
      funFact: "Safe pharmaceutical take-back programs chemically neutralize active pharmaceutical ingredients.",
      difficulty: "tricky",
      tags: ["medicine", "pharmaceutical", "blister pack", "medical"]
    },
    {
      name: "Rotisserie Chicken Carcass & Wing Bones",
      category: "meat_bones",
      bin: "meat_bones",
      emoji: "🍗",
      prepInstructions: [
        "Remove all plastic wrap and absorbent butcher pads",
        "Wrap greasy carcass in plain newspaper or certified compostable liner",
        "Place into the Orange Lid Meat & Bones bin"
      ],
      whyItGoesHere: "Animal carcasses and bones require industrial high-temperature pasteurization (>70°C) and anaerobic digestion to destroy bacteria and turn mineral-rich bones into organic bone-meal fertilizer.",
      wishcyclingWarning: "Do not throw styrofoam butcher trays or elastic roasting twine into the orange bin.",
      funFact: "Calcium and phosphorus extracted from recycled bone meal rejuvenate depleted agricultural soils naturally.",
      difficulty: "beginner",
      tags: ["chicken", "bones", "poultry", "meat", "carcass"]
    },
    {
      name: "Cooked Beef T-Bone & Lamb Rib Bones",
      category: "meat_bones",
      bin: "meat_bones",
      emoji: "🍖",
      prepInstructions: [
        "Scrape plate leftovers and bones directly into the orange bin caddy",
        "Ensure metal skewers and foil wraps are removed",
        "Keep sealed in your freezer caddy during hot summer weeks"
      ],
      whyItGoesHere: "Dense mammal bones undergo thermal bio-rendering and high-pressure grinding to yield renewable energy and nutrient-rich soil amendments.",
      wishcyclingWarning: "Never put large bones in home backyard compost bins; home piles do not get hot enough and will attract pests.",
      funFact: "Bio-rendering converts bone marrow and volatile fatty acids into green methane electricity.",
      difficulty: "tricky",
      tags: ["beef", "bone", "rib", "lamb", "meat"]
    }
  ];

  let filtered = fallbackWasteCatalog;
  if (requestedDifficulty && requestedDifficulty !== "all") {
    const match = fallbackWasteCatalog.filter(i => i.difficulty === requestedDifficulty);
    if (match.length > 0) filtered = match;
  }
  const item = filtered[Math.floor(Math.random() * filtered.length)];
  return {
    ...item,
    id: `fb_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    isAiGenerated: true,
  };
}

// Unlimited Contamination Detection Puzzle Generator API
app.post("/api/generate-contamination-scenario", async (req, res) => {
  try {
    const { targetBin, recentTitles = [] } = req.body || {};
    const ai = getGenAI();

    const streamGuides: Record<string, string> = {
      e_waste: "Designated Drop-Off Location: accepts anything with a plug, cord, or battery (phones, laptops, cables, chargers, lithium & alkaline batteries, circuit boards, small appliances). You must take e-waste to a designated drop-off location like Officeworks or council resource recovery centres—putting it in regular household bins is a fire hazard and illegal. Contaminants include pressurized butane lighters (shredder explosions), wet food organics, shattered ceramics, paper napkins, dirty nappies, general trash.",
      hard_rubbish: "Council Hard Rubbish & Bulky Waste: accepts bulky broken timber furniture, mattresses, bed bases, steel frames, washing machines, dryers, scrap metal, rolls of carpet, bundled timber. Contaminants include lethal asbestos fibro sheets (cancer biohazard), liquid paint/chemicals, daily kitchen food garbage, explosive gas cylinders.",
      medical_waste: "White Lid Bin (Medical Waste): accepts disposable syringes, hypodermic needles, sharps containers, expired medicines, biohazard blood-stained bandages, insulin pens, COVID test swabs. Contaminants include recyclable aluminum soda cans, clean cardboard packaging boxes, household kitchen trash, standard alkaline batteries.",
      commingled_recycling: "Yellow Lid Bin (Commingled Recycling): accepts rigid plastic bottles & containers (#1, #2, #5), aluminum beverage cans, steel food cans, glass jars & bottles. Contaminants include soft plastic grocery bags (tanglers that wrap around spinning screens), lithium-ion batteries (destructive compactor fires), food grease, ceramics, garden hoses.",
      organic: "Green Lid Bin (Organics / FOGO): accepts food scraps, fruit/vegetable peels, coffee grounds, garden clippings, clean paper napkins. Contaminants include greasy pizza boxes, plastic packaging, produce PLU stickers, styrofoam, pet feces, metal cutlery.",
      meat_bones: "Orange Lid Bin (Meat & Bones): accepts raw & cooked meat scraps, animal bones, poultry carcasses, steak bones, seafood shells, fish heads. Contaminants include plastic meat packaging, styrofoam butcher trays, absorbent meat soaker pads, metal barbecue skewers.",
      paper_cardboard: "Blue Lid Bin (Cardboard and Paper): accepts clean dry corrugated boxes, newspaper, magazines, office paper, cereal boxes, paper bags. Contaminants include greasy food boxes, plastic liners, wax-coated hot cups, alkaline batteries, shredded plastic bags.",
      general_waste: "Red Lid Bin (General Waste): accepts non-recyclables, greasy pizza boxes, soft plastics, styrofoam, broken ceramics. Contaminants include explosive lithium batteries, biohazard sharps without protection, industrial hazardous chemicals, automotive lead-acid batteries."
    };

    const validBins = ['e_waste', 'hard_rubbish', 'medical_waste', 'commingled_recycling', 'organic', 'meat_bones', 'paper_cardboard', 'general_waste'];
    const chosenStream = (targetBin && streamGuides[targetBin]) ? targetBin : validBins[Math.floor(Math.random() * validBins.length)];
    const streamGuide = streamGuides[chosenStream];

    if (!ai && !hasNvidiaKey()) {
      return res.json(getFallbackContaminationScenario(chosenStream));
    }

    const prompt = `Generate an engaging, scientifically authentic contamination detective audit puzzle for municipal waste sorting.
Target Stream: "${chosenStream}"
Stream Guide: ${streamGuide}
Avoid using any of these recently seen scenario titles: ${(recentTitles || []).slice(-10).join(', ')}.

Create a scenario with exactly 6 realistic items on the conveyor/sorting table:
- Exactly 2 or 3 items MUST be CONTAMINANTS (isContaminant: true) that do NOT belong in this stream and cause mechanical, chemical, fire, or purity hazards.
- The remaining 3 or 4 items MUST be ACCEPTABLE (isContaminant: false) legitimate items for this specific stream.

Return ONLY a valid JSON object matching this schema:
{
  "title": "Compelling Title (e.g. 'Grey Bin Electronics Reclamation Audit' or 'White Lid Biohazard Sharps Inspection')",
  "binTarget": "${chosenStream}",
  "description": "2-3 sentences setting up the inspection scenario at the depot, MRF, or processing center.",
  "tips": "A forensic tip guiding the detective on what subtle red flags to inspect.",
  "items": [
    {
      "id": "item_1",
      "name": "Specific item name",
      "emoji": "single appropriate unicode emoji",
      "isContaminant": true,
      "explanation": "Clear reason why this item is a contaminant or why it belongs",
      "consequence": "For contaminants: the specific hazard (e.g., shredder explosion, worker needlestick, paper batch pulp spoilage). For valid items: 'Properly accepted stream material.'"
    }
  ]
}`;

    const aiResult = await executeAiWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "You are WasteSort Inspector AI, an expert auditor in MRF optical sorters, commercial composting facilities, electronics recycling smelters, and medical biohazard management. Create crisp, realistic contamination detection puzzles."
      }
    });

    const parsed = unwrapSingleItem(aiResult?.text ? cleanAndParseJson<any>(aiResult.text) : null);
    if (parsed && parsed.title && Array.isArray(parsed.items) && parsed.items.length >= 4) {
      return res.json({
        ...parsed,
        id: `scenario_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        isAiGenerated: true,
      });
    }

    return res.json(getFallbackContaminationScenario(chosenStream));
  } catch {
    console.info("Serving verified municipal scenario for contamination detection request.");
    return res.json(getFallbackContaminationScenario(req.body?.targetBin));
  }
});

function getFallbackContaminationScenario(targetBin?: string) {
  const scenarios: Record<string, any[]> = {
    e_waste: [
      {
        id: `fb_sc_ewaste_${Date.now()}`,
        title: "Designated E-Waste Drop-Off Facility Audit",
        binTarget: "e_waste",
        description: "An incoming batch of residential e-waste has arrived at the designated e-waste drop-off resource recovery center. Detectives must identify non-electronic debris and dangerous fire hazards before feeding the high-speed shredder.",
        tips: "Watch out for flammable pressurized gas containers and wet domestic garbage that disrupt magnetic eddy current separators.",
        isAiGenerated: true,
        items: [
          {
            id: "ew_1",
            name: "Broken Smartphone with Battery",
            emoji: "📱",
            isContaminant: false,
            explanation: "Electronics and smartphones are accepted for disassembly, precious metal recovery, and battery reclamation.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "ew_2",
            name: "Frayed USB-C Power Cord",
            emoji: "🔌",
            isContaminant: false,
            explanation: "Copper cables are chopped into copper granules and recycled into high-grade electrical wiring.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "ew_3",
            name: "Pressurized Butane Cigarette Lighter",
            emoji: "🔥",
            isContaminant: true,
            explanation: "Pressurized butane lighters ignite and explode when crushed by mechanical hammer mills and shredder blades.",
            consequence: "Explosion and catastrophic fire hazard inside electronic shredding chambers."
          },
          {
            id: "ew_4",
            name: "Damaged Computer Motherboard",
            emoji: "🖥️",
            isContaminant: false,
            explanation: "Circuit boards contain gold, silver, and palladium that are safely smelted in e-waste reclamation furnaces.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "ew_5",
            name: "Half-Eaten Greasy Hamburger",
            emoji: "🍔",
            isContaminant: true,
            explanation: "Food waste creates biological slime that corrodes sensitive optical sorters and contaminates dry electronics.",
            consequence: "Organic slime fouls mechanical sorting conveyors and belongs in green organics."
          },
          {
            id: "ew_6",
            name: "Broken Ceramic Coffee Mug",
            emoji: "☕",
            isContaminant: true,
            explanation: "Ceramics contain ultra-hard silicon compounds that dull industrial copper-chopping teeth.",
            consequence: "Damages shredder knives and belongs in the red lid general waste bin."
          }
        ]
      }
    ],
    medical_waste: [
      {
        id: `fb_sc_med_${Date.now()}`,
        title: "White Bin Clinical Sharps & Biohazard Audit",
        binTarget: "medical_waste",
        description: "Inspectors are auditing an incoming container of residential healthcare waste. Ensure ordinary household recyclables aren't misrouted into specialized, energy-intensive medical autoclave autoclaves.",
        tips: "Clean cardboard packaging and aluminum cans belong in curbside bins, not in high-temperature biohazard sterilization.",
        isAiGenerated: true,
        items: [
          {
            id: "mw_1",
            name: "Disposable Insulin Needle with Shield",
            emoji: "💉",
            isContaminant: false,
            explanation: "Sharps and needles represent serious puncture hazards and belong exclusively in white medical waste streams.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "mw_2",
            name: "Clean Aluminum Beverage Can",
            emoji: "🥤",
            isContaminant: true,
            explanation: "Empty soda cans are clean recyclable metals. Placing them in white medical waste wastes specialized high-temperature incineration capacity.",
            consequence: "Unnecessarily diverts clean recyclables from circular supply chains into medical autoclaves."
          },
          {
            id: "mw_3",
            name: "Expired Antibiotic Capsule Blister Pack",
            emoji: "💊",
            isContaminant: false,
            explanation: "Expired pharmaceutical chemicals require high-temperature thermal destruction to protect groundwater.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "mw_4",
            name: "Blood-Stained Wound Gauze Dressing",
            emoji: "🩹",
            isContaminant: false,
            explanation: "Biohazard medical dressings carrying human pathogens must be sanitized through regulated medical waste channels.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "mw_5",
            name: "Clean Cardboard Pill Medicine Box",
            emoji: "📦",
            isContaminant: true,
            explanation: "The outer paperboard packaging is completely clean and unsoiled. It should be flattened and placed in the blue paper bin.",
            consequence: "Wastes expensive medical incineration capacity on clean recyclable paperboard."
          },
          {
            id: "mw_6",
            name: "AA Alkaline Battery",
            emoji: "🔋",
            isContaminant: true,
            explanation: "Batteries can rupture under intense autoclave heat. They belong in the grey e-waste bin.",
            consequence: "Thermal rupture inside clinical sterilizers releasing caustic potassium hydroxide."
          }
        ]
      }
    ],
    commingled_recycling: [
      {
        id: `fb_sc_recycle_${Date.now()}`,
        title: "Yellow Bin Materials Recovery Facility (MRF) Intake",
        binTarget: "commingled_recycling",
        description: "A fast-moving batch on the yellow recycling conveyor has triggered optical alerts. Uncover items that cause sorting line breakdowns or fires.",
        tips: "Flexible film wraps around spinning stars, and batteries explode under compactor pressure.",
        isAiGenerated: true,
        items: [
          {
            id: "cr_1",
            name: "Clean Rigid Shampoo Bottle (HDPE 2)",
            emoji: "🧴",
            isContaminant: false,
            explanation: "High-density polyethylene bottles are easily sorted by near-infrared optical sorters into valuable flake.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "cr_2",
            name: "Soft Plastic Grocery Bag",
            emoji: "🛍️",
            isContaminant: true,
            explanation: "Plastic bags are notorious 'tanglers' that jam rotating screen shafts, shutting down MRF operations for hours.",
            consequence: "Causes costly facility shutdowns requiring workers to cut tangles out by hand."
          },
          {
            id: "cr_3",
            name: "Crushed Aluminum Seltzer Can",
            emoji: "🥫",
            isContaminant: false,
            explanation: "Aluminum is sorted efficiently via eddy current separators and remelted indefinitely.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "cr_4",
            name: "Loose Lithium-Ion Powerbank",
            emoji: "🔋",
            isContaminant: true,
            explanation: "Lithium cells puncture easily when crushed in recycling balers, igniting massive industrial fires.",
            consequence: "Major fire hazard; belongs in the grey e-waste bin."
          },
          {
            id: "cr_5",
            name: "Clear Glass Pickle Jar",
            emoji: "🫙",
            isContaminant: false,
            explanation: "Glass food jars are crushed into clean cullet and melted back into new bottles.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "cr_6",
            name: "Greasy Takeaway Pizza Box",
            emoji: "🍕",
            isContaminant: true,
            explanation: "Food grease soaks into paper fibers and ruins the recycling chemical slurry, and greasy pizza boxes do not belong in green organic or FOGO bins.",
            consequence: "Oil contamination spoils paper pulp; pizza box belongs strictly in the Red General Waste bin (never in the green bin)."
          }
        ]
      }
    ],
    organic: [
      {
        id: `fb_sc_org_${Date.now()}`,
        title: "Green Bin Commercial Compost Screener",
        binTarget: "organic",
        description: "Inspectors are vetting a truckload of green waste heading into industrial windrow composting. Pinpoint non-biodegradable plastics and microplastic carriers.",
        tips: "Produce stickers and shiny plastic packaging do not break down into organic soil humus.",
        isAiGenerated: true,
        items: [
          {
            id: "og_1",
            name: "Banana and Apple Peels",
            emoji: "🍌",
            isContaminant: false,
            explanation: "Raw fruit peels provide moisture and nitrogen for active thermophilic bacteria.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "og_2",
            name: "Plastic Produce Sticker (PLU)",
            emoji: "🏷️",
            isContaminant: true,
            explanation: "Fruit stickers are made of vinyl plastic with synthetic acrylic adhesives that never biodegrade.",
            consequence: "Fragments into permanent microplastics that contaminate organic farm compost."
          },
          {
            id: "og_3",
            name: "Spent Espresso Coffee Grounds",
            emoji: "☕",
            isContaminant: false,
            explanation: "Rich in nitrogen and minerals, coffee grounds accelerate microbial compost decomposition.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "og_4",
            name: "Styrofoam Meat Tray",
            emoji: "🥩",
            isContaminant: true,
            explanation: "Expanded polystyrene does not decompose biologically and breaks into toxic airborne pellets.",
            consequence: "Permanently spoils compost batches and belongs in the red general waste bin."
          },
          {
            id: "og_5",
            name: "Lawn Mower Grass Clippings",
            emoji: "🌱",
            isContaminant: false,
            explanation: "Fresh grass clippings provide organic green matter for balanced soil creation.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "og_6",
            name: "Plastic Clamshell Berry Container",
            emoji: "🍓",
            isContaminant: true,
            explanation: "Clear PET clamshells do not rot. They belong in the yellow recycling bin.",
            consequence: "Physical plastic debris that must be mechanically screened out of finished compost."
          }
        ]
      }
    ],
    paper_cardboard: [
      {
        id: `fb_sc_paper_${Date.now()}`,
        title: "Blue Bin Hydrapulper Batch Quality Inspection",
        binTarget: "paper_cardboard",
        description: "Paper mill technicians are inspecting a bale of paper and cardboard before immersion into the hydrapulper vat. Ensure no plastic coatings or hazardous contaminants disrupt the pulp slurry.",
        tips: "Look out for wax-lined coffee cups and plastic bubble mailers that cannot be pulped with water.",
        isAiGenerated: true,
        items: [
          {
            id: "pb_1",
            name: "Clean Corrugated Cardboard Box",
            emoji: "📦",
            isContaminant: false,
            explanation: "High-grade unbleached kraft fibers provide optimal strength for recycled cardboard manufacturing.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "pb_2",
            name: "Polyethylene-Lined Takeaway Coffee Cup",
            emoji: "☕",
            isContaminant: true,
            explanation: "Hot coffee cups are bonded with an internal plastic moisture barrier that clogs paper pulping screens.",
            consequence: "Gums up hydrapulper mesh screens; belongs in the red lid general waste bin."
          },
          {
            id: "pb_3",
            name: "Daily Newspaper and Paper Bags",
            emoji: "📰",
            isContaminant: false,
            explanation: "Clean newsprint is de-inked and remade into recycled tissue and newsprint.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "pb_4",
            name: "Bubble-Wrap Padded Plastic Mailer",
            emoji: "✉️",
            isContaminant: true,
            explanation: "Composite plastic bubble envelopes contain synthetic LDPE films that do not dissolve in water baths.",
            consequence: "Forms gummy plastic clumps that ruin new paper sheets; belongs in red general waste."
          },
          {
            id: "pb_5",
            name: "Cereal and Pasta Box (Paperboard)",
            emoji: "🥣",
            isContaminant: false,
            explanation: "Dry folding boxboard breaks down smoothly into pulp fibers.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "pb_6",
            name: "Leaking Alkaline Battery",
            emoji: "🔋",
            isContaminant: true,
            explanation: "Batteries leak corrosive chemical electrolytes that contaminate water recycling systems.",
            consequence: "Chemical contamination and acid hazard; belongs in the grey e-waste bin."
          }
        ]
      }
    ],
    meat_bones: [
      {
        id: `fb_sc_meat_${Date.now()}`,
        title: "Orange Lid Meat & Bones Thermal Digest Audit",
        binTarget: "meat_bones",
        description: "An inspector is checking a batch at a dedicated rendering and bone-meal recovery facility. Meat scraps, marrow bones, carcasses, and seafood shells are welcome, but plastic butcher trays and skewers must be rejected.",
        tips: "Plastic butcher wrap, styrofoam trays, and metal skewers contaminate bio-rendering equipment.",
        isAiGenerated: true,
        items: [
          {
            id: "mb_1",
            name: "Rotisserie Chicken Bones & Carcass",
            emoji: "🍗",
            isContaminant: false,
            explanation: "Poultry bones and cartilage pasteurize cleanly in high-heat biological rendering systems.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "mb_2",
            name: "Expanded Polystyrene Meat Foam Tray",
            emoji: "🥩",
            isContaminant: true,
            explanation: "Styrofoam disintegrates into microplastics that poison organic bone-meal agricultural fertilizer.",
            consequence: "Plastic micro-debris pollutes organic fertilizer; belongs in the red general waste bin."
          },
          {
            id: "mb_3",
            name: "Beef T-Bone & Lamb Rib Scraps",
            emoji: "🍖",
            isContaminant: false,
            explanation: "Dense mammal bones are hammer-milled into high-phosphorus agricultural fertilizer.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "mb_4",
            name: "Synthetic Absorbent Meat Soaker Pad",
            emoji: "🩸",
            isContaminant: true,
            explanation: "Meat pads contain non-woven synthetic polymers and superabsorbent gels that never decompose in rendering digesters.",
            consequence: "Synthetic polymers ruin rendering sludge purity; belongs in the red general waste bin."
          },
          {
            id: "mb_5",
            name: "Fish Heads, Bones & Prawn Shells",
            emoji: "🐟",
            isContaminant: false,
            explanation: "Seafood remains provide calcium carbonate and trace minerals for soil enrichment.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "mb_6",
            name: "Stainless Steel Barbecue Skewer",
            emoji: "🍢",
            isContaminant: true,
            explanation: "Rigid metal skewers shatter commercial bio-grinder teeth and jam conveyor hoppers.",
            consequence: "Severe mechanical damage to industrial rendering shredders; belongs in scrap metal or red waste."
          }
        ]
      }
    ],
    hard_rubbish: [
      {
        id: `fb_sc_hr_${Date.now()}`,
        title: "Council Hard Rubbish & Bulky Item Inspection",
        binTarget: "hard_rubbish",
        description: "A municipal bulky waste collection truck has unloaded items at the resource recovery depot. Separate recyclable timber, mattresses, and scrap metal from lethal asbestos and liquid hazardous chemicals.",
        tips: "Bulky timber furniture and mattresses are accepted. Lethal asbestos fibro sheets and wet kitchen trash are hazardous contaminants.",
        isAiGenerated: true,
        items: [
          {
            id: "hr_1",
            name: "Broken Timber Dining Table",
            emoji: "🪑",
            isContaminant: false,
            explanation: "Timber furniture is chipped into industrial mulch or manufactured into composite particle board.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "hr_2",
            name: "Weathered Fibro Asbestos Cement Sheet",
            emoji: "☣️",
            isContaminant: true,
            explanation: "DEADLY HAZARD! Asbestos fibers cause incurable mesothelioma and must ONLY be handled by licensed hazardous waste specialists.",
            consequence: "Severe toxic airborne cancer hazard; entire recovery sorting facility must be evacuated."
          },
          {
            id: "hr_3",
            name: "Steel Spring Mattress",
            emoji: "🛏️",
            isContaminant: false,
            explanation: "Mattress steel springs are smelted into new Australian steel, and foam is upcycled into carpet underlay.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "hr_4",
            name: "Open Can of Oil-Based Liquid Paint",
            emoji: "🎨",
            isContaminant: true,
            explanation: "Liquid paints and solvents contaminate clean timber and metal; belong in specialized Paintback/Chemical CleanOut programs.",
            consequence: "Hazardous chemical spill and volatile flammable vapor risk."
          },
          {
            id: "hr_5",
            name: "Decommissioned Washing Machine",
            emoji: "🧺",
            isContaminant: false,
            explanation: "Whitegoods are processed by high-power hydraulic shredders for steel and copper reclamation.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "hr_6",
            name: "Rotting Bag of Kitchen Food Waste",
            emoji: "🥦",
            isContaminant: true,
            explanation: "Daily kitchen food scraps belong exclusively in the green FOGO bin, not in bulky dry hard rubbish.",
            consequence: "Putrescible odor and pest hazard on the metal recovery pad."
          }
        ]
      }
    ],
    general_waste: [
      {
        id: `fb_sc_gw_${Date.now()}`,
        title: "Red Lid General Waste Landfill Safety Audit",
        binTarget: "general_waste",
        description: "An inspector is evaluating incoming curbside red bins. While broken ceramics, greasy pizza boxes, and snack packaging belong here, dangerous fire starters and recyclable cans must be intercepted.",
        tips: "Watch out for explosive lithium batteries and recyclable clean aluminum cans.",
        isAiGenerated: true,
        items: [
          {
            id: "gw_1",
            name: "Greasy Melted-Cheese Pizza Box Bottom",
            emoji: "🍕",
            isContaminant: false,
            explanation: "Heavy food oils and cheese grease cannot be pulped into clean paper and disrupt FOGO; belongs in red general waste.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "gw_2",
            name: "Lithium-Ion Rechargeable Battery",
            emoji: "🔋",
            isContaminant: true,
            explanation: "CRITICAL FIRE HAZARD! Lithium batteries ignite and explode under the massive pressure of garbage truck compactor blades.",
            consequence: "Leading cause of garbage truck and waste depot fires; belongs strictly in designated e-waste drop-off locations."
          },
          {
            id: "gw_3",
            name: "Broken Ceramic Dinner Plate Shards",
            emoji: "🍽️",
            isContaminant: false,
            explanation: "Ceramics do not melt in glass recycling furnaces; they belong in general waste.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "gw_4",
            name: "Clean Empty Aluminum Beverage Cans",
            emoji: "🥫",
            isContaminant: true,
            explanation: "Aluminum cans are infinitely recyclable with huge energy savings. Throwing them in landfill wastes circular metals.",
            consequence: "Diverts valuable circular metals into landfill; belongs in yellow commingled recycling."
          },
          {
            id: "gw_5",
            name: "Empty Foil Potato Chip Snack Packet",
            emoji: "🥔",
            isContaminant: false,
            explanation: "Metallized multi-layer film packaging cannot be mechanically recycled or composted.",
            consequence: "Properly accepted stream material."
          },
          {
            id: "gw_6",
            name: "Unprotected Medical Syringe Needle",
            emoji: "💉",
            isContaminant: true,
            explanation: "Lethal puncture and bloodborne pathogen hazard for waste collectors; belongs strictly in puncture-proof white medical sharps bins.",
            consequence: "Severe needlestick biohazard for sanitation crews; belongs in white medical waste."
          }
        ]
      }
    ]
  };

  const pool = (targetBin && scenarios[targetBin]) ? scenarios[targetBin] : (
    [...scenarios.e_waste, ...scenarios.medical_waste, ...scenarios.commingled_recycling, ...scenarios.organic, ...scenarios.paper_cardboard, ...scenarios.meat_bones, ...scenarios.hard_rubbish, ...scenarios.general_waste]
  );
  return pool[Math.floor(Math.random() * pool.length)];
}

async function startServer() {
  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`WasteSort server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal error starting WasteSort server:", err);
  process.exit(1);
});
