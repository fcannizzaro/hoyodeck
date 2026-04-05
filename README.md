# HoYo Deck

A Stream Deck plugin for HoYoverse games. Track your Genshin Impact, Honkai: Star Rail, and Zenless Zone Zero stats directly on your Stream Deck — with rich visual feedback, multi-account support, and encoder (dial) controls.

## Features

### Genshin Impact

- **Resin** — Real-time Original Resin count with fill-level visual overlay
- **Commissions** — Daily commission progress with animated character display
- **Expeditions** — Completed/total expeditions with character avatar icons
- **Teapot** — Serenitea Pot realm currency percentage, alerts when capped
- **Transformer** — Parametric Transformer cooldown (icon or text mode)
- **Endgame** — Spiral Abyss stars, Imaginarium Theater medals, or Stygian Onslaught difficulty — with auto-selection for the soonest-ending content
- **Banner** — Active wish banner countdown with character/weapon art (encoder support)

### Honkai: Star Rail

- **Trailblaze Power** — Real-time Trailblaze Power count with fill-level visual overlay
- **Endgame** — Memory of Chaos, Pure Fiction, Apocalyptic Shadow, or Anomaly Arbitration progress
- **Banner** — Active warp banner countdown with character/light cone art (encoder support)

### Zenless Zone Zero

- **Battery Charge** — Real-time Battery Charge count with fill-level visual overlay
- **Endgame** — Shiyu Defense or Deadly Assault progress
- **Banner** — Active Signal Search banner countdown with agent/W-Engine art (encoder support)

### Cross-Game

- **Daily Reward** — HoYoLAB daily check-in for any game, with one-press claiming
- **Redeem Codes** — Redeem HoYoverse gift codes across all games, with available code count overlay

## Installation

### From Stream Deck Store

Coming soon to the Stream Deck Store.

### Manual Installation

