# Upload Receipt Function

This Supabase Edge Function generates presigned URLs for uploading receipt images to Cloudflare R2.

## Setup

### 1. Install Dependencies

The function uses AWS SDK packages. Deno will automatically download them on first run, but you can cache them manually:

```bash
cd supabase/functions/upload-receipt
deno cache index.ts
```

### 2. Environment Variables

Set these in your Supabase project settings or `.env` file:

```env
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY=<your-r2-access-key>
R2_SECRET_KEY=<your-r2-secret-key>
R2_BUCKET=<your-bucket-name>
R2_PUBLIC_BASE=https://<your-public-domain>
```

### 3. Deploy

```bash
supabase functions deploy upload-receipt
```

## Usage

### Request

# Step 1: Get upload URL

curl 'https://zbisfbcmgypcxokydnwc.supabase.co/functions/v1/upload-receipt' \
 -H 'Authorization: Bearer YOUR_KEY' \
 -H 'Content-Type: application/json' \
 -d '{"contentType": "image/png", "extension": "png"}'

# Step 2: Upload file using the uploadUrl from response

curl -X PUT 'UPLOAD_URL' \
 -H 'Content-Type: image/png' \
 --data-binary '@receipt.png'

# File is now accessible at the publicUrl!

## Local Development

```bash
supabase start
supabase functions serve upload-receipt --env-file .env
```
