/* Loaded only by the local MCP host; never by the public page. */
(() => {
  "use strict";
  const S = J.ui,
    A = J.uiApi,
    clone = (x) => JSON.parse(JSON.stringify(x));
  let revision = 0,
    review = null,
    history = [],
    inspected = new Set();
  const cuts = (layer) =>
    layer === "lyrics" ? S.plan.cuts : S.plan[layer]?.cuts || [];
  function candidates() {
    const result = { styles: [], lyrics: {}, media: [] };
    for (const id of J.themeIds(S.project)) {
      const c = J.themeCandidates(S.project, id);
      result.styles.push(...c.styles);
      result.media.push(...c.media);
      for (const [g, v] of Object.entries(c.lyrics))
        result.lyrics[g] = [...new Set([...(result.lyrics[g] || []), ...v])];
    }
    result.styles = [...new Set(result.styles)];
    result.media = [...new Set(result.media)];
    return result;
  }
  function audit() {
    const errors = [],
      warnings = [],
      c = candidates();
    if (!J.themeIds(S.project).length)
      errors.push("Select at least one theme.");
    const check = (group, key, path, media = false) => {
      if (!key || ["none", "cut", "still", "auto"].includes(key)) return;
      const pool = media ? c.media : c.lyrics[group];
      if (pool && !pool.includes(key))
        errors.push(`${path}: ${key} is outside selected themes`);
    };
    if (c.styles.length && !c.styles.includes(S.project.style))
      errors.push("Project style is outside selected themes");
    for (const layer of ["lyrics", "foreground", "media"])
      for (const [i, cut] of cuts(layer).entries()) {
        if (!(cut.end > cut.start))
          errors.push(`${layer}/${i}: invalid duration`);
        if (layer === "lyrics" && !cut.blank) {
          for (const g of [
            "layout",
            "enter",
            "hold",
            "exit",
            "treat",
            "bg",
            "cam",
            "trans",
          ])
            check(g, cut[g], `${layer}/${i}/${g}`);
        } else if (layer !== "lyrics") {
          if (cut.itemId && !J.mediaSourceAvailable(cut))
            errors.push(`${layer}/${i}: missing media ${cut.itemId}`);
          for (const g of ["technique", "entrance", "departure"])
            if (cut[g] !== "legacy")
              check(g, cut[g], `${layer}/${i}/${g}`, true);
          for (const g of ["enter", "hold", "exit", "treat", "trans"]) {
            const allowed = new Set([
              "none",
              "cut",
              "still",
              ...c.media.map((k) => J.MEDIA_TECH[k]?.[g]),
              ...c.media
                .filter((k) => J.MEDIA_TECH[k]?.stage === g)
                .map((k) => J.MEDIA_TECH[k].motion),
            ]);
            if (cut[g] && !allowed.has(cut[g]))
              errors.push(
                `${layer}/${i}/${g}: ${cut[g]} is outside theme recipes`,
              );
          }
        }
        for (const d of cut.decor || [])
          check(
            "decor",
            typeof d === "string" ? d : d.id,
            `${layer}/${i}/decor`,
          );
        const motion = cut.mask?.motion;
        if (motion)
          for (const g of ["technique", "entrance", "departure"])
            check(g, motion[g], `${layer}/${i}/mask/${g}`, true);
      }
    for (const event of S.plan.events || [])
      check("fx", event.type, `events/${event.t}`);
    if (!S.audio) warnings.push("No audio loaded.");
    for (const [layer, on] of Object.entries(S.project.layerVisibility || {}))
      if (!on) warnings.push(`${layer} is hidden and excluded from exports.`);
    return {
      revision,
      errors: [...new Set(errors)],
      warnings,
      review,
      ready: !errors.length && review?.revision === revision,
    };
  }
  function changed() {
    revision++;
    review = null;
    inspected.clear();
    A.syncUI();
    A.replan();
  }
  function mutate(fn) {
    const before = clone(S.project);
    try {
      fn();
      validateProject(S.project);
      changed();
      history.push(before);
      if (history.length > 30) history.shift();
      return state();
    } catch (e) {
      S.project = before;
      A.syncUI();
      A.replan();
      throw e;
    }
  }
  function validateProject(p) {
    if (typeof p.lyrics !== "string" || p.lyrics.length > 200000)
      throw Error("lyrics must be a string (max 200000 characters)");
    if (!Number.isFinite(p.fps) || p.fps < 1 || p.fps > 120)
      throw Error("fps must be 1..120");
    if (
      p.durationOverride != null &&
      (!Number.isFinite(p.durationOverride) ||
        p.durationOverride <= 0 ||
        p.durationOverride > 3600)
    )
      throw Error("durationOverride must be 0..3600 seconds");
    for (const layer of ["media", "foreground"])
      if (!Array.isArray(p[layer]?.items) || p[layer].cutCount > 1000)
        throw Error("Invalid media layer or too many cuts");
    const [w, h] = J.outputSize(p);
    if (w * h > 16777216) throw Error("Output exceeds 16 megapixels");
  }
  function state({ offset = 0, limit = 50, includeProject = true } = {}) {
    return {
      revision,
      project: includeProject ? clone(S.project) : undefined,
      cutCounts: Object.fromEntries(
        ["lyrics", "foreground", "media"].map((l) => [l, cuts(l).length]),
      ),
      offset,
      duration: S.plan.duration,
      fps: S.plan.fps,
      cuts: Object.fromEntries(
        ["lyrics", "foreground", "media"].map((l) => [
          l,
          clone(cuts(l).slice(offset, offset + limit)),
        ]),
      ),
      audio: S.audio
        ? {
            duration: S.audio.duration,
            bpm: S.audio.bpm,
            beats: Array.from(S.audio.beats || []),
            peaks: Array.from(S.audio.peaks || []),
            energyRate: S.audio.energyRate,
          }
        : null,
    };
  }
  function safeJSON(value, depth = 0) {
    if (depth > 40) throw Error("Data nesting is too deep");
    if (value && typeof value === "object")
      for (const [k, v] of Object.entries(value)) {
        if (["__proto__", "prototype", "constructor"].includes(k))
          throw Error("Unsafe property");
        safeJSON(v, depth + 1);
      }
  }
  function patch(target, path, value) {
    safeJSON(value);
    if (
      !Array.isArray(path) ||
      !path.length ||
      path.some((k) =>
        ["__proto__", "constructor", "prototype"].includes(String(k)),
      )
    )
      throw Error("Invalid path");
    let at = target;
    for (const k of path.slice(0, -1)) {
      if (!at[k] || typeof at[k] !== "object") at[k] = {};
      at = at[k];
    }
    at[path.at(-1)] = value;
  }
  function file(input) {
    return fetch(input.url)
      .then((r) => {
        if (!r.ok) throw Error("Cannot read input");
        return r.blob();
      })
      .then((b) => new File([b], input.name, { type: input.type || b.type }));
  }
  window.JizuraMCP = {
    state,
    candidates,
    audit,
    insert({ layer, frame, text, itemId = null, blank = false }) {
      return mutate(() => {
        const start = frame / S.project.fps;
        if (start >= S.plan.duration - 0.04)
          throw Error("Insertion must be before end of project");
        A.seek(start);
        const next = cuts(layer).find((c) => c.start > start + 0.000001),
          end = next?.start ?? S.plan.duration;
        if (layer === "lyrics") {
          // 無表示カット is retired: a "blank" ends the lyric showing at the frame there (カットの終了時間).
          if (blank) {
            const showing = S.plan.cuts
              .filter((c) => c.line >= 0 && Number.isInteger(c.part) && c.start < start - 0.04 && start < c.end)
              .sort((a, b) => b.start - a.start)[0];
            if (!showing) throw Error("No lyric showing at the frame");
            const key = `${showing.line}:${showing.part}`;
            S.project.lyricCutOptions[key] = { ...(S.project.lyricCutOptions[key] || {}), untilNext: false, endTime: +start.toFixed(3) };
          } else {
            if (!text || !J.parseLyrics(text).lines.length)
              throw Error("No valid lyric line");
            A.insertLyricAtPlayhead(text, end);
          }
          return;
        }
        const m = S.project[layer];
        if (
          itemId &&
          !m.items.some((x) => x.id === itemId) &&
          !J.mediaCopyItems(layer).some((x) => x.id === itemId)
        )
          throw Error("Unknown asset");
        const rows = cuts(layer)
          .filter((c) => Math.abs(c.start - start) > 1e-6)
          .map((c) => ({
            start: c.start,
            ov: { ...m.cutOverrides[c.index], itemId: c.itemId },
          }));
        rows.push({ start, ov: { itemId, technique: null } });
        rows.sort((a, b) => a.start - b.start);
        m.manualCuts = true;
        m.randomOrder = false;
        m.cutCount = rows.length;
        m.cutOverrides = {};
        m.timing.lineTimes = {};
        rows.forEach((r, i) => {
          m.cutOverrides[i] = r.ov;
          m.timing.lineTimes[i] = r.start;
        });
      });
    },
    remove({ layer, index }) {
      const c = cuts(layer)[index];
      if (!c) throw Error("Cut not found");
      return mutate(() => {
        if (layer === "lyrics") {
          A.removeLyricCut(c.line, c.part);
        } else A.removeMediaCut(c.index, layer);
      });
    },
    effect({ layer, index, group, id, seed = 1 }) {
      const c = cuts(layer)[index];
      if (!c) throw Error("Cut not found");
      if (c.blank) throw Error("Blank cuts have no effects");
      const groups =
        layer === "lyrics"
          ? [
              "layout",
              "enter",
              "hold",
              "exit",
              "treat",
              "bg",
              "cam",
              "trans",
              "decor",
            ]
          : ["technique", "entrance", "departure", "decor"];
      if (!groups.includes(group))
        throw Error(
          "Unsupported effect group; use cut_update for detailed parameters",
        );
      const pool = candidates();
      const media =
        layer !== "lyrics" &&
        ["technique", "entrance", "departure"].includes(group);
      const choices = media ? pool.media : pool.lyrics[group];
      if (!choices) throw Error("Unknown effect group");
      if (id !== undefined && id !== "none" && !choices.includes(id))
        throw Error("Effect is outside selected themes");
      if (id === "none" && ["layout", "enter", "hold", "exit"].includes(group))
        throw Error("This group requires a registered effect ID");
      if (
        media &&
        id &&
        id !== "none" &&
        (group === "technique"
          ? !!J.MEDIA_TECH[id]?.stage
          : J.MEDIA_TECH[id]?.stage !==
            (group === "entrance" ? "enter" : "exit"))
      )
        throw Error("Effect belongs to a different phase");
      const options = choices.filter(
        (k) =>
          k !== c[group] &&
          (!media ||
            (group === "technique"
              ? !J.MEDIA_TECH[k].stage
              : J.MEDIA_TECH[k].stage ===
                (group === "entrance" ? "enter" : "exit"))),
      );
      const chosen =
        id ?? (options.length ? J.rng(seed).pick(options) : "none");
      return mutate(() => {
        const map =
            layer === "lyrics"
              ? S.project.lyricCutOptions
              : S.project[layer].cutOverrides,
          key = layer === "lyrics" ? `${c.line}:${c.part}` : c.index,
          ov = (map[key] ||= {});
        ov.lock = false;
        if (media) ov[group] = chosen;
        else {
          ov.details ||= {};
          ov.details[group] =
            group === "decor"
              ? chosen === "none"
                ? []
                : [
                    {
                      id: chosen,
                      seed,
                      n: 1,
                      right: false,
                      low: false,
                      accent: false,
                      corner: false,
                      big: false,
                      mode: "count",
                      from: 0,
                      to: 100,
                      v: 0,
                      r: J.rng(seed)(),
                    },
                  ]
              : chosen;
        }
      });
    },
    randomize({ layer, index, seed = 1, disableCurrent = false }) {
      const c = cuts(layer)[index];
      if (!c) throw Error("Cut not found");
      const pools = candidates(),
        rng = J.rng(seed);
      if (!J.themeIds(S.project).length) throw Error("Set themes first");
      return mutate(() => {
        const map =
            layer === "lyrics"
              ? S.project.lyricCutOptions
              : S.project[layer].cutOverrides,
          key = layer === "lyrics" ? `${c.line}:${c.part}` : c.index,
          ov = (map[key] ||= {});
        const preserved = {};
        for (const k of ["text", "area", "mask"])
          if (ov.details?.[k] !== undefined) preserved[k] = ov.details[k];
        ov.details = preserved;
        ov.lock = false;
        ov.seed = seed;
        if (layer === "lyrics") {
          for (const group of [
            "layout",
            "enter",
            "hold",
            "exit",
            "treat",
            "bg",
            "cam",
            "trans",
          ]) {
            if (disableCurrent && c[group])
              S.project.enabled[group][c[group]] = false;
            const pool = (pools.lyrics[group] || []).filter(
              (k) => k !== c[group] && S.project.enabled[group]?.[k] !== false,
            );
            if (pool.length) ov.details[group] = rng.pick(pool);
          }
          ov.details.seed = seed;
        } else {
          for (const group of ["technique", "entrance", "departure"]) {
            const settings = S.project[layer].effects;
            if (disableCurrent && c[group]) settings.enabled[c[group]] = false;
            const pool = pools.media.filter(
              (k) =>
                k !== c[group] &&
                settings.enabled[k] !== false &&
                (group === "technique"
                  ? !J.MEDIA_TECH[k].stage
                  : J.MEDIA_TECH[k].stage ===
                    (group === "entrance" ? "enter" : "exit")),
            );
            ov[group] = pool.length ? rng.pick(pool) : "none";
          }
          for (const k of Object.keys(ov))
            if (k.startsWith("locked")) delete ov[k];
        }
      });
    },
    copy({ sourceLayer, sourceIndex, layer, index }) {
      const source = cuts(sourceLayer)[sourceIndex],
        target = cuts(layer)[index];
      if (!source || !target) throw Error("Cut not found");
      return mutate(() =>
        J.pasteCutEffects(
          S.project,
          S.plan,
          layer,
          target,
          J.cutEffectsPayload(source, sourceLayer, S.plan),
        ),
      );
    },
    link({ a, b, remove = false }) {
      return mutate(() => {
        if (remove)
          S.project.timelineLinks = S.project.timelineLinks.filter(
            (l) => !((l.a === a && l.b === b) || (l.a === b && l.b === a)),
          );
        else {
          A.connectTimelineBoundaries(a, b);
          if (
            !A.boundaryGroupLimits(a)?.members.some(
              (member) => member.ref === b,
            )
          )
            throw Error("These boundaries cannot be linked");
        }
      });
    },
    audioAnalysis({ start = 0, duration = 30 }) {
      if (!S.audio) throw Error("No audio");
      const a = S.audio,
        rate = a.energyRate;
      return {
        start,
        duration: Math.min(duration, a.duration - start),
        energyRate: rate,
        energy: Array.from(
          a.energy.slice(
            Math.floor(start * rate),
            Math.ceil((start + duration) * rate),
          ),
        ),
        beats: a.beats.filter((t) => t >= start && t < start + duration),
        bpm: a.bpm,
      };
    },
    async audioClip({ start = 0, duration = 10 }) {
      if (!S.audio) throw Error("No audio");
      const b = S.audio.buffer,
        offset = Math.round(start * b.sampleRate),
        length = Math.min(
          Math.round(duration * b.sampleRate),
          b.length - offset,
        );
      if (length <= 0) throw Error("Outside audio");
      const clip = new AudioBuffer({
        length,
        sampleRate: b.sampleRate,
        numberOfChannels: b.numberOfChannels,
      });
      for (let c = 0; c < b.numberOfChannels; c++)
        clip.copyToChannel(
          b.getChannelData(c).subarray(offset, offset + length),
          c,
        );
      const bytes = new Uint8Array(
        await J.audioWaveFile(clip, "clip.wav").arrayBuffer(),
      );
      let out = "";
      for (let i = 0; i < bytes.length; i += 32768)
        out += String.fromCharCode(...bytes.subarray(i, i + 32768));
      return { start, duration: length / b.sampleRate, data: btoa(out) };
    },
    catalog() {
      return {
        fonts: Object.fromEntries(
          Object.entries(J.FONTS).map(([key, f]) => [
            key,
            { label: f.label, family: f.family },
          ]),
        ),
        colorGenres: J.COLOR_GENRES,
        settings: J.projectSettings(S.project),
        themes: J.THEMES,
        defaults: J.defaultProject(),
        detailKeys: J.cutDetailKeys,
        masks: J.MASK_SHAPES,
        copySources: J.mediaCopyItems("media"),
        registries: Object.fromEntries(
          J.GROUP_KEYS.map((g) => [
            g,
            Object.fromEntries(
              J.order(g).map((k) => [
                k,
                { name: J.registry(g)[k]?.name, tags: J.registry(g)[k]?.tags },
              ]),
            ),
          ]),
        ),
        media: Object.fromEntries(
          Object.entries(J.MEDIA_TECH).map(([k, v]) => [
            k,
            { name: v.name, stage: v.stage, group: v.group },
          ]),
        ),
        candidates: candidates(),
      };
    },
    new() {
      A.replaceProject(
        { ...J.defaultProject(), lyrics: "" },
        null,
        null,
        new Map(),
      );
      history = [];
      changed();
      return state();
    },
    edit({ changes }) {
      return mutate(() => {
        for (const { path, value } of changes) patch(S.project, path, value);
      });
    },
    theme({ themes }) {
      if (!themes.length || themes.some((t) => !Object.hasOwn(J.THEMES, t)))
        throw Error("Unknown or empty themes");
      return mutate(() => {
        S.project.themes = themes;
        Object.assign(S.project, J.omakase(S.project, J.rng(S.project.seed)));
      });
    },
    generate({ seed }) {
      if (!J.themeIds(S.project).length) throw Error("Set themes first");
      return mutate(() => {
        S.project.seed = seed;
        J.clearPastedLyricEffects(S.project);
        Object.assign(S.project, J.omakase(S.project, J.rng(seed)));
      });
    },
    cut({ layer, index, patch: values }) {
      safeJSON(values);
      const cut = cuts(layer)[index];
      if (!cut) throw Error("Cut not found");
      if (cut.blank)
        throw Error(
          "Blank cuts support timing/deletion; insert an effects-only lyric to animate without text",
        );
      return mutate(() => {
        const map =
          layer === "lyrics"
            ? S.project.lyricCutOptions
            : S.project[layer].cutOverrides;
        const key = layer === "lyrics" ? `${cut.line}:${cut.part}` : cut.index;
        map[key] = { ...(map[key] || {}), ...values };
      });
    },
    timing({ layer, starts }) {
      return mutate(() => {
        const original = cuts(layer).slice();
        for (const entry of starts) {
          const c = original[entry.index];
          if (!c) throw Error("Cut not found");
          const t = entry.frame / S.project.fps,
            ref =
              layer === "lyrics"
                ? c.blank
                  ? `l:blank:${c.blankId}`
                  : `l:${c.line}:${c.part}`
                : `${layer === "foreground" ? "f" : "m"}:${c.index}`,
            limits = A.boundaryGroupLimits(ref);
          if (!limits || t < limits.min - 0.001 || t > limits.max + 0.001)
            throw Error(
              `Start ${t} outside boundaries ${JSON.stringify(limits)} for ${ref}`,
            );
          A.commitTimelineBoundary({ ref, preview: t });
        }
      });
    },
    split({ layer, frame, randomLeft = false, randomRight = false }) {
      return mutate(() => {
        A.seek(frame / S.project.fps);
        if (!cuts(layer).some((c) => c.start < S.t && S.t < c.end))
          throw Error("No cut at split frame");
        A.splitMediaCut(layer, randomLeft, randomRight);
      });
    },
    undo() {
      if (!history.length) throw Error("No undo history");
      S.project = history.pop();
      changed();
      return state();
    },
    async import(input) {
      const f = await file(input);
      if (input.kind === "project") await A.openProjectFile(f);
      else if (input.kind === "audio") {
        if (
          !(await A.loadAudioFile(f, {
            matchDuration: input.matchDuration,
            background: input.background,
          }))
        )
          throw Error("Audio import failed");
      } else if (input.kind === "settings") {
        const p = await J.unpackProject(f);
        for (const entry of p.files)
          if (entry.kind === "font") await J.saveFontFile(entry.id, entry.file);
        await J.restoreFontFiles(p.project.userFonts);
        S.project = J.applyProjectSettings(S.project, p.project) || S.project;
      } else if (input.kind === "font") {
        const key = await J.loadFontFile(f),
          font = J.FONTS[key];
        (S.project.userFonts ||= []).push({
          key,
          label: font.label,
          family: font.family,
          weight: font.weight,
          file: true,
        });
      } else {
        const item = {
          id: crypto.randomUUID(),
          name: f.name,
          type: J.isVideoFile(f) ? "video" : "image",
        };
        await J.attachMedia(item, f);
        await J.storeMedia(item.id, f);
        const m = S.project[input.layer],
          existing = cuts(input.layer);
        if (!m.manualCuts) {
          m.manualCuts = true;
          m.cutCount = existing.length;
          m.cutOverrides = Object.fromEntries(
            existing.map((c) => [
              c.index,
              { ...m.cutOverrides[c.index], itemId: c.itemId },
            ]),
          );
          m.timing.lineTimes = Object.fromEntries(
            existing.map((c) => [c.index, c.start]),
          );
        }
        m.items.push(item);
      }
      history = [];
      changed();
      return state();
    },
    async preview({ frame, width = 960 }) {
      if (frame / S.plan.fps >= S.plan.duration)
        throw Error("Frame is outside the project");
      A.pause();
      S.exporting = true;
      try {
        await A.ensureFonts();
        await document.fonts.ready;
        const t = frame / S.plan.fps;
        await J.prepareMediaFrame(S.plan, t);
        const cv = document.createElement("canvas");
        cv.width = width;
        cv.height = Math.round((width * S.plan.H) / S.plan.W);
        new J.Renderer().frame(cv.getContext("2d"), S.plan, t, {
          scale: width / S.plan.W,
        });
        inspected.add(frame);
        return {
          revision,
          frame,
          data: cv.toDataURL("image/png").split(",")[1],
        };
      } finally {
        S.exporting = false;
      }
    },
    approve({ revision: expected, note }) {
      if (expected !== revision) throw Error("Stale revision");
      if (!inspected.size) throw Error("Inspect preview_frame before approval");
      const a = audit();
      if (a.errors.length) throw Error(a.errors.join("\n"));
      review = { revision, note };
      return audit();
    },
    async output({ kind, every = 1 }) {
      if (!["project", "settings"].includes(kind) && !audit().ready)
        throw Error(
          "Run audit, inspect preview images, and approve this revision before export",
        );
      A.pause();
      S.exporting = true;
      this.abort = new AbortController();
      try {
        await A.ensureFonts();
        await document.fonts.ready;
        let blob,
          metadata = {};
        const opts = {
          plan: S.plan,
          project: S.project,
          audio: S.audio,
          signal: this.abort.signal,
          onProgress: (value, message) =>
            window.mcpProgress?.({ value, message }),
        };
        if (kind === "project")
          blob = await J.packProject(S.project, S.audioFile);
        else if (kind === "settings")
          blob = await J.packProject(J.settingsProject(S.project), null);
        else if (kind === "ae")
          blob = new Blob([JSON.stringify(J.planForAE(S.plan, S.project))], {
            type: "application/json",
          });
        else if (kind === "mp4") {
          const result = await J.exportMP4(opts);
          blob = result.blob;
          metadata = {
            codec: result.codec,
            audio: result.audio,
            width: result.width,
            height: result.height,
          };
        } else
          blob = await J.exportPNGZip({
            ...opts,
            transparent: kind === "png-transparent",
            every,
          });
        const url = URL.createObjectURL(blob),
          a = document.createElement("a");
        a.href = url;
        a.download = "artifact";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        return { bytes: blob.size, ...metadata };
      } finally {
        S.exporting = false;
        this.abort = null;
      }
    },
    cancel() {
      this.abort?.abort();
    },
  };
})();
