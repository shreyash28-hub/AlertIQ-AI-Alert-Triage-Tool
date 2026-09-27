# Deploying AlertIQ to Azure

Frontend on Azure Static Web Apps, backend on Azure App Service, database on
Supabase (already set up). Free tiers throughout.

## Live deployment

- **Frontend:** https://lively-tree-0dbe3e300.2.azurestaticapps.net
- **Backend:** https://alertiq-api-shubham29.azurewebsites.net (`/docs` for the interactive API page)
- Resource group `alertiq-rg`, subscription "Azure for Students". Both resources
  ended up in Asia-Pacific regions (`centralindia` for the App Service plan,
  `eastasia` for the Static Web App) - see the region note below.

## 0. One-time account setup (you, not Claude)

1. Create an Azure account: **azure.microsoft.com/free/students** (no card
   needed if you're eligible) or the regular free tier otherwise.
2. Once created, tell Claude — it will run `az login --use-device-code`,
   which prints a URL and a short code. Open the URL yourself and enter the
   code there to sign in. Claude never sees or handles your Azure password.

## Region note

A restricted/student subscription can only create resources in a specific
allow-listed set of regions, which isn't documented anywhere - `eastus`
(App Service) and `eastus2`/`centralus` (Static Web Apps) were all rejected
with `RequestDisallowedByAzure` on this account. `centralindia` and
`eastasia` worked. If a region is rejected, just try another one from the
service's supported list (`az account list-locations` for App Service;
Static Web Apps only supports a handful: `centralus`, `eastus2`, `westus2`,
`westeurope`, `eastasia`).

## 1. Backend — Azure App Service

```bash
az group create --name alertiq-rg --location centralindia

az appservice plan create --name alertiq-plan --resource-group alertiq-rg \
  --sku F1 --is-linux --location centralindia

az webapp create --name <unique-app-name> --resource-group alertiq-rg \
  --plan alertiq-plan --runtime "PYTHON:3.12"

az webapp config set --name <unique-app-name> --resource-group alertiq-rg \
  --startup-file "startup.sh"

az webapp config appsettings set --name <unique-app-name> --resource-group alertiq-rg \
  --settings \
    SUPABASE_URL="https://<project>.supabase.co" \
    SUPABASE_SERVICE_ROLE_KEY="<service role key>" \
    OLLAMA_URL="http://localhost:11434" \
    OLLAMA_MODEL="phi4-mini" \
    SCM_DO_BUILD_DURING_DEPLOYMENT=true

# zip just the backend/ folder's contents (not the whole repo) and deploy -
# Git Bash on Windows has no `zip`; Python's zipfile works everywhere:
cd backend && python -c "
import zipfile, os
exclude_dirs = {'venv', '__pycache__', 'tests', '.pytest_cache'}
exclude = {'.env', os.path.join('data','alerts.json'), os.path.join('data','assets.csv')}
with zipfile.ZipFile('../backend.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for f in files:
            rel = os.path.relpath(os.path.join(root, f), '.')
            if rel not in exclude and not f.endswith('.pyc'):
                z.write(os.path.join(root, f), rel)
"
cd .. && az webapp deploy --name <unique-app-name> --resource-group alertiq-rg \
  --src-path backend.zip --type zip
```

**Note (see PROGRESS.md gap 6):** App Service can't reach Ollama running on
your laptop, so `OLLAMA_URL` above points nowhere reachable on purpose —
every AI call fails over to the template brief almost instantly (confirmed
live: a deployed `/api/ingest` finished in under a second). Briefs you
already generated locally and saved to Supabase still show up correctly;
only *new* AI-written briefs need the backend running on your own machine.

## 2. Frontend — Azure Static Web Apps

Vite bakes `VITE_*` env vars in at **build time**, so set them before
building, then deploy the pre-built `dist/` folder directly (no GitHub
Actions wiring needed for this).

**`staticwebapp.config.json` must live in `frontend/public/`**, not the
frontend root — Vite only copies files from `public/` into `dist/`, and
without this file's SPA navigation-fallback rule, a direct load or refresh
of any client-routed page (e.g. `/app/incidents/INC-0001`) 404s.

```bash
az staticwebapp create --name <unique-site-name> --resource-group alertiq-rg \
  --location eastasia --sku Free

cd frontend
VITE_SUPABASE_URL="https://<project>.supabase.co" \
VITE_SUPABASE_ANON_KEY="<anon key>" \
VITE_API_URL="https://<unique-app-name>.azurewebsites.net" \
npm run build

swa deploy ./dist --deployment-token "$(az staticwebapp secrets list \
  --name <unique-site-name> --resource-group alertiq-rg \
  --query properties.apiKey -o tsv)" --env production
```

## 3. Verify

- Backend: `https://<unique-app-name>.azurewebsites.net/docs`
- Frontend: the URL `az staticwebapp create` printed (or
  `az staticwebapp show --name <unique-site-name> --resource-group alertiq-rg
  --query defaultHostname -o tsv`)
- Sign up, log in, click **Run triage**, confirm incidents load.

(All of the above was actually run and verified against the live URLs at
the top of this file: signed up a real test account through the deployed
site, confirmed a direct `/signup` page load works, logged in, and saw the
Dashboard load live data from the deployed backend + Supabase. Test account
deleted afterward.)

## Redeploying after a code change

Backend: re-zip and re-run the `az webapp deploy` command above.
Frontend: re-run `npm run build` then the `swa deploy` command above.

## Cost

Both resources are on free tiers (App Service F1, Static Web Apps Free) -
no charge, no Azure credit consumed by hosting itself.
