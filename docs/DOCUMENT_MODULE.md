# Documents — Page Guide

Documents is Jiganto’s rich-text document workspace — folders, pages, templates, versions, comments, tags, file uploads, sharing, and sign-off integration.

**Routes:** `/modules/documents` or `/documents`  
**Public read-only view:** `/public/documents/:token` (no login)

**Access:** Any user with the Documents module enabled for their organisation.

---

## Before any document is open

When nothing is selected in the main area, you see **Document Management** with:

- **New Document** — create a blank page or from a template
- **New Folder** — create a folder at the current location

Use the **Explorer** (left panel) or header buttons to browse folders and open a page.

**Tip:** Single-click a document in Explorer to **preview**; double-click to **edit** immediately.

---

## Page layout

The Documents page has three main areas:

| Area | Location | Purpose |
|------|----------|---------|
| **Explorer panel** | Left (resizable) | Folder tree, quick-access chips, search |
| **Main content** | Centre | Welcome screen, document editor, or file preview |
| **Header bar** | Top | Breadcrumbs, create/import actions, global search |

**Header actions** (below the **Documents** title):

| Button | Action |
|--------|--------|
| **Folder** | Create a new folder |
| **New Page** | Create a new document |
| **Templates** | Open Template Manager |
| **Import Word** | Upload a `.docx` file and convert it |

**Global search** (top right of header): type 3+ characters to search all documents by title.

---

## 1. Explorer panel

**What it is:** Your navigation sidebar — recent docs, starred docs, shared docs, and the folder tree.

**What you see:**

- **Search documents…** — filter explorer results locally
- Quick-access chips:
  - **Recent** — documents you viewed recently
  - **Starred** — documents you favourited
  - **Shared with me** — documents shared to you via access control
- **Folders** tree — nested folders with documents and uploaded files
- Footer buttons: **New folder** and **New doc**

**What you can do:**

- Click a document row → open in **preview** mode
- Double-click a document row → open in **edit** mode
- Click a folder → navigate into that folder (breadcrumb updates)
- Click the chevron on a folder → expand/collapse children
- Right-click (context menu) on a document or folder → Rename, Share, Download, Move, Delete
- Drag a folder onto another folder → move it in the hierarchy
- Click **PanelLeftClose** (top right of Explorer) → hide the panel; use **PanelLeft** in the header to show it again

---

## 2. Create a folder

**How to open:** **Folder** (header), **New folder** (Explorer footer), or **New Folder** (welcome screen).

**Steps:**

1. Enter **Folder Name**
2. Pick a **Folder Color** (8-color swatch)
3. Choose **Location** — Root or an existing parent folder
4. Click **Create Folder**

**To edit a folder later:** Right-click folder → **Rename Folder** (or **⋯** menu on folder card). Change name and color, then click **Save**.

---

## 3. Create a document

**How to open:** **New Page** (header), **New doc** (Explorer footer), or **New Document** (welcome screen).

**Steps:**

1. Enter **Document Title** (defaults to “Untitled” if blank)
2. Choose **Type** — Document, Wiki Page, SOP, Policy, Contract, or Template
3. Optionally pick a **Start from Template** card (or leave **Blank Document** selected)
4. Click **Create**

The new document opens in the editor in the current folder (breadcrumb location).

---

## 4. Import a Word document (.docx)

**How to open:** **Import Word** (header).

**Steps:**

1. Click **Import Word** and select a `.docx` file from your computer
2. Wait for conversion (button shows **Converting…**)
3. In the **Import Word Document** dialog, review the title and preview
4. Choose target folder if prompted
5. Click **Import**

The imported document opens in the editor. Images embedded in the Word file are uploaded automatically when possible.

---

## 5. Template Manager

**How to open:** **Templates** (header).

**Browse tab:**

- Lists all saved templates with scope (global, department, module), department, and category badges
- **Use** a template when creating a document via **New Page** → template cards

