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

function formatTry(amount) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(amount);
}

function formatSettlementAmount(amount, currencyCode) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}

function getOrderTotalInTry() {
  const priceInLira = Number(snackChoice?.value.split("|")[1]);
  const itemQuantity = Math.max(1, Math.min(100, Number(quantity?.value) || 1));
  const deliveryFee = delivery?.value === "delivery" ? 20 : 0;
  const totalInLira = priceInLira * itemQuantity + deliveryFee;

  if (!Number.isFinite(totalInLira) || totalInLira <= 0) {
    throw new Error("Invalid order total");
  }

  return totalInLira;
}

function updateOrderTotal() {
  if (!snackChoice || !quantity || !delivery || !orderTotal) return;
  let total;
  try {
    total = getOrderTotalInTry();
  } catch {
    orderTotal.textContent = "—";
    return;
  }

  orderTotal.textContent = formatTry(total);
  if (paymentEstimate) paymentEstimate.textContent = "Payment currency calculated securely at checkout";
}

async function createPaymentIntent() {
  const response = await fetch("/api/payment-intents", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      snack: snackChoice.value.split("|")[0],
      quantity: Number(quantity.value),
      fulfilment: delivery.value,
      customerName: document.querySelector("#customerName")?.value,
      customerEmail: document.querySelector("#customerEmail")?.value,
      address: document.querySelector("#address")?.value,
    }),
  });
  const data = await readPaymentResponse(response);
  if (!response.ok) throw new Error(data.error || "Unable to create payment");
  return data;
}

async function verifyPayment(reference) {
  const response = await fetch(`/api/payments/${encodeURIComponent(reference)}/verify`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  const data = await readPaymentResponse(response);
  if (!response.ok) throw new Error(data.error || "Unable to verify payment");
  return data.verified === true;
}

function startRedirectCheckout(payment) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = payment.checkoutUrl;
  const fields = {
    merchant_code: payment.merchantCode,
    pay_item_id: payment.payItemId,
    txn_ref: payment.reference,
    amount: payment.amountMinor,
    currency: payment.currency,
    cust_email: document.querySelector("#customerEmail")?.value.trim(),
    cust_name: document.querySelector("#customerName")?.value.trim(),
    site_redirect_url: `${window.location.origin}/payment-return`,
  };
  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = String(value || "");
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

async function readPaymentResponse(response) {
  const body = await response.text();
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(
      `The payment server returned ${response.status} ${response.statusText || "an invalid response"}. Open this site with npm start, not VS Code Live Server.`,
    );
  }
}

const orderParams = new URLSearchParams(window.location.search);
if (snackChoice && orderParams.has("snack")) {
  const selected = [...snackChoice.options].find((option) =>
    option.value.startsWith(`${orderParams.get("snack")}|`),
  );
  if (selected) snackChoice.value = selected.value;
}
[snackChoice, quantity, delivery].forEach((field) => {
  field?.addEventListener("input", updateOrderTotal);
  field?.addEventListener("change", updateOrderTotal);
});
updateOrderTotal();

const returnedPaymentReference = new URLSearchParams(window.location.search).get("payment_ref");
if (returnedPaymentReference) {
  const orderMessage = document.querySelector("#orderMessage");
  orderMessage.textContent = "Verifying your payment securely…";
  verifyPayment(returnedPaymentReference)
    .then((verified) => {
      orderMessage.textContent = verified
        ? "Payment verified. Your order has been received."
        : "Your payment is still being confirmed. Please do not pay again.";
    })
    .catch(() => {
      orderMessage.textContent = "Your payment is still being confirmed. Please do not pay again.";
    })
    .finally(() => window.history.replaceState({}, "", "order.html"));
}

orderForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const orderMessage = document.querySelector("#orderMessage");
  const submitButton = orderForm.querySelector('button[type="submit"]');
  const customerEmail = document.querySelector("#customerEmail")?.value.trim();
  const customerName = document.querySelector("#customerName")?.value.trim();
  try {
    getOrderTotalInTry();
  } catch {
    orderMessage.textContent = "Please review your order and try again.";
    return;
  }

  submitButton.disabled = true;
  orderMessage.textContent =
    "Calculating your secure payment…";

  try {
    const payment = await createPaymentIntent();
    if (paymentEstimate)
      paymentEstimate.textContent = `Estimated charge: ${formatSettlementAmount(payment.displayAmount, payment.currencyCode)}`;
    const paymentCurrencyNote = document.querySelector("#paymentCurrencyNote");
    if (paymentCurrencyNote)
      paymentCurrencyNote.textContent =
        `Prices are displayed in Turkish lira (TRY). Your card will be charged in ${payment.currencyCode}. Your bank may apply its own exchange rate or fees.`;
    startRedirectCheckout(payment);
  } catch (error) {
    orderMessage.textContent = error.message || "Unable to open payment. Please try again.";
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
