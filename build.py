"""Static site generator. Run: python build.py   (set SITE_URL for production)"""
import json, os, html
ROOT = os.path.dirname(os.path.abspath(__file__))
SITE_URL = os.environ.get("SITE_URL", "http://localhost:8080").rstrip("/")
NAME = "pdf pangea"

# slug, short title, emoji, colour, card text, h1, intro, steps, faqs, scripts
T = [
 ("merge-pdf","Merge PDF","⛓","#b5532f","Combine several PDFs into one.","Merge PDF files online, free",
  "Combine multiple PDF files into a single document in the order you want. It runs entirely in your browser – your files are never uploaded.",
  ["Add two or more PDF files.","Drag them (or use the arrows) into the right order.","Click “Merge PDFs” and download the result."],
  [("Is there a limit on files or size?","No fixed limit. Because everything runs on your device, the only limit is your computer's memory."),("Are my PDFs uploaded anywhere?","No. Merging happens locally in your browser.")],"merge"),
 ("split-pdf","Split PDF","✂","#6c7a3b","Separate pages or ranges into new files.","Split a PDF into several files",
  "Cut a PDF into separate documents by page ranges, every N pages or one file per page – privately, on your device.",
  ["Add a PDF.","Choose how to split: ranges like 1-3, 4-6, every N pages, or every page.","Download each file or all of them as a ZIP."],
  [("Can I split by custom ranges?","Yes – enter comma-separated ranges such as 1-3, 4-6, 7-. Each range becomes its own PDF.")],"split"),
 ("remove-pages","Remove pages","🗑","#8f3e20","Delete unwanted pages from a PDF.","Remove pages from a PDF",
  "Delete one or many pages from a PDF in seconds. Just type the page numbers or ranges to drop.",
  ["Add your PDF.","Enter the pages to remove, e.g. 2, 5-7.","Download the cleaned-up PDF."],
  [("Does it change the remaining pages?","No. Remaining pages are copied unchanged, so text and quality stay intact.")],"remove-pages"),
 ("extract-pages","Extract pages","📑","#d49a3a","Pull selected pages into a new PDF.","Extract pages from a PDF",
  "Create a new PDF containing only the pages you pick. Page order follows what you type.",
  ["Add your PDF.","Enter the pages you want, e.g. 1, 3-5.","Download the new PDF."],
  [("Can I reorder while extracting?","Yes – entering “3,1” puts page 3 before page 1.")],"extract-pages"),
 ("organize-pdf","Organize PDF","🗂","#6c7a3b","Reorder, rotate and delete pages visually.","Organize PDF pages – reorder, rotate, delete",
  "See every page as a thumbnail. Drag to reorder, rotate or delete pages, then save your new PDF.",
  ["Add your PDF and wait for thumbnails.","Drag pages, rotate with ⟳, delete with ✕.","Click “Save PDF”."],
  [("Does it work with large PDFs?","Yes, thumbnails are rendered one at a time to keep memory low.")],"organize"),
 ("sign-pdf","Sign PDF","✍","#6c7a3b","Add your drawn signature to a PDF locally.","Sign a PDF online for free",
  "Draw your signature and add it to selected PDF pages. Your document and signature stay on your device.",
  ["Add a PDF and draw your signature with a finger, mouse or stylus.","Choose pages to sign, or leave the field empty to sign every page.","Download your signed PDF."],
  [("Where is the signature placed?","It is placed near the bottom-right of every selected page. The tool does not provide a legally qualified electronic signature.")],"sign-pdf"),
 ("rotate-pdf","Rotate PDF","⟳","#b5532f","Turn pages 90°, 180° or 270°.","Rotate PDF pages",
  "Fix sideways scans by rotating all pages – or only selected ones – permanently.",
  ["Add your PDF.","Choose the angle and optionally the pages.","Download the rotated PDF."],
  [("Can I rotate only some pages?","Yes, type the pages (e.g. 2-4) or leave empty for all.")],"rotate"),
 ("compress-pdf","Compress PDF","🗜","#8f3e20","Make PDFs smaller for email and upload.","Compress PDF to a smaller size",
  "Shrink PDF file size right in your browser. Choose a light lossless pass or stronger compression that re-renders pages as optimised images.",
  ["Add your PDF.","Pick a compression level.","Download the smaller file – we keep the original if we can't improve it."],
  [("Will text stay selectable?","If you choose “Optimise structure only”, yes. Re-rendering pages as images gives much smaller files, but text is no longer selectable. You can set DPI and image quality and see an estimated size first.")],"compress"),
 ("pdf-to-jpg","PDF to JPG","🖼","#d49a3a","Turn every page into an image.","Convert PDF to JPG or PNG",
  "Export each PDF page as a high-quality JPG or PNG image, locally and without uploads.",
  ["Add your PDF.","Choose format and quality.","Download images individually or as a ZIP."],
  [("What resolution should I pick?","150 dpi is good for screens; 300 dpi for print.")],"pdf-to-jpg"),
 ("jpg-to-pdf","JPG to PDF","📷","#6c7a3b","Combine images into a PDF.","Convert JPG, PNG and other images to PDF",
  "Turn photos and scans (JPG, PNG, WebP, GIF, BMP) into one PDF. Set page size, margins and order.",
  ["Add your images.","Arrange the order and choose page size.","Click “Create PDF”."],
  [("Which image formats work?","JPG, PNG, WebP, GIF and BMP – anything your browser can display.")],"jpg-to-pdf"),
 ("pdf-to-gif","PDF to GIF","🎞","#d49a3a","Turn pages into an animated GIF.","Convert PDF to animated GIF",
  "Turn the pages of a PDF into an animated GIF slideshow, with your own speed and size. Private and in your browser.",
  ["Add your PDF.","Choose the speed, width and which pages to include.","Click “Create GIF” and download it."],
  [("Can I pick which pages go in?","Yes, type ranges like 1-3, 5 or leave it empty for every page."),("Why is my GIF big?","GIFs are large by nature. Lower the width or the page count to shrink it.")],"pdf-to-gif"),
 ("gif-to-pdf","GIF to PDF","🧩","#8f3e20","Turn GIF frames into PDF pages.","Convert animated GIF to PDF",
  "Split an animated GIF into its frames and put them into a PDF – one page per frame. Everything stays on your device.",
  ["Add your GIF.","Choose page size and how many frames to keep.","Click “Create PDF”."],
  [("Does a PDF animate?","No, a PDF cannot play animation. Each GIF frame becomes its own page.")],"gif-to-pdf"), ("watermark-pdf","Add watermark","💧","#b5532f","Stamp text across every page.","Add a text watermark to a PDF",
  "Add a diagonal or horizontal text watermark with custom size, colour and opacity to every page.",
  ["Add your PDF.","Type the text and style it.","Download the watermarked PDF."],
  [("Can I use any characters?","The built-in font supports Latin characters.")],"watermark"),
 ("add-page-numbers","Page numbers","🔢","#8f3e20","Number your pages in seconds.","Add page numbers to a PDF",
  "Insert page numbers at any corner or centre, with formats like “Page 1 of 10” and a custom start number.",
  ["Add your PDF.","Choose position, format and start number.","Download the numbered PDF."],
  [("Can I start from a number other than 1?","Yes, set “Start at”.")],"page-numbers"),
 ("pdf-to-text","PDF to text","📝","#d49a3a","Extract the text from a PDF.","Extract text from a PDF",
  "Copy out all text from a PDF as a plain .txt file – nothing leaves your device.",
  ["Add your PDF.","Click “Extract text”.","Download the .txt file."],
  [("Does it work on scans?","Only if the PDF contains real text. Scanned images need OCR, which is not included.")],"pdf-to-text"),
]
def e(s): return html.escape(s, quote=True)
# Most searched PDF tasks first
ORDER = ["merge-pdf","compress-pdf","pdf-to-jpg","jpg-to-pdf","split-pdf","rotate-pdf","remove-pages","extract-pages","organize-pdf","sign-pdf","watermark-pdf","add-page-numbers","pdf-to-text","pdf-to-gif","gif-to-pdf"]
T.sort(key=lambda t: ORDER.index(t[0]))
LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#b5532f"/><path d="M9 7h9l5 5v13H9z" fill="#fffaf1"/><path d="M18 7v5h5" fill="#e4c9a0"/><path d="M12 17h8M12 21h6" stroke="#6c7a3b" stroke-width="1.8" stroke-linecap="round"/></svg>'

