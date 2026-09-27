#!/bin/bash
# Azure App Service (Linux, Python) startup command. Set via:
#   az webapp config set --startup-file "startup.sh" ...
# gunicorn manages worker processes; the uvicorn worker class lets it run
# our async FastAPI app. --timeout is generous because /api/ingest can take
# a while when Ollama IS reachable (it never is on App Service itself -
# see PROGRESS.md gap 6 - so in practice this path is fast: every AI call
# fails over to the template brief almost immediately).
gunicorn --bind=0.0.0.0 --timeout 600 -k uvicorn.workers.UvicornWorker main:app
