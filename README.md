# Deploy Next.js to Render

This is a Next.js template which can be deployed to [Render](https://render.com).

## Shared Booking Data

The app now uses server API routes instead of browser `localStorage`. For real
multi-user operation, connect it to Supabase PostgreSQL:

1. Create a Supabase project.
1. Open the Supabase SQL editor and run `database/schema.sql`.
1. Copy `.env.example` to `.env.local` for local development.
1. Set these environment variables in local and production environments:

- `SUPABASE_URL`: your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key used by Next.js API routes.
- `ADMIN_PASSWORD`: password for the admin page.
- `ADMIN_SESSION_SECRET`: random secret used to sign the admin cookie.

If Supabase variables are missing, the app falls back to an in-memory development
store. That fallback is not durable and should not be used for production.

## Deploying to Render

This template can be used to deploy your Next.js application as a Node.js server.

### Deploy in one click

1. Fork this repo.
1. In your new repo, click the button below.

<a href="https://render.com/deploy" referrerpolicy="no-referrer-when-downgrade" rel="nofollow">
  <img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" />
</a>

Note: The button uses the `render.yaml` file in this repo to deploy your app. For more information about `render.yaml`, see [Render's guide](https://docs.render.com/infrastructure-as-code).

### Deploy manually

1. Fork this repo.
1. Create a new Web Service on Render.
1. Give Render permission to access your new repo.
1. Use the following values during Web Service creation.

- Runtime: Node
- Build Command: `pnpm install; pnpm build`
- Start Command: `pnpm start`

Add the environment variables from `.env.example` in the Render dashboard before
using the site with multiple users.

## Learn More
To learn more about deploying Next.js, take a look at the following resources:

- [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying#self-hosting)
- [Deploying Next.js on Render](https://docs.render.com/deploy-nextjs-app)

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
