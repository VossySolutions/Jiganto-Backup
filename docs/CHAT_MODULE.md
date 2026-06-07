# Chat — Page Guide

Chat is team messaging inside Jiganto — direct messages, channels, threads, reactions, polls, and optional Slack/Teams bridges.

**Route:** `/modules/chat` (opens a conversation at `/modules/chat/:channelId`)

**Access:** Any user with the Chat module enabled for their organisation.

---

## Before any conversations exist

When you have no chats or channels yet, the main area shows **Welcome to Chat** with:

- **Create channel** — add a company or team channel
- **Start a chat** — open a direct message with someone

You can also use the header buttons **New Chat**, **New Team**, or **New Channel** (see below).

---

## Page layout

The Chat page has four main areas:

| Area | Location | Purpose |
|------|----------|---------|
| **Conversations sidebar** | Left | Browse favourites, DMs, teams & channels |
| **Message thread** | Centre | Read and interact with messages |
| **Message compose** | Bottom centre | Type and send messages |
| **Right panel** | Right (optional) | Thread, search, members, pins, or bridge settings |

Header actions (top of page, next to **Chat** title):

- **New Chat** — start a direct message
- **New Team** — create a team with a default `#general` channel
- **New Channel** — create a public, private, or announcement channel

---

## 1. Conversations sidebar

**What it is:** Your inbox — every chat and channel in one list.

**What you see:**

- **Search channels…** — filter the list by name or last message
- **+** (top right of sidebar) — shortcut to **Create channel**
- Three collapsible sections:
  - **Favourites** — starred conversations
  - **Chats** — direct messages (green dot = online)
  - **Teams & Channels** — grouped under **Company** or team names
- Unread counts on each row and section headers
- Icons: `#` public, lock private, megaphone announcement, person DM, link badge = Slack/Teams bridge active

**What you can do:**

- Click a row to open that conversation
- Hover a row and click the **star** to add/remove from **Favourites**
- Click section headers to expand/collapse
- In **Chats**, click **+** to start a new DM (same as **New Chat**)

---

## 2. Message thread

**What it is:** The active conversation — all messages for the selected channel or DM.

**What you see:**

- Channel name and type icon in the header
- **Slack** or **Teams** badge if a bridge is active
- Date dividers between days
- Message bubbles with author, time, reactions, thread reply counts
- **Jiganto AI** label on bot/AI replies (summaries, `@jiganto` answers)
- Images and file attachments inline
- **Pinned** label on pinned messages
- **Jump to bottom** when you scroll up
- **Load older messages** at the top when history is long
- Typing indicator at the bottom (e.g. “Alex is typing…”)
- Amber banner on **announcement** channels if you are not an admin (read-only)

**Header buttons (left to right):**

| Button | Opens |
|--------|--------|
| **Summarise unread** | AI summary of unread messages (only when AI is configured and you have more than 10 unread) |
| Search icon | **Search** panel — find messages in this channel |
| Pin icon | **Pinned messages** panel |
| People icon | **Members & notifications** panel |
| Settings icon | **Bridge connection** panel |

**On each message (hover to show toolbar):**

| Button | Action |
|--------|--------|
| Smile | Add a reaction (quick emoji picker) |
| Reply | Open **Thread** panel for that message |
| Pin / Unpin | Pin or unpin the message |
| Trash | Delete your own message |
| Reaction chips below message | Click to add/remove your reaction |

**On poll messages:** Vote using the poll card (options, live counts, time remaining).

---

## 3. Message compose

**What it is:** Where you write and send messages.

**What you see:**

- Text area with placeholder (channel name or “Select a conversation”)
- Pending attachment chips above the box (after upload, before send)
- Toolbar inside the input area

**Toolbar buttons:**

| Button | Action |
|--------|--------|
| **Aa** | Show/hide formatting bar (bold, italic, code, quote, list) |
| Paperclip | Attach files (images show inline; other files as download links) |
| Smile | Insert emoji |
| @ | Start a mention — pick someone from the list |
| Bar chart | **Create poll** dialog |
| Send (purple) | Send message (or **Enter**; **Shift+Enter** for new line) |

**What you can do:**

- Send text only, attachments only, or both
- Mention people with `@Name` (autocomplete after `@`)
- Ask **@jiganto** a question in the message (AI reply appears in the thread when configured)
- In **announcement** channels, compose is disabled unless you are a channel admin

---

## 4. Start a conversation (New Chat)

**How to open:** **New Chat** (header) or **+** next to **Chats** in the sidebar.

**Steps:**

1. Type at least **2 characters** in **Search users…**
2. Click a person in the results
3. You are taken to the new DM

---

## 5. Create channel

**How to open:** **New Channel** (header) or **+** (sidebar header).

**Steps:**

1. Enter **Channel name** (e.g. `general`)
2. Choose **Type:**
   - **Public** — anyone in the org can see and join
   - **Private** — members only
   - **Announcement (admins only)** — only channel admins can post; others read only
3. Optionally pick a **Team** (or leave **Company-wide**)
4. Click **Create channel**

---

## 6. Create team

**How to open:** **New Team** (header).

**Steps:**

1. Enter **Team name** and optional **Description**
2. Optionally tick **Private team**
3. Click **Create team**

A team is created with a default `#general` channel and you are opened into it.

---

## 7. Create poll

**How to open:** Bar chart icon in the message compose toolbar (channel must be selected).

**Steps:**

1. Enter **Question**
2. Fill **Option 1**, **Option 2**, and use **+ Add option** (up to 6)
3. Choose duration: 15 min, 1 hour, 24 hours, or 1 week
4. Optionally tick **Anonymous votes**
5. Click **Post poll**

