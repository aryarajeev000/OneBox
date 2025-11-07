# 📧 OneBox Email Aggregator

A **real-time email aggregation backend** built with **Node.js**, **TypeScript**, and **Elasticsearch** — inspired by **ReachInbox**.
It connects multiple IMAP accounts, syncs emails in real-time (no cron jobs), indexes them for search, categorizes them using AI, and triggers Slack/webhook notifications.

---

## 🚀 Features

* 🔄 **Real-Time IMAP Sync** — Persistent connections using `imapflow` and IDLE mode.
* 🧠 **AI Categorization** — Uses OpenAI + rule-based heuristics to tag emails as Interested, Spam, etc.
* 🔍 **Search** — Powered by Elasticsearch for fast email lookup.
* ⚡ **Slack & Webhook Automation** — Triggers external notifications for important emails.
* 💾 **Dockerized Setup** — Runs Elasticsearch and Kibana locally.
* 🔧 **Fully Typed Backend** — TypeScript + Modular Service Architecture.

---

## 🏗️ Project Structure

```
Backend/
│
├── src/
│   ├── index.ts                # Entry point
│   ├── Email.ts                # Email types & interfaces
│   ├── ImapService.ts          # IMAP connection & sync logic
│   ├── ElasticsearchService.ts # Indexing & search
│   ├── AIService.ts            # Email categorization (AI + rules)
│   ├── AutomationService.ts    # Slack & webhook notifications
│   └── ...
│
├── docker-compose.yml          # Elasticsearch + Kibana setup
├── tsconfig.json               # TypeScript configuration
├── package.json
└── README.md
```

---

## 🧩 Prerequisites

* Node.js **v18+**
* Docker Desktop (for Elasticsearch & Kibana)
* OpenAI API key
* (Optional) Slack Webhook & webhook.site URL

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
PORT=4000
ELASTIC_URL=http://localhost:9200
ES_INDEX=emails

# OpenAI API key for categorization
OPENAI_API_KEY=sk-your-key-here

# Slack & Webhook URLs
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXXX/YYYY/ZZZZ
EXTERNAL_WEBHOOK_URL=https://webhook.site/your-id

# IMAP Accounts (minimum 2)
IMAP_1_HOST=imap.gmail.com
IMAP_1_PORT=993
IMAP_1_SECURE=true
IMAP_1_USER=yourfirst@gmail.com
IMAP_1_PASS=app-password-1

IMAP_2_HOST=imap.mail.yahoo.com
IMAP_2_PORT=993
IMAP_2_SECURE=true
IMAP_2_USER=yoursecond@yahoo.com
IMAP_2_PASS=app-password-2
```

> 💡 **Tip:** For Gmail, enable “App Passwords” under Google Account → Security.

---

## 🐳 Docker Setup

Start Elasticsearch (and optionally Kibana):

```bash
docker compose up -d
```

Check container status:

```bash
docker ps
```

Access:

* Elasticsearch → [http://localhost:9200](http://localhost:9200)
* Kibana → [http://localhost:5601](http://localhost:5601)

---

## 🧰 Local Development

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm run dev
```

Expected logs:

```
[Elasticsearch] Connection successful
[Index] 'emails' created or already exists
[IMAP] Connected to all accounts
[Server] Listening on http://localhost:4000
```

---

## 🧪 API Endpoints (Postman Testing)

| Method | Endpoint                   | Description                           |
| ------ | -------------------------- | ------------------------------------- |
| `GET`  | `/health`                  | Server status check                   |
| `GET`  | `/emails/search?q=meeting` | Search emails by keyword              |
| `POST` | `/emails/categorize`       | Categorize email via AI               |
| `POST` | `/emails/validate`         | Validate email structure              |
| `POST` | `/emails/test/index`       | (Dev only) Insert test email manually |

Example request:

```bash
curl -X POST http://localhost:4000/emails/categorize \
  -H "Content-Type: application/json" \
  -d '{"subject":"Schedule a call tomorrow","text":"Hey Rajeev, I’m interested."}'
```

Response:

```json
{ "success": true, "label": ["Interested"] }
```

---

## 📬 Slack & Webhook Triggers

* Every **Interested** email automatically triggers:

  * Slack notification → via `SLACK_WEBHOOK_URL`
  * External webhook → via `EXTERNAL_WEBHOOK_URL`

---

## 🧠 AI Categorization Logic

* **Rule-based** fast checks:

  * “Out of Office”, “Spam”, “Meeting Booked”, etc.
* **OpenAI fallback** (if no rules match):

  * Uses `gpt-4o-mini` with one of the labels:

    * Interested, Meeting Booked, Not Interested, Spam, Out of Office

---

## 🧾 Docker Compose Example

```yaml
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.14.3
    container_name: elasticsearch
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - ES_JAVA_OPTS=-Xms1g -Xmx1g
    ports:
      - "9200:9200"
    volumes:
      - esdata:/usr/share/elasticsearch/data

  kibana:
    image: docker.elastic.co/kibana/kibana:8.14.3
    container_name: kibana
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch

volumes:
  esdata:
```

---

## 🧠 Common Issues

| Issue                         | Cause                   | Fix                                        |
| ----------------------------- | ----------------------- | ------------------------------------------ |
| `media_type_header_exception` | ES client v9 with ES v8 | Run `npm install @elastic/elasticsearch@8` |
| `Conflict container name`     | Old container exists    | Run `docker rm -f elasticsearch kibana`    |
| `IMAP Sync SKIPPED`           | ES not ready            | Wait until Elasticsearch fully starts      |
| `OpenAI error`                | Missing API key         | Add `OPENAI_API_KEY` in `.env`             |

---

## 🧾 Build for Production

```bash
npm run build
npm start
```

---

## 🧩 Future Enhancements

* RAG-based AI Suggested Replies using Qdrant/pgvector
* OAuth2 IMAP support for Gmail
* Email thread grouping
* Rate-limited webhook retries
* Frontend (React + Vite) integration

---

## 🧑‍💻 Author

**Rajeev Sutrakar**
Software Developer | IIT Guwahati
📫 [LinkedIn](https://www.linkedin.com/in/rajeev-sutrakar) | 🧠 Passionate about full-stack & AI-driven systems

---
