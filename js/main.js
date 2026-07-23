const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".main-nav");

menuToggle?.addEventListener("click", () => {
  const isOpen = navigation.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) {
    navigation.style.cssText =
      "display:flex;position:absolute;z-index:10;top:95px;left:17px;right:17px;margin:0;padding:18px;flex-direction:column;align-items:flex-start;gap:16px;background:#fffdf7;border:1px solid #e8dcc6;border-radius:14px;box-shadow:0 15px 30px rgba(53,16,14,.12)";
  } else {
    navigation.removeAttribute("style");
  }
  menuToggle.innerHTML = isOpen
    ? '<i class="fa-solid fa-xmark"></i>'
    : '<i class="fa-solid fa-bars"></i>';
});

document.querySelectorAll(".favorite-photo button").forEach((button) => {
  button.addEventListener("click", () => {
    button.classList.toggle("is-liked");
    button.innerHTML = button.classList.contains("is-liked")
      ? '<i class="fa-solid fa-heart"></i>'
      : '<i class="fa-regular fa-heart"></i>';
  });
});

const favoriteViewport = document.querySelector(".favorite-grid");
const favoriteTrack = document.querySelector(".favorite-track");
const favoriteCards = favoriteTrack
  ? [...favoriteTrack.querySelectorAll(".favorite-card")]
  : [];
const favoritePrevious = document.querySelector(
  ".favorites .slider-buttons button:first-child",
);
const favoriteNext = document.querySelector(
  ".favorites .slider-buttons button:last-child",
);
let favoriteIndex = 0;

function setupFavoriteCarousel() {
  if (!favoriteViewport || !favoriteTrack || favoriteCards.length === 0) return;
  const isMobile = window.matchMedia("(max-width: 800px)").matches;
  const visibleCards = isMobile ? 1 : 3;
  const gap = 17;
  const maxIndex = Math.max(0, favoriteCards.length - visibleCards);
  favoriteViewport.style.display = "block";
  favoriteViewport.style.overflow = "hidden";
  favoriteTrack.style.display = "flex";
  favoriteTrack.style.gap = `${gap}px`;
  favoriteTrack.style.willChange = "transform";
  favoriteTrack.style.transition =
    "transform 650ms cubic-bezier(.22, 1, .36, 1)";
  favoriteCards.forEach((card) => {
    card.style.flex = isMobile ? "0 0 100%" : "0 0 calc((100% - 34px) / 3)";
  });
  favoriteIndex = Math.min(favoriteIndex, maxIndex);
  const cardWidth = favoriteCards[0].getBoundingClientRect().width + gap;
  const distance = favoriteIndex * cardWidth;
  favoriteTrack.style.transform = `translate3d(${-distance}px, 0, 0)`;
  if (favoritePrevious) favoritePrevious.disabled = favoriteIndex === 0;
  if (favoriteNext) favoriteNext.disabled = favoriteIndex === maxIndex;
}

favoritePrevious?.addEventListener("click", () => {
  favoriteIndex -= 1;
  setupFavoriteCarousel();
});

favoriteNext?.addEventListener("click", () => {
  favoriteIndex += 1;
  setupFavoriteCarousel();
});

setupFavoriteCarousel();
window.addEventListener("resize", setupFavoriteCarousel);

const revealItems = document.querySelectorAll(".reveal");
revealItems.forEach((item) => {
  item.style.animation = "none";
  item.style.transition = "none";
});
const revealObserver = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 },
);

revealItems.forEach((item) => revealObserver.observe(item));

document.querySelectorAll(".filter-button").forEach((filterButton) => {
  filterButton.addEventListener("click", () => {
    document
      .querySelectorAll(".filter-button")
      .forEach((button) => button.classList.remove("active"));
    filterButton.classList.add("active");
    const filter = filterButton.dataset.filter;
    document.querySelectorAll(".menu-card").forEach((card) => {
      card.style.display =
        filter === "all" || card.dataset.category === filter ? "" : "none";
    });
  });
});

document.querySelectorAll(".order-item").forEach((button) => {
  button.addEventListener("click", () => {
    const params = new URLSearchParams({
      snack: button.dataset.name,
      price: button.dataset.price,
      image: button.dataset.image,
    });
    window.location.href = `order.html?${params.toString()}`;
  });
});

