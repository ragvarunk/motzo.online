# Motzo's voice server

Motzo speaks with **Kokoro** (Apache 2.0) and listens to audio files with **faster-whisper**, both served by [Speaches](https://github.com/speaches-ai/speaches), an open-source server with the OpenAI audio API. No per-use fees: you only pay for the server it runs on.

## What it needs

- A Linux server with Docker (Ubuntu 24.04 is fine). 2 vCPU and 4 GB RAM is enough; 8 GB is more comfortable. No GPU needed.
- A name for it, like `voice.motzo.online`, with a DNS **A record** pointing at the server's IP.
- Ports 80 and 443 open (Caddy uses them to get the free HTTPS certificate).

## Start it

```
git clone https://github.com/ragvarunk/motzo.online.git
cd motzo.online/voice-server
cp .env.example .env
openssl rand -hex 32        # paste the result after SPEACHES_API_KEY= in .env
nano .env                   # set VOICE_DOMAIN too
docker compose up -d
docker compose logs -f speaches   # first start downloads the models (a few minutes)
```

Check it:

```
curl https://voice.motzo.online/health
curl https://voice.motzo.online/v1/audio/speech \
  -H "Authorization: Bearer YOUR_KEY" -H "Content-Type: application/json" \
  -d '{"model":"speaches-ai/Kokoro-82M-v1.0-ONNX","voice":"af_heart","input":"Hi, I am Motzo."}' \
  --output test.mp3
```

## Connect the app

In Vercel (project motzo.online > Settings > Environment Variables) add:

| Name | Value |
| --- | --- |
| `MOTZO_VOICE_URL` | `https://voice.motzo.online` |
| `MOTZO_VOICE_API_KEY` | the same key as `SPEACHES_API_KEY` |

Optional: `MOTZO_TTS_VOICE` picks the voice (default `af_heart`; others include `af_bella`, `af_nicole`, `am_michael`, `am_adam`, `bf_emma`, `bm_george`). Redeploy after changing them.

Until the voice server is connected, Motzo uses the phone's or computer's own voice.
