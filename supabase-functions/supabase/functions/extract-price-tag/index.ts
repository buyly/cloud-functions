import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Type for price tag result
interface PriceTagResult {
  p: number; // price
  i: string; // product name
}

// Manual validation function (similar style to extract-receipt)
function validatePriceTagResult(data: unknown): PriceTagResult {
  // The model is instructed to return: [{ "i": "Item Name", "p": 0.0 }]
  let candidate: unknown = data;

  if (Array.isArray(candidate)) {
    if (candidate.length === 0) {
      console.warn("Price tag result array is empty, defaulting to unknown/0");
      return { p: 0, i: "unknown" };
    }
    candidate = candidate[0];
  }

  if (typeof candidate !== "object" || candidate === null) {
    console.warn("Price tag result is not an object, defaulting to unknown/0");
    return { p: 0, i: "unknown" };
  }

  const { i, p } = candidate as Record<string, unknown>;

  const hasValidName = typeof i === "string" && i.trim() !== "";
  const itemName = hasValidName ? i.trim() : "unknown";

  const hasValidPrice = typeof p === "number" && isFinite(p) && p >= 0;
  const itemPrice = hasValidPrice ? p : 0;

  if (!hasValidName && hasValidPrice) {
    console.warn(
      "Price tag result has valid price but invalid name, using 'unknown'"
    );
  } else if (hasValidName && !hasValidPrice) {
    console.warn(
      `Price tag result for product "${itemName}" has invalid price (${String(
        p
      )}), using 0`
    );
  } else if (!hasValidName && !hasValidPrice) {
    console.warn(
      "Price tag result has both invalid name and price, using 'unknown' and 0"
    );
  }

  return { p: itemPrice, i: itemName };
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

    if (!imageUrl || typeof imageUrl !== "string" || imageUrl.trim() === "") {
      return new Response(
        JSON.stringify({
          error: "Missing required field",
          message: "imageUrl is required and must be a non-empty string",
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
      `Processing price tag extraction for user: ${userId || "anonymous"}`
    );
    console.log(`Image URL: ${imageUrl}`);

    // Call OpenRouter API with image input (vision)
    const openaiResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openrouterApiKey}`,
          "HTTP-Referer": "https://buyly.co.za",
          "X-Title": "Buyly Price Tag Extraction",
        },
        body: JSON.stringify({
          model: "mistralai/mistral-small-3.1-24b-instruct",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `You are a price tag parser. Extract only the price and product name from the price tag in the provided image.

Rules:
1. Extract the product name and price from the image.
2. Output STRICT JSON in this schema: [{"i": "Item Name", "p": 0.00}].
3. If no price is found, use 0 for the price.
4. If no product name is found, use "unknown" for the product.
5. Return ONLY the JSON, no additional text or markdown formatting.`,
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
          max_tokens: 200,
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
          message: "Failed to analyze price tag text",
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
          message: "No data extracted from text",
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
    let result: PriceTagResult;
    try {
      // Remove markdown code blocks if present
      const cleanedText = extractedText
        .replace(/```json\n?|\n?```/g, "")
        .trim();
      const parsed = JSON.parse(cleanedText);

      // Validate and transform to expected format (similar to extract-receipt)
      result = validatePriceTagResult(parsed);
    } catch (parseError: unknown) {
      console.error("Failed to parse AI response:", extractedText);
      const errorMessage =
        parseError instanceof Error
          ? parseError.message
          : "Failed to parse extracted data";
      console.error("Parse error:", errorMessage);

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

    console.log("Successfully extracted price tag data");
    const endTime = performance.now();
    const executionTime = Math.round(endTime - startTime);
    console.log(
      `Extracted price: ${result.p}, product: ${result.i} in ${executionTime}ms`
    );

    // Return the extracted data in the requested format
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in extract-price-tag function:", error);
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

Step 1: Get presigned upload URL for price tag image

curl --location 'https://zbisfbcmgypcxokydnwc.supabase.co/functions/v1/upload-price-tag' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "contentType": "image/png",
    "extension": "png"
  }'

The response will include an uploadUrl and publicUrl:
{
  "success": true,
  "uploadUrl": "https://...",
  "publicUrl": "https://core.buyly.co.za/price-tag-xxx.png",
  "filename": "price-tag-xxx.png",
  "expiresIn": 600
}

Step 2: Upload the price tag image to uploadUrl

curl --request PUT 'UPLOAD_URL_FROM_STEP_1' \
  --header 'Content-Type: image/png' \
  --data-binary '@price-tag.png'

Step 3: Extract price and product from the uploaded price tag image

curl --location 'https://zbisfbcmgypcxokydnwc.supabase.co/functions/v1/extract-price-tag' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "imageUrl": "https://core.buyly.co.za/price-tag-xxx.png",
    "userId": "user123"
  }'

Response:
{
  "p": 2.99,
  "i": "Organic Bananas"
}

*/
