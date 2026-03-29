# UEP REMA 2026

University class materials: **slides** (reveal.js + Vite) and **notebooks** (JupyterLab).

## Jupyter (use a venv)

Use a **project-local virtual environment** so dependencies stay isolated from your system Python.

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
jupyter lab
```

- **Windows:** `python -m venv .venv` then `.venv\Scripts\activate` before `pip install` and `jupyter lab`.
- **Cursor / VS Code:** With `.venv` created, the workspace prefers `${workspaceFolder}/.venv/bin/python`. On Windows, pick **Python: Select Interpreter** and choose `.venv\Scripts\python.exe` if needed.

Open the `notebooks/` folder in JupyterLab for coursework.

## Presentation (reveal.js + live reload)

Requires **Node.js 20.19+** (see `presentation/.nvmrc`).

```bash
cd presentation
npm install
npm run dev
```

Open [http://localhost:8000](http://localhost:8000). Vite reloads when you edit `index.html`, `src/main.js`, or assets.

**Speaker view:** press **S** (or the notes shortcut in the deck controls) after allowing the popup. Put slide scripts in `<aside class="notes">…</aside>` inside each `<section>`.

Build static files: `npm run build`. Run the Docker image locally:

```bash
docker build -t uep-rema-reveal presentation
docker run --rm -p 8080:80 uep-rema-reveal
```

Then open [http://localhost:8080](http://localhost:8080).

## GitHub Actions

Pushes to `main` that touch `presentation/` build a container image and can push to GHCR (see `.github/workflows/reveal-docker.yml` when present). Pull requests build only (no push). Image pushes use the repository `GITHUB_TOKEN`; students only need that for local Docker builds, not for pushing images.
