import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createRemoteJWKSet, jwtVerify } from 'jose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // JWT Verification Middleware
  let cachedJWKS: any = null;
  const verifyJwt = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authingDomain = process.env.AUTHING_DOMAIN;
    
    // If authing domain is not configured, skip verification for development
    if (!authingDomain || authingDomain === "YOUR_AUTHING_DOMAIN.authing.cn") {
      console.warn("⚠️ AUTHING_DOMAIN is not configured. Skipping JWT verification.");
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "身份认证失败，请先登录系统" });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "无效的登录令牌" });
    }

    try {
      if (!cachedJWKS) {
        const jwksUrl = `https://${authingDomain}/oidc/.well-known/jwks.json`;
        cachedJWKS = createRemoteJWKSet(new URL(jwksUrl));
      }
      
      await jwtVerify(token, cachedJWKS);
      next();
    } catch (error: any) {
      console.error("JWT 验证失败:", error.message);
      // If verification fails, we return 401 to trigger re-login on the client
      return res.status(401).json({ error: "UNAUTHORIZED", message: "登录令牌已过期或无效，请重新登录" });
    }
  };

  // API Routes - BFF for Gemini
  app.post("/api/gemini", verifyJwt, async (req, res) => {
    try {
      const model = req.query.model as string || req.body.model || "gemini-3-flash-preview";
      const payload = req.body.payload || req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "API_KEY_MISSING", message: "服务端 GEMINI_API_KEY 未配置" });
      }

      const GOOGLE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 55000); // Increased to 55s for image generation stability

      try {
        const response = await fetch(GOOGLE_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const data = await response.json();
        res.status(response.status).json(data);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          return res.status(504).json({ error: "GATEWAY_TIMEOUT", message: "Google API 响应超时" });
        }
        throw fetchError;
      }
    } catch (error) {
      console.error("Gemini Proxy Error:", error);
      res.status(500).json({ error: "Gemini Proxy Error" });
    }
  });

  // Alipay Create
  app.post("/api/pay/create", async (req, res) => {
    // 组装支付宝预下单参数
    res.json({ qr_code: "https://example.com/mock_qr", out_trade_no: "TRADE_" + Date.now() });
  });

  // Alipay Query
  app.get("/api/pay/query", async (req, res) => {
    res.json({ status: "TRADE_SUCCESS" });
  });

  // Alipay Notify
  app.post("/api/pay/notify", async (req, res) => {
    res.send("success");
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
