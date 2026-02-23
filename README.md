# vinted-brut-notifier

Polls Vinted every 5 minutes for new listings matching Brut Archives / Brut Paris / Brut Clothing and sends an email notification when something new drops.

> **Run this locally, not on a cloud host.** Vinted's bot protection (Cloudflare/Datadome) blocks requests from datacenter IPs (Railway, Render, Fly.io, etc.). A home IP works fine.

## Setup

```bash
npm install
cp .env.example .env
# Fill in your Gmail credentials in .env
```

## Gmail App Password

You need a Gmail **App Password** (not your regular password):

1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Select "Mail" + "Mac" (or any device)
3. Copy the 16-character password into `.env`

## Configuration

| Variable | Default | Description |
|---|---|---|
| `GMAIL_USER` | — | Your Gmail address |
| `GMAIL_APP_PASSWORD` | — | 16-char Gmail App Password |
| `NOTIFY_EMAIL` | — | Where to send alerts (can be same as above) |
| `POLL_INTERVAL_MINUTES` | `5` | How often to poll Vinted |
| `POLL_PAGES` | `2` | Pages per query (96 items/page) |

## Running 24/7 locally with pm2

```bash
npm install -g pm2
pm2 start index.js --name vinted-notifier
pm2 save
pm2 startup   # follow the printed command to auto-start on reboot
```

Useful commands:

```bash
pm2 logs vinted-notifier     # live logs
pm2 status                   # check running status
pm2 restart vinted-notifier  # restart
pm2 stop vinted-notifier     # stop
```

## Project structure

```
src/
  config.js         # search queries, filter logic, env vars
  email.js          # nodemailer (Gmail SMTP port 587)
  poller.js         # poll loop, cron schedule, seen.json deduplication
  scrapers/
    vinted.js       # Vinted API client (cookie auth, pagination)
seen.json           # auto-generated, tracks already-seen item IDs
```
