import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Types for receipt extraction
interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  category?: string;
}

interface ExtractedReceipt {
  merchant: string;
  date: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  confidence: number;
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

    console.log(`Processing receipt extraction for user: ${userId || "anonymous"}`);
    console.log(`Image URL: ${imageUrl}`);

    // Call OpenRouter API (supports multiple models including GPT-4, Claude, etc.)
    const openaiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openrouterApiKey}`,
        "HTTP-Referer": "https://buyly.co.za",
        "X-Title": "Buyly Receipt Extraction",
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-nano-12b-v2-vl:free",
        messages: [
          {
            role: "system",
            content: `You are a receipt data extraction expert. Extract structured data from receipt images.
Return a JSON object with this exact structure:
{
  "merchant": "store name",
  "date": "YYYY-MM-DD",
  "items": [{"name": "item name", "quantity": 1, "price": 0.00, "category": "groceries"}],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00,
  "currency": "USD",
  "confidence": 0.95
}

Rules:
- Extract ALL items from the receipt
- Use numeric values only for prices (no currency symbols)
- Infer reasonable categories: "groceries", "produce", "dairy", "meat", "beverages", "snacks", "household", "other"
- If date is unclear, use current date
- Set confidence between 0.0-1.0 based on image quality
- Return ONLY the JSON object, no additional text`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all data from this receipt image. Return only valid JSON.",
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                  detail: "high",
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.2,
        reasoning: { enabled: true },
      }),
    });

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
    const reasoningDetails = message?.reasoning_details;

    // Log reasoning if available (for debugging)
    if (reasoningDetails) {
      console.log("AI Reasoning:", JSON.stringify(reasoningDetails));
    }

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

    // Parse the JSON response from OpenAI
    let extractedData: ExtractedReceipt;
    try {
      // Remove markdown code blocks if present
      const cleanedText = extractedText.replace(/```json\n?|\n?```/g, "").trim();
      extractedData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", extractedText);
      return new Response(
        JSON.stringify({
          error: "Parse error",
          message: "Failed to parse extracted data",
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
    console.log(`Merchant: ${extractedData.merchant}, Items: ${extractedData.items.length}, Total: ${extractedData.total}`);

    // Return the extracted data
    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData,
        metadata: {
          imageUrl,
          userId: userId || null,
          extractedAt: new Date().toISOString(),
          tokensUsed: openaiData.usage?.total_tokens || 0,
          ...(reasoningDetails && { reasoningDetails }),
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
  "data": {
    "merchant": "Whole Foods",
    "date": "2025-11-21",
    "items": [
      {"name": "Organic Bananas", "quantity": 1, "price": 2.99, "category": "produce"},
      {"name": "Milk 2%", "quantity": 1, "price": 4.50, "category": "dairy"}
    ],
    "subtotal": 7.49,
    "tax": 0.60,
    "total": 8.09,
    "currency": "USD",
    "confidence": 0.95
  },
  "metadata": {
    "imageUrl": "https://core.buyly.co.za/receipt-xxx.png",
    "userId": "user123",
    "extractedAt": "2025-11-21T10:30:00Z",
    "tokensUsed": 1250
  }
}

*/
