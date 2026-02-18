# Background Slideshow

An [Obsidian](https://obsidian.md) plugin that displays background image slideshows with smooth fade transitions.

## Features

- Background image slideshow with configurable fade transitions
- Supports local vault images, web URLs, and random photos from [Lorem Picsum](https://picsum.photos)
- Adjustable display duration and fade time
- Per-pane transparency controls (pane, UI, tabs)
- Drag & drop image reordering
- Toggle on/off via command palette

## Usage

1. Enable the plugin in **Settings → Community Plugins**
2. Open **Settings → Background Slideshow**
3. Choose a mode:
   - **Random images**: Automatically fetches photos from Lorem Picsum
   - **Manual**: Add local vault images or web URLs

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Enable slideshow | Toggle the slideshow on/off | On |
| Duration (seconds) | How long each image is displayed | 60 |
| Fade time (seconds) | Duration of fade transition | 5 |
| Use random images | Use random photos from Lorem Picsum | On |
| Pane opacity | Opacity of editor pane backgrounds | 0.85 |
| UI opacity | Opacity of UI element backgrounds | 0.85 |
| Tab opacity | Opacity of tab backgrounds | 0.85 |

## Commands

- **Toggle background slideshow**: Enable or disable the slideshow

## Installation

### Community Plugins (Recommended)

1. Open **Settings → Community Plugins**
2. Search for "Background Slideshow"
3. Click **Install**, then **Enable**

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Cloud-Xero/obsidian-background-slideshow/releases)
2. Copy the files to `<vault>/.obsidian/plugins/background-slideshow/`
3. Enable the plugin in **Settings → Community Plugins**

## License

[MIT](LICENSE)
