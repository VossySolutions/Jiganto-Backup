# Manual test — 20 client feedback images

Quick checklist. Tick each box as you test.

---

## Dashboard (Images 1–2)

- [ ] Open **Dashboard** → click **Configure** (cog icon shows)
- [ ] Dashboard dropdown has shaded sections (System / Module / My dashboards)
- [ ] In Configure → pick a **custom dashboard** → rename, change layout, or delete works
- [ ] Custom dashboard **1 / 2 / 3 column** layouts look different (not all the same)
- [ ] **Edit layout** on a custom dashboard uses the same grid as view mode
- [ ] Configure → **Modules** tab hides/shows modules on All Modules grid (sidebar unchanged)
- [ ] Configure → **Settings** vs **Modules** descriptions make sense
- [ ] Configure → **Widgets** tab explains built-in vs custom widgets

---

## Chat (Image 3)

- [ ] Outgoing messages use **soft indigo** bubbles (not dark solid purple)
- [ ] Sidebar unread badges and selected channel use **lighter indigo** accents

**Skip (needs setup, not a code bug):**

- User management / adding chat users (needs admin users configured)

---

## Documents (Images 4–9)

- [ ] No extra **New folder** / **Create document** buttons in folder list or empty state
- [ ] **Recent docs** — blue tip explains Hide/Show; sidebar header has **Hide** / **Show** label + chevron (like folders)
- [ ] Open a doc → **Close** (X) in toolbar returns to explorer
- [ ] Save uncategorised doc → can **rename** in the save dialog
- [ ] Import Word → guidance text shows before import
- [ ] In editor: select an image → **Delete** or **Backspace** removes it
- [ ] **Export → Word (.docx)** downloads without error; headings/tables look OK
- [ ] Link `/modules/documents?document=123` **and** `?doc=123` both open the doc
- [ ] Doc → **Versions** tab → **Restore** on an older version works
- [ ] Floating **AI assistant** button is **hidden** on Documents page (no overlap with Save)

**Skip (needs setup, not a code bug):**

- E-Sign tab (separate module)

---

## Customer Management (Images 10–12)

- [ ] Open a customer → **Notes** panel → add a note → it saves

- [ ] **Health scores** → click action (e.g. Schedule check-in) → **dialog** opens with explanation + note field → Confirm logs the action

- [ ] **Renewal pipeline** → same follow-up dialog works

**Skip (needs live data):**

- Image 10 was positive feedback only — billing KPIs need demo/live billing data

---

## Business (Images 13–20)

- [ ] Only **one** AI Insights entry point (no duplicate tab/button)
- [ ] **Dashboard** tab → **Configure data** button goes to Strategy Map
- [ ] Open any strategy item → **Created by** name shows in metadata
- [ ] **Strategy Map** → owners show on cells (not only wide cells)
- [ ] Strategy Map toolbar is **one compact row**; Import / Export / Group are **icon-only**
- [ ] **KPIs** tab → status filter has correct labels (no “All Statuss” typo); RAG filter works; table headers stick on scroll
- [ ] **Reviews** → edit your own check-in note → save works
- [ ] **Initiative** detail → can link to a **project** from picker
- [ ] **Documents** tab → link doc to initiative; **copy link** and **open** buttons work
- [ ] **Documents → Strategy Links** → add **Jiganto document** link (picker, not URL only)
- [ ] Strategy Links row → **copy link** icon copies URL
- [ ] Floating **AI assistant** hidden on Business page (no overlap)

---

## Global

- [ ] **Global search** → document result opens the right doc in Documents module

---

## Done?

If all checked boxes pass, the 20-image feedback is verified.

Items under **Skip** need environment setup, not more app fixes.
