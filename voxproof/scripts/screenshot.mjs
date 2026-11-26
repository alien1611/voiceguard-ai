import { spawn } from "child_process";
import http from "http";
import fs from "fs";
import path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA_DIR = "C:\\Users\\hp\\temp_chrome_audit";
const SCREENSHOT_DIR = path.resolve("./screenshots");

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
    });
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }
  }
}

async function getBrowserTargets() {
  return new Promise((resolve, reject) => {
    http
      .get("http://127.0.0.1:9222/json/list", (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureViewport(client, width, height, isMobile, outputPath) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: isMobile,
  });
  await sleep(1000);
  const { data } = await client.send("Page.captureScreenshot", {
    format: "png",
  });
  fs.writeFileSync(outputPath, Buffer.from(data, "base64"));
  console.log(`Saved screenshot: ${outputPath} (${width}x${height})`);
}

async function main() {
  const url = process.argv[2] || "http://localhost:3000/";
  const prefix = process.argv[3] || "view";

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const chromeArgs = [
    "--remote-debugging-port=9222",
    `--user-data-dir=${USER_DATA_DIR}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    url,
  ];

  const chromeProc = spawn(CHROME_PATH, chromeArgs, { stdio: "ignore" });

  let client = null;
  for (let i = 0; i < 20; i++) {
    await sleep(600);
    try {
      const targets = await getBrowserTargets();
      const pageTarget = targets.find((t) => t.type === "page");
      if (pageTarget && pageTarget.webSocketDebuggerUrl) {
        client = new CDPClient(pageTarget.webSocketDebuggerUrl);
        await client.connect();
        break;
      }
    } catch {}
  }

  if (!client) {
    chromeProc.kill();
    throw new Error("Failed to connect to Chrome CDP on 9222");
  }

  try {
    await client.send("Page.enable");
    await client.send("Page.navigate", { url });
    await sleep(2500);

    // 1440px Desktop
    await captureViewport(
      client,
      1440,
      900,
      false,
      path.join(SCREENSHOT_DIR, `${prefix}_1440.png`)
    );

    // 768px Tablet
    await captureViewport(
      client,
      768,
      1024,
      true,
      path.join(SCREENSHOT_DIR, `${prefix}_768.png`)
    );

    // 390px Mobile
    await captureViewport(
      client,
      390,
      844,
      true,
      path.join(SCREENSHOT_DIR, `${prefix}_390.png`)
    );
  } finally {
    client.close();
    chromeProc.kill();
  }
}

main().catch((err) => {
  console.error("Screenshot capture error:", err);
  process.exit(1);
});
