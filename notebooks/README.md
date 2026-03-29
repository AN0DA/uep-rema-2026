# Notebooks

Put course Jupyter notebooks here.

## Use a venv (required)

Do **not** install course packages into your system Python. Always create and activate a virtual environment at the **repository root** first:

```bash
cd ..   # repo root
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
jupyter lab
```

**Windows:** use `.venv\Scripts\activate` instead of `source .venv/bin/activate`.

Then open this folder in JupyterLab.
