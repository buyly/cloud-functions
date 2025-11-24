import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

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
    const body = await req.json();
    const { filename } = body;

    if (!filename) {
      return new Response(JSON.stringify({ error: "Filename is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Extract filename from URL if a full URL is provided
    let key = filename;
    try {
      const url = new URL(filename);
      // Get the pathname and remove leading slash, then decode URI components
      key = decodeURIComponent(url.pathname.substring(1));
    } catch {
      // If it's not a valid URL, treat it as a plain filename
      key = filename;
    }

    console.log("Deleting file:", key);

    const command = new DeleteObjectCommand({
      Bucket: Deno.env.get("R2_BUCKET"),
      Key: key,
    });

    await r2Client.send(command);

    console.log("File deleted successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "File deleted successfully",
        filename,
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
        error: "Failed to delete file",
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

curl --request POST 'https://[project-ref].supabase.co/functions/v1/delete-receipt' \
  --header 'Authorization: Bearer YOUR_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"filename": "receipt-1234567890.png"}'

*/
