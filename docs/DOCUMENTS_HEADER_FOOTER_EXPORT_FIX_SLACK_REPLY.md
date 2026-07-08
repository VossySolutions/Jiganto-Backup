Hi Peter,

You're right, and thanks for the example — that made it click. What we had was showing the header/footer once at the top/bottom of the document, not repeating on every page like a real Word/PDF header & footer. That's now fixed:

*What changed*
• Header now repeats at the top of every page, footer at the bottom of every page — in both the Word (.docx) export and the PDF export
• Fixed a bug where the header text could appear twice on a page (once in the true page header, once inline in the body)
• Made the server-side PDF generation more reliable so it doesn't silently fall back to a plain browser print
• Even the plain browser-print fallback now repeats the header/footer per page (uses the same trick Word documents use)

*Left / middle / right*
You can now position header and footer text using align buttons (left, centre, right) right in the header/footer box — same as Word's header/footer alignment. Look for the small toolbar above the Page header / Page footer box (Bold, Italic, Underline, then the 3 align icons).

Give it another try on a multi-page document and let me know how it looks.