The poll appears as a message in the channel; members vote from the poll card.

---

## 8. Thread panel (right)

**How to open:** Click **Reply** on a message, or click “N replies” under a message.

**What you see:**

- Original message at the top
- All thread replies below
- Reply box at the bottom

**What you can do:**

- **Summarise thread** — AI summary of the whole thread (when AI is configured)
- Type a reply and press **Enter** or click **Send**
- Close with **X** on the panel header

---

## 9. Search panel (right)

**How to open:** Search icon in the message thread header.

**Steps:**

1. Type at least **2 characters** in **Search in channel…**
2. Click a result to jump to that message (when jump is wired)

---

## 10. Members & notifications (right)

**How to open:** People icon in the message thread header.

**What you see:**

- **Notification preference** dropdown
- List of channel members with roles

**Notification options:**

| Setting | You get notified for |
|---------|----------------------|
| **All messages** | Every new message |
| **Mentions only** | When someone @mentions you (default) |
| **Nothing** | No notifications |
| **Muted** | Channel muted |

Changes save when you pick a new option.

---

## 11. Pinned messages (right)

**How to open:** Pin icon in the message thread header.

**What you see:** List of pinned messages with author, time, and preview.

**What you can do:** Pin/unpin from the message hover toolbar; pinned items also appear here.

---

## 12. Bridge connection (right)

**How to open:** Settings (gear) icon in the message thread header.

**What it is:** Forward Jiganto channel messages to Slack or Microsoft Teams.

**Steps:**

1. Choose **Provider** — Microsoft Teams or Slack
2. **Teams:** paste **Incoming webhook URL**
3. **Slack:** enter **Slack channel ID**
4. Toggle **Bridge active**
5. Click **Save bridge**

**Note:** Workspace-level tokens (`SLACK_BOT_TOKEN`, default Teams webhook) are set in server `.env` by admins. Per-channel settings are saved here.

A green **Slack** / **Teams** badge on the channel means the bridge is active.

---

## 13. AI features

Requires `OPENAI_API_KEY` on the server (see `.env.example`).

| Feature | How to use |
|---------|------------|
| **Summarise unread** | Header button when you have **more than 10** unread messages — posts a pinned AI summary |
| **Summarise thread** | **Summarise thread** button at top of the **Thread** panel |
| **Ask Jiganto** | Include `@jiganto` in your message — AI replies in the channel |

AI messages show a **Jiganto AI** label.

---

## 14. Attachments

**How to send:**

1. Click **Paperclip** in compose
2. Select one or more files
3. Files appear as chips above the input
4. Click **Send**

**Limits:** Configurable via `CHAT_MAX_ATTACHMENT_MB` and `CHAT_MAX_ATTACHMENTS_PER_MESSAGE` (defaults 50 MB, 5 files).

**What you see:** Images inline; other files as clickable file cards.

---

## Shared behaviour (every conversation)

- **Real-time updates** — new messages, reactions, and deletes appear live (WebSocket; optional Supabase Realtime)
- **Read state** — opening a channel marks it read; unread badges clear in the sidebar
- **Deep links** — URL updates to `/modules/chat/:channelId` when you switch conversations
- **Favourites** — persist per browser (star/unstar)
- **Section expand/collapse** — sidebar sections remember your preference

---

## Glossary

| Term | Meaning |
|------|---------|
| **Channel** | A named room for a team or company (`#general`, etc.) |
| **DM / Chat** | Direct message between two people |
| **Team** | A project group with its own channels (shown under team name in sidebar) |
| **Thread** | Replies tied to one message, shown in the right panel |
| **Announcement channel** | Broadcast-only channel; only admins post, everyone else reads |
| **Bridge** | Forward messages to Slack or Teams |
| **Pin** | Keep an important message easy to find in the **Pinned messages** panel |

---

## Quick reference

| Where | Button / action | Result |
|-------|-----------------|--------|
| Header | **New Chat** | DM with a colleague |
| Header | **New Team** | Team + `#general` channel |
| Header | **New Channel** | Public / private / announcement channel |
| Sidebar | **+** (top) | Create channel |
| Sidebar | **+** (Chats) | New DM |
| Sidebar | Star on row | Favourite / unfavourite |
| Thread header | Search | Search in channel |
| Thread header | Pin | Pinned messages |
| Thread header | People | Members & notification prefs |
| Thread header | Settings | Slack/Teams bridge |
| Thread header | **Summarise unread** | AI unread summary (10+ unread) |
| Message hover | Reply | Open thread |
| Message hover | Pin | Pin message |
| Compose | Paperclip | Attach files |
| Compose | Bar chart | Create poll |
| Compose | Send / Enter | Send message |
| Thread panel | **Summarise thread** | AI thread summary |

---

## Admin / configuration (optional)

These features work without extra setup except where noted:

| Feature | Requires |
|---------|----------|
| Basic chat, threads, reactions, polls | Nothing extra |
| AI summarise & `@jiganto` | `OPENAI_API_KEY` in `.env` |
| Slack outbound | `SLACK_BOT_TOKEN` + channel bridge config |
| Teams outbound | Webhook URL per channel (or `TEAMS_INCOMING_WEBHOOK_URL`) |
| Inbound Slack/Teams messages | `CHAT_BRIDGE_INCOMING_SECRET` + webhook to `/api/chat/bridges/incoming` |
| Supabase Realtime | `CHAT_USE_SUPABASE_REALTIME=true` + replication on `chat_messages` |

See `.env.example` for all Chat-related variables.
