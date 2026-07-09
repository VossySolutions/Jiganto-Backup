Hi Peter,

Found it — thanks for the print dialog screenshot, that was the giveaway.

*What was actually happening*
The "2 headers and 2 footers" on the PDF was your Page header/footer content PLUS the browser's own default print header/footer (the date/title top corners and the "about:blank" / page number bottom corners). That combination only shows up when the PDF generator on the server can't run and it quietly falls back to a plain browser print — which is what was happening.

*Fix*
The PDF generator no longer depends on a browser being separately installed on the server — it now uses its own built-in one, so it always runs properly. No more fallback, no more double header/footer, and your header/footer repeat cleanly on every page as designed.

*Word*
Glad that one's coming out perfect. Added the font size option you asked about — when you click Export → Word (.docx), you'll now get a quick prompt to pick the body text size (9–16pt, default 11pt) before it downloads. Headings scale with it automatically, header/footer stay a bit smaller regardless (like a normal Word running header/footer).

Please try the PDF export again on that same document and let me know.
