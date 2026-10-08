# Telegram chat: second design pass

The product is a small Telegram text client, not a marketing website. Its audience needs to connect an account, find a conversation and read messages.

## Tokens

- Paper: #ffffff — controls and incoming messages.
- Ink: #263640 — body copy, never a display-black block.
- Secondary: #607581 — times and helper text.
- Telegram blue: #197bb0 — actionable controls and selected conversations.
- Sea glass: #d9e8de — the reading canvas.
- Reply paper: #eff8e9 — outgoing messages.

IBM Plex Sans, self-hosted, 400 for reading and 500/600 for names and controls. Scale: 12 / 14 / 16 / 20 / 26px. No tracked uppercase labels or display hero.

## Layout

Rejected approach: a third navigation rail and a promotional hero compete with actual conversations.

Chosen approach: a two-pane application window, left-aligned controls, messages in a centred reading column.

    +---------------------+----------------------------------+
    | Telegram   help exit| Conversation header              |
    | Chats          new  |                                  |
    | Search              | incoming                         |
    | conversation rows   |                    outgoing      |
    |                     |                                  |
    | connection status   | Message composer                 |
    +---------------------+----------------------------------+

Login uses the same two-pane shell. The left pane contains the actual connection form. The right pane is the empty conversation state, with a functional demo action.

## Review before implementation

A blue sidebar plus rounded tiles would repeat the SaaS kit. Revise to a white inbox with edge-to-edge conversation rows and one selected-row tint. Keep normal title case, restrained weights, circular contact avatars and no floating card shadows. The wallpaper is the single expressive element: large flat shapes and thin folding contours, inspired by Telegram's paper plane. Messages remain visually quiet and legible.

All existing API behavior remains intact. Verify login, chat, dialog and mobile layouts with browser screenshots.

## Mobile composition

Reuse Paper #ffffff, Ink #263640, Secondary #607581, Telegram blue #197bb0, Sea glass #d9e8de and Reply paper #eff8e9. IBM Plex Sans remains the only family: 30px inbox title, 26px connection title, 16px names/input/message text, 14px previews, 12px timestamps.

    Inbox                  Conversation           New chat
    Telegram    help exit  back  avatar name      existing screen dimmed
    Chats             +    short demo notice     ----------------------
    Search                 incoming              New chat          close
    avatar name     time            outgoing     Phone
           preview         message composer      Create chat

Mobile uses one screen at a time. Keep the existing paper canvas as the sole expressive element; do not invent navigation tabs for features this client does not have. Give the connection screen a short paper masthead instead of a marketing hero. Avoid placing a floating action over status controls: the create-chat action remains in the inbox header. Every action has a 44px target, contact previews can use two lines, long conversation titles truncate, and safe-area insets protect the composer and sheet. The sheet is visibly a dialog, with a close button, not a fake draggable handle. Short viewports and visual-viewport changes should leave the composer reachable while the message log scrolls.
