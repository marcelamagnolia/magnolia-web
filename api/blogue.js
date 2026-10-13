// Le blogue public : la liste, et chaque article.
//
// Rendu sur le serveur, pas dans le navigateur. Google lit ce qu'on lui envoie,
// et l'intérêt du blogue est précisément d'être trouvé : une page qui s'assemble
// en JavaScript arrive vide pour lui.
import { supabase, markdown, page, dateFr, SITE } from './_commun.js'

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
                                .replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export default async function handler(req, res) {
  try {
    const slug = (req.query?.slug || '').trim()
    const html = slug ? await article(slug, res) : await liste()
    if (html === null) return   // l'article a déjà répondu 404
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    // Une minute de cache, puis réutilisation pendant qu'on régénère en fond.
    // Un article publié apparaît donc en moins d'une minute, sans que chaque
    // visite frappe la base.
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600')
    res.status(200).send(html)
  } catch (e) {
    console.error('[blogue]', e)
    res.status(500).send('Le blogue est momentanément indisponible.')
  }
}

// ── La liste ───────────────────────────────────────────────────────────────
async function liste() {
  const articles = await supabase(
    'blog_articles?statut=eq.PUBLIE&langue=eq.fr' +
    '&select=slug,titre,resume,image_url,categorie,auteur_nom,publie_le' +
    '&order=publie_le.desc&limit=50')

  const cartes = articles.length ? articles.map(a => `
      <article class="article-carte">
        ${a.image_url ? `<a href="/blogue/${esc(a.slug)}"><img src="${esc(a.image_url)}" alt=""></a>`
                      : '<div></div>'}
        <div>
          ${a.categorie ? `<span class="etiquette">${esc(a.categorie)}</span>` : ''}
          <a href="/blogue/${esc(a.slug)}"><h3>${esc(a.titre)}</h3></a>
          <p class="article-meta">${dateFr(a.publie_le)} · ${esc(a.auteur_nom)}</p>
          ${a.resume ? `<p>${esc(a.resume)}</p>` : ''}
        </div>
      </article>`).join('\n') : `
      <p style="text-align:center; color: rgba(52,80,122,.6); padding: 40px 0;">
        Les premiers articles arrivent bientôt.
      </p>`

  return page({
    titre: 'Le blogue — Magnolia Signature',
    description: "Des histoires de terrain, des savoir-faire, et ce que le collectif découvre en faisant circuler la matière.",
    url: `${SITE}/blogue/`,
    image: `${SITE}/assets/partage/accueil.jpg`,
    corps: `
<section style="background: var(--cream); padding-top: 56px; padding-bottom: 8px;">
  <div class="blogue">
    <span class="section-label" style="text-align:center; display:block;">Le blogue</span>
    <h2 style="text-align:center; margin-bottom: 10px;">Ce qu'on apprend en chemin</h2>
    <p style="text-align:center; max-width: 560px; margin: 0 auto; color: rgba(52,80,122,.72);">
      Des histoires de terrain, des savoir-faire, et ce que le collectif
      découvre en faisant circuler la matière.
    </p>
  </div>
</section>

<section style="background: var(--cream); padding-top: 8px;">
  <div class="blogue">
${cartes}
  </div>
</section>`,
  })
}

// ── Un article ─────────────────────────────────────────────────────────────
async function article(slug, res) {
  // `statut=eq.PUBLIE` est dans la requête, pas dans un test après coup : un
  // brouillon ne doit pas pouvoir être lu par quelqu'un qui devine son adresse.
  const trouves = await supabase(
    `blog_articles?slug=eq.${encodeURIComponent(slug)}&statut=eq.PUBLIE&select=*&limit=1`)
  const a = trouves?.[0]

  if (!a) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.status(404).send(page({
      titre: 'Article introuvable — Magnolia Signature',
      description: "Cet article n'existe pas ou n'est plus publié.",
      url: `${SITE}/blogue/`,
      corps: `
<section style="background: var(--cream); min-height: 48vh; display:flex; align-items:center;">
  <div class="blogue" style="text-align:center;">
    <h2>Cet article est introuvable</h2>
    <p style="color: rgba(52,80,122,.72);">Il a peut-être été retiré, ou l'adresse a changé.</p>
    <p><a class="retour" href="/blogue/">← Retour au blogue</a></p>
  </div>
</section>`,
    }))
    return null
  }

  return page({
    titre: `${a.titre} — Magnolia Signature`,
    description: a.resume || a.titre,
    url: `${SITE}/blogue/${a.slug}`,
    image: a.image_url || `${SITE}/assets/partage/accueil.jpg`,
    categorie: a.categorie,
    corps: `
<section style="background: var(--cream); padding-top: 48px;">
  <div class="blogue">
    <a class="retour" href="/blogue/">← Le blogue</a>
    ${a.categorie ? `<span class="etiquette">${esc(a.categorie)}</span>` : ''}
    <h1 style="font-family:'Instrument Serif',serif; color: var(--navy); font-size: clamp(30px,4.6vw,46px); line-height:1.2; margin: 6px 0 14px;">
      ${esc(a.titre)}
    </h1>
    <p class="article-meta">${dateFr(a.publie_le)} · ${esc(a.auteur_nom)}</p>
    ${a.image_url ? `<img src="${esc(a.image_url)}" alt="" style="width:100%; border-radius:12px; margin: 26px 0 34px;">` : ''}
    <div class="corps">
${markdown(a.corps_md)}
    </div>
  </div>
</section>`,
  })
}
