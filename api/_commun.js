// Pièces partagées entre les fonctions du blogue.
//
// Le préfixe « _ » dit à Vercel que ce fichier n'est pas une route : il est
// importé par les autres, jamais appelé directement.

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SITE = 'https://www.magnoliasignature.org'

// ── Accès à la base ────────────────────────────────────────────────────────
//
// Par la clé de service, depuis le serveur uniquement. La clé « anon » ne peut
// pas lire cette table : décidé après l'audit de sécurité d'août 2026, parce
// qu'elle est publique et livrée dans le JavaScript du navigateur. Si ces
// requêtes se mettaient à échouer avec « permission denied », c'est que la
// variable d'environnement manque — pas qu'il faut rouvrir la table.
export async function supabase(chemin, options = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!r.ok) throw new Error(`Supabase ${r.status} : ${await r.text()}`)
  return r.status === 204 ? null : r.json()
}

// ── Qui a le droit d'écrire ────────────────────────────────────────────────
//
// On ne crée pas de comptes pour le blogue : les rédactrices se connectent
// avec leur compte MagConnect, et c'est leur rôle qui décide. Lisa est déjà
// EDITOR. Un compte de plus serait un mot de passe de plus à perdre.
export async function auteurAutorise(req) {
  const entete = req.headers.authorization || ''
  const jeton = entete.startsWith('Bearer ') ? entete.slice(7) : null
  if (!jeton) return null

  // On demande à Supabase qui est ce jeton plutôt que de le décoder nous-mêmes :
  // vérifier une signature à la main est le genre de code qu'on écrit mal une
  // fois et qu'on ne relit jamais.
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${jeton}` },
  })
  if (!r.ok) return null
  const utilisateur = await r.json()
  if (!utilisateur?.id) return null

  const profils = await supabase(
    `profiles?id=eq.${utilisateur.id}&select=first_name,last_name,role`)
  const p = profils?.[0]
  if (!p || !['ADMIN', 'EDITOR'].includes(p.role)) return null

  return {
    id: utilisateur.id,
    nom: [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || 'L\'équipe',
  }
}

// ── Markdown ───────────────────────────────────────────────────────────────
//
// Un convertisseur maison plutôt qu'une dépendance. Deux raisons : le site est
// fait de fichiers statiques sans étape de construction, et y ajouter npm pour
// une seule bibliothèque change la façon dont Vercel déploie tout le reste.
//
// Le texte est échappé AVANT toute transformation, jamais après. C'est ce qui
// rend l'injection impossible par construction : à partir de là, les seules
// balises qui existent sont celles qu'on écrit soi-même. Un convertisseur qui
// échappe à la fin laisse toujours passer quelque chose.
export function markdown(texte) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const enligne = s => esc(s)
    // ![texte](url) avant [texte](url) : sinon le second avale le premier.
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,
             (_, alt, url) => sur(url) ? `<img src="${url}" alt="${alt}" loading="lazy">` : alt)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
             (_, t, url) => sur(url) ? `<a href="${url}">${t}</a>` : t)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')

  // Seules les adresses http(s) et les chemins internes deviennent des liens.
  // « javascript: » dans un href est la façon la plus simple d'exécuter du code
  // chez le lecteur ; ici il ne peut jamais en devenir un.
  const sur = url => /^https?:\/\//i.test(url) || url.startsWith('/')

  const lignes = texte.replace(/\r\n/g, '\n').split('\n')
  const out = []
  let dansListe = null, dansPara = []

  const finirPara = () => {
    if (dansPara.length) { out.push(`<p>${enligne(dansPara.join(' '))}</p>`); dansPara = [] }
  }
  const finirListe = () => { if (dansListe) { out.push(`</${dansListe}>`); dansListe = null } }

  for (const ligne of lignes) {
    const l = ligne.trim()

    if (!l) { finirPara(); finirListe(); continue }

    const titre = l.match(/^(#{1,4})\s+(.*)$/)
    if (titre) {
      finirPara(); finirListe()
      const n = titre[1].length + 1   // « # » devient h2 : le h1 est le titre de l'article
      out.push(`<h${n}>${enligne(titre[2])}</h${n}>`)
      continue
    }

    const puce = l.match(/^[-*]\s+(.*)$/)
    if (puce) {
      finirPara()
      if (dansListe !== 'ul') { finirListe(); out.push('<ul>'); dansListe = 'ul' }
      out.push(`<li>${enligne(puce[1])}</li>`)
      continue
    }

    const num = l.match(/^\d+\.\s+(.*)$/)
    if (num) {
      finirPara()
      if (dansListe !== 'ol') { finirListe(); out.push('<ol>'); dansListe = 'ol' }
      out.push(`<li>${enligne(num[1])}</li>`)
      continue
    }

    const cite = l.match(/^>\s?(.*)$/)
    if (cite) {
      finirPara(); finirListe()
      out.push(`<blockquote>${enligne(cite[1])}</blockquote>`)
      continue
    }

    dansPara.push(l)
  }
  finirPara(); finirListe()
  return out.join('\n')
}

// ── La page ────────────────────────────────────────────────────────────────
//
// Le même habillage que le reste du site : même feuille de style, même
// navigation, même pied de page. C'est tout l'intérêt de le construire
// nous-mêmes — un lecteur qui passe de l'accueil au blogue ne doit pas sentir
// qu'il a changé d'endroit.
export function page({ titre, description, url, image, corps, categorie, apercu }) {
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
                                  .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${apercu ? `<!-- L'aperçu s'ouvre depuis une adresse « blob: », où « /style.css »
       ne pointe nulle part. Cette balise donne au navigateur le point de
       départ à partir duquel résoudre les chemins. Sans elle, l'aperçu
       s'affiche sans aucune mise en forme. -->
  <base href="${SITE}/">
  <meta name="robots" content="noindex, nofollow">` : ''}
  <title>${esc(titre)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(url)}">
  <meta property="og:type" content="${categorie ? 'article' : 'website'}">
  <meta property="og:locale" content="fr_CA">
  <meta property="og:site_name" content="Magnolia Signature">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:title" content="${esc(titre)}">
  <meta property="og:description" content="${esc(description)}">
  ${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/svg+xml" href="/assets/magnolia_favicon.svg">
  <link rel="stylesheet" href="/style.css">
  <style>
    html, body { min-height: 100vh; }
    body { display: flex; flex-direction: column; }
    body > section { flex: 0 0 auto; }
    body > .remplissage { flex: 1 1 auto; }
    .blogue { max-width: 760px; margin: 0 auto; padding: 0 24px; }
    .blogue-large { max-width: 900px; }
    .article-carte {
      border-bottom: 1px solid rgba(52,80,122,.12); padding: 30px 0;
      display: grid; grid-template-columns: 190px 1fr; gap: 26px; align-items: start;
    }
    .article-carte:last-child { border-bottom: none; }
    .article-carte img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 10px; }
    .article-carte h3 { font-family: 'Instrument Serif', serif; font-size: 27px;
      line-height: 1.25; color: var(--navy); margin: 0 0 8px; }
    .article-carte a { text-decoration: none; }
    .article-carte a:hover h3 { opacity: .78; }
    .article-meta { font-size: 13px; color: rgba(52,80,122,.55); margin: 0 0 10px; letter-spacing: .04em; }
    .etiquette { display: inline-block; font-size: 11px; letter-spacing: .12em;
      text-transform: uppercase; color: var(--navy); background: rgba(236,186,100,.22);
      padding: 3px 10px; border-radius: 999px; margin-bottom: 10px; }
    .corps { line-height: 1.75; color: #413f3c; font-size: 17px; }
    .corps h2 { font-family: 'Instrument Serif', serif; color: var(--navy);
      font-size: 30px; margin: 44px 0 14px; }
    .corps h3 { font-family: 'Instrument Serif', serif; color: var(--navy);
      font-size: 24px; margin: 34px 0 12px; }
    .corps p { margin: 0 0 20px; }
    .corps img { max-width: 100%; border-radius: 10px; margin: 24px 0; }
    .corps blockquote { border-left: 3px solid var(--gold); margin: 24px 0;
      padding: 4px 0 4px 20px; font-style: italic; color: rgba(52,80,122,.85); }
    .corps ul, .corps ol { margin: 0 0 20px; padding-left: 24px; }
    .corps li { margin-bottom: 8px; }
    .corps a { color: var(--navy); }
    .retour { display: inline-block; font-size: 14px; color: rgba(52,80,122,.7);
      text-decoration: none; margin-bottom: 26px; }
    .retour:hover { color: var(--navy); }
    @media (max-width: 640px) { .article-carte { grid-template-columns: 1fr; } }
  </style>
</head>
<body>

<nav>
  <div class="nav-inner">
    <a class="nav-logo" href="/"><img src="/assets/Magnolia_bleu.svg" alt="Magnolia Signature"></a>
    <ul class="nav-links">
      <li><a href="/#manifeste">À propos</a></li>
      <li><a href="/#univers">Initiatives</a></li>
      <li><a href="/blogue/" class="active">Blogue</a></li>
      <li><a href="/#collectif">Rejoindre</a></li>
    </ul>
    <!-- Le sélecteur garde sa place pour que la barre ne saute pas d'une page
         à l'autre, mais EN est grisé : les trois pages du site ont une version
         anglaise, le blogue n'en a pas. La colonne `langue` existe en base
         pour le jour où on en voudra une. -->
    <div class="nav-controls">
      <div class="lang-toggle">
        <a href="#" id="btn-fr" class="active" onclick="return false;">FR</a>
        <span class="sep">|</span>
        <span id="btn-en" style="opacity:.35; cursor:default;" title="Version anglaise à venir">EN</span>
      </div>
    </div>
  </div>
</nav>

${corps}

<div class="remplissage" style="background: var(--cream);"></div>

<footer style="background: var(--navy); color: var(--cream); text-align:center; padding: 44px 24px;">
  <p style="opacity:.82; font-size: 14px; margin:0;">
    Magnolia Signature — Une révolution douce, humaine et puissante.
  </p>
</footer>

</body>
</html>`
}

export function dateFr(iso) {
  if (!iso) return ''
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
                'août', 'septembre', 'octobre', 'novembre', 'décembre']
  const d = new Date(iso)
  return `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export { SITE }