**Create New tab:**

1. Enter **Template Name** and optional **Description**
2. Choose **Scope** — global, department, or module
3. Optionally set **Department** and **Category**
4. Click **Create Template** (saves from the currently open document’s content when created from the editor context)

---

## 6. Open and edit a document

**Open for preview:** Single-click a document in Explorer.

**Open for editing:**

- Double-click in Explorer, or
- Click **Edit Document** in the document header bar

**Document header bar** (top of editor):

| Button | Action |
|--------|--------|
| **← Back** | Return to welcome / folder view |
| **Edit Document** | Enter edit mode (read-only → editable) |
| **Save** | Save content manually (autosave also runs while editing) |
| **Save As** | Duplicate document under a new title/folder |
| **Cancel** | Discard unsaved edits and return to preview |
| **Download** | Download plain-text copy |
| **Share** | Open share dialog |
| **Star** | Add/remove from Starred |
| **⋯** | Rename, Share Link, Download, Move to Folder, Delete |

**Autosave:** While editing, a **Saving…** / **Autosaved** indicator appears next to the Save button.

**Rename inline:** Click the document title below the header bar, type a new name, press **Enter** or click the save icon.

**Status badge:** Click the status pill (e.g. **Draft**) to change workflow status.

---

## 7. Document tabs

Below the title row, five tabs organize document details:

| Tab | What you see / do |
|-----|-------------------|
| **Content** | Rich-text editor (TipTap) |
| **Comments** | Threaded comments; add general or anchored comments |
| **History** | Version list with change descriptions and timestamps |
| **Properties** | Status, owner, dates, version, folder, views, word count, reading time, template source, tags |
| **Sign-off** | E-sign requests linked to this document |

---

## 8. Rich-text editor (Content tab)

**What it is:** A full word-processor-style editor with formatting toolbar, slash commands, and special blocks.

### Toolbar highlights

| Control | Action |
|---------|--------|
| Bold / Italic / Underline / Strikethrough | Text formatting |
| Headings / Font / Size / Color | Typography |
| Lists / Indent / Align | Structure |
| Link / Image | Insert hyperlinks and images |
| Table | Insert and edit tables |
| **Insert blocks** dropdown | Callouts, collapsible sections, video, math |
| **TOC** | Table of contents from headings |
| **Find / Replace** | Search within the document |
| **Print preview** | Page layout preview before printing |
| **Export** dropdown | PDF, Word (.docx), HTML, Markdown |
| **Comment** | Anchor a comment to selected text |
| **Send for Sign-off** | Jump to E-Sign module with this document attached |

### Slash commands

Type `/` at the start of a line (or after a space) to open the command menu:

- Headings (H1–H3), lists, task list, blockquote, code block, divider
- **Callout — Info / Warning / Success / Danger** (RAG blocks)
- **Collapsible** — expandable section with editable title
- **Video** — embed YouTube or Vimeo URL
- **Math / LaTeX** — formula block

**Callout tip:** Click the callout icon once to cycle colour (info → warning → success → danger). **Ctrl+click** the icon to open the colour picker. Keyboard: **Ctrl+Shift+C** cycles type while cursor is inside a callout.

### Anchored comments

1. Select text in the editor
2. Click **Comment** in the toolbar
3. You are switched to the **Comments** tab with the selected quote shown
4. Type your comment and click **Comment**

---

## 9. Comments tab

**What you see:**

- List of comments with author, timestamp, and optional anchored quote
- Input box at the bottom

**Steps to add a general comment:**

1. Open the **Comments** tab
2. Type in **Add a comment…**
3. Click **Comment**

Anchored comments show the quoted text in an amber block above the comment body.

---

## 10. History tab

**What you see:** All saved versions (`v1`, `v2`, …) with change description and date.

Versions are created automatically when content changes on save. Use this tab to audit what changed and when.

---

## 11. Properties tab

