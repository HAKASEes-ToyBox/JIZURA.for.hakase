import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Runtime } from "./runtime.mjs";
const runtime = new Runtime();
const server = new McpServer({ name: "jizura", version: "0.1.0" });
const session = z.string().describe("ID returned by session_create");
const layer = z
  .enum(["lyrics", "foreground", "media"])
  .describe("media = background");
const text = (value) => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});
function tool(name, description, inputSchema, fn) {
  server.registerTool(name, { description, inputSchema }, async (args) => {
    try {
      return text(await fn(args));
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: e.message }] };
    }
  });
}
const workflow = `Create a session. Read catalog and project state. Set themes first; candidate IDs come from catalog/candidates, never invent them. Import audio, fonts and images/videos by absolute local paths. Set lyrics and project settings with project_edit (JSON path arrays). Inspect the generated cuts. Set cut start FRAMES using cut_timing after listening/using beats; beats alone do not identify lyric onsets. Arrange media cuts with manualCuts, cutCount, cutOverrides and timing.lineTimes (seconds) via project_edit. Use cut_update for placement, masks, chroma, blend, opacity and per-cut details. Generate with a seed, then inspect snapshots at entrances, holds, exits and boundaries. Evaluate readability, timing, composition, consistency and audio synchronization. Refine using theme candidates, inspect again, audit, then quality_approve with current revision and honest visual/audio review notes. Start export and poll job_status until completed. Project/settings saves do not require approval. Do not claim aesthetic quality from audit alone. Edits invalidate approval. No transcription service is included. State/cut properties and catalog defaults are the current engine schema. For custom favorites, read favorite_spec, author a JSON drawing program or capture a cut with favorite_save, validate, inspect favorite_preview images at several times, revise, and export_start kind favorites with a .jizuraichifav filename. Drawing programs are not JavaScript; theme audit cannot judge their aesthetic fit. All local files remain on this machine; public Pages has no MCP endpoint.`;
tool("session_create", "Create isolated JIZURA browser project.", {}, () =>
  runtime.create(),
);
tool(
  "session_close",
  "Release browser and media resources.",
  { session },
  (a) => runtime.closeSession(a.session),
);
tool(
  "project_get",
  "Inspect project, resolved cuts (paginated) and audio summary. Cut indices remain absolute.",
  {
    session,
    offset: z.number().int().nonnegative().default(0),
    limit: z.number().int().min(1).max(200).default(50),
    includeProject: z.boolean().default(true),
  },
  (a) => runtime.call(a.session, "state", a),
);
tool(
  "audio_analysis",
  "Get beat times and 50Hz energy envelope for a bounded interval (seconds). Not lyric recognition.",
  {
    session,
    start: z.number().nonnegative().default(0),
    duration: z.number().positive().max(120).default(30),
  },
  (a) => runtime.call(a.session, "audioAnalysis", a),
);
for (const [name, method, description] of [
  [
    "catalog",
    "catalog",
    "Discover themes, effect IDs, defaults, detail keys, masks, copy sources and theme candidates.",
  ],
  [
    "theme_candidates",
    "candidates",
    "Get union of allowed effect candidates for selected themes.",
  ],
  [
    "project_audit",
    "audit",
    "Technical/theme checks; NOT aesthetic evaluation.",
  ],
  ["project_undo", "undo", "Undo last project edit (not file imports)."],
])
  tool(name, description, { session }, (a) =>
    runtime.call(a.session, method, {}),
  );