MENUS = [("Organize", ["merge-pdf","split-pdf","extract-pages","remove-pages","organize-pdf","rotate-pdf"]),
         ("Convert", ["pdf-to-jpg","jpg-to-pdf","pdf-to-text"]),
         ("Edit", ["sign-pdf","watermark-pdf","add-page-numbers"]),
         ("Optimize", ["compress-pdf"])]
def tool_link(s, cls=""):
    t = next(x for x in T if x[0] == s)
    return f'<a {cls} href="{s}.html" data-tool="{t[9]}">{t[2]} {t[1]}</a>'
def header():
    menus = "".join(f'<div class="menu"><button type="button">{n} ▾</button><div class="dd">{"".join(tool_link(s) for s in items)}</div></div>' for n, items in MENUS)
    return f'''<header class="site"><div class="bar"><a class="logo" href="index.html">{LOGO}{NAME}</a>
<a class="chip dn" href="support.html" data-donate-chip>*tips hat* 🎩</a><nav class="main"><a class="hide-s" href="privacy.html">Privacy</a></nav></div></header>'''
def footer():
    links = "".join(f'<a href="{s}.html">{t}</a>' for s,t,*_ in T[:6])
    return f'''<footer class="site"><div class="wrap"><div><strong>{NAME}</strong><br>Free PDF tools that run on your device.</div><div>{links}<a href="privacy.html">Privacy</a><a href="impressum.html">Impressum</a><a href="support.html">Support</a><a href="#" data-cookie-settings>Cookie settings</a></div></div></footer>'''

TODAY = __import__("datetime").date.today().isoformat()
def page(fn, title, desc, body, ld, scripts=("js/donate.js",), extra_head="", bcls="", robots="index,follow", kw=""):
    url = f"{SITE_URL}/{'' if fn=='index.html' else fn}"
    img = f"{SITE_URL}/og.png"
    seo = (f'<meta name="robots" content="{robots},max-image-preview:large,max-snippet:-1,max-video-preview:-1">'
           f'<meta name="author" content="Joshua Karan Singh"><meta name="application-name" content="{NAME}">'
           + (f'<meta name="keywords" content="{e(kw)}">' if kw else "") +
           f'<link rel="alternate" hreflang="en" href="{url}"><link rel="alternate" hreflang="x-default" href="{url}">'
           f'<meta property="og:locale" content="en_US"><meta property="og:image" content="{img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="{NAME} – free private PDF tools in your browser">'
           f'<meta name="twitter:image" content="{img}"><meta name="twitter:title" content="{e(title)}"><meta name="twitter:description" content="{e(desc)}">'
           '<link rel="apple-touch-icon" href="apple-touch-icon.png"><link rel="icon" href="icon-192.png" type="image/png" sizes="192x192"><meta name="format-detection" content="telephone=no">')
    ldj = "".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in ld)
    sc = "".join(f'<script src="{s}" defer></script>' for s in scripts)
    out = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-src 'none'"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)}</title><meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}"><meta name="theme-color" content="#b5532f">
