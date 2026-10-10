// Adds the roaming / interaction expressions and animations the site uses to a Studio export.
// Run after re-exporting Poring from Bible Strong Avatar Lab:  node scripts/extend-mascot.js app/src/mascot/poring.avatar.json
const fs = require("fs");
const file = process.argv[2];
const j = JSON.parse(fs.readFileSync(file, "utf8"));
const eye = (width, height, angle = 0, y = 0) => ({ width, height, x: 0, y, angle });
const ex = (head, left, right, spacing, extra = {}) => ({ head: { x: head[0], y: head[1], z: head[2] }, eyes: { left, right, spacing }, perspective: 1, motion: { eyes: "none", body: "none" }, ...extra });

const expressions = {
  "look-left": ex([2, -32, 4], eye(22, 46), eye(22, 46), 52),
  "look-right": ex([2, 32, -4], eye(22, 46), eye(22, 46), 52),
  "look-up": ex([22, 0, 0], eye(22, 52, 0, -12), eye(22, 52, 0, -12), 50),
  "look-down": ex([-22, 0, 0], eye(24, 40), eye(24, 40), 54),
  "wink-left": ex([4, 10, -8], eye(50, 12, -6), eye(24, 56), 58),
  "happy-squint": ex([-4, -6, -10], eye(46, 16, -14), eye(46, 16, 14), 60, { colors: { body: "#ff8f6b" } }),
  "love": ex([-6, -10, -12], eye(34, 80), eye(34, 80), 60, { colors: { body: "#ff6f91" } }),
  "dizzy-a": ex([0, -12, -14], eye(30, 30, 45), eye(18, 40, -30), 58, { motion: { eyes: "shake", body: "shake" } }),
  "dizzy-b": ex([0, 12, 14], eye(18, 40, 30), eye(30, 30, -45), 58, { motion: { eyes: "shake", body: "shake" } }),
  "greedy": ex([-4, 0, 0], eye(34, 70), eye(34, 70), 60, { colors: { eyes: "#0f9d58" } }),
  "determined": ex([-6, 0, 0], eye(40, 26, -14), eye(40, 26, 14), 56),
  "oof": ex([-10, 0, 0], eye(44, 10), eye(44, 10), 62, { motion: { eyes: "none", body: "shake" } }),
  "peek": ex([0, 28, -12], eye(22, 30, 0, -10), eye(22, 30, 0, -10), 48),
  "star-struck": ex([6, 0, 0], eye(42, 42), eye(42, 42), 62, { colors: { eyes: "#c98a00" } }),
  "grumpy": ex([-4, -8, 6], eye(44, 18, 18), eye(44, 18, -18), 56, { colors: { body: "#e8611a" } }),
};

const blink = { enabled: true, initialDelayMs: 1500, minIntervalMs: 2500, maxIntervalMs: 5000, durationMs: 220 };
const noBlink = { enabled: false, initialDelayMs: 1500, minIntervalMs: 2500, maxIntervalMs: 5000, durationMs: 220 };
const step = (expression, holdMs, transitionMs = 300, transition = "smooth") => ({ expression, holdMs, transitionMs, transition });
const anim = (label, description, playbackMode, steps, b = blink) => ({ playbackMode, steps, blink: b, metadata: { label, description, group: "Roaming" } });

