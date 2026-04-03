# Hoyo Deck

A Stream Deck plugin for HoYoverse games. Track your Genshin Impact, Honkai: Star Rail, and Zenless Zone Zero stats directly on your Stream Deck.

## Features

### Genshin Impact

- **Resin Counter** - Track your Original Resin in real-time
- **Daily Commissions** - See remaining daily commissions at a glance
- **Expeditions** - Monitor completed/total expeditions
- **Teapot Currency** - Track your Serenitea Pot realm currency
- **Transformer** - Check Parametric Transformer cooldown
- **Spiral Abyss** - View reset timer and star count
- **Daily Reward** - View and claim HoYoLAB check-in rewards (supports all three games)
- **Banner Countdown** - Track current wish banner end date

### Honkai: Star Rail

- **Trailblaze Power** - Track your Trailblaze Power in real-time
- **Banner Countdown** - Track current warp banner end date

### Zenless Zone Zero

- **Battery Charge** - Track your Battery Charge in real-time
- **Banner Countdown** - Track current Signal Search banner end date

## Installation

### From Stream Deck Store

Coming soon to the Stream Deck Store.

### Manual Installation

1. Download the latest `.streamDeckPlugin` file from releases
2. Double-click to install, or use Stream Deck software to import

### Development Setup

```bash
# Clone the repository
git clone https://github.com/fcannizzaro/hoyodeck.git
cd hoyodeck

# Install dependencies
bun install

# Link for development
bun run link

# Run in development mode
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
   - Add any Hoyo Deck action to your Stream Deck
   - Click on the action to open Property Inspector
   - Paste the cookie string in the "Cookie String" field
   - Click "Parse Cookies"
   - Enter your Genshin Impact UID

## Actions

### Genshin Impact

#### Resin

Displays current/original resin count (e.g., "45/200").

#### Commissions

Shows remaining daily commissions (0-4).

#### Expeditions

Shows completed/total expeditions (e.g., "3/5").

#### Teapot

Displays current realm currency amount.

#### Transformer

Shows Parametric Transformer cooldown time.

#### Spiral Abyss

Shows days remaining until reset and total stars earned.

#### Banner

Shows current wish banner countdown with featured character/weapon icon.

### Honkai: Star Rail

#### Trailblaze Power

Displays current/max Trailblaze Power (e.g., "150/300").

#### Banner

Shows current warp banner countdown with featured character/light cone icon.

### Zenless Zone Zero

#### Battery Charge

Displays current/max Battery Charge (e.g., "120/240").

#### Banner

Shows current Signal Search banner countdown with featured character/W-Engine icon.

### Cross-Game

#### Daily Reward

Shows today's HoYoLAB check-in reward. Supports Genshin Impact, Honkai: Star Rail, and Zenless Zone Zero. Press to claim the daily reward.

## Requirements

- Stream Deck software 6.6 or later
- Windows 10+ or macOS 13+
- Node.js 20+ (for development)

## Development

### Project Structure
```
packages/shared/src/           # @hoyodeck/shared
├── types/                     # Game types, settings, Zod schemas
├── cookies/                   # Cookie parsing and validation
└── games/                     # Game registry and config

plugin/src/                    # Stream Deck plugin backend
├── actions/
│   ├── base/                  # Base action classes
│   ├── gi/                    # Genshin Impact actions
│   ├── hsr/                   # Honkai: Star Rail actions
│   └── zzz/                   # Zenless Zone Zero actions
├── api/                       # HoYoLAB API client
├── services/                  # Cross-cutting services
└── utils/                     # Utility functions

property-inspector/src/        # Stream Deck UI panel (React)
├── components/                # Reusable UI components
├── hooks/                     # React hooks
└── panels/                    # Action settings panels
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/fcannizzaro/hoyodeck/issues)
- Discord: Coming soon

## Disclaimer

This project is not affiliated with, endorsed by, or associated with COGNOSPHERE PTE. LTD. (HoYoverse), miHoYo, or any of their subsidiaries. All game titles, trademarks, and registered trademarks mentioned in this project are the property of their respective owners.

## License

Apache 2.0