**What you see:**

| Field | Description |
|-------|-------------|
| **Status** | Draft, Under Review, Awaiting Approval, Published, Archived |
| **Created By** | Document owner |
| **Created / Last Modified** | Timestamps |
| **Version** | Current version number |
| **Location** | Parent folder |
| **Views** | View count |
| **Word count** | Live count from content |
| **Reading time** | Estimated minutes (~200 wpm) |
| **Template** | Source template name (if created from one) |
| **Tags** | Colour-coded tag summary |
| **Description** | Optional document description |

Click the **Status** badge here (same options as the header badge) to update workflow state.

---

## 12. Sign-off tab

**What it is:** Tracks e-sign requests created from this document.

**Empty state:** Click **Start Sign-off Request** → opens **E-Sign** module with this document pre-attached.

**With requests:** Each card shows title, status (Draft / Pending / Completed / Cancelled), signers, and **Remind** for pending signers.

**From editor:** Click **Send for Sign-off** in the Content toolbar for the same flow.

---

## 13. Tags

Tags appear in two places:

1. **Inline tags bar** (above editor, below tabs) — add/remove tags while editing
2. **Properties tab** — read-only tag summary

**To add a tag:**

1. In the inline tags section, type a tag name
2. Optionally pick a colour from the colour button
3. Press **Enter** or confirm add

Tags are stored on the document metadata and shown as coloured badges in the header (up to 3 visible).

---

## 14. Share a document or folder

**How to open:** **Share** icon (document header), **Share Link** in **⋯** menu, or right-click → **Share Link**.

**Internal link (requires login):**

- Copy the `/modules/documents?document=ID` link
- **Share via Email** opens your mail client
- **Open in New Tab** opens the link

**Public link (documents only, no login):**

1. In the share dialog, under **Public link (no login required)**, click **Generate public link**
2. Copy the `/public/documents/:token` URL
3. Share externally — recipients see a read-only HTML page
4. Click **Revoke** to disable the public link

---

## 15. Export a document

**How to open:** **Export** dropdown in the editor toolbar (visible in edit/preview modes when a document is open).

| Format | Result |
|--------|--------|
| **PDF** | Server-generated PDF download (falls back to browser print if server export unavailable) |
| **Word (.docx)** | Download formatted Word file |
| **HTML** | Standalone `.html` file with styles |
| **Markdown** | `.md` file with heading/list conversion |

---

## 16. Upload and preview files

**How to upload:** **Upload** (folder list quick actions) or right-click folder → **Upload File**. Select one or more files (max 50 MB each).

**Uploaded files** appear in the folder tree and in the **Uploaded Files** table when browsing a folder.

**To preview a file:** Click the file row in Explorer or the files table.

| File type | Preview |
|-----------|---------|
| Images | Inline image |
| PDF | Rendered page canvas |
| Word / Excel / PowerPoint | Converted preview (text, tables, slides) |
| Other | Download prompt |

**File preview header:** **Download** and **Delete** buttons.

---

## 17. Move, favourite, and delete

| Action | How |
|--------|-----|
| **Favourite** | Star icon in document header, or star in document list row |
| **Move to Folder** | **⋯** menu → **Move to Folder** → pick destination |
| **Move folder** | Folder **⋯** menu → **Move Folder** |
| **Delete document** | **⋯** menu → **Delete** (or right-click → Delete) |
| **Delete folder** | Folder **⋯** menu → **Delete** |

---

## 18. Breadcrumb navigation

Below the header, breadcrumbs show your path: **Home › Folder › Subfolder**.

- Click any crumb to jump to that folder
- Opening a document does not change the breadcrumb folder context until you go back

---

## Document status workflow

| Status | Typical use |
|--------|-------------|
| **Draft** | Work in progress |
| **Under Review** | Ready for peer review |
| **Awaiting Approval** | Waiting for sign-off or manager approval |
| **Published** | Approved and live |
| **Archived** | Retired / historical |

