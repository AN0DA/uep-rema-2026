# UEP REMA 2026

University class materials: **slides** (reveal.js + Vite) and **notebooks** (JupyterLab).

## Notebooks

| File | Description |
|---|---|
| `00-starter.ipynb` | Introduction and environment check |
| `data-prep-solutions.ipynb` | Data preparation — full solutions |
| `data-prep-assignements.ipynb` | Data preparation — student exercises and debugging tasks |

### Exercise convention

- `'___'` — fill in the missing value, column name, or argument
- `# EXERCISE` — the cell contains blanks to complete
- `# Fix` — correct the bug identified in the debugging exercise above it

### Notebook structure

**Data Preparation** (`data-prep-*`)
- Tasks 1–5: Parse GML → flat DataFrame
- Task 6: Missing value audit (`msno`)
- Task 7: Column type configuration and casting
- Task 8: Decode `funkcjaLokalu` category labels
- Task 9: Outlier detection and flagging
- Tasks 10–13: Imputation — median, PMM, stochastic regression, comparison
- Task 15: Final inspection and export
- **Debugging exercises** (5 bugs) embedded after the task they relate to

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

Open the `notebooks/` folder in JupyterLab for coursework. Start with `data-prep-assignements.ipynb`; refer to `data-prep-solutions.ipynb` only after attempting the exercises.

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