const animations = {
  "walk-left": anim("walk-left", "Facing left while hopping.", "loop", [step("look-left", 900, 200, "snappy"), step("curious-left", 600, 250)]),
  "walk-right": anim("walk-right", "Facing right while hopping.", "loop", [step("look-right", 900, 200, "snappy"), step("playful-right", 600, 250)]),
  "watch-left": anim("watch-left", "Eyes on something to the left.", "loop", [step("look-left", 2000, 250)]),
  "watch-right": anim("watch-right", "Eyes on something to the right.", "loop", [step("look-right", 2000, 250)]),
  "watch-up": anim("watch-up", "Looking up.", "loop", [step("look-up", 2000, 250)]),
  "watch-down": anim("watch-down", "Looking down at what it sits on.", "loop", [step("look-down", 1800, 300), step("gentle-downward-gaze", 1400, 400)]),
  "wink": anim("wink", "A quick wink.", "once", [step("neutral", 200, 150), step("wink-left", 500, 120, "snappy"), step("neutral", 300, 200)], noBlink),
  "blush": anim("blush", "Shy and pink after being petted.", "loop", [step("happy-squint", 1600, 300), step("shy-downward", 1200, 400)]),
  "love": anim("love", "Big pink heart-eyes mood.", "loop", [step("love", 1600, 300, "spring"), step("happy-squint", 1200, 300), step("joyful-wide", 900, 300)]),
  "dizzy": anim("dizzy", "Spun around or thrown.", "loop", [step("dizzy-a", 260, 120, "snappy"), step("dizzy-b", 260, 120, "snappy")], noBlink),
  "dance": anim("dance", "Bobbing to a beat.", "loop", [step("playful-right", 320, 120, "snappy"), step("joyful-wide", 320, 120, "snappy"), step("asymmetric-up-left", 320, 120, "snappy"), step("joyful-down-right", 320, 120, "snappy"), step("wink-left", 320, 120, "snappy")]),
  "nod": anim("nod", "Yes, yes.", "pingPong", [step("look-down", 220, 160, "snappy"), step("look-up", 220, 160, "snappy")], noBlink),
  "shake-no": anim("shake-no", "Nope.", "loop", [step("look-left", 200, 140, "snappy"), step("look-right", 200, 140, "snappy")], noBlink),
  "yawn": anim("yawn", "Big sleepy yawn.", "once", [step("sleepy-squint", 600, 300), step("surprised-wide-left", 900, 500), step("eyes-closed", 800, 400), step("neutral", 400, 400)], noBlink),
  "greedy": anim("greedy", "Money eyes for a big bet.", "loop", [step("greedy", 1400, 250, "spring"), step("joyful-wide", 800, 300)]),
  "peek": anim("peek", "Peeking in from the edge.", "loop", [step("peek", 1500, 300), step("look-right", 900, 300), step("peek", 1200, 300)]),
  "determined": anim("determined", "Focused, on a mission.", "loop", [step("determined", 2000, 300), step("attentive-left", 800, 300)]),
  "oof": anim("oof", "Squashed landing.", "once", [step("oof", 260, 60, "snappy"), step("surprised-wide-left", 400, 200), step("neutral", 300, 300)], noBlink),
  "star-struck": anim("star-struck", "Wowed.", "loop", [step("star-struck", 1200, 250, "spring"), step("joyful-wide", 800, 300)]),
  "grumpy": anim("grumpy", "Annoyed at being poked too much.", "loop", [step("grumpy", 2000, 300), step("skeptical-left", 1000, 300)]),
  "hop": anim("hop", "One springy hop.", "once", [step("surprised-wide-left", 200, 100, "snappy"), step("joyful-wide", 500, 200, "spring")], noBlink),
};

