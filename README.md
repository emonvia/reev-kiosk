# Reev Kiosk

Full-screen EV charging station monitoring kiosk, powered by the [Reev Partner API](https://docs.reev.com/). Designed for iPads and touch-screen displays at parking sites.

Built with **Next.js 16** and **Tailwind CSS**. No database required — the Reev API is the data layer.

---

## Run Locally

```bash
# 1. Clone the repo
git clone <repo-url>
cd reev-dashboard

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your Reev API credentials

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the kiosk.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `REEV_API_URL` | Yes | — | Reev Partner API base URL (e.g. `https://api.reev.com`) |
| `REEV_AUTH_URL` | Yes | — | Reev Keycloak token endpoint for OAuth2 client credentials flow |
| `REEV_CLIENT_ID` | Yes | — | OAuth2 client ID |
| `REEV_CLIENT_SECRET` | Yes | — | OAuth2 client secret |
| `REEV_API_VERSION` | No | `2024-08-01` | API version header |
| `GRID_PIN` | No | — | 4-8 digit PIN to lock the kiosk (omit for open access) |
| `KIOSK_LOCALE` | No | `en` | Kiosk display language |

---

## License

MIT
