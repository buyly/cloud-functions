```bash
supabase functions serve hello-world
```

Start Docker Desktop on your Mac
Once Docker is running, try the command again:

```bash
supabase functions serve hello-world
```

Alternatively, you can deploy directly to Supabase without local testing:

```bash
supabase functions deploy hello-world
```

Set secrets:

```bash
supabase secrets set --env-file .env
```