<meta property="og:type" content="website"><meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{url}"><meta property="og:site_name" content="{NAME}">
<meta name="twitter:card" content="summary_large_image">{seo}<link rel="icon" href="favicon.svg" type="image/svg+xml"><link rel="manifest" href="manifest.webmanifest">
<link rel="preload" href="fonts/ebgaramond-latin-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/style.css">{extra_head}{ldj}</head><body class="{bcls}">
{header()}{body}{footer()}{sc}</body></html>'''
    open(os.path.join(ROOT, fn), "w", encoding="utf-8").write(out)

pages = ["index.html"]
org = {"@context":"https://schema.org","@type":"Organization","@id":SITE_URL+"/#org","name":NAME,"url":SITE_URL+"/","logo":{"@type":"ImageObject","url":SITE_URL+"/icon-512.png","width":512,"height":512},"email":"pdfpangea@gmail.com","founder":{"@type":"Person","name":"Joshua Karan Singh"},"address":{"@type":"PostalAddress","addressLocality":"Münster","postalCode":"48155","addressCountry":"DE"}}
SITE_KW = "pdf tools, merge pdf, split pdf, compress pdf, pdf to jpg, jpg to pdf, sign pdf, free pdf editor, offline pdf tools, private pdf tools, no upload"

EXTRA = {
"merge-pdf": ("Merge PDF online for free: combine PDF files into one document in seconds. No upload, no sign-up, no watermark – runs in your browser.", "merge pdf, combine pdf, join pdf files, pdf merger, merge pdf offline",
  ["Need to merge PDF files without emailing them to a stranger's server? pdf pangea joins invoices, scans, contracts and chapters into one PDF right on your device. Reorder the files by drag and drop or with the arrow buttons and the merged document keeps all pages, links and quality.",
   "Because the PDF merger works locally, it is as fast as your computer and works even when you are offline. There is no file size cap, no queue and no account."],
  [("How do I combine PDF files into one?","Add your PDFs, arrange them in the order you want and press “Merge PDFs”. The combined file downloads instantly."),("Does merging reduce quality?","No. Pages are copied as they are, so text, images and fonts stay identical.")]),
"compress-pdf": ("Compress PDF online: shrink PDF file size with your own DPI and quality, and see the estimated size before you start. Private, free, no upload.", "compress pdf, reduce pdf size, shrink pdf, pdf compressor, make pdf smaller, compress pdf offline",
  ["Too big to email? The PDF compressor lets you pick the exact resolution (DPI) and image quality and shows an estimated output size before you compress. Re-rendering pages as JPEG gives the smallest files; the structure-only mode keeps text selectable.",
   "Everything happens in your browser, so confidential scans and contracts are never uploaded. If the result would not be smaller, your original is kept."],
  [("How can I reduce PDF size without losing quality?","Use a higher DPI (150–200) and quality around 70–80%. Lower both for the smallest possible file."),("Is the file size estimate accurate?","It is based on rendering sample pages with your settings and is usually within about 20% of the real result.")]),
"pdf-to-jpg": ("Convert PDF to JPG or PNG online for free. Choose 96–300 dpi, download every page as an image or as one ZIP. No upload – 100% in your browser.", "pdf to jpg, pdf to png, convert pdf to image, pdf to jpeg, pdf to picture, extract images from pdf",
  ["Turn every page of a PDF into a sharp JPG or PNG. Pick the resolution from screen quality (96 dpi) up to print quality (300 dpi) and download the pages individually or all together in a ZIP file.",
   "Conversion is done locally with open-source PDF rendering, so your documents never leave your computer or phone."],
  [("Which resolution should I choose?","96 dpi for screens and chat apps, 150 dpi for general use, 300 dpi for printing."),("JPG or PNG?","JPG gives smaller files for photos and scans; PNG is lossless and best for text and graphics.")]),
"jpg-to-pdf": ("Convert JPG, PNG and other images to PDF online for free. Combine photos into one PDF in your browser – no upload, no sign-up, no watermark.", "jpg to pdf, png to pdf, image to pdf, photo to pdf, convert pictures to pdf, scan to pdf",
  ["Combine photos, scans and screenshots into a single PDF. Choose page size and margin, arrange the pictures in order and download the finished document.",
   "Images are converted on your device, which makes this image-to-PDF converter ideal for ID copies, receipts and other private documents."],
  [("Which image formats are supported?","JPG/JPEG and PNG directly; other formats your browser can display (such as WebP) are converted automatically."),("Can I put several images in one PDF?","Yes. Add as many as you like and set their order before converting.")]),
"split-pdf": ("Split PDF online for free: cut a PDF into separate files by page ranges, every N pages or one file per page. Private, in your browser, no upload.", "split pdf, divide pdf, separate pdf pages, pdf splitter, split pdf by page range, cut pdf",
  ["Break a large PDF into smaller documents. Split by custom page ranges such as 1-3, 5, 8-10, every N pages, or extract each page as its own file. Multiple results are bundled into a ZIP.",
   "The splitter runs locally, so even sensitive PDFs stay on your device."],
  [("How do I split a PDF by page range?","Choose “Custom ranges” and enter ranges like 1-3, 5, 8-10. Each range becomes its own PDF."),("Can I get every page as a separate PDF?","Yes, choose “Every page”. You receive a ZIP with one PDF per page.")]),
"rotate-pdf": ("Rotate PDF pages online for free: turn all or selected pages 90°, 180° or 270° and save permanently. No upload – runs in your browser.", "rotate pdf, rotate pdf pages, turn pdf, flip pdf page, fix pdf orientation",
  ["Fix sideways scans by rotating the whole PDF or only chosen pages by 90°, 180° or 270°. The new orientation is saved permanently in the file."],
  [("Can I rotate only some pages?","Yes. Enter the page numbers or ranges, or leave the field empty to rotate every page."),("Is the rotation permanent?","Yes, the downloaded PDF opens with the new orientation in any viewer.")]),
"remove-pages": ("Remove pages from a PDF online for free. Delete unwanted pages by number or range in seconds – private, no upload, runs in your browser.", "remove pages from pdf, delete pdf pages, delete pages pdf, cut pages out of pdf",
  ["Delete blank, duplicate or confidential pages from a PDF. Type the page numbers or ranges to remove and download the cleaned document – everything stays on your device."],
  [("How do I delete pages from a PDF?","Enter the pages to remove, for example 2, 4-6, and press the button. The rest of the document is kept unchanged.")]),
"extract-pages": ("Extract pages from a PDF online for free: keep only the pages you need as a new PDF. Private, no upload, works in your browser.", "extract pages from pdf, save selected pdf pages, pdf page extractor, select pages pdf",
  ["Pull a few pages out of a long document and save them as a new PDF. Great for sending only the relevant part of a contract, report or book chapter."],
  [("What is the difference between extract and split?","Extract creates one new PDF from the selected pages; split cuts the document into several files.")]),
"organize-pdf": ("Organize PDF online for free: reorder, rotate and delete pages visually with thumbnails. No upload – everything happens in your browser.", "organize pdf, reorder pdf pages, rearrange pdf, pdf page organizer, move pdf pages",
  ["See every page as a thumbnail, drag pages into a new order, rotate them or mark them for deletion, then save the result as a new PDF in one step."],
  [("How do I rearrange pages in a PDF?","Drag a page thumbnail onto its new position, use ⟳ to rotate and ✕ to delete, then save.")]),
"sign-pdf": ("Sign PDF online for free: draw your signature with mouse, finger or stylus and place it on any pages. No upload, no account – private, in your browser.", "sign pdf, e-sign pdf, add signature to pdf, draw signature pdf, sign pdf online free, sign pdf without upload",
  ["Draw your signature with a mouse, finger or stylus, choose the pages and size, and stamp it onto the PDF. The signature image is embedded locally – neither your document nor your signature is ever sent anywhere.",
   "This is a visual signature (an image placed on the page), not a certificate-based qualified electronic signature."],
  [("Is my signature stored anywhere?","No. It only exists in your browser until you close or reload the page."),("Is this a legally binding qualified signature?","It is a simple visual signature. Contracts that legally require a qualified electronic signature need a certified signing service.")]),
"watermark-pdf": ("Add a watermark to PDF online for free: stamp custom text with size, colour and opacity on every page. Private, in your browser, no upload.", "watermark pdf, add watermark to pdf, pdf stamp, text watermark pdf, confidential watermark",
  ["Mark documents as CONFIDENTIAL, DRAFT or with your name. Choose text, colour, size and opacity and apply it diagonally across every page."],
  [("Can I change the watermark colour and opacity?","Yes – pick any colour and set how transparent the text should be.")]),
"add-page-numbers": ("Add page numbers to PDF online for free: choose position, format and starting number. No upload, no sign-up – runs in your browser.", "add page numbers to pdf, pdf page numbering, number pdf pages, pdf pagination",
  ["Number the pages of any PDF. Select the position, the number format and the first number, and download the numbered document immediately."],
  [("Can I start numbering from a different number?","Yes, set any starting number, for example to continue a longer document.")]),
"pdf-to-text": ("Convert PDF to text online for free: extract all readable text from a PDF as a .txt file. Private, in your browser, no upload.", "pdf to text, extract text from pdf, pdf to txt, copy text from pdf",
  ["Extract the text of a PDF into a plain .txt file you can copy, search or edit. Works locally; scanned PDFs without a text layer contain no extractable text."],
  [("Why is my extracted text empty?","The PDF is probably a scan made of images. Only PDFs with real text can be extracted.")]),
"pdf-to-gif": ("Convert PDF to animated GIF online for free: turn pages into a looping GIF with your own speed and size. No upload, runs in your browser.", "pdf to gif, pdf to animated gif, convert pdf slides to gif, pdf animation",
  ["Turn the pages of a PDF – slides, comics or storyboards – into an animated GIF. Control the seconds per page, width and quality and download the result."],
  [("How do I make the GIF smaller?","Reduce the width or the number of pages, or choose “Smaller file” quality.")]),
"gif-to-pdf": ("Convert GIF to PDF online for free: put GIF images or animation frames into a PDF. Private, no upload, runs in your browser.", "gif to pdf, convert gif to pdf, gif frames to pdf, animated gif to pdf",
  ["Convert GIF files into a PDF document. Every frame of an animated GIF becomes its own page, and you can keep just every Nth frame for long animations."],
  [("What happens to animated GIFs?","Every frame becomes a page. Use “Keep every Nth frame” to skip frames on long GIFs.")]),
}
cards = "".join(f'<a class="card" href="{s}.html" style="--c:{c}"><div class="ico">{i}</div><h3>{t}</h3><p>{d}</p></a>' for s,t,i,c,d,*_ in T)
feat = '''<section class="features"><div><h3>🔒 Private by design</h3><p>Files are processed inside your browser. Nothing is uploaded, stored or seen by anyone else.</p></div>
<div><h3>⚡ Fast &amp; light</h3><p>Small tools load only when needed, then are cached so the site keeps working offline.</p></div>
<div><h3>🌿 Free, forever</h3><p>No sign-up, no watermarks, no limits. A tiny optional tip (€1 + 1 ct per page) keeps the lights on.</p></div></section>'''
meta = {t[9]: {"slug": t[0], "title": t[1], "h1": t[5], "intro": t[6]} for t in T}
IC = {
 "merge":'<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="m3 13 9 5 9-5"/>',
 "split":'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
 "remove-pages":'<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v7M14 10v7"/>',
 "extract-pages":'<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 14h6M12 11l3 3-3 3"/>',
 "sign-pdf":'<path d="M3 17c4 0 4-8 7-8s-1 7 2 7 4-8 7-8"/><path d="M3 21h18"/>',
 "organize":'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 "rotate":'<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
 "compress":'<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
 "pdf-to-jpg":'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m21 15-5-5L5 21"/>',
 "jpg-to-pdf":'<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M12 12v6M9 15h6"/>',
 "pdf-to-gif":'<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M7 10h-1.5a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1H7v-1.5H6M10 10v4M13 14v-4h2.5M13 12h2"/>',
 "gif-to-pdf":'<rect x="3" y="5" width="12" height="10" rx="1.5"/><path d="M8 19h10a1 1 0 0 0 1-1V9M21 17V8"/>',
 "watermark":'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
 "page-numbers":'<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
 "pdf-to-text":'<path d="M4 6h16M4 12h16M4 18h10"/>',
}
def svg(k): return f'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">{IC[k]}</svg>'
LBL = {"merge":"Merge","split":"Split","remove-pages":"Remove","extract-pages":"Extract","organize":"Organize","sign-pdf":"Sign","rotate":"Rotate","compress":"Compress","pdf-to-jpg":"Pdf2Pic","jpg-to-pdf":"Pic2Pdf","pdf-to-gif":"Pdf2Gif","gif-to-pdf":"Gif2Pdf","watermark":"Watermark","page-numbers":"Numbers","pdf-to-text":"Text"}
IC["home"] = '<path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-6h4v6"/>'
LBL["home"] = "Home"
home_cards = "".join(f'<a class="card" href="{t[0]}.html" data-tool="{t[9]}" style="--c:{t[3]}"><div class="ico">{svg(t[9])}</div><h3>{t[1]}</h3><p>{t[4]}</p></a>' for t in T)
rail = "".join(f'<a href="{t[0]}.html" data-tool="{t[9]}" title="{e(t[1])}"><span class="ri">{svg(t[9])}</span><span class="rl">{LBL[t[9]]}</span></a>' for t in T)
HOME_FAQ = [("Are my PDF files uploaded to a server?","No. All tools run inside your browser, so your files never leave your device."),
 ("Is pdf pangea really free?","Yes. There is no sign-up, no watermark and no file limit. An optional tip starting at €1 plus 1 cent per processed page supports the project."),
 ("Does it work offline?","Yes. After your first visit the tools are cached and keep working without an internet connection."),
 ("Which PDF tools are available?","Merge, split, compress, rotate, organize, sign, watermark, add page numbers, remove or extract pages, PDF to JPG/PNG, JPG to PDF, PDF to text, PDF to GIF and GIF to PDF.")]
body = f'''<div class="app"><aside class="rail" id="rail"><button type="button" class="rt" aria-expanded="false" aria-controls="rn">View all tools ▾</button><nav class="rn" id="rn">{rail}</nav></aside>
<main class="work"><section id="home"><div class="titlebar"><h1>Free PDF tools that never leave your device</h1><p>Merge, compress, convert and edit PDFs right in your browser. Nothing is uploaded, nothing needs signing up. Most popular tools first.</p></div><div class="cards">{home_cards}</div>{feat}</section>
<section id="toolview" hidden><div class="titlebar"><h1 id="tt">{e(T[0][5])}</h1><p id="ts">{e(T[0][6])}</p></div><div id="tool" data-tool="{T[0][9]}"><noscript><div class="panel">Please enable JavaScript – the tools run in your browser.</div></noscript></div></section></main></div>
<script id="meta" type="application/json">{json.dumps(meta)}</script>
<div class="statusbar"><div class="ticker" aria-label="Clouds go home! Your PDFs stay private. Files never leave this device."><div class="tk"><span>🌬️ Clouds go home! Your PDFs stay private.</span><span>🔒 Privacy? Damn right.</span><span>📴 Works offline</span><span>🌿 Free · optional tip from €1</span><span>🌬️ Clouds go home! Your PDFs stay private.</span><span>🔒 Privacy? Damn right.</span><span>📴 Works offline</span><span>🌿 Free · optional tip from €1</span></div></div></div>
<div class="wrap"><section class="prose alltools"><h2>All PDF tools</h2><div class="tags">{"".join(f'<a href="{t[0]}.html">{t[1]}</a>' for t in T)}</div></section>
<section class="prose"><h2>Free online PDF tools without the cloud</h2><p>{NAME} is a collection of PDF tools – merge PDF, split PDF, compress PDF, PDF to JPG, JPG to PDF and more – that run entirely in your web browser. Unlike typical online PDF editors, your files are never sent to a server, so confidential contracts, invoices and personal papers stay private. It is fast, free and even works without an internet connection once loaded.</p>
<h2>Frequently asked questions</h2>{"".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q,a in HOME_FAQ)}</section></div>'''
page("index.html", f"Free PDF Tools: Merge, Split, Compress – {NAME}",
     "Free PDF tools that run in your browser: merge, split, compress, rotate, convert PDF to JPG and JPG to PDF. No upload, no sign-up, works offline.",
     body, [org, {"@context":"https://schema.org","@type":"WebSite","@id":SITE_URL+"/#website","name":NAME,"alternateName":["pdfpangea","pdfpangea.com"],"url":SITE_URL+"/","publisher":{"@id":SITE_URL+"/#org"},"inLanguage":"en"},
            {"@context":"https://schema.org","@type":"WebPage","@id":SITE_URL+"/#webpage","url":SITE_URL+"/","name":f"{NAME} – Free private PDF tools","isPartOf":{"@id":SITE_URL+"/#website"},"about":{"@id":SITE_URL+"/#org"},"dateModified":TODAY,"primaryImageOfPage":{"@type":"ImageObject","url":SITE_URL+"/og.png"}},
            {"@context":"https://schema.org","@type":"ItemList","itemListElement":[{"@type":"ListItem","position":i+1,"url":f"{SITE_URL}/{t[0]}.html","name":t[1]} for i,t in enumerate(T)]},
            {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in HOME_FAQ]}], ("js/donate.js","js/app.js"), bcls="shell", kw=SITE_KW)

for slug,title,ico,col,short,h1,intro,steps,faqs,tool in T:
    pages.append(slug+".html")
    X = EXTRA[slug]
    faqs = list(faqs) + X[3] + [("Is it really free and private?","Yes. The tool runs entirely in your browser, so your files are never uploaded. A small optional tip (€1 plus 1 cent per processed page) is only a suggestion."),("Does it work offline?","Yes. After the first visit the tools are cached by your browser and keep working without an internet connection.")]
    related = "".join(f'<a href="{s}.html">{t}</a>' for s,t,*_ in T if s != slug)
    st = "".join(f"<li>{x}</li>" for x in steps)
    fq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q,a in faqs)
    more = "".join(f"<p>{e(p)}</p>" for p in X[2])
    body = f'''<main class="wrap"><section class="tool-head"><div class="crumbs"><a href="index.html">Home</a> › {title}</div><h1>{h1}</h1><p>{intro}</p></section>
