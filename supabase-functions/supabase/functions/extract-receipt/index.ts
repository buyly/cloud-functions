import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Types for receipt extraction
interface ReceiptItem {
  i: string; // item name
  p: number; // price
}

// Manual validation function (faster than Zod)
function validateReceiptItems(data: unknown): ReceiptItem[] {
  if (!Array.isArray(data)) {
    throw new Error("Response must be an array");
  }

  return data.map((item, index) => {
    // Handle completely invalid items
    if (typeof item !== "object" || item === null) {
      console.warn(
        `Item at index ${index} is not an object, returning as unknown`
      );
      return { i: "unknown", p: 0 };
    }

    const { i, p } = item as Record<string, unknown>;

    // Validate item name
    const hasValidName = typeof i === "string" && i.trim() !== "";
    const itemName = hasValidName ? i.trim() : "unknown";

    // Validate price
    const hasValidPrice = typeof p === "number" && p > 0 && isFinite(p);
    const itemPrice = hasValidPrice ? p : 0;

    // Log warnings for invalid data
    if (!hasValidName && hasValidPrice) {
      console.warn(`Item at index ${index} has invalid name, using "unknown"`);
    } else if (hasValidName && !hasValidPrice) {
      console.warn(
        `Item at index ${index} ("${itemName}") has invalid price (${p}), using 0`
      );
    } else if (!hasValidName && !hasValidPrice) {
      console.warn(
        `Item at index ${index} has both invalid name and price, using "unknown" and 0`
      );
    }

    return { i: itemName, p: itemPrice };
  });
}

interface ErrorResponse {
  error: string;
  message: string;
}

Deno.serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" } as ErrorResponse),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  try {
    const startTime = performance.now();
    // Parse request body
    const body = await req.json();
    const { imageUrl, userId } = body;

    if (!imageUrl) {
      return new Response(
        JSON.stringify({
          error: "Missing required field",
          message: "imageUrl is required",
        } as ErrorResponse),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Get OpenRouter API key from environment
    const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterApiKey) {
      console.error("OPENROUTER_API_KEY not configured");
      return new Response(
        JSON.stringify({
          error: "Configuration error",
          message: "AI service not configured",
        } as ErrorResponse),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    console.log(
      `Processing receipt extraction for user: ${userId || "anonymous"}`
    );
    console.log(`Image URL: ${imageUrl}`);

    // Call OpenRouter API (supports multiple models including GPT-4, Claude, etc.)
    const openaiResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openrouterApiKey}`,
          "HTTP-Referer": "https://buyly.co.za",
          "X-Title": "Buyly Receipt Extraction",
        },
        body: JSON.stringify({
          // Available models (uncomment to switch):
          // model: "openai/gpt-4o", // OpenAI GPT-4 with vision (paid)
          // model: "anthropic/claude-3.5-sonnet", // Claude 3.5 Sonnet (paid)
          // model: "google/gemini-pro-vision", // Google Gemini Pro Vision (paid)
          // model: "nvidia/nemotron-nano-12b-v2-vl:free", // 24seconds NVIDIA free vision model (default)
          // model: "nvidia/nemotron-nano-12b-v2-vl", //8sec cosco
          //model: "google/gemini-2.0-flash-exp:free", //4sec cosco
          // model: "google/gemini-2.0-flash-lite-001", //3sec cosco
          // model: "google/gemma-3-4b-it", //4sec cosco
          model: "mistralai/mistral-small-3.1-24b-instruct", //4sec cosco
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `You are a receipt parser. Extract only the grocery line items from the text or image provided.

Rules:
1. Extract the item name and price for each product.
2. Output STRICT JSON format only.
3. IGNORE: Store name, date, quantity, address, subtotal, tax, total, payments, savings lines, or decorative text.
4. If an item has a discount code below it, ignore the discount line; just capture the item price.
5. Use this JSON schema: [{"i": "Item Name", "p": 0.00}]`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageUrl,
                    detail: "auto",
                  },
                },
              ],
            },
          ],
          max_tokens: 1000,
          temperature: 0.1,
        }),
      }
    );

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error("OpenAI API error:", errorData);
      return new Response(
        JSON.stringify({
          error: "AI processing failed",
          message: "Failed to analyze receipt image",
        } as ErrorResponse),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const openaiData = await openaiResponse.json();
    const message = openaiData.choices[0]?.message;
    const extractedText = message?.content;

    if (!extractedText) {
      return new Response(
        JSON.stringify({
          error: "Extraction failed",
          message: "No data extracted from image",
        } as ErrorResponse),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Parse the JSON response from AI
    let items: ReceiptItem[];
    try {
      // Remove markdown code blocks if present
      const cleanedText = extractedText
        .replace(/```json\n?|\n?```/g, "")
        .trim();
      const rawItems = JSON.parse(cleanedText);

      // Validate with manual validation (faster than Zod)
      items = validateReceiptItems(rawItems);
    } catch (parseError: unknown) {
      console.error("Failed to parse AI response:", extractedText);
      const errorMessage =
        parseError instanceof Error
          ? parseError.message
          : "Failed to parse extracted data";
      console.error("Validation error:", errorMessage);

      return new Response(
        JSON.stringify({
          error: "Parse error",
          message: errorMessage,
        } as ErrorResponse),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    console.log("Successfully extracted receipt data");
    const endTime = performance.now();
    const executionTime = Math.round(endTime - startTime);
    console.log(`Extracted ${items.length} items in ${executionTime}ms`);

    // Return the extracted data
    return new Response(
      JSON.stringify({
        success: true,
        items: items,
        metadata: {
          imageUrl,
          userId: userId || null,
          extractedAt: new Date().toISOString(),
          executionTimeMs: executionTime,
          tokensUsed: openaiData.usage?.total_tokens || 0,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Error in extract-receipt function:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      } as ErrorResponse),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

/* Usage Example:

Step 1: Upload receipt and get URL (using upload-receipt function)

Step 2: Extract receipt data
curl --location 'https://zbisfbcmgypcxokydnwc.supabase.co/functions/v1/extract-receipt' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "imageUrl": "https://core.buyly.co.za/receipt-xxx.png",
    "userId": "user123"
  }'

Response:
{
  "success": true,
  "items": [
    {"i": "Organic Bananas", "p": 2.99},
    {"i": "Milk 2%", "p": 4.50},
    {"i": "Bread", "p": 3.25}
  ],
  "metadata": {
    "imageUrl": "https://core.buyly.co.za/receipt-xxx.png",
    "userId": "user123",
    "extractedAt": "2025-11-21T10:30:00Z",
    "tokensUsed": 850
  }
}

*/
