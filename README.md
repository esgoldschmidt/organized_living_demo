## Project Description

I built this as a lightweight version of what Bid360’s Design Tool could become. The core idea was to focus on the workflow, not just the UI: a designer can place, move, resize, save, reload, and version closet layouts in a clean visual workspace. I used Next.js and TypeScript for the front end, then added a Prisma-backed MongoDB persistence layer so designs can be saved as projects with revision history instead of living only in browser state.

What I wanted to show is how I think about the real product: front-end polish matters because this is a visual selling tool, but I also thought through the full stack behind it, including data modeling for projects, spaces, scans, and design revisions. I added confirmation modals, toast feedback, saved-layout loading, and a clearer product story around mobile capture feeding desktop design. So even though this is a focused demo, it reflects how I’d approach the real role: own the design tool end to end, make the experience intuitive, and build it on a foundation that can grow into a true SaaS product.

## 

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Product Scaffold

The app now includes a first-pass persistence layer for a real product workflow:

- `prisma/schema.prisma` models projects, spaces, scans, and versioned design revisions
- `src/app/api/projects/*` provides route handlers for creating projects and saving revisions
- `src/store/designStore.ts` keeps local draft storage, then upgrades to backend persistence when `DATABASE_URL` is configured

## Database Setup

1. Copy `.env.example` to `.env`
2. Add your MongoDB connection string as `DATABASE_URL`
3. Generate the Prisma client:

```bash
npm run prisma:generate
```

4. Push the schema to MongoDB:

```bash
npm run prisma:push
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