<div id="tool" data-tool="{tool}"><noscript><div class="panel">Please enable JavaScript – the tool runs in your browser.</div></noscript></div>
<section class="prose"><h2>How to: {title.lower()}</h2><ol>{st}</ol><h2>About this {title.lower()} tool</h2>{more}<h2>Questions</h2>{fq}<h2>More PDF tools</h2><div class="tags">{related}</div></section></main>'''
    u = f"{SITE_URL}/{slug}.html"
    ld = [org,
      {"@context":"https://schema.org","@type":"WebSite","@id":SITE_URL+"/#website","name":NAME,"url":SITE_URL+"/","publisher":{"@id":SITE_URL+"/#org"},"inLanguage":"en"},
      {"@context":"https://schema.org","@type":"WebPage","@id":u+"#webpage","url":u,"name":f"{h1} – {NAME}","description":X[0],"isPartOf":{"@id":SITE_URL+"/#website"},"inLanguage":"en","dateModified":TODAY,"primaryImageOfPage":{"@type":"ImageObject","url":SITE_URL+"/og.png"},"breadcrumb":{"@id":u+"#crumbs"}},
      {"@context":"https://schema.org","@type":"WebApplication","@id":u+"#app","name":f"{NAME} – {title}","applicationCategory":"UtilitiesApplication","applicationSubCategory":"PDF tools","operatingSystem":"Any (web browser)","browserRequirements":"Requires JavaScript","isAccessibleForFree":True,"offers":{"@type":"Offer","price":"0","priceCurrency":"EUR"},"description":X[0],"url":u,"inLanguage":"en","featureList":[x for x in steps],"keywords":X[1],"publisher":{"@id":SITE_URL+"/#org"}},
      {"@context":"https://schema.org","@type":"HowTo","name":h1,"description":intro,"totalTime":"PT1M","tool":[{"@type":"HowToTool","name":"Web browser"}],"step":[{"@type":"HowToStep","position":i+1,"name":s.rstrip("."),"text":s} for i,s in enumerate(steps)]},
      {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in faqs]},
      {"@context":"https://schema.org","@type":"BreadcrumbList","@id":u+"#crumbs","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":SITE_URL+"/"},{"@type":"ListItem","position":2,"name":title,"item":u}]}]
    page(slug+".html", f"{h1} – {NAME}", X[0], body, ld, ("js/donate.js","js/app.js"), kw=X[1])

pages += ["privacy.html","support.html","impressum.html"]
page("impressum.html", f"Impressum – {NAME}", "Impressum und Anbieterkennzeichnung von pdf pangea.",
 '''<main class="wrap"><section class="prose"><h1>Impressum</h1>