1. Download the latest `.streamDeckPlugin` file from [Releases](https://github.com/fcannizzaro/hoyodeck/releases)
2. Double-click to install, or import through the Stream Deck app

### Development Setup

```bash
# Clone the repository
git clone https://github.com/fcannizzaro/hoyodeck.git
cd hoyodeck

# Install dependencies
bun install

# Open the plugin directory
cd plugin

# Link the plugin for local development
bun run link

# Start development mode (watch + rebuild)
bun run dev
```

## Setup

### Authentication

The plugin requires HoYoLAB authentication to access your game data.

1. **Log in to HoYoLAB**
   - Go to [hoyolab.com](https://www.hoyolab.com) and log in with your account

2. **Extract Cookies**
   - Open browser DevTools (F12)
   - Go to the Network tab
   - Refresh the page
   - Find any request to `hoyolab.com`
   - Copy the entire `Cookie` header value

3. **Configure Plugin**
   - Add any HoYo Deck action to your Stream Deck
   - Open the Property Inspector and navigate to account management
   - Paste the cookie string and parse it
   - Your game UIDs will be resolved automatically

The plugin supports **multiple accounts** — each action can be bound to a different HoYoLAB account.

## Actions

### Genshin Impact (7 actions)

| Action          | Description                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Resin**       | Current / max Original Resin (e.g. `45/200`) with fill gauge. Press to refresh.                                           |
| **Commissions** | Daily commission progress (e.g. `2/4`) with animated character.                                                           |
| **Expeditions** | Completed / total expeditions with character avatar circles (auto-layout for 1–5).                                        |
| **Teapot**      | Realm currency fill %. Shows alert when capped.                                                                           |
| **Transformer** | Parametric Transformer cooldown — icon mode or text countdown.                                                            |
| **Endgame**     | Spiral Abyss ★ / Imaginarium Theater 🏅 / Stygian Onslaught — with reset timer. Supports "ending soonest" auto-selection. |
| **Banner**      | Active wish banner countdown with featured art. Encoder dial cycles banners.                                              |

### Honkai: Star Rail (3 actions)

| Action               | Description                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------- |
| **Trailblaze Power** | Current / max Trailblaze Power (e.g. `150/300`) with fill gauge. Press to refresh.            |
| **Endgame**          | Memory of Chaos / Pure Fiction / Apocalyptic Shadow / Anomaly Arbitration — with reset timer. |
| **Banner**           | Active warp banner countdown with featured art. Encoder dial cycles banners.                  |

### Zenless Zone Zero (3 actions)

| Action             | Description                                                                           |
| ------------------ | ------------------------------------------------------------------------------------- |
| **Battery Charge** | Current / max Battery Charge (e.g. `120/240`) with fill gauge. Press to refresh.      |
| **Endgame**        | Shiyu Defense / Deadly Assault — with reset timer.                                    |
| **Banner**         | Active Signal Search banner countdown with featured art. Encoder dial cycles banners. |

### Cross-Game (2 actions)

| Action           | Description                                                                  |
| ---------------- | ---------------------------------------------------------------------------- |
| **Daily Reward** | Today's HoYoLAB check-in reward for GI, HSR, or ZZZ. Press to claim.         |
| **Redeem Codes** | Shows available code count. Press to redeem all codes for the selected game. |

## Requirements

- Stream Deck software **7.1** or later
- Windows 10+ or macOS 13+
- Node.js 24+ (for development only)

## Tech Stack

| Layer              | Technology                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| Runtime            | Node.js 24 via Stream Deck SDK 2                                                                 |
| Language           | TypeScript 6 (strict mode)                                                                       |
| Plugin Rendering   | React 19 → image via [Takumi](https://github.com/nicholasgasior/takumi-rs) (Rust-based renderer) |
| Property Inspector | React 19 + Tailwind CSS 4 (single-file HTML)                                                     |
| Data Fetching      | TanStack Query 5                                                                                 |
| Validation         | Zod 4                                                                                            |
| Bundler            | Vite 8 (Rolldown)                                                                                |
| Monorepo           | Turborepo + Bun workspaces                                                                       |
| Package Manager    | Bun                                                                                              |

## Development

### Project Structure

```
hoyodeck/
├── packages/shared/src/           # @hoyodeck/shared — shared types, validation, constants
│   ├── types/                     # GameId, HoyoAuth, settings types, Zod schemas
│   ├── cookies/                   # Cookie parsing, auth extraction, validation
│   └── games/                     # Game registry (GAMES, GAME_LABELS, configs)
│
├── plugin/src/                    # Stream Deck plugin backend
│   ├── actions/
│   │   ├── gi/                    # Genshin Impact actions (7)
│   │   ├── hsr/                   # Honkai: Star Rail actions (3)
│   │   ├── zzz/                   # Zenless Zone Zero actions (3)
│   │   └── common/               # Cross-game actions (daily-reward, redeem-code)
│   ├── api/
│   │   ├── hoyolab/              # HoYoLAB API client, DS generation, constants
│   │   ├── manager/              # Codes Server REST client (ETag caching)
│   │   └── types/                # API response types per game
│   ├── services/
│   │   ├── data-controller.ts    # Centralized polling & data store
│   │   ├── game-controllers/     # Per-game fetch orchestrators
│   │   ├── auth-validator.ts     # Auth validation service
│   │   ├── hoyolab-login.ts      # Native webview login
│   │   └── query-client.ts       # TanStack Query client
│   ├── contexts/                  # React contexts (account, data, codes)
│   ├── components/                # Shared visual components (badge, banner, endgame)
│   ├── hooks/                     # Custom hooks (blink, game-data, image)
│   └── utils/                     # Helpers (time, region, image, debug)
│
├── property-inspector/src/        # Stream Deck UI panel (React + Tailwind)
│   ├── panels/                    # Settings panels per action type
│   ├── components/                # Reusable UI components
│   ├── hooks/                     # Stream Deck PI communication hook
│   ├── constants/                 # Game icons and labels
│   └── assets/                    # Game artwork
│
└── plugin/com.fcannizzaro.hoyodeck.sdPlugin/
    └── manifest.json              # Stream Deck plugin manifest
```

### Architecture

The plugin uses a **React-on-Stream-Deck** architecture via [`@fcannizzaro/streamdeck-react`](https://github.com/fcannizzaro/streamdeck-react):

- Each action is a **React component** rendered to a Stream Deck key image via [Takumi](https://github.com/nicholasgasior/takumi-rs) (a Rust-based image renderer)
- A centralized **DataController** polls the HoYoLAB API every 5 minutes and pushes updates to subscribed actions
- Per-game **GameControllers** orchestrate multiple API calls with `Promise.allSettled` for fault isolation
- **Multi-account** support — each action can be bound to a different HoYoLAB account
- The Property Inspector is a **single-file React + Tailwind CSS** app bundled via `vite-plugin-singlefile`

### Scripts

| Script              | Description                         |
| ------------------- | ----------------------------------- |
| `bun run dev`       | Start all workspaces in watch mode  |
| `bun run build`     | Type-check and build all workspaces |
| `bun run typecheck` | Type-check all workspaces           |

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/fcannizzaro/hoyodeck/issues)

## Disclaimer

This project is not affiliated with, endorsed by, or associated with COGNOSPHERE PTE. LTD. (HoYoverse), miHoYo, or any of their subsidiaries. All game titles, trademarks, and registered trademarks mentioned in this project are the property of their respective owners.

## License

Apache 2.0