// ---- every kind of mood, plus talking and pointing for the guide ----
const joyEyes = [eye(34, 80), eye(34, 80), 60];
Object.assign(expressions, {
  "wink-right": ex([4, -10, 8], eye(24, 56), eye(50, 12, 6), 58),
  "side-eye-left": ex([0, -22, 0], eye(40, 18), eye(40, 18), 56),
  "side-eye-right": ex([0, 22, 0], eye(40, 18), eye(40, 18), 56),
  "eye-roll": ex([18, 6, -6], eye(26, 30, 0, -22), eye(26, 30, 0, -22), 54),
  "smug": ex([-4, 14, -10], eye(40, 20, -8), eye(40, 20, 8), 58),
  "pleading": ex([10, 0, 0], eye(40, 70), eye(40, 70), 52),
  "cross-eyed": ex([0, 0, 0], eye(26, 44, -20), eye(26, 44, 20), 20),
  "crying": ex([-14, 0, 4], eye(30, 22, -18, 6), eye(30, 22, 18, 6), 58, { colors: { body: "#6c9cff" } }),
  "sick": ex([-10, -6, 10], eye(36, 14, 10), eye(36, 14, -10), 58, { colors: { body: "#9cc04a" } }),
  "freezing": ex([0, 0, 0], eye(16, 24), eye(16, 24), 46, { colors: { body: "#8fd3ff" }, motion: { eyes: "none", body: "shake" } }),
  "furious": ex([-6, 0, 0], eye(46, 22, 24), eye(46, 22, -24), 54, { colors: { body: "#e5322d", eyes: "#2b0000" }, motion: { eyes: "none", body: "shake" } }),
  "ghost": ex([6, 0, 0], eye(30, 46), eye(30, 46), 58, { colors: { body: "#f1f1ec", eyes: "#3a3a3a" } }),
  "golden": ex([-4, -6, -10], eye(46, 16, -14), eye(46, 16, 14), 60, { colors: { body: "#f2b705" } }),
  "dreamy": ex([10, -8, -10], eye(44, 14, -6), eye(44, 14, 6), 60, { colors: { body: "#8b6cff" } }),
  "cool": ex([0, 6, -4], eye(62, 20), eye(62, 20), 66),
  "nervous": ex([2, 0, 0], eye(18, 30), eye(18, 30), 50, { colors: { body: "#ffa36b" }, motion: { eyes: "shake", body: "none" } }),
  "bored-flat": ex([-6, -10, 6], eye(42, 12), eye(42, 12), 60),
  "mischievous": ex([4, 12, -10], eye(42, 14, -14), eye(26, 40), 56),
  "amazed": ex([12, 0, 0], eye(48, 72), eye(48, 72), 64),
  "tiny-eyes": ex([0, 0, 0], eye(10, 12), eye(10, 12), 44),
  "kawaii": ex([4, -4, -8], eye(30, 62, 0, 4), eye(30, 62, 0, 4), 74),
  "party-pink": ex([-2, -12, -8], ...joyEyes, { colors: { body: "#ff5fa2" } }),
  "party-yellow": ex([-2, 12, 8], ...joyEyes, { colors: { body: "#ffd23f" } }),
  "party-green": ex([-2, -12, -8], ...joyEyes, { colors: { body: "#3ddc84" } }),
  "party-blue": ex([-2, 12, 8], ...joyEyes, { colors: { body: "#3fa9ff" } }),
  "party-purple": ex([-2, -12, -8], ...joyEyes, { colors: { body: "#9b5cff" } }),
  "talk-a": ex([2, -4, 2], eye(22, 52), eye(22, 52), 54),
  "talk-b": ex([-2, 4, -2], eye(24, 44), eye(24, 44), 56),
  "point-left": ex([-6, -34, 6], eye(26, 50), eye(26, 50), 54),
  "point-right": ex([-6, 34, -6], eye(26, 50), eye(26, 50), 54),
});
const mood = (label, description, playbackMode, steps, b = blink) => anim(label, description, playbackMode, steps, b);
Object.assign(animations, {
  "wink-right": mood("wink-right", "Winks with the other eye.", "once", [step("neutral", 200, 150), step("wink-right", 500, 120, "snappy"), step("neutral", 300, 200)], noBlink),
  "side-eye": mood("side-eye", "Unimpressed side glances.", "loop", [step("side-eye-left", 1400, 300), step("side-eye-right", 1400, 300)]),
  "eye-roll": mood("eye-roll", "Rolls its eyes.", "once", [step("eye-roll", 900, 300), step("bored-flat", 600, 300), step("neutral", 300, 300)], noBlink),
  "smug": mood("smug", "Pleased with itself.", "loop", [step("smug", 2000, 300), step("mischievous", 1000, 300)]),
  "pleading": mood("pleading", "Big begging eyes.", "loop", [step("pleading", 1800, 300, "spring"), step("kawaii", 900, 300)]),
  "silly": mood("silly", "Goofy cross-eyed faces.", "loop", [step("cross-eyed", 420, 150, "snappy"), step("wink-left", 300, 120, "snappy"), step("cross-eyed", 420, 150, "snappy"), step("wink-right", 300, 120, "snappy")], noBlink),
  "crying": mood("crying", "Blue and teary.", "loop", [step("crying", 1600, 300), step("crying", 1200, 300)]),
  "sick": mood("sick", "Green and queasy.", "loop", [step("sick", 2000, 400)]),
  "freezing": mood("freezing", "Icy blue and shivering.", "loop", [step("freezing", 2000, 300)]),
  "furious": mood("furious", "Red-hot angry.", "loop", [step("furious", 1500, 200, "snappy"), step("angry-brows", 800, 200)]),
  "ghost": mood("ghost", "Boo! Pale and spooky.", "loop", [step("ghost", 1500, 400), step("ghost", 900, 400)]),
  "golden": mood("golden", "Glowing gold for a payout.", "loop", [step("golden", 1500, 300, "spring"), step("star-struck", 800, 300)]),
  "dreamy": mood("dreamy", "Purple, sleepy, far away.", "loop", [step("dreamy", 2000, 500), step("eyes-closed", 800, 500)]),
  "cool": mood("cool", "Shades on.", "loop", [step("cool", 2500, 300), step("smug", 1000, 300)]),
  "nervous": mood("nervous", "Sweating, darting eyes.", "loop", [step("nervous", 1200, 200), step("look-left", 300, 150, "snappy"), step("look-right", 300, 150, "snappy")]),
  "meh": mood("meh", "Bored.", "loop", [step("bored-flat", 2500, 400), step("eye-roll", 900, 400)]),
  "mischievous": mood("mischievous", "Up to something.", "loop", [step("mischievous", 1800, 300), step("side-eye-right", 900, 300)]),
  "amazed": mood("amazed", "Wide-eyed wonder.", "loop", [step("amazed", 1500, 250, "spring"), step("star-struck", 900, 300)]),
  "shocked": mood("shocked", "Tiny shocked eyes.", "once", [step("tiny-eyes", 1200, 80, "snappy"), step("neutral", 400, 300)], noBlink),
  "kawaii": mood("kawaii", "Extra cute.", "loop", [step("kawaii", 1800, 300, "spring"), step("happy-squint", 900, 300)]),
  "party": mood("party", "Rainbow party.", "loop", ["party-pink", "party-yellow", "party-green", "party-blue", "party-purple"].map((key) => step(key, 280, 120, "snappy")), noBlink),
  "welcome": mood("welcome", "Hello there!", "once", [step("surprised-wide-left", 200, 100, "snappy"), step("joyful-wide", 700, 200, "spring"), step("wink-left", 500, 150, "snappy"), step("happy-squint", 900, 300)], noBlink),
  "explain": mood("explain", "Talking someone through it.", "loop", [step("talk-a", 260, 120, "snappy"), step("talk-b", 260, 120, "snappy"), step("talk-a", 260, 120, "snappy"), step("attentive-left", 700, 250)]),
  "point-left": mood("point-left", "Look over there (left).", "loop", [step("point-left", 1800, 250), step("talk-b", 400, 200)]),
  "point-right": mood("point-right", "Look over there (right).", "loop", [step("point-right", 1800, 250), step("talk-a", 400, 200)]),
});

// The renderer allows at most 64 animations; these overlap with others, so they stay expressions only.
const DROP = ["determined", "shake-no", "meh", "mischievous", "wink-right"];
for (const key of DROP) delete animations[key];

Object.assign(j.expressions, expressions);
Object.assign(j.animations, animations);
for (const key of Object.keys(expressions)) if (!j.expressionOrder.includes(key)) j.expressionOrder.push(key);
for (const key of Object.keys(animations)) if (!j.animationOrder.includes(key)) j.animationOrder.push(key);
for (const key of DROP) delete j.animations[key];
j.animationOrder = j.animationOrder.filter((key) => !DROP.includes(key));
fs.writeFileSync(file, JSON.stringify(j, null, 2) + "\n");
console.log(`${Object.keys(j.expressions).length} expressions, ${Object.keys(j.animations).length} animations`);
