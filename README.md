# DeepLearn Lab

An interactive, browser-based deep-learning course for readers who already know classical
machine learning. Seven modules, **40 lessons**, **64 hands-on labs** and **7 module exams**
(390 quiz/exam questions in total) run entirely in the browser.

Nothing is fetched at runtime: no server, no build step, no package install, no CDN, no tracking
and no account. Point a browser at `index.html` and it works — including from a `file://` path.
The only third-party asset is KaTeX 0.16.11 (MIT), vendored under `assets/vendor/katex/` with
its WOFF2 fonts.

---

## What you get

### Modules

| # | Module | Folder | Lessons | Topics |
|---|---|---|---:|---|
| 0 | Foundations | `modules/m0-foundations` | 5 | Perceptron → MLP, losses, backprop, gradient descent, optimizers, initialization, PyTorch workflow |
| 1 | CNNs | `modules/m1-cnns` | 8 | Convolutions, filters, pooling, LeNet/AlexNet/VGG/ResNet, training, augmentation, detection, transfer learning, Grad-CAM |
| 2 | Sequences & NLP | `modules/m2-sequences` | 7 | RNNs, BPTT, vanishing gradients, LSTM/GRU, tokenization, embeddings, attention, transformers |
| 3 | GANs | `modules/m3-gans` | 4 | Minimax game, training stability, DCGAN, conditional GANs, WGAN-GP, CycleGAN, StarGAN |
| 4 | Autoencoders & pretrained | `modules/m4-autoencoders` | 5 | Autoencoders, VAEs, BERT, GPT decoding, Hugging Face, LoRA, model-selection decisions |
| 5 | Segmentation & Kaggle | `modules/m5-segmentation` | 4 | Semantic/instance segmentation, FCN, upsampling, U-Net, Dice/IoU, Mask R-CNN, competition playbook |
| 6 | Advanced toolkit | `modules/m6-toolkit` | 7 | Reproducibility, AMP/DDP memory budgeting, saliency, quantization, debugging, math cheat sheets, glossary, interview questions |

### Lesson structure

Every lesson follows the same order:

1. Learning objectives and a short bridge from what you already know
2. Intuition, then the mathematics with a worked numeric example for each formula
3. One or more interactive labs
4. Runnable code, common mistakes and a "Debug this" exercise
5. An eight-question quiz with per-option explanations
6. Three-line summary, printable cheat sheet, further reading and prev/next navigation

Each module ends with a ten-question exam on its module index page.

### Labs

Every lab carries one of two badges:

- **Exact math** — numbers are computed in your browser from the inputs you can see and change.
- **Illustrative** — a stored or simulated trace used to show a concept that cannot be simulated
  faithfully in a browser; the badge says so explicitly.

Visuals are drawn procedurally on `<canvas>` or with SVG and CSS. Datasets are synthetic and
generated locally. No benchmark numbers, citations or URLs are invented: further-reading entries
are paper titles, first authors and years only.

### Interface

- Light and dark themes (system preference by default, toggle in the header, `?theme=light` or
  `?theme=dark` override for testing)
- Responsive from 360 px to 1440 px with no horizontal overflow
- Full keyboard operation: visible focus, real buttons/inputs/selects, labelled controls, skip link
- `prefers-reduced-motion` support and a print stylesheet (labs are mounted before printing, and
  cheat sheets print as cards)
- Search across all pages, a glossary, and progress saved in `localStorage` under the `dll:` prefix

---

## Open it locally

Double-click `index.html`, or drag it into Chrome, Edge or Firefox. A `file:///…` URL is the
supported mode; every stylesheet, script, font and data file is relative and vendored.

An optional local server behaves identically:

```sh
python -m http.server 8000
# then open http://localhost:8000
```

Node and Python are **not** required to use the site. They are only needed for the optional
development tools described below.

---

## Deploy to GitHub Pages

The site is plain static content, so no build configuration is needed. Push this repository to
GitHub and choose one of the two deployment methods below.

The published URL will be:

```
https://<username>.github.io/<repository>/
```

All internal links are relative, so the site works at the domain root or in a subpath without any
base-URL changes. A `.nojekyll` file at the repository root disables Jekyll processing; keep it
there so every file is served exactly as committed.

### Option A — GitHub Actions (recommended)

1. In the repository, go to **Settings → Pages → Build and deployment**.
2. Set **Source** to **GitHub Actions**.
3. Push to `main` (or `master`). The included workflow at
   `.github/workflows/deploy-pages.yml` checks out the repository, uploads the whole site as a
   Pages artifact and deploys it.
4. The **Actions** tab shows each deployment, and the Pages URL appears under **Environments →
   github-pages**.

You can also trigger the workflow manually from **Actions → Deploy to GitHub Pages → Run workflow**.
The workflow needs no secrets and uses only official GitHub actions.

### Option B — Deploy from a branch (no Actions)

1. In **Settings → Pages → Build and deployment**, set **Source** to **Deploy from a branch**.
2. Choose `main` (or `master`) and the `/(root)` folder, then save.
3. Every push to that branch republishes the site. The Actions workflow remains in the repository
   but is not used unless you switch the source back to GitHub Actions.

### Custom domain

