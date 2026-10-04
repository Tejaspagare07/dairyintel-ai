# Deployment Guide — DairyIntel AI

Three services + one database. Deploy in this order.

## 0) Before you deploy
- Rotate secrets: reset the MongoDB Atlas DB-user password, generate a fresh
  JWT secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- In Atlas → Network Access, allow your host IPs (or 0.0.0.0/0 if unsure).

## 1) ML service (Python / FastAPI) → Render
- New Web Service, root = `ml-service/`
- Build: `pip install -r requirements.txt && python train.py`
  (training takes 2-3 minutes and creates the model file for the server's scikit-learn version)
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Check: `GET <ML URL>/` should say `"modelLoaded": true`
- Copy the resulting URL (e.g. https://dairyintel-ml.onrender.com)

## 2) Backend (Node / Express) → Render
- New Web Service, root = `backend/`
- Build: `npm install`
- Start: `npm start`
- Environment variables:
  - `MONGO_URI` = your Atlas string
  - `JWT_SECRET` = the fresh secret
  - `ML_SERVICE_URL` = the ML URL from step 1
  - `NODE_ENV` = production
  - `FRONTEND_URL` = (fill in after step 3; comma-separate if you have several domains)
  - OTP email (required in production, otherwise codes can't be delivered):
    - Gmail: `EMAIL_USER` + `EMAIL_PASS` (a 16-character App Password), or
    - SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
  - Optional: `REQUIRE_ADMIN_APPROVAL=true` so new farmers need admin approval
  - Optional for a demo server with no email: `ALLOW_DEV_OTP=true` (shows the code on screen; never use this for real users)
- Copy the backend URL (e.g. https://dairyintel-api.onrender.com)

## 3) Frontend (React / Vite) → Vercel
- Import the repo, root = `frontend/`
- Build: `npm run build`, Output: `dist`
- Environment variable:
  - `VITE_API_URL` = `<backend URL>/api`  (e.g. https://dairyintel-api.onrender.com/api)
- `vercel.json` (and `public/_redirects` for Netlify) sends all routes to `index.html`, so deep links like `/milk-check` work
- Replace `YOUR-DOMAIN` in `public/robots.txt` and `public/sitemap.xml` with your real domain
- Deploy, copy the URL, then go back to the backend and set `FRONTEND_URL` to it,
  and redeploy the backend so CORS allows the frontend.

## 4) Seed the database (once)
From your machine with the production `MONGO_URI` in `backend/.env`:
```
cd backend
node seed.js      # the ML service must be reachable (ML_SERVICE_URL) to add the demo milk checks
```

## 5) Verify
- Visit the frontend URL
- Log in as admin@dairyintel.ai / Admin@123. A code arrives by email; check the backend logs if email isn't configured yet
- Run a Milk check and use "Try an example → Mastitis pattern". You should get a High Risk result, which confirms Node can reach Python
- Change the seeded admin password after first login.
