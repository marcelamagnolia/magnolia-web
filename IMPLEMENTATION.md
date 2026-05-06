# Magnolia Signature — Implementation Notes

## Hosting

- **Repository**: GitHub — `github.com/marcelamagnolia/magnolia-web`
- **Deployment**: Vercel — connected to the GitHub repo, auto-deploys on every push to `main`
- **Domain**: `magnoliasignature.org` — DNS A record points to Vercel (`216.198.79.1`), managed in GoDaddy
- **SSL**: Provisioned automatically by Vercel

## Structure

Static HTML site — no build step, no framework.

```
magnolia-web/
├── index.html           → magnoliasignature.org/
├── style.css
├── assets/
├── magconnect/
│   └── index.html       → magnoliasignature.org/magconnect/
└── magself/
    └── index.html       → magnoliasignature.org/magself/
```

## Email subscription forms

Both forms on the site call the **MagConnect backend API** (`api.magconnect.ca/waitlist`) to add contacts to Brevo.

| Page | List | Brevo list ID |
|------|------|---------------|
| Main page (`/`) — "Rejoindre le Collectif" | MagnoliaSignature - Infolettre | #6 |
| MagConnect page (`/magconnect/`) — "Je rejoins la communauté fondatrice" | MagConnect - Infolettre | #4 |

### How it works
1. User enters their email and submits the form
2. The form calls `POST https://api.magconnect.ca/waitlist` with `{ email, list_id }`
3. The MagConnect backend adds the contact to the correct Brevo list
4. A success or error message is shown in the user's language (FR/EN)

### Requirements on the MagConnect backend
- `ALLOWED_ORIGINS` environment variable (Railway) must include `https://magnoliasignature.org` and `https://www.magnoliasignature.org`
- `BREVO_API_KEY` must be set
- Allowed list IDs are whitelisted in `routers/waitlist.py`: `{3, 4, 6}`

## Languages

The site supports French and English. Language is toggled via the FR/EN button in the nav and persisted in `localStorage`. All content is duplicated with `data-fr` / `data-en` attributes, controlled by a `lang-en` class on `<body>`.

## Deploying changes

```bash
cd magnolia-web
git add .
git commit -m "your message"
git push
```

Vercel picks up the push and redeploys automatically within ~30 seconds.
