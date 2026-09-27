# Deploying AlertIQ to Azure

Frontend on Azure Static Web Apps, backend on Azure App Service, database on
Supabase (already set up). Free tiers throughout.

## 0. One-time account setup (you, not Claude)

1. Create an Azure account: **azure.microsoft.com/free/students** (no card
   needed if you're eligible) or the regular free tier otherwise.
2. Once created, tell Claude — it will run `az login`, which opens a browser
   for you to sign in. Claude never sees or handles your Azure credentials.

## 1. Backend — Azure App Service

```bash
az group create --name alertiq-rg --location eastus

az appservice plan create --name alertiq-plan --resource-group alertiq-rg \
  --sku F1 --is-linux

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

# zip and deploy just the backend/ folder
cd backend && zip -r ../backend.zip . -x "venv/*" "__pycache__/*" "*.pyc" ".env"
cd .. && az webapp deploy --name <unique-app-name> --resource-group alertiq-rg \
  --src-path backend.zip --type zip
```

**Note (see PROGRESS.md gap 6):** App Service can't reach Ollama running on
your laptop, so `OLLAMA_URL` above points nowhere reachable on purpose —
every AI call fails over to the template brief almost instantly. Briefs you
already generated locally and saved to Supabase still show up correctly;
only *new* AI-written briefs need the backend running on your own machine.

## 2. Frontend — Azure Static Web Apps

Vite bakes `VITE_*` env vars in at **build time**, so set them before
building, then deploy the pre-built `dist/` folder directly (no GitHub
Actions wiring needed for this):

```bash
az staticwebapp create --name <unique-site-name> --resource-group alertiq-rg \
  --location eastus2 --sku Free

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

## Redeploying after a code change

Backend: re-zip and re-run the `az webapp deploy` command above.
Frontend: re-run `npm run build` then the `swa deploy` command above.
