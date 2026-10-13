/**
 * Le convertisseur markdown du blogue.
 *
 * Deux choses à défendre, et la seconde compte davantage : que le markdown
 * rende ce qu'on attend, et qu'une entrée hostile ne devienne jamais du code
 * exécutable chez le lecteur.
 *
 * Le contrôle de sécurité regarde les balises RÉELLEMENT produites, pas le
 * texte. Un premier essai cherchait « onerror » dans la sortie et criait au
 * danger en trouvant « &lt;img onerror… » — qui est du texte affiché, pas une
 * balise. Chercher une chaîne ne distingue pas les deux ; compter les balises
 * si.
 *
 *   node tests/markdown.test.mjs
 */
import { markdown } from '../api/_commun.js'

const RENDUS = [
  ['titre',        '## Un sous-titre',           '<h3>Un sous-titre</h3>'],
  ['gras',         'du **gras** ici',            '<strong>gras</strong>'],
  ['italique',     'du *penché* ici',            '<em>penché</em>'],
  ['lien',         '[voir](https://exemple.ca)', '<a href="https://exemple.ca">voir</a>'],
  ['lien interne', '[là](/blogue/)',             '<a href="/blogue/">là</a>'],
  ['image',        '![chat](/a.jpg)',            '<img src="/a.jpg"'],
  ['puces',        '- un\n- deux',               '<ul>'],
  ['numéros',      '1. un\n2. deux',             '<ol>'],
  ['citation',     '> ceci',                     '<blockquote>ceci</blockquote>'],
  ['paragraphe',   'une ligne\net la suite',     '<p>une ligne et la suite</p>'],
]

// Tout ce que le convertisseur a le droit de produire. Le reste est suspect
// par définition : si une balise sort d'ici sans être dans cette liste, c'est
// qu'elle vient du texte de quelqu'un.
const PERMISES = new Set([
  'h2','h3','h4','h5','p','ul','ol','li','strong','em','code','blockquote','a','img',
  '/h2','/h3','/h4','/h5','/p','/ul','/ol','/li','/strong','/em','/code','/blockquote','/a',
])

const HOSTILES = [
  ['balise script',    '<script>alert(1)</script>'],
  ['image onerror',    '<img src=x onerror="alert(1)">'],
  ['lien javascript',  '[clique](javascript:alert(1))'],
  ['image javascript', '![x](javascript:alert(1))'],
  ['html brut',        "<div onclick='alert(1)'>texte</div>"],
  ['iframe',           '<iframe src="https://mauvais.test"></iframe>'],
  ['lien data:',       '[x](data:text/html,<script>alert(1)</script>)'],
  ['guillemet évadé',  '[x](https://bon.ca" onmouseover="alert(1))'],
]

function inspecter(html) {
  const balises = [...html.matchAll(/<\/?([a-zA-Z0-9]+)/g)]
    .map(m => (html[m.index + 1] === '/' ? '/' : '') + m[1].toLowerCase())
  return {
    inconnues: balises.filter(b => !PERMISES.has(b)),
    attributs: [...html.matchAll(/<[a-z]+\s[^>]*?\b(on\w+|javascript:)/gi)].map(m => m[1]),
  }
}

let ok = 0, total = 0
for (const [nom, entree, attendu] of RENDUS) {
  total++
  const bon = markdown(entree).includes(attendu)
  console.log(`  ${bon ? '✓' : '✗'} ${nom}`)
  if (bon) ok++
}
for (const [nom, entree] of HOSTILES) {
  total++
  const { inconnues, attributs } = inspecter(markdown(entree))
  const bon = !inconnues.length && !attributs.length
  console.log(`  ${bon ? '✓' : '✗'} hostile : ${nom}`)
  if (bon) ok++
}
console.log(`\n  ${ok}/${total} passent`)
process.exit(ok === total ? 0 : 1)
