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

  // "1-3, 5, 8-" -> [0,1,2,4,7,...]
  function parseRanges(str, total, keepGroups) {
    var groups = [];
    String(str || "").split(",").forEach(function (part) {
      part = part.trim(); if (!part) return;
      var m = part.match(/^(\d*)\s*-\s*(\d*)$/), a, b;
      if (m) { a = m[1] ? +m[1] : 1; b = m[2] ? +m[2] : total; }
      else if (/^\d+$/.test(part)) { a = b = +part; }
      else throw new Error("Can't understand “" + part + "”. Use e.g. 1-3, 5, 8-");
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

  var RANGE_HINT = "e.g. 1-3, 5, 8-";
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
        { id: "pages", label: "Pages", type: "text", value: "", hint: "Leave empty for all pages. " + RANGE_HINT }
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
        { id: "level", label: "Compression", type: "select", choices: [["light", "Light – keeps text selectable"], ["medium", "Balanced – pages become images (150 dpi)"], ["strong", "Strong – pages become images (100 dpi)"]] }
      ],
      run: function (files, o, prog) {
        var f = files[0];
        if (o.level === "light") {
          return loadDoc(f).then(function (d) { return d.save({ useObjectStreams: true }); }).then(function (bytes) {
            return finishCompress(f, pdfBlob(bytes), 0);
          });
        }
        var dpi = o.level === "medium" ? 150 : 100, q = o.level === "medium" ? 0.72 : 0.55;
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
    watermark: {
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

  function finishCompress(f, blob, pages) {
    var better = blob.size < f.size;
    return loadDoc(f).then(function (d) { return d.getPageCount(); }).catch(function () { return pages; }).then(function (n) {
      return {
        files: [{ name: base(f.name) + "-compressed.pdf", blob: better ? blob : f }],
        pages: n || pages,
        note: better ? "Reduced from " + size(f.size) + " to " + size(blob.size) + " (−" + Math.round(100 - blob.size / f.size * 100) + "%)."
          : "This file is already well optimised – we kept the original (" + size(f.size) + "). Try a stronger level."
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
    var prog = h("progress", { max: "1", value: "0", hidden: "" });
    var go = h("button", { class: "btn", text: T.btn, disabled: "" });
    var panel = h("div", { class: "panel" }, [drop, input, list, orgBox, optBox, prog, status, h("div", { class: "actions" }, [go])]);
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
          if (d.min !== undefined) inp.min = d.min; if (d.max !== undefined) inp.max = d.max;
        }
        inp.id = "o-" + d.id; inp.value = opts[d.id];
        var redraw = d.id === "mode" || d.id === "size";
        inp.oninput = function () { opts[d.id] = inp.value; };
        inp.onchange = function () { opts[d.id] = inp.value; if (redraw) drawOpts(); };
        var box = h("div", {}, [h("label", { for: inp.id, text: d.label }), inp]);
        if (d.hint) box.appendChild(h("small", { text: d.hint }));
        optBox.appendChild(box);
      });
    }
    drawOpts();

    function msg(t, err) { status.textContent = t || ""; status.className = "status" + (err ? " err" : ""); }
    function sync() {
      var min = T.min || 1;
      go.disabled = files.length < min;
      drop.hidden = !T.multiple && files.length > 0;
      optBox.hidden = orgBox.hidden = files.length === 0;
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
    function fileChange() { drawList(); sync(); if (T.organizer) drawOrganizer(); }

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
      if (r.files.length > 1) {
        var z = h("button", { class: "btn", text: "Download all as ZIP", style: "margin-top:1rem" });
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
      var box = h("div", { class: "donate", "data-donate-box": "" }); resBox.appendChild(box); Donate.render(box);
      resBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    sync();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var r = $("#tool"), shell = document.body.classList.contains("shell"), meta = null;
    if (shell) {
      meta = JSON.parse($("#meta").textContent);
      var open = function (k, push) {
        if (!TOOLS[k]) k = "merge";
        r.dataset.tool = k; r.innerHTML = ""; mount(r);
        $("#tt").textContent = meta[k].h1; $("#ts").textContent = meta[k].intro;
        document.title = meta[k].h1 + " – pdf pangea";
        document.querySelectorAll(".rail a").forEach(function (a) { a.classList.toggle("active", a.dataset.tool === k); });
        var act = document.querySelector(".rail a.active"); if (act && act.scrollIntoView) act.scrollIntoView({ block: "nearest", inline: "center" });
        if (push) history.replaceState(null, "", "#" + meta[k].slug);
      };
      var rail = $("#rail"), rt = $(".rt");
      var setOpen = function (v) { rail.classList.toggle("open", v); rt.setAttribute("aria-expanded", v); rt.textContent = v ? "Close ▴" : "View all tools ▾"; };
      rt.onclick = function () { setOpen(!rail.classList.contains("open")); };
      document.querySelectorAll("a[data-tool]").forEach(function (a) {
        a.addEventListener("click", function (e) { e.preventDefault(); open(a.dataset.tool, true); setOpen(false); if (document.activeElement) document.activeElement.blur(); });
      });
      var start = "merge", h = location.hash.slice(1);
      Object.keys(meta).forEach(function (k) { if (meta[k].slug === h) start = k; });
      open(start, false);
    } else if (r && TOOLS[r.dataset.tool]) mount(r);
    if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(function () {});
  });
})();




