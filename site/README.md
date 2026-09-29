# Covert public site

This directory contains the minimal public Engineering Preview landing page.

## Local preview

No build step is required.

From the repository root:

```bash
python -m http.server 8080 --directory site
```

Then open:

`http://127.0.0.1:8080/`

Any equivalent static-file server is acceptable for local review.

## Vercel

Recommended Vercel project settings:

- **Root Directory:** `site`
- **Framework Preset:** Other
- **Build Command:** none
- **Output Directory:** `.`

Use Preview deployments for branch/PR review.

Do not promote a Production deployment until owner-authorized.

## Claim boundary

The site intentionally uses the label:

**Engineering Preview / Pre-release**

The website must remain downstream of:

- repository source truth;
- `docs/ENGINEERING_PREVIEW.md`;
- exact-SHA CI/evidence;
- current release gates.

If the website and repository evidence disagree, correct the website.

## Screenshots

Do not add concept images as though they are current product screenshots.

When current screenshots are added, record the branch/SHA they represent in the PR description or adjacent documentation.
