// Dépôt des images du blogue.
//
// Dans un seau dédié, pas dans « avatars » : celui-là mélange déjà photos de
// profil, de publications et de feedback de MagConnect, et y ajouter les images
// du site Magnolia rendrait tout ménage futur dangereux.
import { auteurAutorise } from './_commun.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Vercel découpe le corps des requêtes par défaut, ce qui abîme un fichier
// binaire. On le reçoit brut et on l'assemble nous-mêmes.
export const config = { api: { bodyParser: false } }

const TYPES = {
  'image/jpeg': 'jpg', 'image/png': 'png',
  'image/webp': 'webp', 'image/gif': 'gif',
}
const MAX = 8 * 1024 * 1024

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erreur: 'Méthode non permise' })

  const auteur = await auteurAutorise(req)
  if (!auteur) return res.status(401).json({ erreur: 'Connexion requise' })

  const type = (req.headers['content-type'] || '').split(';')[0].trim()
  const ext = TYPES[type]
  // On vérifie le type AVANT de lire le fichier : refuser après avoir tout
  // chargé en mémoire revient à laisser n'importe qui nous envoyer n'importe
  // quoi pour voir.
  if (!ext) return res.status(415).json({ erreur: 'Formats acceptés : JPEG, PNG, WebP, GIF.' })

  try {
    const morceaux = []
    let taille = 0
    for await (const m of req) {
      taille += m.length
      if (taille > MAX) return res.status(413).json({ erreur: 'Image trop lourde (8 Mo maximum).' })
      morceaux.push(m)
    }
    const fichier = Buffer.concat(morceaux)
    if (!fichier.length) return res.status(400).json({ erreur: 'Fichier vide.' })

    // Le nom est fabriqué ici, jamais repris de celui du fichier : un nom venu
    // du poste de quelqu'un peut contenir des « ../ » ou des caractères qui
    // cassent l'adresse.
    const chemin = `${new Date().getUTCFullYear()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/blogue/${chemin}`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': type,
        'Cache-Control': '31536000',
      },
      body: fichier,
    })
    if (!r.ok) throw new Error(`stockage ${r.status} : ${await r.text()}`)

    return res.status(201).json({
      url: `${SUPABASE_URL}/storage/v1/object/public/blogue/${chemin}`,
    })
  } catch (e) {
    console.error('[televerser]', e)
    return res.status(500).json({ erreur: "L'image n'a pas pu être déposée." })
  }
}