Add a `CNAME` file at the repository root containing your domain (for example
`learn.example.com`), configure the DNS records for that domain, and enable **Enforce HTTPS** in
the Pages settings. The `CNAME` file is included in the Actions artifact as well.

### Deployment checklist / troubleshooting

- Commit the whole `assets/` directory, including `assets/vendor/katex/fonts/*.woff2`. Paths are
  case-sensitive on GitHub's Linux runners.
- Commit `assets/js/search-index.js`. Without it the search overlay is empty.
- If a page renders unstyled, check the browser console for a 404 on a CSS/JS file; the script and
  stylesheet order is fixed and must be preserved.
- If you see a directory listing or missing font files, confirm `.nojekyll` is present at the root.
- After adding a lesson, regenerate the search index (see below) and push the updated file.

---

## Repository layout

```
.github/workflows/deploy-pages.yml   Pages deployment workflow (optional)
.nojekyll                            disables Jekyll processing on GitHub Pages
.gitignore                           excludes internal authoring material and local cruft
index.html                           landing page: roadmap, module rings, progress
modules/
  mN-…/
    index.html                       module overview and 10-question exam
    mN-LL-slug.html                  lesson
    widgets/mN-widgets.js            all labs for that module
assets/
  css/                               tokens, base, components, print
  js/                                core, store, progress, tensor, nn, viz, ui, quiz,
                                     widgets, lesson, landing, search-index
  data/glossary.js                   glossary terms
  vendor/katex/                      vendored KaTeX and its fonts
tools/                               optional dev-time scripts; never loaded by the site
README.md                            this file
```

Internal authoring notes, plans and agent definitions are intentionally excluded by
`.gitignore` and are not part of the published repository.

---

## Architecture

- **No frameworks or ES modules.** Scripts use classic `<script defer>` tags, a single global
  namespace `DL`, and relative paths. There is no `fetch()`, no bundler and no runtime network
  access.
- **Page shell.** `assets/js/lesson.js` builds the table of contents, search overlay, glossary,
  quiz mount points and theme/printing behaviour. `assets/js/core.js` provides shared helpers,
  `DL.MODULES` metadata and the time-sliced trainer.
- **Depth-safe links.** Lesson pages declare `data-root="../../"` on `<body>`; `DL.root()` resolves
  asset and navigation links from it.
- **Widgets.** Each module registers its lab ids with `DL.widgets.register(id, fn)`. Labs mount
  lazily via `IntersectionObserver`, animations use `requestAnimationFrame`, and training loops
  are time-sliced to roughly 12 ms per frame with Pause / Reset / Speed controls.
- **Math.** KaTeX is loaded locally; formulas are authored inline as `\(…\)` and `\[…\]`.
- **Persistence.** Quiz scores and reading progress use `DL.store` on top of `localStorage` under
  `dll:`. Nothing leaves the browser.

---

## Optional development tools

Install Node 20+ and Python 3.10+ only if you want to validate or extend the site.

```sh
node tools/test.js                 # numeric tests: tensors, layers, gradients, XOR (67 tests)
python tools/params.py resnet18    # parameter/shape tables used in the prose
node tools/build-search.js         # regenerate assets/js/search-index.js from every page
node tools/smoke.js                # static checks: ids, links, scripts, quizzes, badges
node tools/shot.js <page> <out.png> --width=360 --theme=dark
                                   # screenshot with overflow and console reporting
node tools/shot.js <page> <out.png> --print
                                   # print-media screenshot
node tools/qa.js --widths=360,768,1440 --themes=light,dark
                                   # full-site screenshot sweep
```

`tools/shot.js` drives an installed Chrome or Edge over the DevTools protocol with no npm
dependencies. It exits non-zero on console errors, so it can be used in a loop. `tools/qa.js`
forcibly mounts every lab before capture and reports overflow, console errors and failures.

`tools/coverage.js --write` compares the lesson plan with the files on disk; the plan itself is
part of the internal authoring notes and is not published, so this tool is only useful in the
authoring environment.

### Adding or editing a lesson

1. Copy the structure of `modules/m0-foundations/m0-01-perceptron-to-mlp.html`, including its
   inline theme boot script and its deferred script order.
2. Give the page a unique `data-lesson` id and keep all links relative through `DL.root()`.
3. Register each new lab id in the module's `widgets/mN-widgets.js`. **Never rename an existing
   id** — progress keys and cross-page references depend on it.
4. Provide eight quiz questions: four options each, a `correct` index into those options, and one
   `why` explanation per option with exactly one marked `Correct:`.
5. Run `node tools/build-search.js`, then `node tools/smoke.js`, then a screenshot sweep at 360,
   768 and 1440 px in both themes before pushing.

---

## Accessibility and privacy

All controls are native, labelled and keyboard-operable; nothing depends on hover alone. Motion is
kept subtle and respects `prefers-reduced-motion`. Colour contrast and layout are checked in both
themes. There are no cookies, analytics, trackers or network requests; state stays in your
browser's `localStorage` and can be cleared through normal browser settings.

---

## Licence and provenance

Prose, code and diagrams are original to this project. All datasets are synthetic and generated
in the browser or in lesson scripts; no copyrighted images or datasets are bundled. Further
reading lists paper titles, first authors and years only. KaTeX 0.16.11 is distributed under the
MIT licence; its licence and files are in `assets/vendor/katex/`.
