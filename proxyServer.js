const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();

app.use(
  "/api",
  createProxyMiddleware({
    target: "http://api.elasticemail.com",
    changeOrigin: true,
    pathRewrite: { "^/api": "" },
    onProxyReq: function (proxyReq) {
      proxyReq.setHeader(
        "Authorization",
        "CF3FFA621A83FA1FC632270DAFC7EE116211F71D42D4EB46A1D31C4E0BEF951F02B209FF18243C09B03200849A154DDF"
      );
    },
  })
);

app.listen(5500, () => {
  console.log("Proxy server listening on port 5500");
});
