// The stamp editor: put text (font, colour, size, outline, angle, place) on a picture or on a plain colour, draw it on a
// canvas and send it in for approval (or change one of the player's own stamps). The rules (fonts, ranges) are in
// stamps-model.js (FONTS, cleanDesign); the cloud side is Stamps.make / Stamps.edit.
(function () {
  "use strict";
  const M = window.StampsModel;
  const SIZE = M.SIZE;
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };

  // The picture is as wide and as tall as the one it is made on (the longer side is `size`); with no picture it is square.
  // (A very long picture is kept within 1:3.)
  function dims(state, size = SIZE) {
    const w = state.baseImg?.naturalWidth || state.baseImg?.width,
      h = state.baseImg?.naturalHeight || state.baseImg?.height;
    if (!w || !h) return [size, size];
    const ratio = Math.min(3, Math.max(1 / 3, w / h));
    return ratio >= 1 ? [size, Math.max(8, Math.round(size / ratio))] : [Math.max(8, Math.round(size * ratio)), size];
  }
  // Draw the design on `canvas` at `size` pixels (the longer side). `opaque`: paint white first (for formats that cannot be
  // see-through). `guide`: the index of the text to outline (for the preview only).
  function draw(canvas, state, size = SIZE, opaque = false, guide = -1) {
    const [W, H] = dims(state, size);
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d"),
      k = size / SIZE;
    ctx.clearRect(0, 0, W, H);
    if (opaque) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
    }
    if (state.bg !== "none") {
      ctx.fillStyle = state.bg;
      ctx.fillRect(0, 0, W, H);
    }
    if (state.baseImg) ctx.drawImage(state.baseImg, 0, 0, W, H);
    state.layers.forEach((layer, i) => {
      if (!layer.text) return;
      const font = M.fontOf(layer.font);
      ctx.save();
      ctx.translate(layer.x * W, layer.y * H);
      ctx.rotate((layer.rot * Math.PI) / 180);
      ctx.font = font.weight + " " + layer.size * k + "px " + font.css;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      if (layer.stroke.width) {
        ctx.strokeStyle = layer.stroke.color;
        ctx.lineWidth = layer.stroke.width * 2 * k;
        ctx.strokeText(layer.text, 0, 0);
      }
      ctx.fillStyle = layer.color;
      ctx.fillText(layer.text, 0, 0);
      if (i === guide) {
        // A dashed frame around the text that is being edited (not part of the picture).
        const w = ctx.measureText(layer.text).width + 8 * k,
          h = layer.size * k * 1.2;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = "#ffffffcc";
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.setLineDash([]);
        ctx.strokeStyle = "#000000aa";
        ctx.lineDashOffset = 4;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(-w / 2, -h / 2, w, h);
      }
      ctx.restore();
    });
  }
  // The picture to send: WebP first, then PNG, then JPEG, smaller and smaller until it fits.
  function exportImage(state) {
    const canvas = document.createElement("canvas");
    for (const [size, format, quality, opaque] of [
      [SIZE, "image/webp", 0.9, false],
      [SIZE, "image/webp", 0.7, false],
      [SIZE, "image/png", undefined, false],
      [160, "image/webp", 0.7, false],
      [160, "image/jpeg", 0.75, true],
      [128, "image/jpeg", 0.65, true],
    ]) {
      draw(canvas, state, size, opaque);
      const data = canvas.toDataURL(format, quality);
      if (data.startsWith("data:" + format) && M.imageOk(data)) return data;
    }
    throw Error("画像が大きすぎます。文字や画像を減らしてください。");
  }
  const loadImage = (src) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  const blank = (n) => M.cleanDesign({ layers: [{ text: n || "スタンプ", font: "pop", color: "#ffffff", size: 44, stroke: { color: "#000000", width: 5 }, x: 0.5, y: 0.5 }] }).layers[0];

  // Open the editor. { stamp } to change one of the player's own, { done } is called after a save.
  async function open({ stamp, done } = {}) {
    const S = window.Stamps,
      { frame, say } = S.ui;
    const { body, status } = frame(stamp ? "スタンプを編集" : "スタンプを作る");
    const state = { bg: "none", base: "", baseImg: null, layers: [], sel: 0 };
    let changed = !stamp; // the picture / text were touched (a new stamp always has a picture to approve)
    const canvas = node("canvas", "stamps-canvas");
    canvas.width = canvas.height = SIZE;
    const stage = node("div", "stamps-stage");
    stage.append(canvas);
    canvas.setAttribute("aria-label", "スタンプのプレビュー（文字はドラッグで動かせます）");
    const repaint = () => draw(canvas, state, SIZE * 2, false, state.sel);
    const touched = () => {
      changed = true;
      repaint();
      costNote();
    };

    // Starting point: a stamp being changed opens as it was made (the picture it was on and its text), else with one text.
    if (stamp) {
      say(status, "読み込んでいます…");
      const src = await S.source(stamp);
      say(status, "");
      if (src) {
        const design = src.design;
        state.bg = design?.bg?.color || "none";
        const baseData = src.base || (design ? "" : src.image);
        if (baseData) {
          state.base = baseData;
          state.baseImg = await loadImage(baseData);
        }
        state.layers = design ? design.layers : [];
      }
    } else state.layers = [blank()];

    // ---- Controls ----
    const field = (text, el) => {
      const row = node("label", "stamps-field");
      row.append(node("span", "", text), el);
      return row;
    };
    const input = (attrs) => Object.assign(node("input"), attrs);
    const name = input({ type: "text", maxLength: M.MAX_NAME, placeholder: "名前（" + M.MAX_NAME + "文字まで）", value: stamp?.name || "" });
    name.setAttribute("aria-label", "名前");
    const price = input({ type: "number", min: 0, max: M.MAX_PRICE, step: 1, inputMode: "numeric", value: String(stamp ? stamp.price : 0) });
    price.setAttribute("aria-label", "値段");
    const cost = node("p", "stamps-hint stamps-cost");
    const costNote = () => {
      let text = "";
      try {
        if (!stamp) text = "作る費用として、販売価格と同じ " + M.priceOf(price.value) + "pt を支払います（今すぐ引かれます）。運営が承認するとそのまま費用になり、却下・取り下げなら全額戻ります。";
        else {
          const plan = M.planEdit(stamp, { name: name.value, price: price.value, picture: changed });
          text = plan.review
            ? plan.hold > 0
              ? "運営の確認が必要です。作る費用の差額 " + plan.hold + "pt（販売価格との差）を支払います。承認で費用になり、却下・取り下げで戻ります。確認中も今までの内容で販売できます。"
              : "運営の確認が必要です。費用はかかりません。確認中も今までの内容で販売できます。"
            : "すぐに反映されます（費用なし）。";
        }
      } catch {
        text = "";
      }
      cost.textContent = text;
    };
    name.oninput = price.oninput = costNote;

    const file = input({ type: "file", accept: "image/*" });
    file.setAttribute("aria-label", "土台の画像");
    file.onchange = async () => {
      const f = file.files[0];
      if (!f) return;
      say(status, "画像を準備しています…");
      try {
        const data = await S.prepare(f);
        state.base = data;
        state.baseImg = await loadImage(data);
        say(status, "");
        touched();
      } catch (error) {
        say(status, error?.message || "画像を読み込めませんでした。", true);
      }
    };
    const clearBase = node("button", "", "画像を外す");
    clearBase.type = "button";
    clearBase.onclick = () => {
      state.base = "";
      state.baseImg = null;
      file.value = "";
      touched();
    };
    const bgColor = input({ type: "color", value: state.bg === "none" ? "#ffffff" : state.bg });
    bgColor.setAttribute("aria-label", "背景の色");
    const bgOn = input({ type: "checkbox", checked: state.bg !== "none" });
    bgOn.setAttribute("aria-label", "背景に色をつける");
    const bgRow = node("label", "stamps-field");
    bgRow.append(node("span", "", "背景の色"), bgOn, bgColor);
    bgOn.onchange = bgColor.oninput = () => {
      state.bg = bgOn.checked ? bgColor.value : "none";
      touched();
    };

    // Text layers
    const tabs = node("div", "stamps-layers");
    const panel = node("div", "stamps-layer-panel");
    const add = node("button", "", "＋ 文字を足す");
    add.type = "button";
    const current = () => state.layers[state.sel];
    function paintPanel() {
      tabs.replaceChildren();
      state.layers.forEach((layer, i) => {
        const b = node("button", "stamps-layer-tab" + (i === state.sel ? " is-on" : ""), layer.text || "（空）");
        b.type = "button";
        b.onclick = () => {
          state.sel = i;
          paintPanel();
        };
        tabs.append(b);
      });
      add.hidden = state.layers.length >= M.MAX_LAYERS;
      panel.replaceChildren();
      const layer = current();
      if (!layer) return panel.append(node("p", "stamps-hint", "文字がありません。「文字を足す」で入れられます。"));
      const text = input({ type: "text", maxLength: M.MAX_NAME, value: layer.text });
      text.setAttribute("aria-label", "文字");
      text.oninput = () => {
        layer.text = text.value;
        tabs.children[state.sel].textContent = layer.text || "（空）";
        touched();
      };
      const font = node("select");
      font.setAttribute("aria-label", "フォント");
      for (const f of M.FONTS) {
        const o = node("option", "", f.name);
        o.value = f.id;
        o.style.fontFamily = f.css;
        font.append(o);
      }
      font.value = layer.font;
      font.onchange = () => {
        layer.font = font.value;
        touched();
      };
      const range = (label, min, max, key, sub) => {
        const el = input({ type: "range", min, max, step: 1, value: sub ? layer[sub][key] : layer[key] });
        el.setAttribute("aria-label", label);
        el.oninput = () => {
          (sub ? layer[sub] : layer)[key] = Number(el.value);
          touched();
        };
        return field(label, el);
      };
      const color = (label, get, set) => {
        const el = input({ type: "color", value: get() });
        el.setAttribute("aria-label", label);
        el.oninput = () => {
          set(el.value);
          touched();
        };
        return field(label, el);
      };
      const remove = node("button", "stamps-danger", "この文字を消す");
      remove.type = "button";
      remove.onclick = () => {
        state.layers.splice(state.sel, 1);
        state.sel = Math.max(0, state.sel - 1);
        paintPanel();
        touched();
      };
      panel.append(
        field("文字", text),
        field("フォント", font),
        color("文字の色", () => layer.color, (v) => (layer.color = v)),
        range("大きさ", 10, 96, "size"),
      );
      const more = node("details", "stamps-more-edit");
      more.append(
        node("summary", "", "ふち・かたむき・位置をくわしく"),
        color("ふちの色", () => layer.stroke.color, (v) => (layer.stroke.color = v)),
        range("ふちの太さ", 0, 12, "width", "stroke"),
        range("かたむき", -180, 180, "rot"),
        range("横の位置（%）", 0, 100, "x100"),
        range("縦の位置（%）", 0, 100, "y100"),
      );
      panel.append(more, remove);
      // The position sliders show 0-100 (the design keeps 0-1).
      for (const [label, key] of [["横の位置（%）", "x"], ["縦の位置（%）", "y"]]) {
        const el = more.querySelector('[aria-label="' + label + '"]');
        el.value = Math.round(layer[key] * 100);
        el.oninput = () => {
          layer[key] = Number(el.value) / 100;
          touched();
        };
      }
    }
    add.onclick = () => {
      if (state.layers.length >= M.MAX_LAYERS) return;
      state.layers.push(blank("もじ"));
      state.layers[state.layers.length - 1].y = 0.3 + 0.2 * state.layers.length;
      state.sel = state.layers.length - 1;
      paintPanel();
      touched();
    };

    // Drag a text on the picture to place it.
    let drag = null;
    const point = (event) => {
      const r = canvas.getBoundingClientRect();
      return { x: Math.min(1, Math.max(0, (event.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (event.clientY - r.top) / r.height)) };
    };
    canvas.style.touchAction = "none";
    canvas.onpointerdown = (event) => {
      if (!state.layers.length) return;
      const p = point(event);
      // The nearest text (to its middle) is the one picked.
      let best = -1,
        far = 0.35;
      state.layers.forEach((l, i) => {
        const d = Math.hypot(l.x - p.x, l.y - p.y);
        if (d < far) (far = d), (best = i);
      });
      if (best < 0) return;
      state.sel = best;
      drag = { dx: state.layers[best].x - p.x, dy: state.layers[best].y - p.y };
      canvas.setPointerCapture?.(event.pointerId);
      paintPanel();
    };
    canvas.onpointermove = (event) => {
      if (!drag) return;
      const p = point(event),
        layer = current();
      layer.x = Math.round(Math.min(1, Math.max(0, p.x + drag.dx)) * 1000) / 1000;
      layer.y = Math.round(Math.min(1, Math.max(0, p.y + drag.dy)) * 1000) / 1000;
      changed = true;
      repaint();
    };
    canvas.onpointerup = canvas.onpointercancel = () => {
      if (!drag) return;
      drag = null;
      paintPanel();
      costNote();
    };

    const rights = input({ type: "checkbox" });
    const rightsRow = node("label", "stamps-rights");
    rightsRow.append(rights, node("span", "", "自分で作った画像（または使っていい画像）です"));
    const go = node("button", "stamps-primary", stamp ? "保存する" : "審査に出す");
    go.type = "button";
    go.onclick = async () => {
      go.disabled = true;
      let message = "";
      say(status, "送っています…");
      try {
        const design = M.cleanDesign({ bg: { color: state.bg }, layers: state.layers });
        const picture = changed ? { image: exportImage({ ...state, layers: design.layers }), base: state.base, design } : {};
        if (stamp) {
          const result = await S.edit(stamp.id, { name: name.value, price: price.value, ...picture });
          message = result === "review" ? "運営の確認に出しました。結果は「ストア」に出ます。" : "保存しました。";
        } else {
          await S.make({ ...picture, name: name.value, price: price.value, rights: rights.checked });
          message = "審査に出しました。承認されると売り出せます。結果は、このストアのカードに出ます。";
        }
        if (done) done(message);
        else say(status, message);
      } catch (error) {
        say(status, error?.message || "送れませんでした。", true);
        go.disabled = false;
      }
    };

    const baseRow = field("土台の画像（なくてもOK。形はそのまま使います）", file);
    baseRow.append(clearBase);
    body.append(
      stage,
      node("p", "stamps-hint stamps-drag", "文字は絵の上でドラッグして動かせます。"),
      node("h3", "stamps-sub", "文字"),
      tabs,
      add,
      panel,
      node("h3", "stamps-sub", "絵と背景"),
      baseRow,
      bgRow,
      node("h3", "stamps-sub", "名前と値段"),
      field("名前", name),
      field("値段（pt）", price),
      cost,
      node("p", "stamps-hint", "売れると、値段のポイントがあなたに届きます（トークの「もらった」に出ます）。0ptなら無料で配れます。運営が内容を見て、承認・却下したり、あとから止めたり削除したりします。"),
    );
    if (!stamp) body.append(rightsRow);
    body.append(go);
    paintPanel();
    repaint();
    costNote();
  }
  window.StampEditor = Object.freeze({ open, draw, exportImage, dims });
})();
