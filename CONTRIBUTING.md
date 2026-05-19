# Getting started — Magnolia Signature website

## What you need

- **Git** — download at [git-scm.com](https://git-scm.com)
- **VS Code** — download at [code.visualstudio.com](https://code.visualstudio.com)

---

## First time setup

### 1. Accept the invitation
You will receive an email from GitHub. Click **Accept invitation**.

### 2. Clone the repo
Open a terminal and run:
```bash
git clone https://github.com/marcelamagnolia/magnolia-web.git
```
This downloads the project to your computer.

### 3. Open in VS Code
```bash
cd magnolia-web
code .
```

---

## Project structure

```
magnolia-web/
├── index.html          → magnoliasignature.org (main page)
├── style.css           → shared styles for all pages
├── assets/             → images and SVGs
├── magconnect/
│   └── index.html      → magnoliasignature.org/magconnect/
└── magself/
    └── index.html      → magnoliasignature.org/magself/
```

The site is plain HTML and CSS — no framework, no build step needed.

---

## Making changes

### 1. Before you start, get the latest version
```bash
git pull
```
Always do this before starting work to avoid conflicts.

### 2. Edit the files
Make your changes in VS Code.

### 3. Preview locally
Just open `index.html` directly in your browser (double-click the file). No server needed.

### 4. Push your changes
Once you're happy with the result:
```bash
git add .
git commit -m "short description of what you changed"
git push
```

The site will update automatically within ~30 seconds on [magnoliasignature.org](https://magnoliasignature.org).

---

## Tips

- The site supports **French and English**. Content uses `data-fr` and `data-en` attributes — always update both languages.
- Images go in the `assets/` folder.
- The shared `style.css` applies to all pages. Each page also has its own `<style>` block at the top for page-specific overrides.
- If you're not comfortable with the terminal, you can also edit files directly on [github.com/marcelamagnolia/magnolia-web](https://github.com/marcelamagnolia/magnolia-web) through the browser.
