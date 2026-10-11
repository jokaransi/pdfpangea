/* Optional tip counter: 1€ for <100 pages, +1€ per further 100 pages, stored in a cookie. Never blocks anything. */
(function () {
  var CONFIG = {
    pagesPerEuro: 100,
    kofiUrl: "https://ko-fi.com/djoshi",
    cookie: "hp_donation"
  };

  // The donation cookie is only written after the visitor accepts; the choice itself is kept in localStorage.
  var CONSENT_KEY = "pp_consent", mem = { pending: 0, paid: 0, pages: 0 };
  function consent() { try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; } }
  function setConsent(v) {
    try { localStorage.setItem(CONSENT_KEY, v); } catch (e) {}
    if (v === "yes") save(mem);
    else document.cookie = CONFIG.cookie + "=;max-age=0;path=/;SameSite=Lax";
  }
  function readCookie() {
    if (consent() !== "yes") return mem;
    var m = document.cookie.match(new RegExp("(?:^|; )" + CONFIG.cookie + "=([^;]*)"));
    var p = (m ? decodeURIComponent(m[1]) : "0|0|0").split("|").map(function (x) { return parseInt(x, 10) || 0; });
    mem = { pending: p[0], paid: p[1], pages: p[2] };
    return mem;
  }
  function save(s) {
    mem = { pending: s.pending, paid: s.paid, pages: s.pages };
    if (consent() !== "yes") return;
    var v = [s.pending, s.paid, s.pages].join("|");
    document.cookie = CONFIG.cookie + "=" + encodeURIComponent(v) + ";max-age=" + 3600 * 24 * 365 * 2 + ";path=/;SameSite=Lax";
  }
  // Ko-fi only accepts whole euros, so the tip is 1€ plus 1€ for every full 100 pages.
  function tip(s) { return 1 + Math.floor(s.pending / CONFIG.pagesPerEuro); }
  function eur(c) { return (c / 100) + "€"; }
  function tipLabel(s) { return tip(s) + "€"; }
  function toast(msg) {
    var old = document.querySelector(".tip-toast"); if (old) old.remove();
    var t = document.createElement("div"); t.className = "tip-toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 9000);
  }
  function openKofi(s) {
    var amount = tip(s), pages = s.pending;
    try { if (navigator.clipboard) navigator.clipboard.writeText(String(amount)).catch(function () {}); } catch (e) {}
    // open the tab right away (popup blockers), then send it to Ko-fi after 2 seconds
    var w = null;
    try { w = window.open("", "_blank"); } catch (e) {}
    if (w) {
      try {
        w.document.write('<!doctype html><meta charset="utf-8"><title>Opening Ko-fi…</title><body style="font:22px Georgia,serif;background:#f7f0e4;color:#30251f;display:grid;place-items:center;height:100vh;margin:0;text-align:center"><div style="max-width:30rem;padding:1.5rem"><div style="font-size:3rem">🎩</div><h1 style="font-weight:600;margin:.4rem 0">Opening Ko-fi…</h1><p>We\'d recommend a <b>' + amount + '€</b> tip' + (pages ? ' for the ' + pages + ' page' + (pages === 1 ? '' : 's') + ' you processed' : '') + ' (1€ base + 1€ per full 100 pages) – but it\'s entirely up to you.</p><p style="opacity:.7">Thank you! ♥</p></div></body>');
        w.document.close();
      } catch (e) {}
      setTimeout(function () { if (!w.closed) w.location.href = CONFIG.kofiUrl; }, 2000);
    } else {
      toast("Opening Ko-fi… we'd recommend a " + amount + "€ tip – but it's entirely up to you. Thank you! 🎩");
      setTimeout(function () { window.location.href = CONFIG.kofiUrl; }, 2000);
    }
  }
  var Donate = {
    state: readCookie(),
    add: function (pages) {
      this.state = readCookie();
      this.state.pending += pages;
      this.state.pages += pages;
      save(this.state);
      this.refresh();
    },
    markPaid: function () {
      this.state = readCookie();
      this.state.paid += tip(this.state) * 100;
      this.state.pending = 0;
      this.state.pages = 0;
      save(this.state);
      this.refresh();
    },
    eur: eur,
    refresh: function () {
      this.state = readCookie();
      var s = this.state;
      document.querySelectorAll("[data-donate-chip]").forEach(function (el) {
        el.textContent = "*tips hat* 🎩 · " + tipLabel(s);
        el.href = CONFIG.kofiUrl; el.onclick = function (ev) { ev.preventDefault(); openKofi(Donate.state); };
      });
      document.querySelectorAll("[data-donate-box]").forEach(function (b) { Donate.render(b); });
    },
    render: function (box) {
      var s = this.state;
      box.innerHTML = "";
      var h = document.createElement("h3");
      h.textContent = "Enjoying this tool?";
      var p = document.createElement("p");
      p.textContent = s.pending > 0
        ? "You have processed " + s.pages + " page" + (s.pages === 1 ? "" : "s") + ". A fair tip would be " + tipLabel(s) + " (1€ base + 1€ per full 100 pages). It is entirely optional – everything stays free."
        : "Everything is free and runs on your device. If it helped, a small tip of 1€ (plus 1€ per full 100 pages) keeps it that way – entirely optional.";
      var row = document.createElement("div");
      row.className = "row";
      var d = document.createElement("button");
      d.className = "btn";
      d.textContent = "*tips hat* 🎩 · " + tipLabel(s);
      var note = document.createElement("p");
      note.style.fontSize = "1rem";
      d.onclick = function () {
        openKofi(s);
      };
      row.appendChild(d);
      if (s.pending > 0) {
        var r = document.createElement("button");
        r.className = "btn ghost";
        r.textContent = "I've supported – reset counter";
        r.onclick = function () { Donate.markPaid(); };
        row.appendChild(r);
      }
      box.appendChild(h); box.appendChild(p); box.appendChild(row); box.appendChild(note);
      if (s.paid > 0) {
        var t = document.createElement("p");
        t.style.fontSize = "1rem";
        t.textContent = "Already donated so far: " + eur(s.paid) + ". Thank you ♥";
        box.appendChild(t);
      }
    }
  };
  document.addEventListener("DOMContentLoaded", function () {
    var o = document.createElement("div");
    try { if (sessionStorage.getItem("pp_seen")) return; sessionStorage.setItem("pp_seen", "1"); } catch (e) {}
    o.className = "welcome";
    o.setAttribute("role", "dialog");
    o.setAttribute("aria-modal", "true");
    o.setAttribute("aria-labelledby", "wt");
    o.innerHTML = '<div class="wbox"><h2 id="wt">Welcome to pdf pangea</h2>' +
      '<ul><li><b>🌬️ Clouds go home! Your files stay on this device.</b> Everything is processed right in your browser – nothing is uploaded.</li>' +
      '<li><b>📴 Works offline</b> once the page has loaded.</li>' +
      '<li><b>🌿 Free to use.</b> If it helps you, an optional tip of <b>1€</b> (+1€ per 100 pages) is appreciated – never required.</li></ul>' +
      (consent() === null
        ? '<p class="wcookie">🍪 We’d like to save one small cookie that remembers your optional tip counter. No tracking, no ads, nothing shared. <a href="privacy.html">Details</a></p><div class="wbtns"><button class="btn" type="button" data-c="yes">Accept &amp; go</button><button class="btn ghost" type="button" data-c="no">No cookie, thanks</button></div>'
        : '<div class="wbtns"><button class="btn" type="button">Got it, let\'s go</button></div>') + '</div>';
    function close() { o.remove(); document.removeEventListener("keydown", esc); }
    function esc(e) { if (e.key === "Escape") close(); }
    o.querySelectorAll("button").forEach(function (x) { x.onclick = function () { var v = x.getAttribute("data-c"); if (v) { setConsent(v); Donate.refresh(); } close(); }; });
    o.addEventListener("click", function (e) { if (e.target === o) close(); });
    document.addEventListener("keydown", esc);
    document.body.appendChild(o);
    o.querySelector("button").focus();
  });  window.Donate = Donate;
  function showConsent() {
    var old = document.querySelector(".cookie-note"); if (old) old.remove();
    var c = document.createElement("div");
    c.className = "cookie-note";
    c.setAttribute("role", "region");
    c.setAttribute("aria-label", "Cookie notice");
    c.innerHTML = '<p><b>One small cookie, no ads.</b> We’d like to save a single cookie that remembers your optional tip counter. No tracking, no advertising, nothing shared. <a href="privacy.html">Details</a></p>' +
      '<div><button type="button" class="btn sm" data-c="yes">Accept</button><button type="button" class="btn ghost sm" data-c="no">No thanks</button></div>';
    c.addEventListener("click", function (e) {
      var v = e.target.getAttribute && e.target.getAttribute("data-c"); if (!v) return;
      setConsent(v); c.remove(); Donate.refresh();
    });
    document.body.appendChild(c);
  }
  Donate.showConsent = showConsent;
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-cookie-settings]").forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); showConsent(); });
    });
  });
  document.addEventListener("DOMContentLoaded", function () { Donate.refresh(); });
})();
