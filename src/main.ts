import "@fontsource/gloock/latin-400.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/page.css";

import { checkoutUrl } from "./config.ts";
import { initHeroBackground } from "./hero-background.ts";

initHeroBackground();

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = <T extends Element>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll<T>(s));

/* Checkout */
for (const a of $$<HTMLAnchorElement>("[data-checkout]")) a.href = checkoutUrl;

/* Reveal on scroll */
const revealIO = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("is-in");
      revealIO.unobserve(e.target);
    }
  },
  { rootMargin: "0px 0px -6% 0px", threshold: 0.08 },
);
for (const el of $$(".reveal")) revealIO.observe(el);

/* Scroll-driven effects in one rAF loop */
const bar = $<HTMLElement>(".progress span");
const lits = $$<HTMLElement>("[data-lit] .lit");
const journey = $<HTMLElement>("[data-journey]");
const steps = journey ? $$<HTMLElement>(".journey__step", journey) : [];
const parallax = $<HTMLElement>(".desire__media img");

let ticking = false;
function onScroll(): void {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const vh = window.innerHeight;
    const doc = document.documentElement;
    const max = doc.scrollHeight - vh;
    if (bar) bar.style.setProperty("--p", String(max > 0 ? window.scrollY / max : 0));

    // Texto que acende frase por frase
    const line = vh * 0.72;
    for (const s of lits) {
      const r = s.getBoundingClientRect();
      s.classList.toggle("is-on", reduced || r.top < line);
    }

    // Linha da jornada
    if (journey) {
      const r = journey.getBoundingClientRect();
      const mid = vh * 0.6;
      const prog = Math.min(1, Math.max(0, (mid - r.top) / r.height));
      journey.style.setProperty("--j", String(reduced ? 1 : prog));
      for (const st of steps) {
        const sr = st.getBoundingClientRect();
        st.classList.toggle("is-on", reduced || sr.top < mid);
      }
    }

    // Parallax leve na foto do desejo
    if (parallax && !reduced) {
      const r = parallax.parentElement!.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) parallax.style.setProperty("--parallax", `${-r.top * 0.18 - 40}px`);
    }
  });
}
window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onScroll);
onScroll();

/* Carrosséis: pontinhos com progresso + rotação automática */
const AUTO_MS = 2600;
for (const car of $$<HTMLElement>("[data-carousel]")) {
  const track = $<HTMLElement>(".carousel__track", car)!;
  const slides = $$<HTMLElement>(".slide", track);
  const dots = $<HTMLElement>(".carousel__dots", car)!;
  car.style.setProperty("--auto", `${AUTO_MS}ms`);
  let idx = 0;
  let timer = 0;
  let inView = false;
  let pausedUntil = 0;

  const scrollable = () => track.scrollWidth - track.clientWidth > 8;
  const go = (i: number) => {
    idx = (i + slides.length) % slides.length;
    const pad = parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
    track.scrollTo({ left: slides[idx].offsetLeft - pad, behavior: reduced ? "auto" : "smooth" });
    paint();
  };
  const btns = slides.map((_, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.tabIndex = -1;
    b.setAttribute("aria-label", `Ver item ${i + 1}`);
    b.addEventListener("click", () => {
      pause();
      go(i);
    });
    dots.appendChild(b);
    return b;
  });
  const paint = () => {
    btns.forEach((b, k) => {
      b.classList.remove("is-active");
      if (k === idx) {
        void b.offsetWidth; // reinicia a barrinha de progresso
        b.classList.add("is-active");
      }
    });
    car.classList.toggle("is-auto", inView && Date.now() > pausedUntil && scrollable());
  };
  const tick = () => {
    if (inView && Date.now() > pausedUntil && scrollable()) go(idx + 1);
  };
  const start = () => {
    clearInterval(timer);
    timer = window.setInterval(tick, AUTO_MS);
  };
  const pause = () => {
    pausedUntil = Date.now() + 9000;
    car.classList.remove("is-auto");
    start();
  };
  // sincroniza o índice quando a pessoa arrasta
  let st = 0;
  track.addEventListener(
    "scroll",
    () => {
      clearTimeout(st);
      st = window.setTimeout(() => {
        const x = track.scrollLeft;
        let best = 0;
        let bd = Infinity;
        slides.forEach((s, k) => {
          const d = Math.abs(s.offsetLeft - x - (parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0));
          if (d < bd) {
            bd = d;
            best = k;
          }
        });
        if (best !== idx) {
          idx = best;
          paint();
        }
      }, 90);
    },
    { passive: true },
  );
  track.addEventListener("pointerdown", (e) => {
    if ((e as PointerEvent).pointerType !== "mouse") pause();
  });
  track.addEventListener(
    "wheel",
    (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) pause();
    },
    { passive: true },
  );
  new IntersectionObserver(
    (es) => {
      inView = es[0].isIntersecting;
      if (inView) start();
      paint();
    },
    { threshold: 0.3 },
  ).observe(car);
  paint();
}

