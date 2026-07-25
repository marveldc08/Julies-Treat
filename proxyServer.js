const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const rootDirectory = __dirname;

function loadEnvironmentFile() {
  const environmentPath = path.join(rootDirectory, ".env");
  if (!fs.existsSync(environmentPath)) return;

  for (const line of fs.readFileSync(environmentPath, "utf8").split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;
    const separator = trimmedLine.indexOf("=");
    if (separator < 1) continue;
    const key = trimmedLine.slice(0, separator).trim();
    let value = trimmedLine.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvironmentFile();
const port = Number(process.env.PORT) || 5500;
const orderStorePath = path.join(rootDirectory, "data", "orders.json");
const paymentCurrency = Number(process.env.PAYMENT_CURRENCY || 840);
const settlementCurrencies = {
  566: "NGN",
  840: "USD",
};
const interswitch = {
  merchantCode: process.env.INTERSWITCH_MERCHANT_CODE,
  payItemId: process.env.INTERSWITCH_PAY_ITEM_ID,
  mode: process.env.INTERSWITCH_MODE || "TEST",
  verifyUrl: process.env.INTERSWITCH_VERIFY_URL,
  verifyBearerToken: process.env.INTERSWITCH_VERIFY_BEARER_TOKEN,
};
const products = {
  "Puff Puff": 10,
  "Beef Shawarma": 170,
  "Chicken Pie": 50,
  "Meat Pie": 50,
  Samosa: 40,
  "Chin Chin": 35,
};
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function readOrders() {
  try {
    return JSON.parse(fs.readFileSync(orderStorePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

function saveOrders(orders) {
  fs.mkdirSync(path.dirname(orderStorePath), { recursive: true });
  const temporaryPath = `${orderStorePath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(orders, null, 2));
  fs.renameSync(temporaryPath, orderStorePath);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20_000) request.destroy();
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

function readForm(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20_000) request.destroy();
    });
    request.on("end", () => resolve(new URLSearchParams(body)));
    request.on("error", reject);
  });
}

function assertPaymentConfiguration() {
  if (!interswitch.merchantCode || !interswitch.payItemId || !interswitch.verifyUrl) {
    throw new Error("Payment server is not configured");
  }
}

async function getTryToSettlementRate() {
  const settlementCurrency = settlementCurrencies[paymentCurrency];
  if (!settlementCurrency) throw new Error("Unsupported payment currency");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/TRY", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Exchange rate unavailable");
    const data = await response.json();
    const rate = Number(data?.rates?.[settlementCurrency]);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("Invalid exchange rate");
    return rate;
  } finally {
    clearTimeout(timeout);
  }
}

function calculateOrder(input) {
  const snack = String(input.snack || "");
  const quantity = Number(input.quantity);
  const fulfilment = String(input.fulfilment || "");
  const unitPriceTry = products[snack];
  const customerName = String(input.customerName || "").trim().slice(0, 100);
  const customerEmail = String(input.customerEmail || "").trim().toLowerCase().slice(0, 254);
  const address = String(input.address || "").trim().slice(0, 1_000);
  if (
    !unitPriceTry ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 100 ||
    !["pickup", "delivery"].includes(fulfilment) ||
    customerName.length < 2 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
  ) {
    throw new Error("Invalid order");
  }
  const totalTry = unitPriceTry * quantity + (fulfilment === "delivery" ? 20 : 0);
  return { snack, quantity, fulfilment, totalTry, customerName, customerEmail, address };
}

async function createPaymentIntent(request, response) {
  try {
    assertPaymentConfiguration();
    const input = await readJson(request);
    const order = calculateOrder(input);
    const exchangeRate = await getTryToSettlementRate();
    const amountMinor = Math.round(order.totalTry * exchangeRate * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error("Invalid payment amount");

    const reference = `julies_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
    const orders = readOrders();
    orders[reference] = {
      ...order,
      amountMinor,
      currency: paymentCurrency,
      exchangeRate,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    saveOrders(orders);

    sendJson(response, 201, {
      reference,
      amountMinor,
      currency: paymentCurrency,
      currencyCode: settlementCurrencies[paymentCurrency],
      displayAmount: amountMinor / 100,
      merchantCode: interswitch.merchantCode,
      payItemId: interswitch.payItemId,
      mode: interswitch.mode,
      checkoutUrl:
        interswitch.mode === "LIVE"
          ? "https://newwebpay.interswitchng.com/collections/w/pay"
          : "https://sandbox.interswitchng.com/collections/w/pay",
    });
  } catch (error) {
    sendJson(response, error.message === "Invalid order" ? 400 : 503, {
      error: error.message === "Payment server is not configured" ? error.message : "Unable to create payment",
    });
  }
}

async function handlePaymentReturn(request, response) {
  try {
    const form = await readForm(request);
    const reference = form.get("txnref") || form.get("transactionreference");
    const orders = readOrders();
    const destination = reference && orders[reference]
      ? `/order.html?payment_ref=${encodeURIComponent(reference)}`
      : "/order.html?payment_error=return";
    response.writeHead(303, { Location: destination });
    response.end();
  } catch {
    response.writeHead(303, { Location: "/order.html?payment_error=return" });
    response.end();
  }
}

async function verifyPayment(request, response, reference) {
  try {
    assertPaymentConfiguration();
    const orders = readOrders();
    const order = orders[reference];
    if (!order) return sendJson(response, 404, { error: "Payment reference not found" });
    if (order.status === "paid") return sendJson(response, 200, { verified: true });

    const verificationUrl = new URL(interswitch.verifyUrl);
    verificationUrl.searchParams.set("merchantcode", interswitch.merchantCode);
    verificationUrl.searchParams.set("transactionreference", reference);
    verificationUrl.searchParams.set("amount", String(order.amountMinor));
    const headers = { Accept: "application/json", "Content-Type": "application/json" };
    if (interswitch.verifyBearerToken) headers.Authorization = `Bearer ${interswitch.verifyBearerToken}`;
    const upstream = await fetch(verificationUrl, { headers });
    if (!upstream.ok) throw new Error("Payment verification service unavailable");
    const transaction = await upstream.json();
    const verified = transaction.ResponseCode === "00" && Number(transaction.Amount) === order.amountMinor;

    order.status = verified ? "paid" : "pending";
    order.verifiedAt = verified ? new Date().toISOString() : undefined;
    order.interswitchResponseCode = transaction.ResponseCode;
    saveOrders(orders);
    return sendJson(response, 200, { verified });
  } catch (error) {
    return sendJson(response, 503, { error: "Unable to verify payment" });
  }
}

function serveStatic(request, response, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method not allowed");
    return;
  }
  let relativePath;
  try {
    relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  } catch {
    response.writeHead(400);
    response.end("Invalid request path");
    return;
  }
  const filePath = path.resolve(rootDirectory, relativePath);
  if (!filePath.startsWith(`${rootDirectory}${path.sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, file) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    if (request.method === "HEAD") response.end();
    else response.end(file);
  });
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (request.method === "POST" && url.pathname === "/api/payment-intents") return createPaymentIntent(request, response);
  if (request.method === "POST" && url.pathname === "/payment-return") return handlePaymentReturn(request, response);
  const verificationMatch = url.pathname.match(/^\/api\/payments\/(julies_[a-zA-Z0-9_]+)\/verify$/);
  if (request.method === "POST" && verificationMatch) return verifyPayment(request, response, verificationMatch[1]);
  return serveStatic(request, response, url.pathname);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE" || error.code === "EACCES") {
    console.error(`Port ${port} is already in use. Stop VS Code Live Server, then run npm start again.`);
    process.exitCode = 1;
    return;
  }
  throw error;
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Julie's Treats is running at http://127.0.0.1:${port}`);
  console.log(
    interswitch.merchantCode && interswitch.payItemId && interswitch.verifyUrl
      ? `Interswitch ${interswitch.mode} payment configuration loaded.`
      : "Interswitch payment configuration is incomplete. Check .env.",
  );
});
