import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const output = await mkdtemp(path.join(os.tmpdir(), "jizura-mcp-test-"));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(here, "server.mjs")],
  env: { ...process.env, JIZURA_OUTPUT_DIR: output },
  stderr: "pipe",
});
transport.stderr?.on("data", (b) => process.stderr.write(b));
const client = new Client({ name: "jizura-test", version: "1" });
async function call(name, args = {}) {
  const r = await client.callTool({ name, arguments: args }, undefined, {
    timeout: 180000,
  });
  assert.ok(!r.isError, `${name}: ${r.content?.[0]?.text}`);
  return r;
}
const json = (r) => JSON.parse(r.content[0].text);
async function runJob(session, kind, filename) {
  const job = json(await call("export_start", { session, kind, filename }));
  let j;
  for (let n = 0; n < 300; n++) {
    j = json(await call("job_status", { job: job.id }));
    if (j.status !== "running") break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(j.status, "completed", JSON.stringify(j));
  if (kind === "mp4") {
    assert.equal(j.metadata.width, 320);
    assert.equal(j.metadata.height, 180);
    assert.ok(j.metadata.audio);
  }
  assert.ok((await stat(j.path)).size > 0);
  return j.path;
}
try {
  await client.connect(transport);
  assert.ok((await client.listTools()).tools.length >= 25);
  assert.equal((await client.listResources()).resources.length, 1);
  const { session } = json(await call("session_create"));
  console.log("session created");
  await call("theme_set", { session, themes: ["pop"] });
  await call("project_edit", {
    session,
    changes: [
      { path: ["lyrics"], value: "プレビュー|ルビ\n次の歌詞" },
      { path: ["durationOverride"], value: 3 },
      { path: ["fps"], value: 12 },
      { path: ["videoSize"], value: { w: 320, h: 180 } },
    ],
  });
  const image = path.resolve(here, "../assets/effect-preview.png");
  let s = json(
    await call("asset_import", {
      session,
      path: image,
      kind: "media",
      layer: "foreground",
      type: "image/png",
    }),
  );
  await call("cut_insert", {
    session,
    layer: "foreground",
    frame: 0,
    itemId: s.project.foreground.items[0].id,
  });
  // A real PCM audio fixture makes audio import / preview / MP4 audio testable without private files.
  const wav = Buffer.alloc(44 + 16000 * 3 * 2);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24);
  wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  for (let i = 0; i < 48000; i++)
    wav.writeInt16LE(
      Math.round(Math.sin((i / 16000) * 440 * 2 * Math.PI) * 3000),
      44 + i * 2,
    );
  const audioPath = path.join(output, "audio.wav");
  await writeFile(audioPath, wav);
  await call("asset_import", {
    session,
    path: audioPath,
    kind: "audio",
    type: "audio/wav",
  });
  const audio = await call("audio_preview", {
    session,
    start: 0,
    duration: 0.2,
  });
  assert.ok(audio.content.some((c) => c.type === "audio"));
  if (process.env.JIZURA_TEST_FONT)
    await call("asset_import", {
      session,
      kind: "font",
      path: process.env.JIZURA_TEST_FONT,
    });
  const analysis = json(
    await call("audio_analysis", { session, start: 0, duration: 1 }),
  );
  assert.equal(analysis.energy.length, 50);
  await call("generate", { session, seed: 42 });
  s = json(await call("project_get", { session }));
  assert.ok(s.cuts.foreground.length);
  await call("cut_effect", {
    session,
    layer: "foreground",
    index: 0,
    group: "technique",
    seed: 9,
  });
  await call("cut_update", {
    session,
    layer: "foreground",
    index: 0,
    patch: {
      opacity: 80,
      placement: { cx: 0.2, cy: 0.1, w: 0.6, h: 0.7, angle: 15 },
      details: {
        mask: {
          enabled: true,
          shapes: [{ type: "ellipse", cx: 0.5, cy: 0.5, w: 0.8, h: 0.8 }],
        },
      },
    },
  });
  await call("cut_split", { session, layer: "foreground", frame: 18 });
  await call("cut_timing", {
    session,
    layer: "foreground",
    starts: [{ index: 1, frame: 20 }],
  });
  await call("cut_randomize", { session, layer: "lyrics", index: 0, seed: 6 });
  await call("cut_effect", {
    session,
    layer: "lyrics",
    index: 0,
    group: "layout",
    seed: 7,
  });
  const bad = await client.callTool({
    name: "cut_effect",
    arguments: {
      session,
      layer: "lyrics",
      index: 0,
      group: "layout",
      id: "invented",
    },
  });
  assert.ok(bad.isError);
  let audit = json(await call("project_audit", { session }));
  assert.deepEqual(audit.errors, []);
  const preview = await call("preview_frame", {
    session,
    frame: 10,
    width: 320,
  });
  assert.ok(preview.content.some((c) => c.type === "image"));
  await writeFile(
    path.join(output, "preview.png"),
    Buffer.from(preview.content.find((c) => c.type === "image").data, "base64"),
  );
  await call("quality_approve", {
    session,
    revision: audit.revision,
    note: "Automated smoke test approval only; not a claim of aesthetic quality.",
  });
  for (const kind of [
    "project",
    "settings",
    "ae",
    "png",
    "png-transparent",
    "mp4",
  ]) {
    const f = await runJob(
      session,
      kind,
      `test-${kind}.${kind === "mp4" ? "mp4" : kind.startsWith("png") ? "zip" : kind === "ae" ? "json" : "jizura"}`,
    );
    console.log(kind, (await stat(f)).size);
  }
  // Edits invalidate approval, even if appearance is unchanged.
  await call("project_edit", {
    session,
    changes: [{ path: ["title"], value: "Changed" }],
  });
  assert.equal(json(await call("project_audit", { session })).ready, false);
  const stale = await client.callTool({
    name: "quality_approve",
    arguments: {
      session,
      revision: audit.revision,
      note: "This revision must be rejected as stale",
    },
  });
  assert.ok(stale.isError);
  const traversal = await client.callTool({
    name: "export_start",
    arguments: { session, kind: "project", filename: "../escape.jizura" },
  });
  assert.ok(traversal.isError);
  const existing = await client.callTool({
    name: "export_start",
    arguments: { session, kind: "project", filename: "test-project.jizura" },
  });
  assert.ok(existing.isError);
  // Generic edits cannot evade the theme gate.
  const catalog = json(await call("catalog", { session }));
  const disallowed = Object.keys(catalog.registries.layout).find(
    (k) => !catalog.candidates.lyrics.layout.includes(k),
  );
  await call("cut_update", {
    session,
    layer: "lyrics",
    index: 0,
    patch: { details: { layout: disallowed } },
  });
  assert.ok(json(await call("project_audit", { session })).errors.length);
  await call("project_undo", { session });
  const reopened = json(await call("session_create")).session;
  s = json(
    await call("asset_import", {
      session: reopened,
      path: path.join(output, "test-project.jizura"),
      kind: "project",
    }),
  );
  assert.equal(s.project.lyrics, "プレビュー|ルビ\n次の歌詞");
  assert.equal(s.project.foreground.items.length, 1);
  assert.equal(s.cuts.foreground.length, 2);
  await call("cut_delete", {
    session: reopened,
    layer: "foreground",
    index: 1,
  });
  await call("project_undo", { session: reopened });
  s = json(await call("project_get", { session: reopened }));
  assert.equal(s.cuts.foreground.length, 2);
  await call("asset_import", {
    session: reopened,
    kind: "settings",
    path: path.join(output, "test-settings.jizura"),
  });
  s = json(await call("project_get", { session: reopened }));
  assert.equal(s.project.foreground.items.length, 1);
  // Link boundaries and move them together, then undo to retain the fixture.
  await call("boundary_link", { session: reopened, a: "f:0", b: "l:0:0" });
  await call("cut_timing", {
    session: reopened,
    layer: "foreground",
    starts: [{ index: 0, frame: 6 }],
  });
  s = json(await call("project_get", { session: reopened }));
  assert.equal(s.cuts.foreground[0].start, s.cuts.lyrics[0].start);
  await call("project_undo", { session: reopened });
  await call("project_undo", { session: reopened });
  await call("cut_insert", {
    session: reopened,
    layer: "lyrics",
    frame: 12,
    blank: true,
  });
  assert.deepEqual(
    json(await call("project_audit", { session: reopened })).errors,
    [],
  );
  await call("project_undo", { session: reopened });
  if (process.env.JIZURA_TEST_VIDEO) {
    s = json(
      await call("asset_import", {
        session: reopened,
        path: process.env.JIZURA_TEST_VIDEO,
        kind: "media",
        layer: "media",
        type: "video/mp4",
      }),
    );
    await call("cut_insert", {
      session: reopened,
      layer: "media",
      frame: 0,
      itemId: s.project.media.items.at(-1).id,
    });
    await call("cut_update", {
      session: reopened,
      layer: "media",
      index: 0,
      patch: { videoStart: 0.5 },
    });
    await call("cut_split", { session: reopened, layer: "media", frame: 12 });
    s = json(await call("project_get", { session: reopened }));
    assert.ok(Math.abs(s.cuts.media[1].videoStart - 1.5) < 0.01);
    await call("preview_frame", { session: reopened, frame: 16, width: 320 });
    console.log("video split/seek passed");
  }
  // Cancellation interrupts render work and frees the session for further edits.
  await call("project_edit", {
    session: reopened,
    changes: [{ path: ["durationOverride"], value: 60 }],
  });
  const a2 = json(await call("project_audit", { session: reopened }));
  assert.deepEqual(a2.errors, []);
  await call("preview_frame", { session: reopened, frame: 5, width: 320 });
  await call("quality_approve", {
    session: reopened,
    revision: a2.revision,
    note: "Cancellation fixture only; rendering deliberately interrupted.",
  });
  const pending = json(
    await call("export_start", {
      session: reopened,
      kind: "png",
      filename: "cancel.zip",
    }),
  );
  await call("job_cancel", { job: pending.id });
  let cancelled;
  for (let i = 0; i < 100; i++) {
    cancelled = json(await call("job_status", { job: pending.id }));
    if (cancelled.status !== "running") break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(cancelled.status, "cancelled");
  await call("session_close", { session: reopened });
  await call("session_close", { session });
  console.log("PASS", output);
} finally {
  await client.close();
}
