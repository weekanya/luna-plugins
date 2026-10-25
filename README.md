# Luna Plugins by weekanya

Plugins for [TidaLuna](https://github.com/Inrixia/TidaLuna).

## 📥 Plugins Included

### 🎵 Song Downloader (Material Design 3)
Download Tidal tracks, albums, and playlists as high-quality FLAC files with a built-in Material 3 Expressive Download Manager:
- Real-time download progress (MB & percentage)
- RealMAX FLAC quality finder toggle
- Complete queue management (retry failed tracks, clear history, cancel/resume)
- Canonical Google Material Symbols and dark theme palette

### 📁 Local Tracks
On a playlist page a **＋ Local track** button appears. Add a track that is missing from Tidal from a local file or a direct audio link; it's stored on this device and played through a built-in player (Tidal playback is paused automatically).

---

## 🚀 How to Install in TidaLuna

1. Open **Luna Settings** in your Tidal client.
2. Go to the **Plugin Store** tab.
3. In the **Install from URL** field, paste:
   ```text
   https://github.com/weekanya/luna-plugins/releases/download/latest/store.json
   ```
4. Click **Install** on Song Downloader!

---

## 🛠️ Local Development

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Run development mode (local server at `http://127.0.0.1:3000` with live reload in Luna):
   ```bash
   pnpm run watch
   ```
3. Build for production:
   ```bash
   pnpm run build
   ```
