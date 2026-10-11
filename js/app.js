/* pdf pangea – all PDF processing happens in the browser. Nothing is uploaded. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") e.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") e[k] = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  var loaded = {};
  function loadScript(src) {
    if (!loaded[src]) loaded[src] = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error("Could not load " + src)); };
      document.head.appendChild(s);
    });
    return loaded[src];
  }
  function needPdfLib() { return loadScript("vendor/pdf-lib.min.js"); }
  function needPdfJs() {
    return loadScript("vendor/pdf.min.js").then(function () {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
    });
  }
  function needZip() { return loadScript("vendor/jszip.min.js"); }
  function readBuf(f) { return f.arrayBuffer(); }
  function size(n) { return n > 1048576 ? (n / 1048576).toFixed(2) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
  function base(n) { return n.replace(/\.[^.]+$/, ""); }
  function canvasBlob(c, type, q) { return new Promise(function (r) { c.toBlob(r, type, q); }); }
  function pdfBlob(bytes) { return new Blob([bytes], { type: "application/pdf" }); }

  function loadDoc(file, opts) {
    return needPdfLib().then(function () { return readBuf(file); }).then(function (b) {
      return PDFLib.PDFDocument.load(b, Object.assign({ updateMetadata: false }, opts || {}));
    }).catch(function (e) {
      if (/encrypt/i.test(e.message)) throw new Error("“" + file.name + "” is password-protected. Remove the password first.");
      throw new Error("Could not read “" + file.name + "”. Is it a valid PDF?");
    });
  }
  function pdfJsDoc(file) {
    return needPdfJs().then(function () { return readBuf(file); }).then(function (b) {
      return pdfjsLib.getDocument({ data: new Uint8Array(b) }).promise;
    });
  }

  // Fill & Sign: page editor with draggable text, ticks, dates, signatures and images
  function buildEditor(box, file, state, onChange) {
    var items = state.items, cur = 1, total = 1, pdf = null, W = 612, armed = null, sel = null, sig = null, fontSize = 14;
    var stageW = 600, u = 1, renderTok = 0;
    var canvas = h("canvas", { class: "ed-canvas" }), layer = h("div", { class: "ed-layer" });
    var stage = h("div", { class: "ed-stage" }, [canvas, layer]);
    var label = h("span", { class: "ed-page", text: "Page 1 / 1" });
    var hint = h("p", { class: "ed-hint", text: "Pick a tool, then click on the page where it should go." });
    var tools = {};
    function mk(id, text, title) {
      var b = h("button", { type: "button", class: "btn ghost sm ed-tool", title: title, text: text });
      b.onclick = function () { pick(id); }; tools[id] = b; return b;
    }
    var sizeIn = h("input", { type: "number", min: "6", max: "72", value: "14", class: "ed-size", "aria-label": "Text size" });
    var tb = h("div", { class: "ed-bar" }, [
      mk("text", "T Text", "Type text"), mk("date", "📅 Date", "Insert today's date"), mk("check", "✓", "Tick"), mk("cross", "✗", "Cross"),
      mk("sig", "✍ Signature", "Draw and place your signature"), mk("img", "🖼 Image", "Place an image or stamp"),
      h("label", { class: "ed-sizel" }, [document.createTextNode("Size "), sizeIn])
    ]);
    var prev = h("button", { type: "button", class: "btn ghost sm", text: "‹", title: "Previous page" });
    var next = h("button", { type: "button", class: "btn ghost sm", text: "›", title: "Next page" });
    var nav = h("div", { class: "ed-nav" }, [prev, label, next]);
    var fileIn = h("input", { type: "file", accept: "image/*", hidden: "" });
    var redraw = h("button", { type: "button", class: "btn ghost sm", text: "Redraw signature", hidden: "" });
    box.appendChild(tb); box.appendChild(hint); box.appendChild(nav); box.appendChild(stage); box.appendChild(fileIn); box.appendChild(redraw);

    function pick(id) {
      if (id === "sig" && !sig) return signPad(function () { arm("sig"); });
      if (id === "img") return fileIn.click();
      arm(armed === id ? null : id);
    }
    function arm(id) {
      armed = id; stage.classList.toggle("armed", !!id);
      Object.keys(tools).forEach(function (k) { tools[k].classList.toggle("on", k === id); });
      hint.textContent = id ? "Now click or tap on the page to place it." : "Pick a tool, then click on the page where it should go.";
    }
    sizeIn.oninput = function () {
      fontSize = Math.max(6, Math.min(72, +sizeIn.value || 14));
      if (sel && sel.type === "text") { sel.size = fontSize; place(sel); }
    };
    redraw.onclick = function () { signPad(function () { arm("sig"); }); };
    prev.onclick = function () { go(cur - 1); }; next.onclick = function () { go(cur + 1); };
    function go(n) { if (n < 1 || n > total) return; cur = n; select(null); show(); }

    function fit() {
      var w = Math.min(820, Math.max(200, box.clientWidth || 600));
      stageW = w; u = w / W; stage.style.width = w + "px";
      items.forEach(function (it) { if (it.el) place(it); });
    }
    function show() {
      label.textContent = "Page " + cur + " / " + total;
      prev.disabled = cur <= 1; next.disabled = cur >= total;
      layer.innerHTML = "";
      var tok = ++renderTok;
      pdf.getPage(cur).then(function (page) {
        var v1 = page.getViewport({ scale: 1 }); W = v1.width; fit();
        var dpr = Math.min(2, window.devicePixelRatio || 1), v = page.getViewport({ scale: stageW / W * dpr });
        canvas.width = v.width; canvas.height = v.height;
        canvas.style.height = (v.height / dpr) + "px";
        stage.style.height = (v.height / dpr) + "px";
        return page.render({ canvasContext: canvas.getContext("2d"), viewport: v }).promise.then(function () {
          if (tok !== renderTok) return;
          items.forEach(function (it) { if (it.page === cur) mountItem(it); });
        });
      }).catch(function () {});
    }

    function place(it) {
      var el = it.el; if (!el) return;
      el.style.left = it.x * u + "px"; el.style.top = it.y * u + "px";
      if (it.type === "text") {
        var ta = it.ta; ta.style.fontSize = it.size * u + "px"; ta.style.lineHeight = "1.2";
        var lines = ta.value.split("\n").length;
        ta.style.height = lines * 1.2 * it.size * u + "px";
        ta.style.width = "1px"; ta.style.width = Math.max(40, ta.scrollWidth + 6) + "px";
      } else { el.style.width = it.w * u + "px"; el.style.height = it.h * u + "px"; }
    }
    function select(it) {
      sel = it;
      items.forEach(function (i) { if (i.el) i.el.classList.toggle("sel", i === it); });
      if (it && it.type === "text") { sizeIn.value = it.size; }
    }
    function remove(it) {
      var k = items.indexOf(it); if (k >= 0) items.splice(k, 1);
      if (it.el && it.el.parentNode) it.el.parentNode.removeChild(it.el);
      if (sel === it) sel = null; onChange();
    }
    function drag(handle, it, mode) {
      handle.addEventListener("pointerdown", function (ev) {
        ev.preventDefault(); ev.stopPropagation(); select(it);
        handle.setPointerCapture(ev.pointerId);
        var sx = ev.clientX, sy = ev.clientY, ox = it.x, oy = it.y, ow = it.w, oh = it.h;
        function mv(e) {
          var dx = (e.clientX - sx) / u, dy = (e.clientY - sy) / u;
          if (mode === "move") { it.x = ox + dx; it.y = oy + dy; }
          else {
            var nw = Math.max(10, ow + dx);
            it.w = nw; it.h = it.ar ? nw * it.ar : nw;
          }
          place(it);
        }
        function up() { handle.removeEventListener("pointermove", mv); handle.removeEventListener("pointerup", up); handle.removeEventListener("pointercancel", up); }
        handle.addEventListener("pointermove", mv); handle.addEventListener("pointerup", up); handle.addEventListener("pointercancel", up);
      });
    }
    function mountItem(it) {
      var el = h("div", { class: "ed-item ed-" + it.type });
      it.el = el;
      var del = h("button", { type: "button", class: "ed-del", title: "Delete", text: "✕" });
      del.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
      del.onclick = function (e) { e.stopPropagation(); remove(it); };
      if (it.type === "text") {
        var ta = h("textarea", { class: "ed-ta", wrap: "off", rows: "1", spellcheck: "false", "aria-label": "Text" });
        ta.value = it.text; it.ta = ta;
        ta.oninput = function () { it.text = ta.value; place(it); onChange(); };
        ta.onfocus = function () { select(it); };
        var grip = h("span", { class: "ed-grip", title: "Move", text: "✥" });
        el.appendChild(ta); el.appendChild(grip); drag(grip, it, "move");
      } else {
        var vis;
        if (it.type === "check" || it.type === "cross") {
          vis = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          vis.setAttribute("viewBox", "0 0 24 24"); vis.setAttribute("class", "ed-mark");
          vis.innerHTML = it.type === "check" ? '<polyline points="4,13 9,18 20,6"/>' : '<line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/>';
        } else { vis = h("img", { src: it.src, alt: "", draggable: "false" }); }
        el.appendChild(vis); drag(el, it, "move");
        var rs = h("span", { class: "ed-rs", title: "Resize" }); el.appendChild(rs); drag(rs, it, "size");
        if (it.type === "check" || it.type === "cross") it.ar = 1;
      }
      el.appendChild(del);
      el.addEventListener("pointerdown", function () { select(it); });
      layer.appendChild(el); place(it); select(it);
      return el;
    }
    function add(it) {
      it.page = cur; items.push(it); var el = mountItem(it); onChange();
      if (it.ta) {
        it.ta.focus();
        if (it.text) it.ta.select();
        else it.ta.setSelectionRange(0, 0);
      }
      return el;
    }
    layer.addEventListener("pointerdown", function (ev) {
      if (ev.target !== layer) return;
      if (!armed) { select(null); return; }
      ev.preventDefault();
      var r = layer.getBoundingClientRect(), x = (ev.clientX - r.left) / u, y = (ev.clientY - r.top) / u, t = armed;
      if (t === "text") add({ type: "text", x: x, y: y - fontSize * 0.6, size: fontSize, text: "" });
      else if (t === "date") add({ type: "text", x: x, y: y - fontSize * 0.6, size: fontSize, text: new Date().toLocaleDateString() });
      else if (t === "check" || t === "cross") add({ type: t, x: x - 10, y: y - 10, w: 20, h: 20, ar: 1 });
      else if (t === "sig" && sig) { var w = Math.min(150, W * 0.4); add({ type: "sig", x: x - w / 2, y: y - w * sig.ar / 2, w: w, h: w * sig.ar, ar: sig.ar, src: sig.src }); }
      else if (t === "img" && sig && sig.pending) { var iw = Math.min(140, W * 0.4), p = sig.pending; add({ type: "img", x: x - iw / 2, y: y - iw * p.ar / 2, w: iw, h: iw * p.ar, ar: p.ar, src: p.src }); }
      arm(null);
    });
    fileIn.onchange = function () {
      var f = fileIn.files[0]; fileIn.value = ""; if (!f) return;
      var url = URL.createObjectURL(f), im = new Image();
      im.onload = function () {
        var k = Math.min(1, 1200 / Math.max(im.width, im.height)), c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        sig = sig || {}; sig.pending = { src: c.toDataURL("image/png"), ar: c.height / c.width };
        URL.revokeObjectURL(url); arm("img");
      };
      im.onerror = function () { URL.revokeObjectURL(url); hint.textContent = "Could not read that image."; };
      im.src = url;
    };

    function signPad(done) {
      var cv = h("canvas", { class: "ed-pad", width: "900", height: "300", "aria-label": "Draw your signature here" }), c = cv.getContext("2d"), down = false, has = false;
      c.lineWidth = 7; c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = "#1d2b53"; c.fillStyle = "#1d2b53";
      function xy(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; }
      cv.addEventListener("pointerdown", function (e) { e.preventDefault(); cv.setPointerCapture(e.pointerId); var p = xy(e); c.beginPath(); c.arc(p[0], p[1], 3.5, 0, 7); c.fill(); c.beginPath(); c.moveTo(p[0], p[1]); down = has = true; });
      cv.addEventListener("pointermove", function (e) { if (!down) return; e.preventDefault(); var p = xy(e); c.lineTo(p[0], p[1]); c.stroke(); });
      ["pointerup", "pointercancel"].forEach(function (n) { cv.addEventListener(n, function () { down = false; }); });
      var ok = h("button", { type: "button", class: "btn sm", text: "Use signature" }), clr = h("button", { type: "button", class: "btn ghost sm", text: "Clear" }), cancel = h("button", { type: "button", class: "btn ghost sm", text: "Cancel" });
      var modal = h("div", { class: "ed-modal", role: "dialog", "aria-label": "Draw your signature" }, [h("div", { class: "ed-card" }, [
        h("strong", { text: "Draw your signature" }), h("small", { text: "Use your finger, mouse or stylus." }), cv, h("div", { class: "ed-row" }, [clr, cancel, ok])])]);
      document.body.appendChild(modal);
      var close = function () { modal.parentNode && modal.parentNode.removeChild(modal); };
      clr.onclick = function () { c.clearRect(0, 0, cv.width, cv.height); has = false; };
      cancel.onclick = close;
      ok.onclick = function () {
        if (!has) return;
        var d = c.getImageData(0, 0, cv.width, cv.height).data, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        for (var y = 0; y < cv.height; y++) for (var x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        var pad = 6; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(cv.width - 1, x1 + pad); y1 = Math.min(cv.height - 1, y1 + pad);
        var o = document.createElement("canvas"); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
        o.getContext("2d").drawImage(cv, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
        sig = sig || {}; sig.src = o.toDataURL("image/png"); sig.ar = o.height / o.width; redraw.hidden = false;
        close(); done();
      };
    }

    var ro = window.ResizeObserver ? new ResizeObserver(function () { if (pdf && Math.abs(box.clientWidth - stageW) > 2 && box.clientWidth < 820 + 40) show(); }) : null;
    pdfJsDoc(file).then(function (d) { pdf = d; total = d.numPages; show(); if (ro) ro.observe(box); })
      .catch(function () { hint.textContent = "Could not read this PDF."; });
    return { destroy: function () { if (ro) ro.disconnect(); } };
  }

  // "1-3, 5, 8-" -> [0,1,2,4,7,...]
  function parseRanges(str, total, keepGroups) {
    var groups = [];
    String(str || "").split(",").forEach(function (part) {
      part = part.trim(); if (!part) return;
      var m = part.match(/^(\d*)\s*-\s*(\d*)$/), a, b;
      if (m) { a = m[1] ? +m[1] : 1; b = m[2] ? +m[2] : total; }
      else if (/^\d+$/.test(part)) { a = b = +part; }
      else throw new Error("Can't understand “" + part + "”. Use e.g. 1-3, 5, 8-12");
      if (a < 1 || b > total || a > b) throw new Error("Range “" + part + "” is outside 1–" + total + ".");
      var g = []; for (var i = a; i <= b; i++) g.push(i - 1);
      groups.push(g);
    });
    if (!groups.length) throw new Error("Please enter the pages you want.");
    return keepGroups ? groups : [].concat.apply([], groups);
  }

  function copyTo(src, idxs) {
    return PDFLib.PDFDocument.create().then(function (out) {
      return out.copyPages(src, idxs).then(function (pages) {
        pages.forEach(function (p) { out.addPage(p); });
        return out;
      });
    });
  }
  function one(name, doc) {
    return doc.save().then(function (bytes) { return { name: name, blob: pdfBlob(bytes) }; });
  }

  var RANGE_HINT = "Example: 1-3, 5, 8-12 (pages 1 to 3, page 5, pages 8 to 12).";
  var TOOLS = {
    merge: {
      accept: ".pdf,application/pdf", multiple: true, ordered: true, min: 2, btn: "Merge PDFs",
      run: function (files, o, prog) {
        return needPdfLib().then(function () { return PDFLib.PDFDocument.create(); }).then(function (out) {
          var i = 0;
          return files.reduce(function (p, f) {
            return p.then(function () { return loadDoc(f); }).then(function (d) {
              return out.copyPages(d, d.getPageIndices());
            }).then(function (pages) { pages.forEach(function (pg) { out.addPage(pg); }); prog(++i / files.length); });
          }, Promise.resolve()).then(function () {
            return one("merged.pdf", out).then(function (r) { return { files: [r], pages: out.getPageCount() }; });
          });
        });
      }
    },
    split: {
      accept: ".pdf,application/pdf", btn: "Split PDF",
      options: [
        { id: "mode", label: "Split by", type: "select", choices: [["ranges", "Custom ranges"], ["every", "Every N pages"], ["each", "Every page"]] },
        { id: "ranges", label: "Ranges", type: "text", value: "1-3, 4-", hint: "Each comma-separated range becomes its own file. " + RANGE_HINT, show: function (o) { return o.mode === "ranges"; } },
        { id: "n", label: "Pages per file", type: "number", value: 2, min: 1, show: function (o) { return o.mode === "every"; } }
      ],
      run: function (files, o, prog) {
        var f = files[0];
        return loadDoc(f).then(function (src) {
          var total = src.getPageCount(), groups = [], i;
          if (o.mode === "each") for (i = 0; i < total; i++) groups.push([i]);
          else if (o.mode === "every") {
            var n = Math.max(1, +o.n || 1);
            for (i = 0; i < total; i += n) { var g = []; for (var j = i; j < Math.min(total, i + n); j++) g.push(j); groups.push(g); }
          } else groups = parseRanges(o.ranges, total, true);
          var res = [], pages = 0;
          return groups.reduce(function (p, g, k) {
            return p.then(function () { return copyTo(src, g); }).then(function (d) {
              pages += g.length; prog((k + 1) / groups.length);
              return one(base(f.name) + "-part" + (k + 1) + ".pdf", d);
            }).then(function (r) { res.push(r); });
          }, Promise.resolve()).then(function () { return { files: res, pages: pages }; });
        });
      }
    },
    "remove-pages": {
      accept: ".pdf,application/pdf", btn: "Remove pages",
      options: [{ id: "pages", label: "Pages to remove", type: "text", value: "", hint: RANGE_HINT }],
      run: function (files, o) {
        return loadDoc(files[0]).then(function (src) {
          var total = src.getPageCount(), rm = {};
          parseRanges(o.pages, total).forEach(function (i) { rm[i] = 1; });
          var keep = src.getPageIndices().filter(function (i) { return !rm[i]; });
          if (!keep.length) throw new Error("You can't remove every page.");
          return copyTo(src, keep).then(function (d) {
            return one(base(files[0].name) + "-edited.pdf", d).then(function (r) { return { files: [r], pages: keep.length }; });
          });
        });
      }
    },
    "extract-pages": {
      accept: ".pdf,application/pdf", btn: "Extract pages",
      options: [{ id: "pages", label: "Pages to extract", type: "text", value: "", hint: RANGE_HINT + " – order is kept, so “3,1” puts page 3 first." }],
      run: function (files, o) {
        return loadDoc(files[0]).then(function (src) {
          var idx = parseRanges(o.pages, src.getPageCount());
          return copyTo(src, idx).then(function (d) {
            return one(base(files[0].name) + "-extract.pdf", d).then(function (r) { return { files: [r], pages: idx.length }; });
          });
        });
      }
    },
    rotate: {
      accept: ".pdf,application/pdf", btn: "Rotate PDF",
      options: [
        { id: "angle", label: "Rotate", type: "select", choices: [["90", "90° clockwise"], ["180", "180°"], ["270", "90° counter-clockwise"]] },
        { id: "pages", label: "Pages", type: "text", value: "", hint: RANGE_HINT + " Leave empty for all pages." }
      ],
      run: function (files, o) {
        return loadDoc(files[0]).then(function (d) {
          var all = d.getPages(), idx = o.pages.trim() ? parseRanges(o.pages, all.length) : d.getPageIndices();
          idx.forEach(function (i) {
            var p = all[i]; p.setRotation(PDFLib.degrees(((p.getRotation().angle + +o.angle) % 360 + 360) % 360));
          });
          return one(base(files[0].name) + "-rotated.pdf", d).then(function (r) { return { files: [r], pages: idx.length }; });
        });
      }
    },
    organize: {
      accept: ".pdf,application/pdf", btn: "Save PDF", organizer: true,
      run: function (files, o) {
        return loadDoc(files[0]).then(function (src) {
          var keep = o.order.filter(function (p) { return !p.del; });
          if (!keep.length) throw new Error("Keep at least one page.");
          return copyTo(src, keep.map(function (p) { return p.i; })).then(function (d) {
            d.getPages().forEach(function (pg, k) {
              if (keep[k].rot) pg.setRotation(PDFLib.degrees(((pg.getRotation().angle + keep[k].rot) % 360 + 360) % 360));
            });
            return one(base(files[0].name) + "-organized.pdf", d).then(function (r) { return { files: [r], pages: keep.length }; });
          });
        });
      }
    },
    compress: {
      accept: ".pdf,application/pdf", btn: "Compress PDF",
      options: [
        { id: "level", label: "Method", type: "select", value: "image", choices: [["image", "Re-render pages as images (smallest)"], ["light", "Optimise structure only (text stays selectable)"]] },
        { id: "dpi", label: "Resolution (DPI)", type: "select", value: "120", show: function (o) { return o.level !== "light"; }, choices: [["72", "72 dpi – screen, smallest"], ["96", "96 dpi"], ["120", "120 dpi"], ["150", "150 dpi – good"], ["200", "200 dpi"], ["300", "300 dpi – print"]] },
        { id: "quality", label: "Image quality", type: "range", value: "70", min: 10, max: 95, step: 5, unit: "%", show: function (o) { return o.level !== "light"; } }
      ],
      estimate: function (f, o) {
        if (o.level === "light") return Promise.resolve("Estimated size: typically " + size(f.size * 0.9) + " – " + size(f.size) + " (small gains only)");
        var dpi = +o.dpi, q = o.quality / 100;
        return pdfJsDoc(f).then(function (pdf) {
          var n = pdf.numPages, idx = [], k = Math.min(3, n), i;
          for (i = 0; i < k; i++) idx.push(k === 1 ? 1 : 1 + Math.round(i * (n - 1) / (k - 1)));
          var total = 0, seq = Promise.resolve();
          idx.forEach(function (p) {
            seq = seq.then(function () { return pdf.getPage(p); }).then(function (page) {
              var v = page.getViewport({ scale: dpi / 72 });
              var c = document.createElement("canvas"); c.width = Math.ceil(v.width); c.height = Math.ceil(v.height);
              var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
              return page.render({ canvasContext: ctx, viewport: v }).promise.then(function () { return canvasBlob(c, "image/jpeg", q); })
                .then(function (b) { total += b.size; c.width = c.height = 0; });
            });
          });
          return seq.then(function () {
            var est = total / idx.length * n + 2000;
            return "Estimated size: ≈ " + size(est * 0.85) + " – " + size(est * 1.15) + " (original " + size(f.size) + (est >= f.size ? " – may not get smaller" : ", about −" + Math.round(100 - est / f.size * 100) + "%") + ")";
          });
        });
      },
      run: function (files, o, prog) {
        var f = files[0];
        if (o.level === "light") {
          return loadDoc(f).then(function (d) { return d.save({ useObjectStreams: true }); }).then(function (bytes) {
            return finishCompress(f, pdfBlob(bytes), 0);
          });
        }
        var dpi = +o.dpi, q = o.quality / 100;
        return Promise.all([pdfJsDoc(f), needPdfLib()]).then(function (a) {
          var pdf = a[0], out, n = pdf.numPages;
          return PDFLib.PDFDocument.create().then(function (d) {
            out = d;
            var seq = Promise.resolve();
            for (var i = 1; i <= n; i++) (function (i) {
              seq = seq.then(function () { return pdf.getPage(i); }).then(function (page) {
                var v1 = page.getViewport({ scale: 1 }), v = page.getViewport({ scale: dpi / 72 });
                var c = document.createElement("canvas"); c.width = Math.ceil(v.width); c.height = Math.ceil(v.height);
                var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
                return page.render({ canvasContext: ctx, viewport: v }).promise.then(function () { return canvasBlob(c, "image/jpeg", q); })
                  .then(readBuf).then(function (b) { return out.embedJpg(b); }).then(function (img) {
                    out.addPage([v1.width, v1.height]).drawImage(img, { x: 0, y: 0, width: v1.width, height: v1.height });
                    c.width = c.height = 0; prog(i / n);
                  });
              });
            })(i);
            return seq;
          }).then(function () { return out.save(); }).then(function (bytes) { return finishCompress(f, pdfBlob(bytes), n); });
        });
      }
    },
    "pdf-to-jpg": {
      accept: ".pdf,application/pdf", btn: "Convert to images",
      options: [
        { id: "fmt", label: "Format", type: "select", choices: [["jpeg", "JPG"], ["png", "PNG"]] },
        { id: "dpi", label: "Quality", type: "select", value: "150", choices: [["96", "Screen (96 dpi)"], ["150", "Good (150 dpi)"], ["220", "High (220 dpi)"], ["300", "Print (300 dpi)"]] }
      ],
      run: function (files, o, prog) {
        var f = files[0], ext = o.fmt === "png" ? "png" : "jpg";
        return pdfJsDoc(f).then(function (pdf) {
          var res = [], seq = Promise.resolve();
          for (var i = 1; i <= pdf.numPages; i++) (function (i) {
            seq = seq.then(function () { return pdf.getPage(i); }).then(function (page) {
              var v = page.getViewport({ scale: +o.dpi / 72 });
              var c = document.createElement("canvas"); c.width = Math.ceil(v.width); c.height = Math.ceil(v.height);
              var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
              return page.render({ canvasContext: ctx, viewport: v }).promise.then(function () { return canvasBlob(c, "image/" + o.fmt, 0.92); })
                .then(function (b) { res.push({ name: base(f.name) + "-page" + i + "." + ext, blob: b }); c.width = c.height = 0; prog(i / pdf.numPages); });
            });
          })(i);
          return seq.then(function () { return { files: res, pages: res.length }; });
        });
      }
    },
    "jpg-to-pdf": {
      accept: "image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp", multiple: true, ordered: true, min: 1, btn: "Create PDF",
      options: [
        { id: "size", label: "Page size", type: "select", choices: [["fit", "Same as image"], ["a4", "A4"], ["letter", "US Letter"]] },
        { id: "margin", label: "Margin (pt)", type: "number", value: 0, min: 0, max: 100, show: function (o) { return o.size !== "fit"; } }
      ],
      run: function (files, o, prog) {
        return needPdfLib().then(function () { return PDFLib.PDFDocument.create(); }).then(function (out) {
          var seq = Promise.resolve();
          files.forEach(function (f, k) {
            seq = seq.then(function () { return toEmbeddable(f); }).then(function (img) {
              return (img.type === "jpg" ? out.embedJpg(img.buf) : out.embedPng(img.buf));
            }).then(function (im) {
              var w = im.width, hh = im.height, pw, ph, m = 0;
              if (o.size === "fit") { pw = w; ph = hh; }
              else {
                pw = o.size === "a4" ? 595.28 : 612; ph = o.size === "a4" ? 841.89 : 792; m = +o.margin || 0;
                if (w > hh) { var t = pw; pw = ph; ph = t; }
              }
              var s = Math.min((pw - 2 * m) / w, (ph - 2 * m) / hh);
              var dw = w * s, dh = hh * s;
              out.addPage([pw, ph]).drawImage(im, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
              prog((k + 1) / files.length);
            });
          });
          return seq.then(function () { return one("images.pdf", out); }).then(function (r) { return { files: [r], pages: files.length }; });
        });
      }
    },
    "pdf-to-gif": {
      accept: ".pdf,application/pdf", btn: "Create GIF",
      options: [
        { id: "width", label: "Width (px)", type: "number", value: 480, min: 100, max: 1200 },
        { id: "delay", label: "Seconds per page", type: "number", value: 1, min: 0.1, max: 30, step: 0.1 },
        { id: "pages", label: "Pages", type: "text", value: "", hint: RANGE_HINT + " Leave empty for all pages." },
        { id: "quality", label: "Quality", type: "select", value: "10", choices: [["20", "Smaller file"], ["10", "Balanced"], ["1", "Best colours (slow)"]] }
      ],
      run: function (files, o, prog) {
        var f = files[0];
        return Promise.all([pdfJsDoc(f), loadScript("vendor/gif.js")]).then(function (a) {
          var pdf = a[0], idx = o.pages.trim() ? parseRanges(o.pages, pdf.numPages) : Array.from({ length: pdf.numPages }, function (_, i) { return i; });
          if (idx.length > 200) throw new Error("Please choose at most 200 pages for a GIF.");
          var W = Math.max(100, Math.min(1200, +o.width || 480)), H = 0, gif, seq = Promise.resolve();
          idx.forEach(function (pi, k) {
            seq = seq.then(function () { return pdf.getPage(pi + 1); }).then(function (page) {
              var v0 = page.getViewport({ scale: 1 });
              if (!H) {
                H = Math.round(W * v0.height / v0.width);
                gif = new GIF({ workers: 2, quality: +o.quality, width: W, height: H, workerScript: "vendor/gif.worker.js" });
              }
              var s = Math.min(W / v0.width, H / v0.height), v = page.getViewport({ scale: s });
              var c = document.createElement("canvas"); c.width = W; c.height = H;
              var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
              var t = document.createElement("canvas"); t.width = Math.ceil(v.width); t.height = Math.ceil(v.height);
              return page.render({ canvasContext: t.getContext("2d"), viewport: v }).promise.then(function () {
                ctx.drawImage(t, (W - t.width) / 2, (H - t.height) / 2);
                gif.addFrame(c, { delay: Math.round((+o.delay || 1) * 1000) });
                prog(0.5 * (k + 1) / idx.length);
              });
            });
          });
          return seq.then(function () {
            return new Promise(function (res, rej) {
              gif.on("progress", function (p) { prog(0.5 + p / 2); });
              gif.on("finished", res);
              gif.on("abort", function () { rej(new Error("GIF creation was cancelled.")); });
              gif.render();
            });
          }).then(function (blob) { return { files: [{ name: base(f.name) + ".gif", blob: blob }], pages: idx.length }; });
        });
      }
    },
    "gif-to-pdf": {
      accept: "image/gif,.gif", btn: "Create PDF",
      options: [
        { id: "size", label: "Page size", type: "select", choices: [["fit", "Same as GIF"], ["a4", "A4"], ["letter", "US Letter"]] },
        { id: "step", label: "Keep every Nth frame", type: "number", value: 1, min: 1, max: 100, hint: "Use 2 or 3 to skip frames on long GIFs." }
      ],
      run: function (files, o, prog) {
        var f = files[0];
        return Promise.all([needPdfLib(), loadScript("vendor/omggif.js"), readBuf(f)]).then(function (a) {
          var rd;
          try { rd = new GifReader(new Uint8Array(a[2])); } catch (e) { throw new Error("“" + f.name + "” is not a valid GIF."); }
          var w = rd.width, h = rd.height, n = rd.numFrames(), step = Math.max(1, parseInt(o.step, 10) || 1);
          var buf = new Uint8ClampedArray(w * h * 4), c = document.createElement("canvas"), t = document.createElement("canvas");
          c.width = t.width = w; c.height = t.height = h;
          var cx = c.getContext("2d"), tx = t.getContext("2d");
          var count = Math.ceil(n / step);
          if (count > 300) throw new Error("This GIF has " + count + " frames. Raise “Keep every Nth frame” to stay under 300.");
          return PDFLib.PDFDocument.create().then(function (out) {
            var seq = Promise.resolve(), made = 0;
            for (var i = 0; i < n; i++) (function (i) {
              seq = seq.then(function () {
                rd.decodeAndBlitFrameRGBA(i, buf);
                if (i % step) return;
                cx.putImageData(new ImageData(buf, w, h), 0, 0);
                tx.fillStyle = "#fff"; tx.fillRect(0, 0, w, h); tx.drawImage(c, 0, 0);
                return canvasBlob(t, "image/jpeg", 0.92).then(readBuf).then(function (b) { return out.embedJpg(b); }).then(function (im) {
                  var pw = w, ph = h, m = 0;
                  if (o.size !== "fit") {
                    pw = o.size === "a4" ? 595.28 : 612; ph = o.size === "a4" ? 841.89 : 792; m = 24;
                    if (w > h) { var q = pw; pw = ph; ph = q; }
                  }
                  var s = Math.min((pw - 2 * m) / w, (ph - 2 * m) / h);
                  out.addPage([pw, ph]).drawImage(im, { x: (pw - w * s) / 2, y: (ph - h * s) / 2, width: w * s, height: h * s });
                  made++; prog((i + 1) / n);
                });
              });
            })(i);
            return seq.then(function () { return one(base(f.name) + ".pdf", out); }).then(function (r) { return { files: [r], pages: made }; });
          });
        });
      }
    },    watermark: {
      accept: ".pdf,application/pdf", btn: "Add watermark",
      options: [
        { id: "text", label: "Text", type: "text", value: "CONFIDENTIAL", hint: "Latin characters only." },
        { id: "size", label: "Font size", type: "number", value: 60, min: 8, max: 300 },
        { id: "opacity", label: "Opacity (%)", type: "number", value: 25, min: 5, max: 100 },
        { id: "color", label: "Colour", type: "color", value: "#b5532f" },
        { id: "angle", label: "Angle", type: "select", value: "45", choices: [["45", "Diagonal"], ["0", "Horizontal"]] }
      ],
      run: function (files, o) {
        if (!o.text.trim()) return Promise.reject(new Error("Please enter watermark text."));
        return loadDoc(files[0]).then(function (d) {
          return d.embedFont(PDFLib.StandardFonts.HelveticaBold).then(function (font) {
            var c = o.color.match(/\w\w/g).map(function (x) { return parseInt(x, 16) / 255; }), a = +o.angle, sz = +o.size;
            var tw = font.widthOfTextAtSize(o.text, sz);
            d.getPages().forEach(function (p) {
              var W = p.getWidth(), H = p.getHeight(), r = a * Math.PI / 180;
              // position so that the text's centre lands on the page centre
              var x = W / 2 - (tw / 2) * Math.cos(r) + (sz / 3) * Math.sin(r);
              var y = H / 2 - (tw / 2) * Math.sin(r) - (sz / 3) * Math.cos(r);
              p.drawText(o.text, { x: x, y: y, size: sz, font: font, color: PDFLib.rgb(c[0], c[1], c[2]), opacity: (+o.opacity) / 100, rotate: PDFLib.degrees(a) });
            });
            return one(base(files[0].name) + "-watermarked.pdf", d).then(function (r) { return { files: [r], pages: d.getPageCount() }; });
          });
        }).catch(function (e) { if (/encode/i.test(e.message)) throw new Error("The watermark text contains characters that can't be used. Stick to Latin letters."); throw e; });
      }
    },
    "page-numbers": {
      accept: ".pdf,application/pdf", btn: "Add page numbers",
      options: [
        { id: "pos", label: "Position", type: "select", value: "bc", choices: [["bc", "Bottom centre"], ["br", "Bottom right"], ["bl", "Bottom left"], ["tc", "Top centre"], ["tr", "Top right"], ["tl", "Top left"]] },
        { id: "fmt", label: "Format", type: "select", choices: [["n", "1, 2, 3"], ["pn", "Page 1"], ["pnn", "Page 1 of 10"], ["nn", "1 / 10"]] },
        { id: "start", label: "Start at", type: "number", value: 1 },
        { id: "size", label: "Font size", type: "number", value: 11, min: 6, max: 48 }
      ],
      run: function (files, o) {
        return loadDoc(files[0]).then(function (d) {
          return d.embedFont(PDFLib.StandardFonts.Helvetica).then(function (font) {
            var pages = d.getPages(), N = pages.length, sz = +o.size, st = parseInt(o.start, 10) || 1;
            pages.forEach(function (p, i) {
              var n = st + i, t = { n: "" + n, pn: "Page " + n, pnn: "Page " + n + " of " + (st + N - 1), nn: n + " / " + (st + N - 1) }[o.fmt];
              var w = font.widthOfTextAtSize(t, sz), W = p.getWidth(), H = p.getHeight(), m = 28;
              var x = o.pos[1] === "c" ? (W - w) / 2 : o.pos[1] === "l" ? m : W - m - w;
              var y = o.pos[0] === "b" ? m : H - m - sz;
              p.drawText(t, { x: x, y: y, size: sz, font: font, color: PDFLib.rgb(.2, .15, .1) });
            });
            return one(base(files[0].name) + "-numbered.pdf", d).then(function (r) { return { files: [r], pages: N }; });
          });
        });
      }
    },
    "fill-sign-pdf": {
      accept: ".pdf,application/pdf", btn: "Save PDF", editor: true,
      run: function (files, o, prog) {
        var items = o.editor.items.filter(function (it) { return it.type !== "text" || /\S/.test(it.text); });
        if (!items.length) return Promise.reject(new Error("Nothing to save yet – add some text, a tick or your signature first."));
        var f = files[0];
        return loadDoc(f).then(function (doc) {
          var pages = doc.getPages(), rgb = PDFLib.rgb, ink = rgb(0.1, 0.1, 0.2);
          return doc.embedFont(PDFLib.StandardFonts.Helvetica).then(function (font) {
            var cache = {};
            function embed(src) {
              if (!cache[src]) {
                var bin = atob(src.split(",")[1]), arr = new Uint8Array(bin.length);
                for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
                cache[src] = doc.embedPng(arr);
              }
              return cache[src];
            }
            var seq = Promise.resolve();
            items.forEach(function (it, k) {
              seq = seq.then(function () {
                var page = pages[it.page - 1], sz = page.getSize(), W = sz.width, H = sz.height, a = ((page.getRotation().angle % 360) + 360) % 360;
                // visible (top-left based) point -> PDF user space
                function pt(vx, vy) {
                  if (a === 90) return { x: vy, y: vx };
                  if (a === 180) return { x: W - vx, y: vy };
                  if (a === 270) return { x: W - vy, y: H - vx };
                  return { x: vx, y: H - vy };
                }
                var rot = PDFLib.degrees(a);
                if (it.type === "text") {
                  it.text.split("\n").forEach(function (line, i) {
                    var safe = line.split("").map(function (c) { try { font.encodeText(c); return c; } catch (e) { return "?"; } }).join("");
                    if (!safe) return;
                    var p = pt(it.x, it.y + (i * 1.2 + 0.95) * it.size);
                    page.drawText(safe, { x: p.x, y: p.y, size: it.size, font: font, color: ink, rotate: rot });
                  });
                } else if (it.type === "check" || it.type === "cross") {
                  var s = it.w / 24, th = Math.max(1, 2.6 * s);
                  var segs = it.type === "check" ? [[[4, 13], [9, 18]], [[9, 18], [20, 6]]] : [[[5, 5], [19, 19]], [[19, 5], [5, 19]]];
                  segs.forEach(function (sg) {
                    var p1 = pt(it.x + sg[0][0] * s, it.y + sg[0][1] * s), p2 = pt(it.x + sg[1][0] * s, it.y + sg[1][1] * s);
                    page.drawLine({ start: p1, end: p2, thickness: th, color: ink, lineCap: PDFLib.LineCapStyle.Round });
                  });
                } else {
                  return embed(it.src).then(function (img) {
                    var p = pt(it.x, it.y + it.h);
                    page.drawImage(img, { x: p.x, y: p.y, width: it.w, height: it.h, rotate: rot });
                  });
                }
              }).then(function () { prog((k + 1) / items.length); });
            });
            return seq;
          }).then(function () {
            return one(base(f.name) + "-filled.pdf", doc).then(function (r) { return { files: [r], pages: pages.length }; });
          });
        });
      }
    },
    "pdf-to-text": {
      accept: ".pdf,application/pdf", btn: "Extract text",
      run: function (files, o, prog) {
        var f = files[0];
        return pdfJsDoc(f).then(function (pdf) {
          var out = [], seq = Promise.resolve();
          for (var i = 1; i <= pdf.numPages; i++) (function (i) {
            seq = seq.then(function () { return pdf.getPage(i); }).then(function (p) { return p.getTextContent(); }).then(function (tc) {
              var line = "", s = "";
              tc.items.forEach(function (it) { s += it.str + (it.hasEOL ? "\n" : " "); });
              out.push("--- Page " + i + " ---\n" + s.trim()); prog(i / pdf.numPages);
            });
          })(i);
          return seq.then(function () {
            var txt = out.join("\n\n");
            if (!/\S/.test(out.join("").replace(/--- Page \d+ ---/g, ""))) throw new Error("No text found – this PDF may be a scan (images only).");
            return { files: [{ name: base(f.name) + ".txt", blob: new Blob([txt], { type: "text/plain;charset=utf-8" }) }], pages: pdf.numPages };
          });
        });
      }
    }
  };

  var LIMITS = {
    merge: "No fixed file count, but everything is processed in your device's memory, so very large batches (over roughly 500 MB in total) can be slow. Password-protected PDFs aren't supported.",
    split: "Works well up to a few hundred pages. Password-protected PDFs aren't supported. Many output files are offered as one ZIP.",
    "remove-pages": "Works well up to a few hundred pages. You can't remove every page. Password-protected PDFs aren't supported.",
    "extract-pages": "Works well up to a few hundred pages. Password-protected PDFs aren't supported.",
    organize: "Works well up to a few hundred pages; every page is shown as a thumbnail. Password-protected PDFs aren't supported.",
    "fill-sign-pdf": "Visual fill-in and signature only – not a certificate-based qualified electronic signature. Text uses a standard font (basic Latin characters). Password-protected PDFs aren't supported.",
    rotate: "Works well up to a few hundred pages. Rotation is in steps of 90°. Password-protected PDFs aren't supported.",
    compress: "Re-rendering turns pages into images (text is no longer selectable); structure-only keeps text. The size estimate is approximate. If the result isn't smaller, we keep your original. Password-protected PDFs aren't supported.",
    "pdf-to-jpg": "Long PDFs at 300 dpi need a lot of memory – pick a lower quality if your browser slows down. Results are offered as one ZIP.",
    "jpg-to-pdf": "Accepts JPG, PNG, WebP, GIF and BMP. Very large photos use a lot of memory, so convert big batches in parts.",
    "pdf-to-gif": "Up to 200 pages per GIF, 100–1200 px wide. GIFs are limited to 256 colours, so photos look grainier than in the PDF.",
    "gif-to-pdf": "Up to 300 frames (use “Keep every Nth frame” for longer GIFs). Frames become JPG pages; transparency turns white.",
    watermark: "Latin letters only (no emoji or non-Latin scripts). The same watermark goes on every page. Password-protected PDFs aren't supported.",
    "page-numbers": "Numbers are added to every page in Helvetica. Password-protected PDFs aren't supported.",
    "pdf-to-text": "Only text that is really inside the PDF is extracted. Scanned pages (pictures of text) can't be read because OCR isn't included."
  };

  var MAXTHUMBS = 60;
  function thumbCell(label, el) {
    return h("div", { class: "thumb ro" }, [h("div", { class: "pic" }, [el]), h("span", { text: label, title: label })]);
  }
  function imgCell(src, label) { return thumbCell(label, h("img", { src: src, alt: label })); }
  // Renders PDF pages as thumbnails: mode "all" = every page, "first" = page 1 only (label is the file name)
  function pdfThumbs(grid, file, mode, label, alive) {
    return pdfJsDoc(file).then(function (pdf) {
      var n = mode === "first" ? 1 : Math.min(pdf.numPages, MAXTHUMBS), seq = Promise.resolve();
      Array.apply(null, Array(n)).forEach(function (_, i) {
        var cv = h("canvas");
        grid.appendChild(thumbCell(mode === "first" ? label : label + (i + 1), cv));
        seq = seq.then(function () { return alive() ? pdf.getPage(i + 1) : null; }).then(function (page) {
          if (!page) return;
          var v0 = page.getViewport({ scale: 1 }), v = page.getViewport({ scale: 150 / Math.max(v0.width, v0.height) });
          cv.width = v.width; cv.height = v.height;
          return page.render({ canvasContext: cv.getContext("2d"), viewport: v }).promise;
        });
      });
      if (mode !== "first" && pdf.numPages > n) grid.appendChild(h("p", { class: "more", text: "+ " + (pdf.numPages - n) + " more pages not shown" }));
      return seq;
    });
  }
  function resPreview(grid, files, urls) {
    var pdfs = files.filter(function (f) { return /\.pdf$/i.test(f.name); }), seq = Promise.resolve(), always = function () { return true; };
    if (pdfs.length === 1 && files.length === 1) { pdfThumbs(grid, pdfs[0].blob, "all", "Page ", always).catch(function () {}); return; }
    files.slice(0, MAXTHUMBS).forEach(function (f) {
      if (/\.pdf$/i.test(f.name)) seq = seq.then(function () { return pdfThumbs(grid, f.blob, "first", f.name, always); }).catch(function () {});
      else if (/\.(png|jpe?g|gif)$/i.test(f.name)) { var u = URL.createObjectURL(f.blob); urls.push(u); grid.appendChild(imgCell(u, f.name)); }
      else if (/\.txt$/i.test(f.name)) {
        var pre = h("pre", { class: "txtprev", text: "…" }); grid.className = ""; grid.appendChild(pre);
        f.blob.text().then(function (t) { pre.textContent = t.slice(0, 2500) + (t.length > 2500 ? "\n…" : ""); });
      }
    });
    if (files.length > MAXTHUMBS) grid.appendChild(h("p", { class: "more", text: "+ " + (files.length - MAXTHUMBS) + " more files not shown" }));
  }

  function finishCompress(f, blob, pages) {
    var better = blob.size < f.size;
    return loadDoc(f).then(function (d) { return d.getPageCount(); }).catch(function () { return pages; }).then(function (n) {
      return {
        files: [{ name: base(f.name) + "-compressed.pdf", blob: better ? blob : f }],
        pages: n || pages,
        note: better ? "Reduced from " + size(f.size) + " to " + size(blob.size) + " (−" + Math.round(100 - blob.size / f.size * 100) + "%)."
          : "This file is already well optimised – we kept the original (" + size(f.size) + "). Try a lower DPI or quality."
      };
    });
  }

  function toEmbeddable(f) {
    if (/jpe?g$/i.test(f.type) || /\.jpe?g$/i.test(f.name)) return readBuf(f).then(function (b) { return { type: "jpg", buf: b }; });
    if (/png$/i.test(f.type) || /\.png$/i.test(f.name)) return readBuf(f).then(function (b) { return { type: "png", buf: b }; });
    return createImageBitmap(f).then(function (bm) {
      var c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height;
      c.getContext("2d").drawImage(bm, 0, 0);
      return canvasBlob(c, "image/png");
    }).then(readBuf).then(function (b) { return { type: "png", buf: b }; })
      .catch(function () { throw new Error("“" + f.name + "” is not a supported image."); });
  }

  // ---------- UI ----------
  function mount(root) {
    var key = root.dataset.tool, T = TOOLS[key], files = [], opts = {}, results = [];
    var drop = h("div", { class: "drop", tabindex: "0" }, [
      h("strong", { text: T.multiple ? "Choose files or drop them here" : "Choose a file or drop it here" }),
      h("small", { text: "Your files never leave this device." })
    ]);
    var input = h("input", { type: "file", hidden: "", accept: T.accept });
    if (T.multiple) input.multiple = true;
    var list = h("ul", { class: "files" }), optBox = h("div", { class: "opts" }), orgBox = h("div"), status = h("div", { class: "status" });
    var edBox = h("div", { class: "editor", hidden: "" }), edState = { items: [] }, edCtl = null;
    var prog = h("progress", { max: "1", value: "0", hidden: "" });
    var go = h("button", { class: "btn", text: T.btn, disabled: "" });
    var limitBox = h("p", { class: "limits" }, [h("b", { text: "Limits: " }), document.createTextNode(LIMITS[key] || "")]);
    var prevBox = h("div", { class: "prev" });
    var panel = h("div", { class: "panel" }, [drop, input, limitBox, list, prevBox, orgBox, edBox, optBox, prog, status, h("div", { class: "actions" }, [go])]);
    var resBox = h("div", { class: "panel", hidden: "" });
    root.appendChild(panel); root.appendChild(resBox);

    (T.options || []).forEach(function (d) { opts[d.id] = d.value !== undefined ? d.value : (d.choices ? d.choices[0][0] : ""); });
    function drawOpts() {
      optBox.innerHTML = "";
      (T.options || []).forEach(function (d) {
        if (d.show && !d.show(opts)) return;
        var inp;
        if (d.type === "select") {
          inp = h("select", {}, d.choices.map(function (c) { return h("option", { value: c[0], text: c[1] }); }));
        } else {
          inp = h("input", { type: d.type });
          if (d.min !== undefined) inp.min = d.min; if (d.max !== undefined) inp.max = d.max; if (d.step !== undefined) inp.step = d.step;
        }
        inp.id = "o-" + d.id; inp.value = opts[d.id];
        var redraw = d.id === "mode" || d.id === "size" || d.id === "level";
        var lab = h("label", { for: inp.id, text: d.label + (d.type === "range" ? ": " + opts[d.id] + (d.unit || "") : "") });
        inp.oninput = function () { opts[d.id] = inp.value; if (d.type === "range") lab.textContent = d.label + ": " + inp.value + (d.unit || ""); schedEst(); };
        inp.onchange = function () { opts[d.id] = inp.value; if (redraw) drawOpts(); schedEst(); };
        var box = h("div", {}, [lab, inp]);
        if (d.hint) box.appendChild(h("small", { text: d.hint }));
        optBox.appendChild(box);
      });
    }
    drawOpts();
    var estBox = h("p", { class: "estimate", hidden: "" }), estTimer = 0, estTok = 0;
    optBox.parentNode.insertBefore(estBox, optBox.nextSibling);
    function schedEst() {
      if (!T.estimate) return;
      clearTimeout(estTimer);
      if (!files.length) { estBox.hidden = true; return; }
      estBox.hidden = false; estBox.textContent = "Estimating size…";
      var tok = ++estTok;
      estTimer = setTimeout(function () {
        T.estimate(files[0], opts).then(function (t) { if (tok === estTok) estBox.textContent = t; })
          .catch(function () { if (tok === estTok) estBox.hidden = true; });
      }, 450);
    }

    function msg(t, err) { status.textContent = t || ""; status.className = "status" + (err ? " err" : ""); }
    function sync() {
      var min = T.min || 1;
      go.disabled = files.length < min;
      drop.hidden = !T.multiple && files.length > 0;
      optBox.hidden = orgBox.hidden = files.length === 0;
      edBox.hidden = files.length === 0;
      go.hidden = files.length === 0;
      if (files.length && files.length < min) msg("Add at least " + min + " files.");
      else if (status.textContent.indexOf("Add at least") === 0) msg("");
    }
    function drawList() {
      list.innerHTML = "";
      files.forEach(function (f, i) {
        var li = h("li", { draggable: T.ordered ? "true" : "false" }, [
          h("span", { class: "name", text: f.name }), h("span", { class: "meta", text: size(f.size) })
        ]);
        if (T.ordered) {
          li.appendChild(h("button", { class: "btn ghost sm", title: "Move up", text: "↑", onclick: function () { mv(i, i - 1); } }));
          li.appendChild(h("button", { class: "btn ghost sm", title: "Move down", text: "↓", onclick: function () { mv(i, i + 1); } }));
          li.ondragstart = function (e) { e.dataTransfer.setData("text/plain", i); li.classList.add("dragging"); };
          li.ondragend = function () { li.classList.remove("dragging"); };
          li.ondragover = function (e) { e.preventDefault(); };
          li.ondrop = function (e) { e.preventDefault(); e.stopPropagation(); var from = +e.dataTransfer.getData("text/plain"); if (!isNaN(from)) mv(from, i); };
        }
        li.appendChild(h("button", { class: "btn ghost sm", title: "Remove", text: "✕", onclick: function () { files.splice(i, 1); fileChange(); } }));
        list.appendChild(li);
      });
    }
    function mv(a, b) { if (b < 0 || b >= files.length) return; files.splice(b, 0, files.splice(a, 1)[0]); drawList(); }
    var prevUrls = [], prevToken = 0;
    function drawInputPreview() {
      var tok = ++prevToken;
      prevUrls.forEach(URL.revokeObjectURL); prevUrls = [];
      prevBox.innerHTML = "";
      if (!files.length || T.organizer || T.editor) return;
      var grid = h("div", { class: "thumbs" }), seq = Promise.resolve();
      prevBox.appendChild(h("small", { text: "Preview" })); prevBox.appendChild(grid);
      var alive = function () { return tok === prevToken; };
      if (/^image/.test(T.accept)) files.forEach(function (f) {
        var u = URL.createObjectURL(f); prevUrls.push(u); grid.appendChild(imgCell(u, f.name));
      });
      else if (T.multiple) files.forEach(function (f) { seq = seq.then(function () { return alive() && pdfThumbs(grid, f, "first", f.name, alive); }).catch(function () {}); });
      else pdfThumbs(grid, files[0], "all", "Page ", alive).catch(function () {});
    }
    function drawEditor() {
      if (edCtl) edCtl.destroy(); edCtl = null; edBox.innerHTML = ""; edState = { items: [] };
      if (files.length) edCtl = buildEditor(edBox, files[0], edState, function () { resBox.hidden = true; });
    }
    function fileChange() { drawList(); sync(); drawInputPreview(); schedEst(); if (T.organizer) drawOrganizer(); if (T.editor) drawEditor(); }

    function add(fl) {
      var arr = Array.prototype.slice.call(fl);
      if (!T.multiple) arr = arr.slice(0, 1);
      files = T.multiple ? files.concat(arr) : arr;
      resBox.hidden = true; msg("");
      fileChange();
    }
    drop.onclick = function () { input.click(); };
    drop.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } };
    input.onchange = function () { if (input.files.length) add(input.files); input.value = ""; };
    ["dragover", "dragenter"].forEach(function (n) { panel.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (n) { panel.addEventListener(n, function () { drop.classList.remove("over"); }); });
    panel.addEventListener("drop", function (e) { e.preventDefault(); if (e.dataTransfer.files.length) add(e.dataTransfer.files); });

    // Page organizer (thumbnails, drag to reorder, rotate, delete)
    var order = [];
    function drawOrganizer() {
      orgBox.innerHTML = "";
      if (!files.length) return;
      msg("Loading pages…"); go.disabled = true; order = [];
      pdfJsDoc(files[0]).then(function (pdf) {
        go.disabled = false; for (var i = 0; i < pdf.numPages; i++) order.push({ i: i, rot: 0, del: false });
        var grid = h("div", { class: "thumbs" });
        orgBox.appendChild(h("small", { text: "Drag pages to reorder. Use ⟳ to rotate and ✕ to delete." }));
        orgBox.appendChild(grid);
        var cells = [];
        order.forEach(function (p) {
          var cv = h("canvas"), cell = h("div", { class: "thumb", draggable: "true" }, [h("div", { class: "pic" }, [cv]), h("span", { text: "Page " + (p.i + 1) })]);
          var rb = h("button", { class: "btn ghost sm", text: "⟳", title: "Rotate", onclick: function () { p.rot = (p.rot + 90) % 360; cv.style.transform = "rotate(" + p.rot + "deg)"; } });
          var db = h("button", { class: "btn ghost sm", text: "✕", title: "Delete / restore", onclick: function () { p.del = !p.del; cell.classList.toggle("del", p.del); } });
          cell.appendChild(h("div", { class: "tb" }, [rb, db]));
          cell.ondragstart = function (e) { e.dataTransfer.setData("text/plain", "p" + order.indexOf(p)); cell.classList.add("dragging"); };
          cell.ondragend = function () { cell.classList.remove("dragging"); };
          cell.ondragover = function (e) { e.preventDefault(); };
          cell.ondrop = function (e) {
            e.preventDefault(); e.stopPropagation();
            var d = e.dataTransfer.getData("text/plain"); if (d[0] !== "p") return;
            var from = +d.slice(1), to = order.indexOf(p);
            order.splice(to, 0, order.splice(from, 1)[0]);
            grid.innerHTML = ""; order.forEach(function (q) { grid.appendChild(q.cell); });
          };
          p.cell = cell; grid.appendChild(cell);
          cells.push([p, cv]);
        });
        msg("");
        var seq = Promise.resolve();
        cells.forEach(function (pc) {
          seq = seq.then(function () { return pdf.getPage(pc[0].i + 1); }).then(function (page) {
            var v0 = page.getViewport({ scale: 1 }), v = page.getViewport({ scale: 150 / Math.max(v0.width, v0.height) });
            pc[1].width = v.width; pc[1].height = v.height;
            return page.render({ canvasContext: pc[1].getContext("2d"), viewport: v }).promise;
          });
        });
      }).catch(function () { msg("Could not read this PDF.", true); });
    }

    go.onclick = function () {
      go.disabled = true; resBox.hidden = true; msg("Working…"); prog.hidden = false; prog.value = 0;
      var o = Object.assign({}, opts); if (T.organizer) o.order = order;
      if (T.editor) o.editor = edState;
      Promise.resolve().then(function () { return T.run(files, o, function (v) { prog.value = v; }); }).then(function (r) {
        msg(""); showResults(r); Donate.add(r.pages);
      }).catch(function (e) { msg(e.message || String(e), true); }).then(function () { prog.hidden = true; go.disabled = files.length < (T.min || 1); });
    };

    var urls = [];
    function showResults(r) {
      urls.forEach(URL.revokeObjectURL); urls = [];
      resBox.hidden = false; resBox.innerHTML = "";
      resBox.appendChild(h("h2", { text: "All done ✓" }));
      if (r.note) resBox.appendChild(h("p", { text: r.note }));
      r.files.forEach(function (f) {
        var u = URL.createObjectURL(f.blob); urls.push(u);
        resBox.appendChild(h("div", { class: "result" }, [
          h("span", { class: "name", text: f.name }), h("span", { class: "meta", text: size(f.blob.size) }),
          h("a", { class: "btn alt sm", href: u, download: f.name, text: "Download" })
        ]));
      });
      var zipBtn = null;
      if (r.files.length > 1) {
        var z = zipBtn =  h("button", { class: "btn", text: "Download all as ZIP", style: "margin-top:1rem" });
        z.onclick = function () {
          z.disabled = true;
          needZip().then(function () {
            var zip = new JSZip(); r.files.forEach(function (f) { zip.file(f.name, f.blob); });
            return zip.generateAsync({ type: "blob" });
          }).then(function (b) {
            var a = h("a", { href: URL.createObjectURL(b), download: "files.zip" }); document.body.appendChild(a); a.click(); a.remove();
          }).then(function () { z.disabled = false; });
        };
        resBox.appendChild(z);
      }
      var again = h("button", { class: "btn ghost", text: "Start over", style: "margin:1rem 0 0 .5rem", onclick: function () { files = []; resBox.hidden = true; msg(""); fileChange(); window.scrollTo({ top: 0, behavior: "smooth" }); } });
      resBox.appendChild(again);
      var pv = h("div", { class: "prev" }), pgrid = h("div", { class: "thumbs" });
      pv.appendChild(h("small", { text: "Preview of your result" })); pv.appendChild(pgrid); resBox.appendChild(pv);
      resPreview(pgrid, r.files, urls);
      var box =  h("div", { class: "donate", "data-donate-box": "" }); resBox.appendChild(box); Donate.render(box);
      resBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    sync();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var r = $("#tool"), shell = document.body.classList.contains("shell"), meta = null;
    if (shell) {
      meta = JSON.parse($("#meta").textContent);
      var open = function (k, push) {
        var home = k === "home" || !TOOLS[k];
        $("#home").hidden = !home; $("#toolview").hidden = home;
        if (home) k = "home";
        document.querySelectorAll(".rail a").forEach(function (a) { a.classList.toggle("active", a.dataset.tool === k); });
        if (home) {
          r.innerHTML = ""; document.title = "pdf pangea – Free private PDF tools: merge, split, compress, convert";
          if (push) history.replaceState(null, "", location.pathname + location.search);
          window.scrollTo(0, 0);
        } else {
          r.dataset.tool = k; r.innerHTML = ""; mount(r);
          $("#tt").textContent = meta[k].h1; $("#ts").textContent = meta[k].intro;
          document.title = meta[k].h1 + " – pdf pangea";
          if (push) history.replaceState(null, "", "#" + meta[k].slug);
        }
        var act = document.querySelector(".rail a.active"); if (act && act.scrollIntoView) act.scrollIntoView({ block: "nearest", inline: "center" });
      };
      var rail = $("#rail"), rt = $(".rt");
      var setOpen = function (v) { rail.classList.toggle("open", v); rt.setAttribute("aria-expanded", v); rt.textContent = v ? "Close ▴" : "View all tools ▾"; };
      rt.onclick = function () { setOpen(!rail.classList.contains("open")); };
      document.querySelectorAll("a[data-tool]").forEach(function (a) {
        a.addEventListener("click", function (e) { e.preventDefault(); open(a.dataset.tool, true); setOpen(false); if (document.activeElement) document.activeElement.blur(); });
      });
      var start = "home", h = location.hash.slice(1);
      Object.keys(meta).forEach(function (k) { if (meta[k].slug === h) start = k; });
      var logo = $("header.site .logo");
      if (logo) logo.addEventListener("click", function (e) { e.preventDefault(); open("home", true); setOpen(false); });
      open(start, false);
    } else if (r && TOOLS[r.dataset.tool]) mount(r);
    if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(function () {});
  });
})();