const orderForm = document.querySelector("#orderForm");
const snackChoice = document.querySelector("#snackChoice");
const quantity = document.querySelector("#quantity");
const delivery = document.querySelector("#delivery");
const orderTotal = document.querySelector("#orderTotal");
const paymentEstimate = document.querySelector("#paymentEstimate");
const PAYMENT_CURRENCY = 840; // USD, supported by the Interswitch account.
const RATE_ENDPOINT = "https://open.er-api.com/v6/latest/TRY";
let tryToUsdRate = null;

function updateOrderTotal() {
  if (!snackChoice || !quantity || !delivery || !orderTotal) return;
  const price = Number(snackChoice.value.split("|")[1]);
  const total =
    price * Math.max(1, Number(quantity.value) || 1) +
    (delivery.value === "delivery" ? 20 : 0);
  orderTotal.textContent = `₺${total.toFixed(2)}`;
  if (paymentEstimate && tryToUsdRate) {
    paymentEstimate.textContent = `≈ $${(total * tryToUsdRate).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} at payment`;
  }
}

async function getTryToUsdRate() {
  if (tryToUsdRate) return tryToUsdRate;
  const response = await fetch(RATE_ENDPOINT, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Exchange rate unavailable");
  const data = await response.json();
  const rate = Number(data?.rates?.USD);
  if (!Number.isFinite(rate) || rate <= 0)
    throw new Error("Invalid exchange rate");
  tryToUsdRate = rate;
  return rate;
}

const orderParams = new URLSearchParams(window.location.search);
if (snackChoice && orderParams.has("snack")) {
  const selected = [...snackChoice.options].find((option) =>
    option.value.startsWith(`${orderParams.get("snack")}|`),
  );
  if (selected) snackChoice.value = selected.value;
}
[snackChoice, quantity, delivery].forEach((field) =>
  field?.addEventListener("input", updateOrderTotal),
);
updateOrderTotal();

orderForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const orderMessage = document.querySelector("#orderMessage");
  const submitButton = orderForm.querySelector('button[type="submit"]');
  const customerEmail = document.querySelector("#customerEmail")?.value.trim();
  const customerName = document.querySelector("#customerName")?.value.trim();
  const priceInLira = Number(snackChoice.value.split("|")[1]);
  const itemQuantity = Math.max(1, Number(quantity.value) || 1);
  const deliveryFee = delivery.value === "delivery" ? 20 : 0;
  const totalInLira = priceInLira * itemQuantity + deliveryFee;

  if (typeof window.webpayCheckout !== "function") {
    orderMessage.textContent =
      "Payment service is unavailable. Please try again shortly.";
    return;
  }

  submitButton.disabled = true;
  orderMessage.textContent =
    "Converting TRY to USD and opening secure payment…";

  try {
    const exchangeRate = await getTryToUsdRate();
    const totalInUsd = totalInLira * exchangeRate;
    if (paymentEstimate)
      paymentEstimate.textContent = `≈ $${totalInUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} at payment`;
    window.webpayCheckout({
      merchant_code: "MX201383",
      pay_item_id: "Default_Payable_MX201383",
      txn_ref: `julies_${Date.now()}`,
      amount: Math.round(totalInUsd * 100), // USD is submitted in cents.
      currency: PAYMENT_CURRENCY,
      cust_email: customerEmail,
      cust_name: customerName,
      site_redirect_url: window.location.href,
      mode: "TEST",
      onComplete(response) {
        if (response?.resp === "00") {
          orderMessage.textContent =
            "Payment completed successfully. Your order has been received.";
          orderForm.reset();
          updateOrderTotal();
        } else {
          orderMessage.textContent =
            "Payment was not completed. You can try again.";
        }
        submitButton.disabled = false;
      },
    });
  } catch (error) {
    orderMessage.textContent =
      error.message === "Exchange rate unavailable" ||
      error.message === "Invalid exchange rate"
        ? "We could not get the current TRY to USD exchange rate. Please try again."
        : "Unable to open payment. Please try again.";
    submitButton.disabled = false;
  }
});

document
  .querySelector("#contactForm")
  ?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.querySelector("#contactMessage");
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.style.opacity = "0.7";
    message.textContent = "Sending your message…";

    try {
      const response = await fetch(
        "https://formsubmit.co/ajax/julie.s.treat1@gmail.com",
        {
          method: "POST",
          headers: { Accept: "application/json" },
          body: new FormData(form),
        },
      );
      if (!response.ok) throw new Error("Message delivery failed");
      form.reset();
      message.textContent =
        "Thanks for reaching out! Your message was sent successfully.";
    } catch (error) {
      message.textContent =
        "We could not send your message right now. Please email julie.s.treat1@gmail.com directly.";
    } finally {
      submitButton.disabled = false;
      submitButton.style.opacity = "1";
    }
  });

