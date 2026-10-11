/* Optional donation counter. 1 cent per processed page, stored in a cookie. Never blocks anything. */
(function () {
  var CONFIG = {
    centsPerPage: 1,
    paypalUrl: "", // TODO: put your PayPal.me / donate link here, e.g. "https://www.paypal.com/donate/?hosted_button_id=XXXX"
    cookie: "hp_donation"
  };

  function readCookie() {
    var m = document.cookie.match(new RegExp("(?:^|; )" + CONFIG.cookie + "=([^;]*)"));
    var raw = m ? decodeURIComponent(m[1]) : null;
    if (!raw) { try { raw = localStorage.getItem(CONFIG.cookie); } catch (e) {} }
    var p = (raw || "0|0|0").split("|").map(function (x) { return parseInt(x, 10) || 0; });
    return { pending: p[0], paid: p[1], pages: p[2] };
  }
  function save(s) {
    var v = [s.pending, s.paid, s.pages].join("|");
    document.cookie = CONFIG.cookie + "=" + encodeURIComponent(v) + ";max-age=" + 3600 * 24 * 365 * 2 + ";path=/;SameSite=Lax";
    try { localStorage.setItem(CONFIG.cookie, v); } catch (e) {}
  }
  function eur(c) { return "€" + (c / 100).toFixed(2); }

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
      this.state.paid += this.state.pending;
      this.state.pending = 0;
      save(this.state);
      this.refresh();
    },
    eur: eur,
    refresh: function () {
      this.state = readCookie();
      var s = this.state;
      document.querySelectorAll("[data-donate-chip]").forEach(function (el) {
        el.textContent = s.pending > 0 ? "♥ " + eur(s.pending) : "♥ Donate";
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
        ? "You have processed " + s.pages + " page" + (s.pages === 1 ? "" : "s") + ". A fair tip would be " + eur(s.pending) + " (1 ct per page). It is entirely optional – everything stays free."
        : "Everything is free and runs on your device. If it helped, a small tip keeps it that way – 1 ct per page, entirely optional.";
      var row = document.createElement("div");
      row.className = "row";
      var d = document.createElement("button");
      d.className = "btn";
      d.textContent = s.pending > 0 ? "Donate " + eur(s.pending) : "Donate";
      var note = document.createElement("p");
      note.style.fontSize = "1rem";
      d.onclick = function () {
        if (CONFIG.paypalUrl) { window.open(CONFIG.paypalUrl, "_blank", "noopener"); }
        else { note.textContent = "PayPal donations are coming soon – thank you for the thought!"; }
      };
      row.appendChild(d);
      if (s.pending > 0) {
        var r = document.createElement("button");
        r.className = "btn ghost";
        r.textContent = "I've donated – reset counter";
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
    o.className = "welcome";
    o.setAttribute("role", "dialog");
    o.setAttribute("aria-modal", "true");
    o.setAttribute("aria-labelledby", "wt");
    o.innerHTML = '<div class="wbox"><h2 id="wt">Welcome to pdf pangea</h2>' +
      '<ul><li><b>🔒 Your files never leave this device.</b> Everything is processed right in your browser – nothing is uploaded.</li>' +
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
  document.addEventListener("DOMContentLoaded", function () { Donate.refresh(); });
})();


