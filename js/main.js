(function () {
  "use strict";
  var root = document.documentElement;
  root.classList.add("js");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- email: Gmail compose on desktop, mail app on phones ---------- */
  var EMAIL = document.getElementById("addr").textContent.trim();
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    [].forEach.call(document.querySelectorAll("[data-mail]"), function (a) {
      a.href = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(EMAIL);
      a.target = "_blank";
      a.rel = "noopener";
    });
  }
  var copyBtn = document.getElementById("copyBtn");
  copyBtn.addEventListener("click", function () {
    var fail = function () { copyBtn.textContent = "Select the address to copy"; };
    try {
      navigator.clipboard.writeText(EMAIL).then(function () {
        copyBtn.textContent = "Copied";
        setTimeout(function () { copyBtn.textContent = "Copy"; }, 1600);
      }, fail);
    } catch (e) { fail(); }
  });

  /* ---------- scroll reveal ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    [].forEach.call(reveals, function (el) { io.observe(el); });
  } else {
    [].forEach.call(reveals, function (el) { el.classList.add("in"); });
  }

  /* ---------- revolving ring of cards ----------
     Each card sits on a circle of radius R around the head, seen from slightly
     above (TILT) and rolled so the left side is higher (ROLL). Cards with z < 0
     are drawn behind the portrait, cards with z > 0 in front of it. */
  var orbit = document.getElementById("orbit"),
      portrait = document.getElementById("portrait"),
      cards = [].slice.call(document.querySelectorAll("#ring .gcard"));
  var TILT = 0.44, ROLL = 0.2, FOCAL = 1300, SPEED = (2 * Math.PI) / 48000; /* one turn in 48 s */
  var ringOn = false, paused = false, angle = 0.5, last = 0, R = 0, cy = 0;
  /* drag to spin: boost is extra angular speed (rad/ms) from a fling; it fades back to 0 */
  var boost = 0, FADE = 700, MAXBOOST = 0.008, drag = null, justDragged = false;
  var hot = -1, pressed = -1, lift = cards.map(function () { return 1; }); /* hover lift / press per card */

  cards.forEach(function (c) {
    var title = c.querySelector("b"), desc = c.querySelector(".gdesc");
    c.setAttribute("aria-label", title.textContent + (desc ? ", " + desc.textContent : ""));
  });

  function measure() {
    var narrow = window.innerWidth < 600;
    if (!ringOn) { ringOn = true; orbit.classList.add("is-ring"); orbit.parentNode.classList.add("fixed"); }
    orbit.classList.toggle("compact", narrow);
    var w = portrait.clientWidth, h = portrait.clientHeight;
    /* hug the head, but keep the side cards mostly inside the page */
    R = Math.min(w * 0.75, orbit.clientWidth / 2 - (narrow ? 50 : 120));
    TILT = narrow ? 0.6 : 0.44; /* phones: drop front cards further so they clear the back ones */
    cy = portrait.offsetTop + h * (narrow ? 0.45 : 0.42);
    place();
  }
  function place() {
    var n = cards.length;
    for (var i = 0; i < n; i++) {
      var th = angle + (i * 2 * Math.PI) / n;
      var cs = Math.cos(th), sn = Math.sin(th);
      var x = R * cs, z = R * sn;
      var y = z * TILT + x * ROLL;
      var front = z >= 0;
      var goal = i === pressed ? 0.96 : (i === hot && front ? 1.07 : 1);
      lift[i] += (goal - lift[i]) * 0.2;
      var s = FOCAL / (FOCAL - z) * lift[i];
      /* lean each card along the ring's path on screen, fading to level at the sides */
      var lean = Math.atan((cs * TILT - sn * ROLL) / (-sn || 1e-6)) * 0.4 * Math.abs(sn) * (180 / Math.PI);
      var c = cards[i];
      c.style.transform = "translate(calc(-50% + " + x.toFixed(1) + "px),calc(-50% + " + (cy + y).toFixed(1) + "px)) perspective(600px) rotateZ(" +
        lean.toFixed(1) + "deg) rotateY(" + (30 * Math.sin(2 * th)).toFixed(1) + "deg) scale(" + s.toFixed(3) + ")";
      c.style.zIndex = front ? (i === hot ? 4 : 3) : 1;
      c.style.opacity = front ? 1 : 0.75;
      c.classList.toggle("back", !front);
    }
  }
  function frame(t) {
    var dt = Math.min(60, t - last); last = t;
    if (ringOn) {
      if (!drag) {
        angle += dt * ((paused && !boost ? 0 : SPEED) + boost);
        boost *= Math.exp(-dt / FADE);
        if (Math.abs(boost) < SPEED * 0.05) boost = 0;
      }
      place();
    }
    requestAnimationFrame(frame);
  }
  var ring = document.getElementById("ring");
  function cardIndex(el) { var c = el && el.closest && el.closest(".gcard"); return c ? cards.indexOf(c) : -1; }
  function setHot(i) { if (hot >= 0) cards[hot].classList.remove("hot"); hot = i; if (i >= 0) cards[i].classList.add("hot"); }
  ring.addEventListener("pointerover", function (e) { var i = cardIndex(e.target); if (i >= 0) { paused = true; if (e.pointerType === "mouse" && !drag) setHot(i); } });
  ring.addEventListener("pointerout", function (e) { if (cardIndex(e.relatedTarget) < 0) { paused = false; setHot(-1); } });
  ring.addEventListener("focusin", function (e) { paused = true; setHot(cardIndex(e.target)); });
  ring.addEventListener("focusout", function () { paused = false; setHot(-1); });

  /* click and hold, then push sideways: the ring follows the pointer, then coasts and slows back to normal */
  orbit.addEventListener("pointerdown", function (e) {
    if (!ringOn || (e.pointerType === "mouse" && e.button !== 0)) return;
    drag = null;
    pressed = cardIndex(e.target);
    orbit._down = { id: e.pointerId, x: e.clientX, samples: [{ t: e.timeStamp, a: angle }] };
  });
  orbit.addEventListener("pointermove", function (e) {
    var d = orbit._down;
    if (!d || d.id !== e.pointerId) return;
    if (!drag) {
      if (Math.abs(e.clientX - d.x) < 6) return;
      drag = d; boost = 0; pressed = -1; setHot(-1);
      orbit.classList.add("dragging");
      try { orbit.setPointerCapture(e.pointerId); } catch (err) {}
    }
    angle -= (e.clientX - drag.x) / (R || 200); /* front of the ring moves with the pointer */
    drag.x = e.clientX;
    drag.samples.push({ t: e.timeStamp, a: angle });
    while (drag.samples.length > 2 && e.timeStamp - drag.samples[0].t > 90) drag.samples.shift();
  });
  function release(e, fling) {
    var d = orbit._down;
    if (!d || d.id !== e.pointerId) return;
    if (drag && fling) {
      var s = drag.samples, a = s[0], b = s[s.length - 1], dt = b.t - a.t;
      var v = dt > 0 && e.timeStamp - b.t < 80 ? (b.a - a.a) / dt : 0;
      boost = Math.max(-MAXBOOST, Math.min(MAXBOOST, v - SPEED));
      justDragged = true; setTimeout(function () { justDragged = false; }, 0);
    }
    if (drag) orbit.classList.remove("dragging");
    drag = null; orbit._down = null; pressed = -1;
  }
  orbit.addEventListener("pointerup", function (e) { release(e, true); });
  orbit.addEventListener("pointercancel", function (e) { release(e, false); });
  /* a drag that ends on a card must not open its link */
  orbit.addEventListener("click", function (e) { if (justDragged) { e.preventDefault(); e.stopPropagation(); justDragged = false; } }, true);
  orbit.addEventListener("dragstart", function (e) { e.preventDefault(); });
  window.addEventListener("resize", measure);
  if (!portrait.complete) portrait.addEventListener("load", measure);
  measure();
  requestAnimationFrame(frame); /* the ring always revolves, by request, even with reduced motion on */

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
})();
