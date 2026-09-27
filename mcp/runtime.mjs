import { createServer } from "node:http";
import { stat, mkdir, realpath, open, unlink } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
const here = path.dirname(fileURLToPath(import.meta.url)),
  root = path.dirname(here);
export class Runtime {
  constructor() {
    this.sessions = new Map();
    this.inputs = new Map();
    this.jobs = new Map();
    this.output = path.resolve(
      process.env.JIZURA_OUTPUT_DIR || path.join(here, "output"),
    );
  }
  async start() {
    this.http = createServer(async (req, res) => {
      try {
        const u = new URL(req.url, "http://localhost");
        let filename;
        if (this.inputs.has(u.pathname)) {
          const item = this.inputs.get(u.pathname);
          filename = item.path;
          res.setHeader(
            "Content-Type",
            item.type || "application/octet-stream",
          );
        } else {
          const rel =
            decodeURIComponent(u.pathname).replace(/^\//, "") || "index.html";
          if (!/^(index(?:_en)?\.html|assets\/[^?]+|vendor\/[^?]+)$/.test(rel))
            throw Error("Unavailable");
          filename = path.resolve(root, rel);
          if (
            rel.split(/[\\/]/).includes("..") ||
            !filename.startsWith(root + path.sep)
          )
            throw Error("Invalid path");
          res.setHeader(
            "Content-Type",
            rel.endsWith(".html")
              ? "text/html; charset=utf-8"
              : rel.endsWith(".js")
                ? "text/javascript"
                : rel.endsWith(".png")
                  ? "image/png"
                  : "application/octet-stream",
          );
        }
        const info = await stat(filename);
        res.setHeader("Content-Length", info.size);
        createReadStream(filename)
          .on("error", () => res.destroy())
          .pipe(res);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise((r) => this.http.listen(0, "127.0.0.1", r));
    this.origin = `http://127.0.0.1:${this.http.address().port}`;
    try {
      this.browser = await chromium.launch({
        headless: process.env.JIZURA_HEADLESS !== "0",
        ...(process.env.JIZURA_BROWSER
          ? { executablePath: process.env.JIZURA_BROWSER }
          : process.platform === "win32"
            ? { channel: "msedge" }
            : {}),
      });
    } catch (e) {
      await this.close();
      throw e;
    }
  }
  async create() {
    const context = await this.browser.newContext({
        acceptDownloads: true,
        viewport: { width: 1280, height: 900 },
      }),
      page = await context.newPage();
    const id = randomUUID();
    const s = { id, context, page, busy: false };
    this.sessions.set(id, s);
    await page.exposeFunction("mcpProgress", (p) => {
      if (s.job) Object.assign(s.job, { progress: p });
    });
    await page.goto(this.origin);
    await page.waitForFunction(() => window.J?.ui?.plan);
    await page.addScriptTag({ path: path.join(here, "browser-api.js") });
    await this.call(id, "new", {});
    return { session: id };
  }
  get(id) {
    const s = this.sessions.get(id);
    if (!s) throw Error("Unknown session");
    return s;
  }
  async call(id, method, args) {
    const s = this.get(id);
    if (s.busy && method !== "cancel")
      throw Error("Session has an active operation");
    s.busy = true;
    try {
      return await s.page.evaluate(
        async ({ method, args }) => await window.JizuraMCP[method](args),
        { method, args },
      );
    } finally {
      s.busy = false;
    }
  }
  async input(id, args) {
    if (!path.isAbsolute(args.path)) throw Error("Input path must be absolute");
    const filename = await realpath(args.path);
    if (!(await stat(filename)).isFile()) throw Error("Input is not a file");
    const token = "/input/" + randomUUID();
    this.inputs.set(token, { path: filename, type: args.type });
    try {
      return await this.call(id, "import", {
        ...args,
        url: this.origin + token,
        name: path.basename(filename),
      });
    } finally {
      this.inputs.delete(token);
    }
  }
  async export(id, { filename, kind, every }) {
    const s = this.get(id);
    if (s.busy) throw Error("Session busy");
    if (
      !/^[\p{L}\p{N}_. -]+$/u.test(filename) ||
      filename === "." ||
      filename === ".."
    )
      throw Error("filename must be a simple file name");
    s.busy = true;
    const dest = path.join(this.output, filename);
    try {
      await mkdir(this.output, { recursive: true });
      const reservation = await open(dest, "wx");
      await reservation.close();
    } catch (e) {
      s.busy = false;
      throw e;
    }
    const job = {
      id: randomUUID(),
      session: id,
      status: "running",
      kind,
      path: dest,
      progress: { value: 0, message: "Starting" },
    };
    this.jobs.set(job.id, job);
    s.job = job;
    s.busy = true;
    void (async () => {
      let handler, timer;
      try {
        const download = new Promise((resolve) => {
          handler = resolve;
          s.page.once("download", handler);
        });
        job.metadata = await s.page.evaluate(
          (args) => window.JizuraMCP.output(args),
          {
            kind,
            every,
          },
        );
        const d = await Promise.race([
          download,
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(Error("Download did not start")),
              30000,
            );
          }),
        ]);
        const failure = await d.failure();
        if (failure) throw Error(failure);
        await d.saveAs(dest);
        job.status = "completed";
      } catch (e) {
        job.status = job.cancelled ? "cancelled" : "failed";
        job.error = e.message;
        await unlink(dest).catch(() => {});
      } finally {
        clearTimeout(timer);
        s.page.off("download", handler);
        s.busy = false;
        s.job = null;
      }
    })();
    return job;
  }
  async cancel(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) throw Error("Unknown job");
    if (job.status === "running") {
      job.cancelled = true;
      await this.get(job.session).page.evaluate(() =>
        window.JizuraMCP.cancel(),
      );
    }
    return job;
  }
  async closeSession(id) {
    const s = this.get(id);
    if (s.busy) throw Error("Cancel or finish job before closing session");
    await s.context.close();
    this.sessions.delete(id);
    return { closed: id };
  }
  async close() {
    await this.browser?.close();
    if (this.http) await new Promise((r) => this.http.close(r));
  }
}