function loadScript(source) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = source;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function startGsapAnimations() {
  if (!window.gsap) return;
  if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  const introElements = document.querySelectorAll(
    ".hero-copy > *, .page-hero > div > *, .menu-intro > *, .section-intro > *, .section-heading > div > *, .cta-content > *",
  );
  gsap.fromTo(
    introElements,
    { autoAlpha: 0, y: 28 },
    {
      autoAlpha: 1,
      y: 0,
      duration: 1.05,
      stagger: 0.1,
      ease: "power2.out",
      delay: 0.15,
      overwrite: "auto",
    },
  );

  document.querySelectorAll(".reveal").forEach((element) => {
    if (
      element.matches(
        ".feature-card, .favorite-card, .service-card, .menu-card, .stat",
      )
    )
      return;
    gsap.fromTo(
      element,
      { autoAlpha: 0, y: 45 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 1.15,
        ease: "power2.out",
        overwrite: "auto",
        scrollTrigger: { trigger: element, start: "top 86%", once: true },
      },
    );
  });

  const cardGroups = document.querySelectorAll(
    ".story-grid, .favorite-grid, .service-grid, .menu-grid, .stat-row",
  );
  cardGroups.forEach((group) => {
    const cards = group.querySelectorAll(
      ".feature-card, .favorite-card, .service-card, .menu-card, .stat",
    );
    cards.forEach((card) => {
      card.style.transition = "none";
      card.addEventListener("mouseenter", () =>
        gsap.to(card, {
          y: -8,
          duration: 0.3,
          ease: "power2.out",
          overwrite: "auto",
        }),
      );
      card.addEventListener("mouseleave", () =>
        gsap.to(card, {
          y: 0,
          duration: 0.55,
          ease: "power2.inOut",
          overwrite: "auto",
        }),
      );
    });
    gsap.fromTo(
      cards,
      { autoAlpha: 0, y: 35, scale: 0.97 },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.85,
        stagger: 0.18,
        ease: "power2.out",
        overwrite: "auto",
        scrollTrigger: { trigger: group, start: "top 88%", once: true },
      },
    );
  });

  document
    .querySelectorAll(
      ".button, .header-order, .filter-button, .slider-buttons button, .menu-photo button",
    )
    .forEach((button) => {
      button.style.transition = "none";
      button.addEventListener("mouseenter", () =>
        gsap.to(button, {
          scale: 1.04,
          duration: 0.3,
          ease: "power2.out",
          overwrite: "auto",
        }),
      );
      button.addEventListener("mouseleave", () =>
        gsap.to(button, {
          scale: 1,
          duration: 0.45,
          ease: "power2.inOut",
          overwrite: "auto",
        }),
      );
      button.addEventListener("mousedown", () =>
        gsap.to(button, {
          scale: 0.97,
          duration: 0.15,
          ease: "power2.out",
          overwrite: "auto",
        }),
      );
      button.addEventListener("mouseup", () =>
        gsap.to(button, {
          scale: 1.04,
          duration: 0.25,
          ease: "power2.out",
          overwrite: "auto",
        }),
      );
    });

  document
    .querySelectorAll(
      ".hero-image img, .page-hero, .cta > img, .image-stack img",
    )
    .forEach((image) => {
      if (window.ScrollTrigger)
        gsap.to(image, {
          yPercent: 7,
          ease: "none",
          scrollTrigger: { trigger: image, scrub: true },
        });
    });

  document.querySelectorAll(".footer-main > div").forEach((column, index) => {
    gsap.fromTo(
      column,
      { autoAlpha: 0, y: 20 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.7,
        delay: index * 0.08,
        ease: "power2.out",
        scrollTrigger: { trigger: column, start: "top 92%", once: true },
      },
    );
  });
}

if (window.gsap) {
  startGsapAnimations();
} else {
  loadScript("https://cdn.jsdelivr.net/npm/gsap@3.12.7/dist/gsap.min.js")
    .then(() =>
      loadScript(
        "https://cdn.jsdelivr.net/npm/gsap@3.12.7/dist/ScrollTrigger.min.js",
      ),
    )
    .then(startGsapAnimations)
    .catch(() =>
      document.documentElement.classList.add("animations-unavailable"),
    );
}
