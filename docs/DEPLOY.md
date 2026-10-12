# Deployment

## GitHub Pages (set up in this repository)

1. Push this repository to GitHub.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` runs `.github/workflows/pages.yml`, which checks the data files and publishes the site. The address appears in the workflow run, usually `https://<username>.github.io/<repository>/`.

## Your own domain

1. Buy the domain (for example from Loopia, One.com, Namecheap or Cloudflare).
2. In **Settings → Pages → Custom domain**, enter it, e.g. `swedent.se` or `www.swedent.se`, and save. GitHub creates the `CNAME` setting for you.
3. At your domain registrar, add DNS records:
   - For `www.swedent.se`: a `CNAME` record pointing `www` to `<username>.github.io`.
   - For the bare `swedent.se`: four `A` records pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`.
4. Wait for DNS to update (minutes to a few hours), then tick **Enforce HTTPS**.

## Turning on CV Match and email drafting on your own domain

These features call Claude. On a static host they show a "coming soon" notice. To enable them:

1. Move hosting to a platform with serverless functions, such as Vercel or Cloudflare Pages (both free to start, both support custom domains).
2. Add one function, e.g. `/api/match`, that receives the prompt from the page, calls the Anthropic API with your key stored as an environment variable, and returns the answer.
3. In `index.html`, replace the `window.claude.use("sample")` connection with a call to that function.
4. Add rate limiting (per IP or per signed-in user), because every request costs API credits.

Never put an API key in `index.html` or anywhere in this repository.

## Sign-in with Google, LinkedIn or Apple

Real sign-in needs an authentication service, for example Supabase Auth, Firebase Authentication or Clerk. All three offer Google and Apple sign-in on free tiers; LinkedIn sign-in uses the LinkedIn OpenID Connect app. Profiles and alerts would then be stored per user in the service's database instead of the browser.
