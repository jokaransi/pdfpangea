/* Optional donation counter. 1 cent per processed page, stored in a cookie. Never blocks anything. */
(function () {
  var CONFIG = {
    centsPerPage: 1,
    kofiUrl: "https://ko-fi.com/djoshi", minCents: 100, // TODO: put your Ko-fi page here, e.g. "https://ko-fi.com/yourname"
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
  }  function eur(c) { return "€" + (c / 100).toFixed(2); }
  function kofiLink(s) {
    var url = new URL(CONFIG.kofiUrl);
    url.searchParams.set("amount", ((CONFIG.minCents + s.pending) / 100).toFixed(2));
    url.searchParams.set("currency", "EUR");
    return url.toString();
  }

  var Donate = {
    state: readCookie(),
    add: function (pages) {
      this.state = readCookie();
      this.state.pending += pages * CONFIG.centsPerPage;
      this.state.pages += pages;
      save(this.state);
      this.refresh();
    },
    markPaid: function () {
      this.state = readCookie();
      this.state.paid += CONFIG.minCents + this.state.pending;
      this.state.pending = 0;
      save(this.state);
      this.refresh();
    },
    eur: eur,
    refresh: function () {
      this.state = readCookie();
      var s = this.state;
      document.querySelectorAll("[data-donate-chip]").forEach(function (el) {
        el.textContent = "*tips hat* 🎩 · " + eur(CONFIG.minCents + s.pending);
        if (CONFIG.kofiUrl) { el.href = kofiLink(s); el.target = "_blank"; el.rel = "noopener"; }
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
        ? "You have processed " + s.pages + " page" + (s.pages === 1 ? "" : "s") + ". A fair tip would be " + eur(CONFIG.minCents + s.pending) + " (€1.00 minimum + 1 ct per page). It is entirely optional – everything stays free."
        : "Everything is free and runs on your device. If it helped, a small tip of €1.00 plus 1 ct per page keeps it that way – entirely optional.";
      var row = document.createElement("div");
      row.className = "row";
      var d = document.createElement("button");
      d.className = "btn";
      d.textContent = "*tips hat* 🎩 · " + eur(CONFIG.minCents + s.pending);
      var note = document.createElement("p");
      note.style.fontSize = "1rem";
      d.onclick = function () {
        if (CONFIG.kofiUrl) { window.open(kofiLink(s), "_blank", "noopener"); }
        else { note.textContent = "Ko-fi support is coming soon – thank you for the thought!"; }
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
      '<ul><li><b>☁️ Fuck the cloud. Your files stay on this device.</b> Everything is processed right in your browser – nothing is uploaded.</li>' +
      '<li><b>📴 Works offline</b> once the page has loaded.</li>' +
      '<li><b>🌿 Free to use.</b> If it helps you, an optional tip of <b>1 ct per page</b> is appreciated – never required.</li></ul>' +
      '<button class="btn" type="button">Got it, let\'s go</button></div>';
    var b = o.querySelector("button");
    function close() { o.remove(); document.removeEventListener("keydown", esc); }
    function esc(e) { if (e.key === "Escape") close(); }
    b.onclick = close;
    o.addEventListener("click", function (e) { if (e.target === o) close(); });
    document.addEventListener("keydown", esc);
    document.body.appendChild(o);
    b.focus();
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
    if (consent() === null) { try { if (!sessionStorage.getItem("pp_cookie_seen")) { sessionStorage.setItem("pp_cookie_seen", "1"); showConsent(); } } catch (e) { showConsent(); } }
    document.querySelectorAll("[data-cookie-settings]").forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); showConsent(); });
    });
  });
  document.addEventListener("DOMContentLoaded", function () { Donate.refresh(); });
})();