Change status from the badge under the document title or in the **Properties** tab.

---

## Shared behaviour

- **Autosave** — content saves automatically ~1.5 s after you stop typing while editing
- **Deep links** — `?document=ID` or `?folder=ID` query params open the right item
- **Loading states** — skeletons and spinners while folders, lists, and tabs load
- **Drag-and-drop** — reorder folders in the tree by dragging onto a new parent
- **Context menus** — right-click documents, folders, and files for quick actions

---

## Glossary

| Term | Meaning |
|------|---------|
| **Page / Document** | A rich-text document stored in the `documents` table |
| **Folder** | Container for documents and uploaded files |
| **Template** | Reusable starting content for new documents |
| **Version** | Snapshot of document content at a point in time |
| **Anchored comment** | Comment tied to a specific text selection |
| **Callout (RAG)** | Coloured info/warning/success/danger block |
| **Public link** | Token-based read-only URL without login |
| **Uploaded file** | Binary attachment (PDF, image, Office file, etc.) separate from rich-text pages |

---

## Quick reference

| Where | Button / action | Result |
|-------|-----------------|--------|
| Header | **Folder** | New folder dialog |
| Header | **New Page** | New document dialog |
| Header | **Templates** | Template Manager |
| Header | **Import Word** | Import `.docx` |
| Header search | Type 3+ chars | Search all documents |
| Explorer | **Recent / Starred / Shared** chips | Filter quick-access list |
| Explorer | Single-click doc | Preview document |
| Explorer | Double-click doc | Edit document |
| Explorer footer | **New folder / New doc** | Create in current folder |
| Document header | **Edit Document** | Enter edit mode |
| Document header | **Save** | Save content now |
| Document header | **Save As** | Duplicate document |
| Document header | **Share** | Share dialog (internal + public) |
| Document header | **Star** | Favourite document |
| Editor toolbar | **Export** | PDF / Word / HTML / Markdown |
| Editor toolbar | **Comment** | Anchor comment to selection |
| Editor toolbar | **Send for Sign-off** | Open E-Sign compose |
| Editor | Type `/` | Slash command menu |
| Callout block | Click icon | Cycle callout colour |
| Comments tab | **Comment** button | Post comment |
| Properties tab | Status badge | Change workflow status |
| Share dialog | **Generate public link** | No-login read-only URL |

---

## API overview (for developers)

Key endpoints used by the page:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/documents/folders` | Folder tree |
| `GET /api/documents` | Documents in folder |
| `GET /api/documents/search?q=` | Global search |
| `GET /api/documents/recent` | Recent documents |
| `GET /api/documents/favorites` | Starred documents |
| `GET /api/documents/shared-with-me` | ACL-shared documents |
| `POST /api/documents` | Create document |
| `POST /api/documents/:id/content` | Save HTML content |
| `GET /api/documents/:id/export-pdf` | Server-side PDF |
| `GET/POST/DELETE /api/documents/:id/public-token` | Public link management |
| `GET /public/documents/:token` | Public read-only view |
| `GET/POST /api/documents/:id/comments` | Comments |
| `GET /api/documents/:id/versions` | Version history |
| `GET/POST /api/documents/templates` | Templates |
| `POST /api/documents/upload-image` | Editor image upload |
| `POST /api/document-files/upload` | File attachment upload |

---

## Admin / configuration (optional)

| Feature | Requires |
|---------|----------|
| Basic documents, folders, editor | Nothing extra |
| Server-side PDF export | Chrome/Chromium installed on server (`puppeteer-core`) |
| Word import | `mammoth` (bundled) |
| Word export | `docx` package (client-side generation) |
| Public share links | Document metadata storage (no extra service) |
| Sign-off integration | E-Sign module enabled |
| Shared with me | ACL entry with `subjectType: user` and `subjectId` set to the recipient |