/* Abas "Quem você se torna" (trocam sozinhas até a pessoa tocar) */
for (const tabs of $$<HTMLElement>("[data-tabs]")) {
  const list = $<HTMLElement>(".tabs__list", tabs)!;
  const btns = $$<HTMLButtonElement>(".tabs__btn", tabs);
  const panels = $$<HTMLElement>(".tabs__panel", tabs);
  let cur = 0;
  let manual = false;
  let inView = false;
  const show = (i: number) => {
    cur = i;
    btns.forEach((x, k) => {
      x.classList.toggle("is-active", k === i);
      x.setAttribute("aria-selected", String(k === i));
    });
    panels.forEach((p, k) => {
      p.hidden = k !== i;
      p.classList.toggle("is-active", k === i);
    });
    const b = btns[i];
    list.scrollTo({ left: b.offsetLeft - (list.clientWidth - b.offsetWidth) / 2, behavior: reduced ? "auto" : "smooth" });
    tabs.classList.toggle("is-auto", !manual && inView);
    const bar = btns[i];
    bar.classList.remove("is-timing");
    void bar.offsetWidth;
    if (!manual) bar.classList.add("is-timing");
  };
  btns.forEach((b, i) =>
    b.addEventListener("click", () => {
      manual = true;
      btns.forEach((x) => x.classList.remove("is-timing"));
      show(i);
    }),
  );
  new IntersectionObserver(
    (es) => {
      inView = es[0].isIntersecting;
      if (inView && !manual) show(cur);
    },
    { threshold: 0.4 },
  ).observe(tabs);
  window.setInterval(() => {
    if (!manual && inView) show((cur + 1) % btns.length);
  }, 3800);
}

/* Movimento: títulos palavra por palavra, listas em cascata, fotos com zoom lento */
if (!reduced) {
  for (const t of $$<HTMLElement>(".section__title")) {
    if (t.children.length) continue;
    const words = (t.textContent || "").trim().split(/\s+/);
    t.textContent = "";
    words.forEach((w, i) => {
      const span = document.createElement("span");
      span.className = "w";
      span.style.setProperty("--i", String(i));
      span.textContent = w;
      t.appendChild(span);
      if (i < words.length - 1) t.appendChild(document.createTextNode(" "));
    });
    t.classList.add("words");
    t.classList.remove("reveal");
    revealIO.observe(t);
  }
  const groups = [".journey ol", ".exp__list", ".bonus-list", ".faq", ".stats", ".offer__stack", ".product__list"];
  for (const sel of groups) {
    for (const g of $$<HTMLElement>(sel)) {
      if (sel === ".offer__stack") continue;
      g.classList.add("stagger");
      Array.from(g.children).forEach((c, i) => (c as HTMLElement).style.setProperty("--i", String(i)));
      revealIO.observe(g);
    }
  }
  for (const img of $$<HTMLElement>(".pain-card__img, .bio__photo")) {
    img.classList.add("kb");
    revealIO.observe(img);
  }
}