tool(
  "theme_set",
  "Set theme IDs and apply theme-compatible omakase settings.",
  { session, themes: z.array(z.string()).min(1) },
  (a) => runtime.call(a.session, "theme", a),
);
tool(
  "project_edit",
  "Edit engine project fields using path arrays. Read project_get/catalog first. Includes lyrics, settings, cuts, fonts, links, visibility. Audit detects off-theme cuts and blocks final export.",
  {
    session,
    changes: z
      .array(
        z.object({
          path: z
            .array(z.union([z.string(), z.number().int().nonnegative()]))
            .min(1),
          value: z.unknown(),
        }),
      )
      .min(1),
  },
  (a) => runtime.call(a.session, "edit", a),
);
tool(
  "asset_import",
  "Import project/settings/audio/media/font/favorites from an absolute LOCAL path. Favorites accept .jizuraichifav or project files; mode chooses append/replace. Audio accepts video and extracts audio. For media, layer defaults to background.",
  {
    session,
    path: z.string(),
    mode: z.enum(["append","replace"]).default("append"),
    kind: z.enum(["project", "settings", "audio", "media", "font", "favorites"]),
    layer: z.enum(["foreground", "media"]).default("media"),
    type: z.string().optional(),
    matchDuration: z.boolean().default(true),
    background: z.boolean().default(false),
  },
  (a) => runtime.input(a.session, a),
);
tool(
  "generate",
  "Run existing omakase with theme filtering and reproducible seed.",
  { session, seed: z.number().int() },
  (a) => runtime.call(a.session, "generate", a),
);
tool(
  "cut_update",
  "Merge native cut overrides. details holds detailed effect parameters; consult catalog and resolved cut first. area/placement/mask supported.",
  {
    session,
    layer,
    index: z.number().int().nonnegative(),
    patch: z.record(z.unknown()),
  },
  (a) => runtime.call(a.session, "cut", a),
);
tool(
  "cut_timing",
  "Set start frames of resolved cut indices. Inspect state afterward; planner enforces minimum spacing.",
  {
    session,
    layer,
    starts: z
      .array(
        z.object({
          index: z.number().int().nonnegative(),
          frame: z.number().int().nonnegative(),
        }),
      )
      .min(1),
  },
  (a) => runtime.call(a.session, "timing", a),
);
tool(
  "cut_split",
  "Split a media cut with continuous video source offsets.",
  {
    session,
    layer: z.enum(["foreground", "media"]),
    frame: z.number().int().nonnegative(),
    randomLeft: z.boolean().default(false),
    randomRight: z.boolean().default(false),
  },
  (a) => runtime.call(a.session, "split", a),
);
server.registerTool(
  "preview_frame",
  {
    description:
      "Render actual engine frame as PNG for visual evaluation. Call at several frames/cut boundaries.",
    inputSchema: {
      session,
      frame: z.number().int().nonnegative(),
      width: z.number().int().min(160).max(1920).default(960),
    },
  },
  async (a) => {
    try {
      const r = await runtime.call(a.session, "preview", a);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ revision: r.revision, frame: r.frame }),
          },
          { type: "image", mimeType: "image/png", data: r.data },
        ],
      };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: e.message }] };
    }
  },
);
tool(
  "cut_insert",
  "Insert a lyric or media cut at a frame until the next cut; blank=true ends the lyric showing at the frame (its end time) instead. Media asset IDs come from project_get or catalog copySources.",
  {
    session,
    layer,
    frame: z.number().int().nonnegative(),
    text: z.string().optional(),
    itemId: z.string().nullable().optional(),
    blank: z.boolean().default(false),
  },
  (a) => runtime.call(a.session, "insert", a),
);
tool(
  "cut_delete",
  "Delete one resolved cut.",
  { session, layer, index: z.number().int().nonnegative() },
  (a) => runtime.call(a.session, "remove", a),
);
tool(
  "cut_effect",
  "Choose or reroll ONE effect from theme candidates. Omit id to pick a different allowed choice. Media uses technique/entrance/departure; lyrics uses registry group names.",
  {
    session,
    layer,
    index: z.number().int().nonnegative(),
    group: z.string(),
    id: z.string().optional(),
    seed: z.number().int().default(1),
  },
  (a) => runtime.call(a.session, "effect", a),
);
tool(
  "cut_randomize",
  "Reroll a cut within theme candidates; retain area/mask/media playback. Optionally disable current effects in project candidate checkboxes.",
  {
    session,
    layer,
    index: z.number().int().nonnegative(),
    seed: z.number().int().default(1),
    disableCurrent: z.boolean().default(false),
  },
  (a) => runtime.call(a.session, "randomize", a),
);
tool(
  "cut_copy_effects",
  "Copy effects between compatible cuts, retaining destination placement.",
  {
    session,
    sourceLayer: layer,
    sourceIndex: z.number().int().nonnegative(),
    layer,
    index: z.number().int().nonnegative(),
  },
  (a) => runtime.call(a.session, "copy", a),
);
tool(
  "boundary_link",
  "Link/unlink start boundaries. IDs: l:line:part, f:index, m:index. cut_timing moves linked boundaries together.",
  { session, a: z.string(), b: z.string(), remove: z.boolean().default(false) },
  (a) => runtime.call(a.session, "link", a),
);
server.registerTool(
  "audio_preview",
  {
    description:
      "Listen to source audio clip (WAV), to align lyrics and assess rhythm. Max 20 seconds.",
    inputSchema: {
      session,
      start: z.number().nonnegative().default(0),
      duration: z.number().positive().max(20).default(10),
    },
  },
  async (a) => {
    try {
      const r = await runtime.call(a.session, "audioClip", a);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ start: r.start, duration: r.duration }),
          },
          { type: "audio", mimeType: "audio/wav", data: r.data },
        ],
      };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: e.message }] };
    }
  },
);

