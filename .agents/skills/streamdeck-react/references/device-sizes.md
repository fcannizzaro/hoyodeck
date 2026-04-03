# Device Sizes

The library automatically detects the device type and sets render dimensions. Use `useCanvas()` to access dimensions in components.

## Key Sizes

| Device                 | Key Size (px) |
| ---------------------- | ------------- |
| Stream Deck (original) | 72 x 72       |
| Stream Deck MK.2       | 72 x 72       |
| Stream Deck XL         | 96 x 96       |
| Stream Deck Mini       | 80 x 80       |
| Stream Deck +          | 144 x 144     |
| Stream Deck Neo        | 72 x 72       |
| Galleon 100 SD         | 144 x 144     |
| Stream Deck + XL       | 144 x 144     |

## Encoder Display Sizes (Stream Deck+)

| Surface                      | Size (px) |
| ---------------------------- | --------- |
| Encoder display (per action) | 200 x 100 |

## Touch Input

The Stream Deck+ touch strip is 800 x 100 across the full device. Touch events are routed per encoder action, so coordinates are relative to that action's segment.

## Grid Sizes

| Device                 | Columns | Rows |
| ---------------------- | ------- | ---- |
| Stream Deck (original) | 5       | 3    |
| Stream Deck MK.2       | 5       | 3    |
| Stream Deck XL         | 8       | 4    |
| Stream Deck Mini       | 3       | 2    |
| Stream Deck +          | 4       | 2    |
| Stream Deck Neo        | 4       | 2    |
| Galleon 100 SD         | 3       | 4    |
| Stream Deck + XL       | 9       | 4    |

## Touch Sizes

| Device           | Columns | Rows |
| ---------------- | ------- | ---- |
| Stream Deck +    | 4       | 1    |
| Stream Deck + XL | 6       | 1    |

## Design Guidelines

- Design for the smallest target size (72x72) and let larger keys have more breathing room.
- Use `useCanvas()` to adapt layouts dynamically:
  ```tsx
  const { width, height, type } = useCanvas();
  ```
- Text below ~10px fontSize becomes hard to read on 72x72 keys.
- Stream Deck XL's 96x96 keys allow more detailed layouts.
- Stream Deck+ 144x144 keys support rich multi-element designs.
- Encoder displays (200x100) are wider than tall -- use horizontal layouts.
