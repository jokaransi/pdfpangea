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
  [("Will text stay selectable?","With “Light” yes. “Balanced” and “Strong” turn pages into images for much smaller files, so text is no longer selectable.")],"compress"),
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

def page(fn, title, desc, body, ld, scripts=("js/donate.js",), extra_head="", bcls=""):
    url = f"{SITE_URL}/{'' if fn=='index.html' else fn}"
    ldj = "".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in ld)
    sc = "".join(f'<script src="{s}" defer></script>' for s in scripts)
    out = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-src 'none'"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)}</title><meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}"><meta name="theme-color" content="#b5532f">
<meta property="og:type" content="website"><meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{url}"><meta property="og:site_name" content="{NAME}">
<meta name="twitter:card" content="summary"><link rel="icon" href="favicon.svg" type="image/svg+xml"><link rel="manifest" href="manifest.webmanifest">
<link rel="preload" href="fonts/ebgaramond-latin-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/style.css">{extra_head}{ldj}</head><body class="{bcls}">
{header()}{body}{footer()}{sc}</body></html>'''
    open(os.path.join(ROOT, fn), "w", encoding="utf-8").write(out)

pages = ["index.html"]
org = {"@context":"https://schema.org","@type":"Organization","name":NAME,"url":SITE_URL}
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
body = f'''<div class="app"><aside class="rail" id="rail"><button type="button" class="rt" aria-expanded="false" aria-controls="rn">View all tools ▾</button><nav class="rn" id="rn">{rail}</nav></aside>
<main class="work"><section id="home"><div class="titlebar"><h1>Free PDF tools that never leave your device</h1><p>Merge, compress, convert and edit PDFs right in your browser. Nothing is uploaded, nothing needs signing up. Most popular tools first.</p></div><div class="cards">{home_cards}</div>{feat}</section>
<section id="toolview" hidden><div class="titlebar"><h1 id="tt">{e(T[0][5])}</h1><p id="ts">{e(T[0][6])}</p></div><div id="tool" data-tool="{T[0][9]}"><noscript><div class="panel">Please enable JavaScript – the tools run in your browser.</div></noscript></div></section></main></div>
<script id="meta" type="application/json">{json.dumps(meta)}</script>
<div class="statusbar"><div class="ticker" aria-label="Fuck the cloud. Your PDFs stay private. Files never leave this device."><div class="tk"><span>☁️ Fuck the cloud. Your PDFs stay private.</span><span>🔒 Privacy? Damn right.</span><span>📴 Works offline</span><span>🌿 Free · optional tip from €1</span><span>☁️ Fuck the cloud. Your PDFs stay private.</span><span>🔒 Privacy? Damn right.</span><span>📴 Works offline</span><span>🌿 Free · optional tip from €1</span></div></div></div>
<div class="wrap"><section class="prose alltools"><h2>All PDF tools</h2><div class="tags">{"".join(f'<a href="{t[0]}.html">{t[1]}</a>' for t in T)}</div></section>
<section class="prose"><h2>Free online PDF tools without the cloud</h2><p>{NAME} is a collection of PDF tools – merge PDF, split PDF, compress PDF, PDF to JPG, JPG to PDF and more – that run entirely in your web browser. Unlike typical online PDF editors, your files are never sent to a server, so confidential contracts, invoices and personal papers stay private. It is fast, free and even works without an internet connection once loaded.</p></section></div>'''
page("index.html", f"{NAME} – Free private PDF tools: merge, split, compress, convert",
     "Free PDF tools that run in your browser: merge, split, compress, rotate, convert PDF to JPG and JPG to PDF. No upload, no sign-up, works offline.",
     body, [org, {"@context":"https://schema.org","@type":"WebSite","name":NAME,"url":SITE_URL+"/"},
            {"@context":"https://schema.org","@type":"ItemList","itemListElement":[{"@type":"ListItem","position":i+1,"url":f"{SITE_URL}/{t[0]}.html","name":t[1]} for i,t in enumerate(T)]}], ("js/donate.js","js/app.js"), bcls="shell")

for slug,title,ico,col,short,h1,intro,steps,faqs,tool in T:
    pages.append(slug+".html")
    related = "".join(f'<a href="{s}.html">{t}</a>' for s,t,*_ in T if s != slug)
    st = "".join(f"<li>{x}</li>" for x in steps)
    fq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q,a in faqs)
    fq += "<details><summary>Is it really free and private?</summary><p>Yes. The tool runs entirely in your browser, so your files are never uploaded. A small optional donation (€1 plus 1 cent per processed page) is only a suggestion.</p></details>"
    body = f'''<main class="wrap"><section class="tool-head"><div class="crumbs"><a href="index.html">Home</a> › {title}</div><h1>{h1}</h1><p>{intro}</p></section>
