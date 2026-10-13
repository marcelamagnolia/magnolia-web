// L'API d'écriture du blogue. Tout passe par ici : la page d'administration ne
// parle jamais à Supabase directement.
//
// Pourquoi : la clé « anon » est publique — elle est livrée dans le JavaScript
// de n'importe quelle page. Si le navigateur écrivait en base avec elle,
// n'importe qui pourrait publier. Ici, la clé de service reste sur le serveur
// et chaque appel est vérifié : qui es-tu, et as-tu le droit d'écrire.
import { supabase, auteurAutorise } from './_commun.js'

export default async function handler(req, res) {
  const auteur = await auteurAutorise(req)
  if (!auteur) return res.status(401).json({ erreur: 'Connexion requise' })

  const id = (req.query?.id || '').trim()

  try {
    if (req.method === 'GET') {
      // La liste de l'administration montre TOUT, brouillons compris : c'est
      // le seul endroit où on peut les voir.
      const champs = 'id,slug,titre,resume,categorie,auteur_nom,statut,publie_le,updated_at'
      const r = id
        ? await supabase(`blog_articles?id=eq.${id}&select=*&limit=1`)
        : await supabase(`blog_articles?select=${champs}&order=updated_at.desc`)
      return res.status(200).json(id ? (r[0] || null) : r)
    }

    if (req.method === 'POST') {
      const c = req.body || {}
      if (!c.titre?.trim()) return res.status(400).json({ erreur: 'Il faut un titre.' })
      const ligne = {
        titre: c.titre.trim(),
        slug: await slugLibre(c.slug || c.titre),
        resume: c.resume?.trim() || null,
        corps_md: c.corps_md || '',
        categorie: c.categorie?.trim() || null,
        image_url: c.image_url || null,
        // Le nom vient du compte, pas du formulaire : on ne signe pas d'un nom
        // qu'on a tapé soi-même.
        auteur_nom: auteur.nom,
        auteur_id: auteur.id,
        statut: 'BROUILLON',
      }
      const [cree] = await supabase('blog_articles', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(ligne),
      })
      return res.status(201).json(cree)
    }

    if (req.method === 'PATCH') {
      if (!id) return res.status(400).json({ erreur: 'Quel article ?' })
      const c = req.body || {}
      const maj = { updated_at: new Date().toISOString() }
      for (const champ of ['titre', 'resume', 'corps_md', 'categorie', 'image_url']) {
        if (champ in c) maj[champ] = c[champ] === '' ? null : c[champ]
      }
      if (c.slug) maj.slug = await slugLibre(c.slug, id)

      if (c.statut === 'PUBLIE') {
        maj.statut = 'PUBLIE'
        // La date de publication se pose une seule fois. Sans ce garde-fou,
        // repasser un article en ligne après une correction le ferait remonter
        // en tête de liste comme s'il était nouveau.
        const [actuel] = await supabase(`blog_articles?id=eq.${id}&select=publie_le&limit=1`)
        if (!actuel?.publie_le) maj.publie_le = new Date().toISOString()
      } else if (c.statut === 'BROUILLON') {
        maj.statut = 'BROUILLON'
      }

      const [modifie] = await supabase(`blog_articles?id=eq.${id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(maj),
      })
      return res.status(200).json(modifie)
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ erreur: 'Quel article ?' })
      await supabase(`blog_articles?id=eq.${id}`, { method: 'DELETE' })
      return res.status(204).end()
    }

    return res.status(405).json({ erreur: 'Méthode non permise' })
  } catch (e) {
    console.error('[articles]', e)
    return res.status(500).json({ erreur: 'Quelque chose a échoué de notre côté.' })
  }
}

// ── L'adresse de l'article ─────────────────────────────────────────────────
//
// Fabriquée à partir du titre : « Reconnaître un bon bois de grange » devient
// « reconnaitre-un-bon-bois-de-grange ». Les accents sont retirés plutôt que
// laissés tels quels — ils fonctionnent dans une adresse, mais se transforment
// en charabia dès qu'on la copie dans un courriel ou un message.
function slugifier(texte) {
  return String(texte)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'article'
}

// Deux articles ne peuvent pas partager une adresse : la colonne est unique, et
// sans ce contrôle la deuxième publication échouerait avec une erreur de base
// incompréhensible pour la personne qui écrit.
async function slugLibre(source, idExistant = null) {
  const base = slugifier(source)
  for (let n = 0; n < 50; n++) {
    const essai = n === 0 ? base : `${base}-${n + 1}`
    const pris = await supabase(
      `blog_articles?slug=eq.${encodeURIComponent(essai)}&select=id&limit=1`)
    if (!pris.length || (idExistant && pris[0].id === idExistant)) return essai
  }
  return `${base}-${Date.now()}`
}
