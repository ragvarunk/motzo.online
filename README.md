# motzo.online

Motzo is a personal AI helper for a car owner's vehicle. It works on phones, tablets and computers, by typing or by voice.

## What's in this first version

- **Chat like talking to Claude**: type, voice notes, or hands-free voice mode. Every message (yours and Motzo's) is saved with its exact date and time; tap a time to see it in full. Motzo reacts to messages, and you can react with a long press or double tap.
- **Camera in the chat**: photos, short videos, and **lens mode**, which reads what the camera sees live (damage, VIN, plate, warning lights, tire size, documents). Upload photos, videos, documents (PDF) and audio too.
- **Photo reading**: what part it is, a cost range, the right kind of shop (glass, body, repair, tire, oil), whether it's likely today, and what your insurance probably covers. Motzo asks for the photos or VIN it still needs.
- **Vehicle profile**: year, make, model, trim, VIN (typed or scanned, decoded free via NHTSA), plate, mileage. Several vehicles.
- **Insurance**: upload a card or policy and Motzo reads the deductibles; save to your profile or type them in.
- **Oil change reminders** from mileage (typed, read from an odometer photo, or counted while the app is open). No gas notifications.
- **Shop finder** (Google Maps): nearest shops of the right kind, rating, review count, distance, open now, mobile service, a plain "right for this job?" verdict, reviews with what reviewers complain about, hours, phone number only when you ask.
- **Quotes**: you confirm, Motzo asks several shops the same questions (price, parts, materials, how, timing, technicians, calibration, warranty, insurance, payment) and lines up the answers. **No phone calls.** Your name, phone, email, address, plate and insurance are never shared until you accept one quote, and you choose what goes to that one shop. Every exchange is logged with times.
- **Garage**: vehicles, insurance, oil & miles, service history, the full conversation record (downloadable), and what you've shared with whom.
- **Robot character** (placeholder until the real design arrives): moves around the chat, shows listening, thinking, talking, happy and concerned.

## Sample mode (honest by design)

Any key that isn't set runs that part in sample mode, clearly labelled "Sample":

| Missing key | What happens |
| --- | --- |
| `ANTHROPIC_API_KEY` | Motzo gives keyword-based sample answers; lens says it needs the key |
| `GOOGLE_MAPS_API_KEY` | Three "Sample …" shops instead of real ones |
| `ELEVENLABS_API_KEY` | The device's own voice; audio files aren't transcribed |

Shops aren't connected to Motzo yet (no business API, agent-to-agent link or text channel). Sample shops answer with sample quotes so you can try the whole flow; **real shops are shown as "not contacted" and nothing is sent to them.**

Data lives on the device (IndexedDB) for now. There's no sign-in yet (Google sign-in comes later).

## Run locally

```
npm install
cp .env.example .env.local   # add any keys you have
npm run dev
```

## Deploy on Vercel

1. Vercel > **Add New… > Project** > import `ragvarunk/motzo.online`.
2. Framework: Next.js (detected). Leave build settings as they are.
3. Add the environment variables from `.env.example` that you have (all optional).
4. Deploy.

Google Maps: enable **Places API (New)** for `GOOGLE_MAPS_API_KEY` (server only) and **Maps Embed API** for `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` (restrict it to your domain).