/* Interruptor pra quem é / não é (alterna sozinho até a pessoa tocar) */
for (const fit of $$<HTMLElement>("[data-fit]")) {
  const btns = $$<HTMLButtonElement>("[data-fit-btn]", fit);
  const panels = $$<HTMLElement>("[data-fit-panel]", fit);
  let manual = false;
  let inView = false;
  let cur = "yes";
  const set = (v: string) => {
    cur = v;
    fit.classList.toggle("is-no", v === "no");
    btns.forEach((x) => {
      const on = x.dataset.fitBtn === v;
      x.classList.toggle("is-active", on);
      x.setAttribute("aria-selected", String(on));
    });
    panels.forEach((p) => {
      const on = p.dataset.fitPanel === v;
      p.hidden = !on;
      p.classList.toggle("is-active", on);
      if (on) {
        for (const li of $$<HTMLElement>("li", p)) {
          li.style.animation = "none";
          void li.offsetWidth;
          li.style.animation = "";
        }
      }
    });
  };
  btns.forEach((b) =>
    b.addEventListener("click", () => {
      manual = true;
      fit.classList.add("is-manual");
      set(b.dataset.fitBtn || "yes");
    }),
  );
  new IntersectionObserver(
    (es) => {
      inView = es[0].isIntersecting;
    },
    { threshold: 0.3 },
  ).observe(fit);
  window.setInterval(() => {
    if (!manual && inView) set(cur === "yes" ? "no" : "yes");
  }, 3800);
}

/* Acordeões exclusivos (bônus e FAQ) */
for (const group of $$<HTMLElement>("[data-exclusive]")) {
  const items = $$<HTMLDetailsElement>("details", group);
  for (const d of items) {
    d.addEventListener("toggle", () => {
      if (!d.open) return;
      for (const o of items) if (o !== d) o.open = false;
    });
  }
}

/* Contadores da bio */
const fmt = (n: number) => n.toLocaleString("pt-BR");
const countIO = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      countIO.unobserve(e.target);
      const el = e.target as HTMLElement;
      const to = Number(el.dataset.count);
      const pre = el.dataset.prefix ?? "";
      const suf = el.dataset.suffix ?? "";
      if (reduced) {
        el.textContent = `${pre}${fmt(to)}${suf}`;
        continue;
      }
      const t0 = performance.now();
      const dur = 1400;
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - k, 3);
        el.textContent = `${pre}${fmt(Math.round(to * eased))}${suf}`;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  },
  { threshold: 0.6 },
);
for (const el of $$<HTMLElement>("[data-count]")) countIO.observe(el);

/* Oferta: valores entram um a um, soma, risca e revela o preço */
const offer = $<HTMLElement>("[data-offer]");
if (offer) {
  const items = $$<HTMLElement>(".offer__stack li", offer);
  const totalEl = $<HTMLElement>("[data-total]", offer)!;
  const totalWrap = $<HTMLElement>(".offer__total", offer)!;
  const money = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const finalTotal = items.reduce((s, li) => s + Number(li.dataset.v || 0), 0);

  const run = () => {
    if (reduced) {
      items.forEach((li) => li.classList.add("is-in"));
      totalEl.textContent = money(finalTotal);
      totalWrap.classList.add("is-struck");
      offer.classList.add("is-done");
      return;
    }
    let acc = 0;
    items.forEach((li, i) => {
      setTimeout(() => {
        li.classList.add("is-in");
        acc += Number(li.dataset.v || 0);
        totalEl.textContent = money(acc);
        if (i === items.length - 1) {
          setTimeout(() => totalWrap.classList.add("is-struck"), 350);
          setTimeout(() => offer.classList.add("is-done"), 900);
        }
      }, 260 * i);
    });
  };
  const offerIO = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        offerIO.disconnect();
        run();
      }
    },
    { threshold: 0.25 },
  );
  offerIO.observe(offer);
}

/* Botão fixo no rodapé: aparece depois do topo, some quando há um botão da página na tela */
const sticky = $<HTMLElement>("[data-sticky]");
const hero = $<HTMLElement>(".hero");
if (sticky && hero) {
  let heroOut = false;
  const visibleCtas = new Set<Element>();
  const update = () => {
    const on = heroOut && visibleCtas.size === 0;
    sticky.classList.toggle("is-on", on);
    sticky.setAttribute("aria-hidden", String(!on));
    const link = $<HTMLAnchorElement>("a", sticky);
    if (link) link.tabIndex = on ? 0 : -1;
  };
  new IntersectionObserver((es) => {
    heroOut = !es[0].isIntersecting;
    update();
  }).observe(hero);
  const ctaIO = new IntersectionObserver((es) => {
    for (const e of es) {
      if (e.isIntersecting) visibleCtas.add(e.target);
      else visibleCtas.delete(e.target);
    }
    update();
  });
  for (const c of $$(".cta, .offer__card")) ctaIO.observe(c);
}
