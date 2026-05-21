# 🕌 AgamaKu - Islamic Booking Marketplace

**AgamaKu** is a premium, mobile-first, and desktop-responsive web application serving as an **"Islamic Grab-style" booking platform**. It connects students looking for specialized religious services—such as Mengaji (Quran Recitation), Tadabbur (Quran Tafsir), Ceramah (Lectures), Tahlil, and Ruqyah—with highly qualified, verified Ustaz & Ustazah partners.

The platform is designed with a premium, high-end **Islamic HSL Emerald & Gold theme**, packed with custom animations, custom vector road networks on canvas, and in-browser sound chimes.

---

## ✨ Key Features

### 1. 📱 Dual-Mode Viewports
- **Mobile Emulator Frame**: Renders the application in a realistic phone shell with curved corners, safe areas, and a speaker/camera notch.
- **Widescreen Desktop Workspace**: Automatically reflows vertical layouts into a spacious **3-column horizontal grid**, scales the Canvas map side-by-side with dispatch panels, and builds a premium left navigation sidebar for desktop viewports.

### 2. 🤝 Dual-Mode Architecture
- **Student Mode**: 
  - Browse 5 primary religious categories.
  - Filter and search the dynamic teacher directories.
  - View rich teacher profiles displaying verified credentials, academic backgrounds (e.g., Al-Azhar, UM), and database reviews.
  - Lock bookings to specific teachers, automatically pre-filling services and custom hourly rates.
- **Partner Mode (Ustaz Dashboard)**: 
  - Toggle online/offline status.
  - Receive real-time audio chimes for incoming classes.
  - Accept or decline bookings, review active students, and manage ongoing classes.

### 3. 🗺️ Real-time GPS Mapping Engine
- Uses **Leaflet.js** integrated with **OpenStreetMap** to render a beautiful real-world interactive map.
- Leverages the **Open Source Routing Machine (OSRM)** API to draw actual road geometries and calculate realistic drive times.
- Connects to the browser's `navigator.geolocation` API to use the student's real-world GPS location as the delivery destination.

### 4. 🎵 Synthesized Audio Soundscapes
- Leverages the **Web Audio API** to synthesize beautiful major-triad acoustic chime alerts in-browser for incoming booking alerts and live chat messages. 
- *No static MP3/WAV assets required!*

### 5. 🛠️ Intelligent Development Server
- Standard Node.js backend utilizing the native `http` module.
- Includes a fully functional **SQLite database** to store persistent user balances, bookings, completed history, and real-time live chat messages between the Student and Partner.
- Includes a **port fallback scan loop** (automatically tries port 3000, 3001, etc. if port is already in use).
- Broadcasts the computer's **local network Wi-Fi IP address** in the terminal so you can scan and test the application directly on physical mobile devices!

---

## 📂 File Directory

* **[`index.html`](index.html)**: Central semantic markup hosting all dynamic view containers (Home, Directory, Profile, Booking, Radar, Active Map, Partner Dashboard).
* **[`styles.css`](styles.css)**: Glassmorphism tokens, emerald-to-gold HSL color palettes, phone layout wrappers, keyframes (`pulse-avatar`, `scan-line`), and responsive widescreen grid reflows.
* **[`data.js`](data.js)**: Static database lists covering service specs, detailed teacher profiles, hourly rates, and ratings/reviews.
* **[`map.js`](map.js)**: Wrapper engine bridging Leaflet.js tiles with Open Source Routing Machine (OSRM) GeoJSON vectors for live driving paths.
* **[`app.js`](app.js)**: Central state machine (`appState`) managing views, dispatching matched searches, and syncing database polling states for live chat.
* **[`server.js`](server.js)**: Node.js HTTP server utilizing a local SQLite database for data persistence and a port-scanning utility for cross-device testing.
* **[`GEMINI.md`](GEMINI.md)**: Exhaustive engineering document outlining algorithms, database keys, and test sequences for developers and AI session agents.

---

## 🚀 How to Run & Test Locally

### 1. Start the Server
Run the local server using Node.js:
```bash
node server.js
```
The terminal will scan available ports and output access links:
```text
[AgamaKu Server] Running successfully!
👉 Local URL:   http://localhost:3001
👉 Network URL: http://192.168.1.6:3001  (Open this on your mobile phone!)
```

### 2. Access and Test
- **Local Testing**: Open your browser and navigate to the Local URL.
- **Physical Phone Testing**: Connect your mobile phone to the **same Wi-Fi network** as your computer, and navigate to the printed Network URL.

---

## 🧪 Quick Test Scenarios

### Aliran A: Pre-Selected Locked Bookings (Student Mode)
1. On the Homepage, scroll to *Ustaz & Ustazah Terdekat* and select **Ustazah Fatimah Az-Zahra**.
2. Review her biography and rating scores, then click **Tempah Sekarang**.
3. Inside the booking form, verify that the locked green header shows her name, estimated rates use her custom rate (`RM 40.00/jam`), and the general gender selector is hidden.
4. Click **Cari Guru Sekarang**. The radar sweeps for 4 seconds and automatically matches her, starting the canvas path travel!

### Aliran B: Dual-Mode Partner Sync (Ustaz Zulkifli)
1. Go to **Partner Mode** dashboard -> click **Pergi Online** (indicator turns green).
2. Switch back to **Student Mode** -> select **Ustaz Zulkifli Harun** -> click **Tempah Sekarang** -> click **Cari Guru Sekarang**.
3. The radar spins and plays persistent synthesized acoustic chime loops.
4. Switch to **Partner Mode (Ustaz Dashboard)**. Click the green **Terima Tempahan** (Accept Booking) button.
5. Switch to **Student Mode**.
6. **Result**: Both screens are locked into the active tracking viewport showing the travel pin moving along the road network in real time!

---

## 🛡️ Clean Workspace Configuration
The repository includes pre-built ignore files:
- **`.gitignore`**: Excludes `node_modules/`, logs, env secrets, and local databases.
- **`.cursorignore` & `.windsurfignore`**: Tells modern AI agents to completely ignore workspace cache histories (`.gemini/`, `.antigravity/`, `brain/`, `scratch/`), preventing context bloat and keeping AI responses lightning fast.

---

🕌 *AgamaKu - Connecting students with qualified Ustaz & Ustazah seamlessly.*