<p><b>Angaben gemäß § 5 DDG:</b><br>Joshua Karan Singh<br>Hafenweg 28, Atelier 2.4<br>48155 Münster</p>
<p><b>Kontakt:</b><br>E-Mail: <a href="mailto:pdfpangea@gmail.com">pdfpangea@gmail.com</a></p>
<p><b>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV:</b><br>Joshua Karan Singh<br>Hafenweg 28, Atelier 2.4<br>48155 Münster</p>
<p><b>EU-Streitschlichtung:</b><br>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://europa.eu" rel="noopener">https://europa.eu</a>.<br>Unsere E-Mail-Adresse finden Sie oben im Impressum.</p>
<p><b>Verbraucherstreitbeilegung/Universalschlichtungsstelle:</b><br>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p></section></main>''',
 [org], ("js/donate.js",))
page("privacy.html", f"Datenschutzerklärung / Privacy – {NAME}", "Datenschutzerklärung: Ihre Dateien verlassen Ihr Gerät nie. Your files never leave your device.",
 '''<main class="wrap"><section class="prose"><h1>Datenschutzerklärung</h1>
<p><i>English summary: all PDF and image processing happens in your browser. Files are never uploaded. There is no tracking and no advertising. One optional cookie stores your tip counter. The legally binding text is the German one below.</i></p>
<h2>1. Verantwortlicher</h2><p>Verantwortlich im Sinne der DSGVO ist die im <a href="impressum.html">Impressum</a> genannte Person.</p>
<h2>2. Verarbeitung Ihrer Dateien</h2><p>Alle PDF- und Bilddateien werden ausschließlich lokal in Ihrem Browser verarbeitet. Es findet <b>kein Upload</b> statt; wir und Dritte erhalten keinen Zugriff auf Ihre Dateien oder deren Inhalt. Die Dateien liegen nur im Arbeitsspeicher Ihres Geräts und verschwinden beim Schließen oder Neuladen der Seite.</p>
<h2>3. Hosting über GitHub Pages</h2><p>Diese Website wird über GitHub Pages (GitHub Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA; Microsoft-Konzern) ausgeliefert. Beim Aufruf der Seite verarbeitet der Hoster technisch notwendig Ihre IP-Adresse sowie Datum, Uhrzeit, aufgerufene Datei und Browserangaben in Server-Logfiles. Rechtsgrundlage ist unser berechtigtes Interesse an einer sicheren und stabilen Bereitstellung (Art. 6 Abs. 1 lit. f DSGVO). Eine Übermittlung in die USA kann stattfinden; GitHub ist nach unseren Informationen unter dem EU-US Data Privacy Framework zertifiziert. Wir selbst erhalten oder speichern diese Logdaten nicht. Weitere Informationen: <a href="https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement" rel="noopener">GitHub-Datenschutzerklärung</a>.</p>
<h2>4. Cookie und lokaler Speicher</h2><p>Wir setzen ein einziges, rein funktionales Cookie: <code>hp_donation</code>. Es speichert nur den Zähler für die freiwillige Unterstützung (Cent-Betrag und Seitenzahl, Laufzeit 2 Jahre). Es enthält keine personenbezogenen Daten, dient nicht dem Tracking und nicht der Werbung und wird nicht an Dritte übermittelt. Das Cookie wird <b>nur nach Ihrer Einwilligung</b> gesetzt (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO). Ihre Entscheidung speichern wir im lokalen Speicher Ihres Browsers (<code>pp_consent</code>), dort sowie im Sitzungsspeicher (<code>pp_seen</code>, <code>pp_cookie_seen</code>) merken wir uns außerdem, dass die Hinweise bereits angezeigt wurden. Ohne Einwilligung funktioniert alles weiterhin; der Zähler gilt dann nur, bis Sie die Seite schließen. Sie können Ihre Wahl jederzeit über „Cookie settings“ im Seitenfuß ändern oder widerrufen sowie Cookie und lokalen Speicher in Ihrem Browser löschen.</p>
<p>Zusätzlich legt ein Service Worker die Dateien dieser Website im Browser-Cache ab, damit sie offline funktioniert. Dabei werden keine personenbezogenen Daten gespeichert.</p>
<h2>5. Keine Tracker, keine Dritten</h2><p>Wir verwenden keine Analyse-, Tracking- oder Werbedienste und laden keine Schriftarten, Skripte oder Bibliotheken von fremden Servern. Alle Schriften und Programmbibliotheken liegen auf dieser Website selbst. Eine Inhalts-Sicherheitsrichtlinie (CSP) verhindert zusätzlich, dass die Seite Daten an fremde Server sendet.</p>
<h2>6. Externer Link zu Ko-fi</h2><p>Die Schaltfläche „Support me“ ist ein einfacher Link zu Ko-fi. Erst wenn Sie darauf klicken, verlassen Sie diese Website und es gelten die Datenschutzbestimmungen von Ko-fi (Ko-fi Labs Inc.). Vorher werden keine Daten an Ko-fi übertragen. Unterstützung ist freiwillig.</p>
<h2>7. Ihre Rechte</h2><p>Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO) sowie das Recht, eine Einwilligung jederzeit mit Wirkung für die Zukunft zu widerrufen. Da wir keine personenbezogenen Daten über Sie speichern, können wir Anfragen zu Daten auf Ihrem Gerät nicht zuordnen; diese löschen Sie direkt im Browser. Sie haben zudem das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren, z. B. der für Ihren Wohnort zuständigen Landesdatenschutzbehörde.</p>
<h2>8. Aktualität</h2><p>Stand: Oktober 2026. Wir passen diese Erklärung an, wenn sich die Website oder die Rechtslage ändert.</p></section></main>''',
 [org], ("js/donate.js",))
page("support.html", f"Support {NAME}", "Everything is free. Optionally support the project with a tiny donation of 1 cent per page.",
 f'''<main class="wrap"><section class="prose"><h1>Support {NAME}</h1><p>All tools are free and always will be. If they saved you time, you can optionally tip €1 plus 1 cent for every page you processed. The counter below is kept in a cookie in your browser.</p>
