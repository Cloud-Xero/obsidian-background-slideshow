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

## Network use and privacy

This plugin loads background images over the network in the following cases:

- **Use random images** is On (the default): random photos are loaded from [Lorem Picsum](https://picsum.photos) (`picsum.photos`). The images may be delivered from other hosts that Lorem Picsum uses.
- **Use random images** is Off and you add an image URL: the image is loaded from that URL.

Images from your vault are loaded locally and are never sent anywhere. The plugin does not send telemetry or analytics.

### Vault file list

**Add image from vault** reads the list of all files in your vault when you open its dialog. The list is used only to show image files as choices. It is not saved or sent anywhere, and it is discarded when the dialog closes. The only things saved in the plugin settings are the paths of the images you add and whether each image is enabled.

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
