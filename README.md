# SourceTX Website — HTML + Pictures + Functional Backend

This corrected package contains **real, visible HTML files** and **real image files**.

## Where the files are

- `public/index.html` — homepage
- `public/about.html`, `services.html`, `jobs.html`, etc. — all website pages
- `public/talent-workforce.html`, `cloud-infrastructure.html`, `data-ai-analytics.html`, `application-engineering.html`, `cybersecurity-quality.html`, and `managed-services.html` — expanded service detail pages
- `public/pictures/animated-*.svg` — self-contained animated illustrations
- `public/job-*.html` — individual job pages
- `public/apply-*.html` — individual application pages
- `public/pictures/` — JPG, PNG, and WebP image files
- `public/css/styles.css` — website design
- `public/js/app.js` — navigation, form submission, and job filtering
- `server.js` — form processing, résumé uploads, email alerts, admin area, jobs API, sitemap, and security

## Preview immediately

You can open `public/index.html` directly to inspect the design and pictures. Navigation also works when opened directly.

Forms require the included server:

```bash
npm install
cp .env.example .env
npm start
```

Then open `http://localhost:3000`.

## Publish

### Render
1. Upload this folder to a GitHub repository.
2. Create a new Render Blueprint from the repository.
3. Render uses `render.yaml`.
4. Set `NOTIFY_EMAIL` and the SMTP variables.
5. Add the custom domain and HTTPS.

### VPS or hosting with Node.js
```bash
npm ci --omit=dev
ADMIN_PASSWORD='use-a-strong-password' SITE_URL='https://www.sourcetx.com' npm start
```
Use Nginx or your hosting dashboard to route the domain to port 3000.

> Ordinary HTML-only hosting can display the pages and pictures, but résumé uploads and forms require Node.js or another backend.

## Before launch

1. Verify the company name should be **SourceTX** or **SourceTek** and use one version consistently.
2. Verify phone, email, office addresses, LinkedIn URL, and legal company name.
3. Replace sample jobs in `data/jobs.json` with approved active jobs.
4. Configure SMTP so applications and messages reach the recruiting team.
5. Change `ADMIN_PASSWORD`; the admin page is `/admin`.
6. Confirm commercial image rights for all pictures inherited from the supplied site.
7. Have privacy and website terms reviewed for US and UK recruiting requirements.
8. Add verified testimonials, leadership profiles, client sectors, and measurable results.
9. Connect Bullhorn or another ATS when API credentials are available.
10. For higher traffic, move JSON submissions to PostgreSQL and résumés to encrypted S3 storage.

## Content suggestions

- Add a clear proof section with verified numbers: placements, repeat clients, average response time, or consultant retention.
- Add named recruiter profiles to build trust with candidates.
- Publish 3–5 short hiring guides and interview resources for SEO.
- Add salary ranges and employment classification where legally required.
- Add client and candidate testimonials only with permission.
- Add CAPTCHA or Cloudflare Turnstile before a public launch to reduce spam.

## Expanded service content

The services portfolio now covers talent and workforce solutions, cloud and infrastructure, data and AI, application engineering, cybersecurity and quality engineering, and managed services. All copy is original and should be validated against the services SourceTX actually delivers. Review `CONTENT_SUGGESTIONS.md` before launch.

## Animation

Animated SVG illustrations are stored in `public/pictures/` and work without external libraries. Scroll-reveal and floating effects are in `public/css/styles.css` and `public/js/app.js`. Motion is automatically reduced for visitors who enable the operating-system “reduce motion” accessibility preference.

### Animation picture files

Each animated illustration has two local files in `public/pictures/`:

- `animated-*.svg` — the live animated version displayed on the website
- `animated-*-poster.png` — a normal PNG preview/fallback that can be opened in any image viewer

`animation-preview-sheet.png` shows all five illustrations together.
