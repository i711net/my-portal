# MY Blog

MY Blog is a full-feature blog starter built for GitHub, Vercel, and Cloudflare.

## What is included

- Public blog homepage
- Featured and latest post sections
- Dynamic article pages
- Admin writing desk UI
- Direct image upload flow for Cloudflare R2
- Supabase-backed published posts and homepage settings
- Environment template for Vercel deployment
- Git-friendly project structure

## Local setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Cloudflare R2 image uploads

Create an R2 bucket and an R2 API token, then set these variables in `.env.local` and Vercel:

```bash
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
ADMIN_UPLOAD_TOKEN=
```

The admin page calls `/api/upload-url`, receives a presigned URL, and uploads the selected image directly to R2.

## Supabase online posts

Published posts and homepage settings are stored in Supabase so visitors can see them online.

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Paste and run `supabase/schema.sql`.
4. Add these Vercel environment variables:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` must stay secret. Do not add it with a `NEXT_PUBLIC_` name.

After Vercel redeploys, open `/admin`, enter the same `ADMIN_UPLOAD_TOKEN`, then publish an article. The homepage reads `/api/posts`, and article pages read `/posts/your-slug`.

## GitHub and Vercel deployment

1. Push this folder to a GitHub repository named `MY Blog` or `my-blog`.
2. Import the GitHub repository in Vercel.
3. Add the R2 and Supabase environment variables in Vercel.
4. Point your domain DNS through Cloudflare and add the Vercel DNS records.

## Production next steps

- Add Auth.js or GitHub OAuth for the admin area.
- Add Turnstile to login, comments, and forms.
- Add sitemap and RSS generation.