for(const [name,method,description] of [
  ['favorite_spec','favoriteSpec','Get the portable favorite format and drawing-program authoring specification.'],
  ['favorite_list','favoriteList','List saved favorites including payloads.']
])tool(name,description,{session},a=>runtime.call(a.session,method,a));
tool('favorite_validate','Validate an authored favorite payload without saving.',{session,payload:z.record(z.unknown())},a=>runtime.call(a.session,'favoriteValidate',a));
tool('favorite_save','Create/update a named favorite from a payload or capture a cut. Read favorite_spec first.',{session,name:z.string().max(200),id:z.string().optional(),payload:z.record(z.unknown()).optional(),layer:layer.optional(),index:z.number().int().nonnegative().optional()},a=>runtime.call(a.session,'favoriteSave',a));
tool('favorite_apply','Apply a favorite to a compatible cut, keeping its text/material, timing and placement.',{session,id:z.string(),layer,index:z.number().int().nonnegative()},a=>runtime.call(a.session,'favoriteApply',a));
tool('favorite_delete','Delete a saved favorite.',{session,id:z.string()},a=>runtime.call(a.session,'favoriteDelete',a));
server.registerTool('favorite_preview',{description:'Render a favorite or draft payload as a PNG image without changing the project. time is seconds within the cut; omit target for sample lyrics/image. Inspect multiple times before export.',inputSchema:{session,id:z.string().optional(),payload:z.record(z.unknown()).optional(),layer:layer.optional(),index:z.number().int().nonnegative().optional(),time:z.number().nonnegative().default(1),width:z.number().int().min(160).max(1920).default(640)}},async a=>{
  try{const {data,...info}=await runtime.call(a.session,'favoritePreview',a);return {content:[{type:'text',text:JSON.stringify(info)},{type:'image',mimeType:'image/png',data}]};}
  catch(e){return {isError:true,content:[{type:'text',text:e.message}]};}
});
tool(
  "quality_approve",
  "Record AGENT visual/audio review after inspecting previews and passing audit. Never approve without actually reviewing. Any edit invalidates this approval.",
  { session, revision: z.number().int(), note: z.string().min(20) },
  (a) => runtime.call(a.session, "approve", a),
);
tool(
  "export_start",
  "Save project/settings/favorites (.jizuraichifav) or export MP4, PNG ZIP, transparent PNG ZIP, AE plan JSON. Returns async job; poll status. Final renders require quality approval. Existing files never overwritten.",
  {
    session,
    kind: z.enum([
      "project",
      "settings",
      "favorites",
      "mp4",
      "png",
      "png-transparent",
      "ae",
    ]),
    filename: z.string(),
    every: z.number().int().min(1).default(1),
  },
  (a) => runtime.export(a.session, a),
);
tool(
  "job_status",
  "Get progress, error, and completed output path.",
  { job: z.string() },
  (a) => {
    const j = runtime.jobs.get(a.job);
    if (!j) throw Error("Unknown job");
    return j;
  },
);
tool("job_cancel", "Cancel an active export.", { job: z.string() }, (a) =>
  runtime.cancel(a.job),
);
server.registerResource(
  "workflow",
  "jizura://workflow",
  { description: "Theme-guided production workflow", mimeType: "text/plain" },
  async (uri) => ({ contents: [{ uri: uri.href, text: workflow }] }),
);
server.registerPrompt(
  "create-video",
  { description: "Theme-guided creation, evaluation and improvement workflow" },
  () => ({
    messages: [{ role: "user", content: { type: "text", text: workflow } }],
  }),
);
await runtime.start();
await server.connect(new StdioServerTransport());
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await runtime.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.stdin.on("end", shutdown);
