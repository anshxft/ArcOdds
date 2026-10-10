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

Object.assign(j.expressions, expressions);
Object.assign(j.animations, animations);
for (const key of Object.keys(expressions)) if (!j.expressionOrder.includes(key)) j.expressionOrder.push(key);
for (const key of Object.keys(animations)) if (!j.animationOrder.includes(key)) j.animationOrder.push(key);
fs.writeFileSync(file, JSON.stringify(j, null, 2) + "\n");
console.log(`${Object.keys(j.expressions).length} expressions, ${Object.keys(j.animations).length} animations`);
