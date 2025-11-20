import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// R2 Configuration
const r2Client = new S3Client({
  region: "auto",
  endpoint: Deno.env.get("R2_ENDPOINT"),
  credentials: {
    accessKeyId: Deno.env.get("R2_ACCESS_KEY")!,
    secretAccessKey: Deno.env.get("R2_SECRET_KEY")!,
  },
});

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
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  try {
    // Parse request body (optional: get filename and content type from client)
    let contentType = "image/png";
    let extension = "png";

    try {
      const body = await req.json();
      if (body.contentType) contentType = body.contentType;
      if (body.extension) extension = body.extension;
    } catch {
      // If no JSON body, use defaults
    }

    // Generate unique filename
    const filename = `receipt-${Date.now()}-${crypto.randomUUID()}.${extension}`;

    console.log("Generating presigned URL for:", filename);

    // Create presigned URL for upload (valid for 10 minutes)
    const command = new PutObjectCommand({
      Bucket: Deno.env.get("R2_BUCKET"),
      Key: filename,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 600 });
    const publicUrl = `${Deno.env.get("R2_PUBLIC_BASE")}/${filename}`;

    console.log("Presigned URL generated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        uploadUrl,
        publicUrl,
        filename,
        expiresIn: 600,
        instructions: "Use PUT request to uploadUrl with the file binary data",
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate upload URL",
        message: error instanceof Error ? error.message : String(error),
      }),
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

/* Usage:

Step 1: Get presigned URL
curl --location 'https://zbisfbcmgypcxokydnwc.supabase.co/functions/v1/upload-receipt' \
  --header 'Authorization: Bearer YOUR_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"contentType": "image/png", "extension": "png"}'

Step 2: Upload file to R2 using the uploadUrl from step 1
curl --request PUT 'UPLOAD_URL_FROM_STEP_1' \
  --header 'Content-Type: image/png' \
  --data-binary '@receipt.png'

Step 3: Access the file at the publicUrl

*/
