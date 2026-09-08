(() => {
  const ROOT_CLASS = "splash-active";
  const SEEN_KEY = "continuum-splash-seen-v2";
  const root = document.documentElement;

  // La marca se pone antes de que el body termine de parsearse. Así, si el service worker
  // toma el control y recarga esta misma pestaña, el telón no aparece dos veces.
  let alreadySeen = false;
  try {
    alreadySeen = localStorage.getItem(SEEN_KEY) === "1";
    if (!alreadySeen) localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Bloquear el almacenamiento no debe bloquear el arranque.
  }

  if (alreadySeen || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  root.classList.add(ROOT_CLASS);

  function bootSplash() {
    const splash = document.getElementById("app-splash");
    if (!splash) {
      root.classList.remove(ROOT_CLASS);
      return;
    }

    const masthead = splash.querySelector(".splash-masthead");
    let removed = false;

    const remove = () => {
      if (removed) return;
      removed = true;
      document.removeEventListener("keydown", skipKeyboard);
      splash.remove();
      root.classList.remove(ROOT_CLASS);
    };

    // La portada real ya se pinta antes de DOMContentLoaded. Tomamos sus coordenadas y
    // colocamos el emblema del telón exactamente encima: al fundirse, no hay salto visual.
    const alignWithHome = () => {
      const target = document.querySelector("#app .home-masthead");
      if (target && masthead) {
        const rect = target.getBoundingClientRect();
        masthead.style.setProperty("--splash-top", `${rect.top}px`);
        masthead.style.setProperty("--splash-left", `${rect.left}px`);
        masthead.style.setProperty("--splash-width", `${rect.width}px`);
      }
      splash.classList.add("splash-ready");
    };

    // Dos frames dejan que fuentes, estilos y la portada terminen de tomar su tamaño. En
    // entornos sin requestAnimationFrame (tests, navegadores embebidos) usamos setTimeout:
    // la apertura no puede romper el resto de la aplicación por una API de animación.
    const nextFrame = typeof window.requestAnimationFrame === "function"
      ? callback => window.requestAnimationFrame(callback)
      : callback => window.setTimeout(callback, 0);
    nextFrame(() => nextFrame(alignWithHome));

    const skip = () => splash.classList.add("splash-skip");
    // El teclado nunca tiene que esperar al telón para empezar a recorrer la página.
    const skipKeyboard = () => remove();
    document.addEventListener("keydown", skipKeyboard, { once: true });
    splash.addEventListener("pointerdown", skip, { once: true, passive: true });
    splash.addEventListener("animationend", event => {
      if (event.target === splash && event.animationName.startsWith("splash-curtain-")) remove();
    });

    // Red de seguridad: incluso si el navegador no entrega animationend, el telón nunca
    // puede quedarse por encima de la aplicación.
    window.setTimeout(remove, 1800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootSplash, { once: true });
  } else {
    bootSplash();
  }
})();