<div id="tool" data-tool="{tool}"><noscript><div class="panel">Please enable JavaScript – the tool runs in your browser.</div></noscript></div>
<section class="prose"><h2>How to: {title.lower()}</h2><ol>{st}</ol><h2>Questions</h2>{fq}<h2>More PDF tools</h2><div class="tags">{related}</div></section></main>'''
    ld = [org,
      {"@context":"https://schema.org","@type":"SoftwareApplication","name":f"{NAME} – {title}","applicationCategory":"UtilitiesApplication","operatingSystem":"Any (web browser)","offers":{"@type":"Offer","price":"0","priceCurrency":"EUR"},"description":intro,"url":f"{SITE_URL}/{slug}.html"},
      {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in faqs]},
      {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":SITE_URL+"/"},{"@type":"ListItem","position":2,"name":title,"item":f"{SITE_URL}/{slug}.html"}]}]
    page(slug+".html", f"{h1} – {NAME}", intro[:155], body, ld, ("js/donate.js","js/app.js"))

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

today = __import__("datetime").date.today().isoformat()
open(os.path.join(ROOT,"sitemap.xml"),"w").write('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+"".join(f'<url><loc>{SITE_URL}/{"" if p=="index.html" else p}</loc><lastmod>{today}</lastmod></url>' for p in pages)+'</urlset>')
open(os.path.join(ROOT,"robots.txt"),"w").write(f"User-agent: *\nAllow: /\nSitemap: {SITE_URL}/sitemap.xml\n")
open(os.path.join(ROOT,"favicon.svg"),"w").write(LOGO.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" '))
json.dump({"name":NAME,"short_name":"pdf pangea","start_url":"index.html","display":"standalone","background_color":"#f7f0e4","theme_color":"#b5532f","icons":[{"src":"favicon.svg","sizes":"any","type":"image/svg+xml"}]},open(os.path.join(ROOT,"manifest.webmanifest"),"w"))
pre = pages + ["css/style.css","js/app.js","js/donate.js","favicon.svg","manifest.webmanifest","fonts/ebgaramond-latin-400.woff2","fonts/ebgaramond-latin-400i.woff2","fonts/ebgaramond-latin-600.woff2","fonts/fraunces-latin-400.woff2","fonts/fraunces-latin-600.woff2","vendor/pdf-lib.min.js","vendor/pdf.min.js","vendor/pdf.worker.min.js","vendor/jszip.min.js","vendor/gif.js","vendor/gif.worker.js","vendor/omggif.js"]
ver = str(int(max(os.path.getmtime(os.path.join(ROOT,p)) for p in pre)))
open(os.path.join(ROOT,"sw.js"),"w").write(f'''const C="pdfpangea-{ver}",A={json.dumps(pre)};
self.addEventListener("install",e=>{{e.waitUntil(caches.open(C).then(c=>Promise.allSettled(A.map(u=>c.add(u)))).then(()=>self.skipWaiting()))}});
self.addEventListener("activate",e=>{{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))}});
self.addEventListener("fetch",e=>{{if(e.request.method!=="GET")return;e.respondWith(fetch(e.request,{{cache:"no-cache"}}).then(r=>{{if(r.ok){{const k=r.clone();caches.open(C).then(c=>c.put(e.request,k))}}return r}}).catch(()=>caches.match(e.request,{{ignoreSearch:true}})))}});
''')
print("built", len(pages), "pages for", SITE_URL)











