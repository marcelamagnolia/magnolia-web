// Ce dont la page d'écriture a besoin pour ouvrir une session.
//
// La clé « anon » est publique par conception — elle finit toujours visible
// dans le navigateur. On la sert quand même d'ici plutôt que de l'écrire dans
// le HTML, pour une raison simple : le jour où elle change, il y a un seul
// endroit à corriger, et ce n'est pas un fichier du dépôt.
//
// Elle ne donne accès à rien : la table du blogue lui est fermée, et toute
// écriture passe par /api/articles qui vérifie qui appelle.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.status(200).json({
    url: process.env.SUPABASE_URL,
    cle: process.env.SUPABASE_ANON_KEY,
  })
}