<div class="donate" data-donate-box></div></section></main>''', [org], ("js/donate.js",))

def prio(p): return "1.0" if p=="index.html" else ("0.9" if p in ("merge-pdf.html","compress-pdf.html","pdf-to-jpg.html","jpg-to-pdf.html","split-pdf.html") else ("0.3" if p in ("privacy.html","impressum.html","support.html") else "0.8"))
today = TODAY
open(os.path.join(ROOT,"sitemap.xml"),"w").write('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'+"".join(f'<url><loc>{SITE_URL}/{"" if p=="index.html" else p}</loc><lastmod>{today}</lastmod><changefreq>monthly</changefreq><priority>{prio(p)}</priority>'+(f'<image:image><image:loc>{SITE_URL}/og.png</image:loc></image:image>' if p not in ("privacy.html","impressum.html","support.html") else "")+'</url>' for p in pages)+'</urlset>')
open(os.path.join(ROOT,"robots.txt"),"w").write(f"User-agent: *\nAllow: /\n\nSitemap: {SITE_URL}/sitemap.xml\n")
open(os.path.join(ROOT,"llms.txt"),"w",encoding="utf-8").write(f"# {NAME}\n\n> Free PDF tools that run 100% in the browser. Files are never uploaded; works offline. Open-source libraries only.\n\n## Tools\n"+"".join(f"- [{t[1]}]({SITE_URL}/{t[0]}.html): {EXTRA[t[0]][0]}\n" for t in T)+f"\n## Legal\n- [Privacy]({SITE_URL}/privacy.html)\n- [Impressum]({SITE_URL}/impressum.html)\n")
open(os.path.join(ROOT,"humans.txt"),"w",encoding="utf-8").write("Site: pdf pangea\nAuthor: Joshua Karan Singh\nMade in Münster, Germany\n")
page("404.html", f"Page not found – {NAME}", "This page does not exist. Browse all free PDF tools.",
 f'<main class="wrap"><section class="prose"><h1>Page not found</h1><p>That page does not exist. Try one of our tools:</p><div class="tags">{"".join(f"<a href=\'{t[0]}.html\'>{t[1]}</a>" for t in T)}</div><p><a href="/">Back to start</a></p></section></main>', [org], ("js/donate.js",), robots="noindex,follow")
open(os.path.join(ROOT,"favicon.svg"),"w").write(LOGO.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" '))
json.dump({"name":NAME,"short_name":"pdf pangea","start_url":"index.html","display":"standalone","background_color":"#f7f0e4","theme_color":"#b5532f","description":"Free PDF tools that run 100% in your browser.","lang":"en","categories":["utilities","productivity"],"icons":[{"src":"favicon.svg","sizes":"any","type":"image/svg+xml"},{"src":"icon-192.png","sizes":"192x192","type":"image/png"},{"src":"icon-512.png","sizes":"512x512","type":"image/png","purpose":"any maskable"}]},open(os.path.join(ROOT,"manifest.webmanifest"),"w"))
pre = pages + ["css/style.css","js/app.js","js/donate.js","favicon.svg","manifest.webmanifest","fonts/ebgaramond-latin-400.woff2","fonts/ebgaramond-latin-400i.woff2","fonts/ebgaramond-latin-600.woff2","fonts/fraunces-latin-400.woff2","fonts/fraunces-latin-600.woff2","vendor/pdf-lib.min.js","vendor/pdf.min.js","vendor/pdf.worker.min.js","vendor/jszip.min.js","vendor/gif.js","vendor/gif.worker.js","vendor/omggif.js"]
ver = str(int(max(os.path.getmtime(os.path.join(ROOT,p)) for p in pre)))
open(os.path.join(ROOT,"sw.js"),"w").write(f'''const C="pdfpangea-{ver}",A={json.dumps(pre)};
self.addEventListener("install",e=>{{e.waitUntil(caches.open(C).then(c=>Promise.allSettled(A.map(u=>c.add(u)))).then(()=>self.skipWaiting()))}});
self.addEventListener("activate",e=>{{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))}});
self.addEventListener("fetch",e=>{{if(e.request.method!=="GET")return;e.respondWith(fetch(e.request,{{cache:"no-cache"}}).then(r=>{{if(r.ok){{const k=r.clone();caches.open(C).then(c=>c.put(e.request,k))}}return r}}).catch(()=>caches.match(e.request,{{ignoreSearch:true}})))}});
''')
print("built", len(pages), "pages for", SITE_URL)












