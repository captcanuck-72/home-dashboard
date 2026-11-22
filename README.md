# Home Dashboard for iPad

A full-screen family dashboard for an iPad on the wall or kitchen counter:

- **Clock & weather**: current conditions, a rain/snow heads-up for the next 12 hours, and a multi-day forecast (Open-Meteo, free, no account)
- **Calendar**: events merged from all your Google Calendars, colour-coded, with the current event highlighted
- **Tasks**: your Google Tasks, sorted by due date; tap to check one off (tap again within 2½ seconds to undo)
- **Groceries**: type or tap the mic to add items ("milk, eggs and bread" becomes three items). The list is stored as a Google Tasks list called **Groceries**, so it is also on your phone in the Google Tasks app at the store.
- **Ask AI**: one tap opens Claude, ChatGPT, Gemini or Perplexity, optionally with your question already filled in
- **Front door camera**: a live stream, a refreshing snapshot, or a big button that opens the camera's app
- **School lunches**: Monday to Friday lunch orders (titled with your child's name, set in Settings); tap a day to edit, with quick picks for repeat orders
- **Night clock**: from 10 PM to 6 AM the screen goes black with a dim clock; tap to wake

There are no servers to run and nothing to pay for. The dashboard is a static web page, and your Google data comes from a small script that runs inside your own Google account.

```
index.html, app.js, styles.css, manifest.webmanifest, icon-*.png   ← the dashboard (host these)
apps-script/Code.gs, apps-script/appsscript.json                   ← the Google back end
```

You can try it right away: open `index.html` from any web host and it runs on **demo data**. Groceries and lunches you add in demo mode are saved on that device only.

---

## Step 1: Google back end (about 10 minutes)

Do this on a computer, signed in to the Google account that owns your calendars.

1. Go to **https://script.google.com** → **New project**. Rename it "Home Dashboard".
2. Delete the sample code in `Code.gs` and paste in the whole of `apps-script/Code.gs`. Click 💾 **Save**.
3. In the left sidebar, click **Services ➕**, choose **Google Calendar API**, then **Add**. Do it again for **Google Tasks API**. Keep the default identifiers `Calendar` and `Tasks`.
4. In the toolbar's function menu, choose **`setup`** and click **▶ Run**.
   - Google asks for permission: **Review permissions** → pick your account → **Advanced** → **Go to Home Dashboard (unsafe)** → **Allow**. ("Unsafe" only means Google hasn't reviewed a script you wrote for yourself.)
   - The **Execution log** lists the calendars it found and ends with **`YOUR DASHBOARD KEY → …`**. Copy that key.
5. Click **Deploy → New deployment** → ⚙️ **Web app**, and set:
   - **Execute as:** Me
   - **Who has access:** Anyone *(needed so the iPad can reach it without signing in; the key keeps strangers out)*
   - Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).

**Which calendars show up?** Pick them on the dashboard itself: ⚙️ **Settings → Calendars** has a checkbox for every calendar in your account. Unticking one hides it on the dashboard only, not in Google Calendar. Until you pick, the dashboard shows the calendars ticked in Google Calendar's sidebar on the web, and **Match Google Calendar** switches back to that. A calendar added later won't appear until you tick it, unless you're following Google Calendar's ticks.

- To include someone else's calendar (a partner's, say), have them share it with your Google account (**Settings → [their calendar] → Share with specific people**).
- To add a school or team calendar that has an iCal link, use **Other calendars ➕ → From URL**.
- To rename calendars, or to keep one off the dashboard entirely (it won't even get a checkbox), edit `CONFIG` at the top of `Code.gs`.

**Updating `Code.gs` later** (after editing it, or when pasting in a newer version):
1. Select all the code in the editor, paste the new code over it, and click 💾 **Save**.
2. Go to **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. The URL and key stay the same. Without this step, the dashboard keeps using the old version.

## Step 2: Put the dashboard online (free, HTTPS)

The dashboard must be served over **https://**. Otherwise the iPad blocks the microphone button.

**Easiest: Netlify Drop.** Go to **https://app.netlify.com/drop** and drag in the `home-dashboard` folder. You get a URL like `https://something.netlify.app` (a free account keeps it permanently).

**Or GitHub Pages.** Create a repository, upload these files, then go to **Settings → Pages → Deploy from branch → main / (root)**. Your URL will be `https://<username>.github.io/<repo>/`. The code contains no secrets: your key lives only on the iPad.

## Step 3: Set up the iPad

1. Open your dashboard URL in **Safari** and tap ⚙️ (top right).
2. Paste the **Web app URL** and **Dashboard key**, then tap **Test connection** and look for ✓ Connected.
3. Search for your town under **Weather** and pick °C/°F. Check the other options, then tap **Save**.
4. Tap **Share → Add to Home Screen**. Always launch it from that icon: it opens full screen with no Safari bars.
   - Home Screen apps keep their own storage, so if the settings don't carry over, open ⚙️ again in the Home Screen app. Typing a long URL on the iPad is a pain, so on your computer open the dashboard, fill in Settings, tap **Copy setup link**, send the link to the iPad (AirDrop, Messages or email), and paste it into **Paste a setup link → Import**.
5. Kiosk settings:
   - **Settings → Display & Brightness → Auto-Lock → Never**
   - **Settings → Accessibility → Guided Access → On.** Then in the dashboard, triple-click the top (or Home) button → **Start**. This locks the iPad to the dashboard; triple-click again and enter your passcode to leave. Under **Guided Access → Display Auto-Lock**, choose **Never**.
   - Keep it plugged in. If your iPad offers it (**Settings → Battery → Charging**), turn on the **80% limit** to protect the battery.

The page refreshes Google data every 5 minutes and weather every 15, reloads itself at 3:30 AM to stay fresh, and keeps showing the last data if the Wi-Fi drops (the status pill turns red).

---

## Adding groceries by voice

- **Mic button on the dashboard**: tap it and say "milk, eggs and bread". Items are split on commas and "and", but common pairs like "mac and cheese" and "salt and pepper" stay together. If the iPad says the mic isn't allowed (some iPadOS versions block it in Home Screen apps), tap the text box and use the 🎤 key on the keyboard instead.
- **"Hey Siri, add groceries"** works from your iPhone, Apple Watch, HomePod or the iPad itself:
  1. Open the **Shortcuts** app → **➕** → add the action **Dictate Text**.
  2. Add **Get Contents of URL**. Paste your Web app URL, tap ▸ to expand it, and set **Method: POST** and **Request Body: JSON** with three text fields:
     - `key` = your dashboard key
     - `action` = `addGrocery`
     - `text` = the **Dictated Text** variable
  3. Optionally add **Show Notification** ("Added!").
  4. Name the shortcut **Add groceries**. Now say "Hey Siri, add groceries", then "milk and bananas".
- **Phone at the store**: open the **Google Tasks** app, go to the **Groceries** list, and check items off. They disappear from the dashboard too.

## Ask AI

The button opens a panel of assistants. If you type or say a question first, Claude, ChatGPT and Perplexity open with it filled in. To change the list, go to **Settings → Ask AI buttons**, one `Name | URL` per line, with `%s` where the question goes.

## Front door camera

A doorbell that pops up on a Fire TV is almost certainly a **Ring** or **Blink**. Amazon does not offer a public video API for either, so the feed can't simply be embedded. You have three options, easiest first:

1. **Button to the app (works today).** In Settings → Front door camera, choose **"A big button that opens the camera's app or website"** and set the link. For Ring, `https://account.ring.com/account/dashboard` opens Ring's website, which has live view. Also install the Ring (or Blink) app on the iPad and allow notifications, so a doorbell press pops up on the iPad just like on the TV.
2. **Real live view on the dashboard (Ring).** This needs a small always-on computer at home (Raspberry Pi, old laptop, NAS) running a bridge such as **Scrypted** (Ring plugin) or **ring-mqtt + go2rtc**. Then use one of go2rtc's URLs in Settings:
   - Live video: **HLS** → `https://…/api/stream.m3u8?src=front_door`
   - Lighter live view: **MJPEG** → `https://…/api/stream.mjpeg?src=front_door`
   - Snapshot every few seconds (best for battery doorbells): **Snapshot** → `https://…/api/frame.jpeg?src=front_door`
   - Player page: **Web page** → `https://…/stream.html?src=front_door`

   For a battery doorbell, tick **"Only stream when tapped"**. Constant streaming drains it fast.
3. **Cameras with RTSP** (Reolink, Amcrest, many Eufy and TP-Link Tapo models) work with go2rtc directly, the same way as option 2.

⚠️ **The camera URL must also be https://.** Because the dashboard is on https, the iPad blocks `http://192.168…` addresses. The simplest fix is **Tailscale** on the home computer (`tailscale serve` gives it an https address) or Home Assistant's remote URL.

## Privacy & security

- Your Google data never passes through anyone else's server. The iPad talks directly to *your* Apps Script, which runs as *you*.
- The web app URL plus the key give access to your calendar titles, tasks and lists, so treat the setup link like a password. If it leaks, run **`resetKey`** in Apps Script and enter the new key on the iPad.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Google sent back a web page instead of data" | Redeploy with **Who has access: Anyone** and use the URL ending in `/exec`. |
| "Wrong dashboard key" | Re-copy the key from the `setup()` log (or run `setup` again; it prints the same key). |
| Status pill is amber | One section failed (for example, the Tasks API wasn't added). Tap the pill to see which. |
| A calendar is missing | Tick it in ⚙️ Settings → Calendars on the dashboard. If it isn't listed there, check `EXCLUDE_CALENDARS` in `Code.gs`. |
| Settings → Calendars says to update the Apps Script | Paste the newest `Code.gs` and deploy a new version (see "Updating `Code.gs` later"). |
| Weather says "Sample" | Set your town in Settings → Weather. |
| Camera says it can't load | The URL is `http://` (see the HTTPS note above) or the camera server is off. |
