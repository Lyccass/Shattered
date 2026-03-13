# Style Audit — CHAPTER_01.md
**Role:** 5 — The Style Auditor
**Scope:** Compliance with AGENTS.md and PROSE_ANALYSIS.md

---

## COMPLIANCE SUMMARY

**Total flags: 14**

| Category | Flag Count |
|---|---|
| Structural Tell Thresholds | 7 |
| Anti-AI Tell Lock | 3 |
| Hard Bans | 1 |
| Diction / PROSE_ANALYSIS voice patterns | 2 |
| POV Lock | 1 |

Heaviest failure cluster: **Structural Tell Thresholds**, specifically negation-reveal constructions, two-line contrast stacks, and synthetic dramatic compression. The chapter is technically competent and the voice is largely consistent, but the structural scaffolding betrays the most common AI-prose fingerprint — too many landing lines, too much symmetry, and a tendency to resolve emotion into a tidy closing beat at the end of nearly every unit of text.

---

## CATEGORY 1: STRUCTURAL TELL THRESHOLDS (AGENTS.md)

### FLAG 1.1 — Negation-reveal construction (over threshold)

**Rule:** Negation-reveal constructions (`Not X. Not Y. The real thing.`) — max 2 per chapter.

**Instances found:**

**Instance A (page 1):**
> "Pain, honestly, was the easy part. The real insult was the endless string of tiny negotiations..."

This follows the negation-reveal pattern: implicitly denies pain as the problem, then reveals the "real" thing. It is soft — the negation is implicit rather than grammatically explicit — but it uses the exact rhetorical shape (dismissed surface → named real thing).

**Instance B (lines 54–55):**
> "He let it go because he knew what she meant. No helping the sales pitch along. No turning himself into the pleasant, manageable sort of dying man private facilities liked best. No rewarding anybody for saying continuity pathway with a straight face."

Three successive "No X" constructions. Explicit negation-reveal stacking. This is the clearest use of the pattern.

**Instance C (lines 150–151):**
> "He did not want a speech. He did not want brave words. He definitely did not want to hear that everything would be all right from anybody old enough to know better. He just wanted something true."

Four-part negation structure resolving to the positive reveal ("He just wanted something true"). This is the most structurally complete version of the pattern and it lands hard — but it is the third use of this construction type in the chapter, which breaches the threshold.

**Correction for Instance C:** Collapse the negations. The content is there; it does not need the four-beat setup. Example approach: run the detail about the speech and brave words as a single subordinate clause, then land on what he wanted without the rhetorical scaffold. The truth of "He just wanted something true" is stronger if it is not preceded by three grammatically parallel negations priming for it.

---

### FLAG 1.2 — Two-line contrast stacks (over threshold)

**Rule:** Two-line contrast or pivot stacks — max 2 per chapter. If the pair can be one sentence without loss, it should be one sentence.

**Instance A (line 19):**
> "The heater was up too high. Naturally."

This is a two-unit contrast landing: observation + dry pivot word. It can be one sentence without loss: "The heater was, naturally, up too high." The isolated "Naturally." functions as a one-word paragraph beat and a contrast stack simultaneously, which doubles its structural signature.

**Instance B (lines 103–104):**
> "Cryostasis was absurd. It was probably a cleaner, more expensive way to die, wrapped in legal language and filtered air, and it might also be a scam with better branding than most. Even so, it was still a door, however stupid, and he was not ready to sit still while the walls kept moving inward."

The "Cryostasis was absurd" opener performs a statement-pivot-reframe shape. The blunt single-sentence opener followed by the qualification-and-reframe is the thesis-antithesis-synthesis pattern (see Flag 1.4 below). As a two-line stack, the opener sentence could be folded into the sentence that follows: the absurdity is adequately established by "probably a cleaner, more expensive way to die."

**Instance C (line 156):**
> "That did the job."

Following the exchange "I was supposed to have longer" / "I know", this single-sentence paragraph is a conclusive contrast landing on a prior emotional beat. It resolves the moment cleanly, but at this point in the chapter it is the third isolated conclusive-landing paragraph after emotional tension (see also "He got out." at line 108 and "Then he went in." at line 166). Three such beats exceed the two-per-chapter threshold.

**Correction for Instance C:** The job is already done by "I know" and the preceding paragraph about the face tightening. "That did the job." is author-commentary on its own scene. Remove it; let the knock at the door do the transition work instead.

---

### FLAG 1.3 — One-word paragraph landing beats (over threshold)

**Rule:** One-word paragraph landing beats — max 2 per chapter.

The chapter contains the following single-word or near-single-word paragraph isolates used as landing beats:

- **"Naturally."** (line 19) — isolated one-word paragraph
- **"Then he went in."** (line 166) — four words, functioning identically as a landing beat

These are the two clearest cases. "That did the job." (line 156) is a third functioning beat of this type — a micro-paragraph that performs exactly the same rhetorical role as a one-word landing. Using all three is one over threshold.

**Correction:** "That did the job." should be cut (see Flag 1.2, Instance C). If that is cut, the remaining two ("Naturally." and "Then he went in.") are within threshold and both earn their isolation.

---

### FLAG 1.4 — Thesis-antithesis-synthesis pattern

**Rule:** Do not let internal reasoning turn into thesis-antithesis-synthesis essays. The logic should feel lived-in, biased, partial, and in motion.

**Instance (lines 103–104):**
> "Cryostasis was absurd. It was probably a cleaner, more expensive way to die, wrapped in legal language and filtered air, and it might also be a scam with better branding than most. Even so, it was still a door, however stupid, and he was not ready to sit still while the walls kept moving inward."

Structure: Thesis (it is absurd) → Antithesis (it might work / it's still a door) → Synthesis (but I'm doing it). This is formally clean. The character reaches a balanced, composed conclusion about a desperate choice. That composure is part of the character's voice, but the paragraph's reasoning moves too neatly through the dialectical three-step. Real lived ambivalence is messier — it interrupts itself, loops back, forgets to conclude.

**Correction:** Introduce a self-correction move or an asymmetric detail that derails the clean resolution. The door metaphor is strong; the problem is the almost essayistic setup delivering it.

---

### FLAG 1.5 — Parallel stacking / rule of three (repeated)

**Rule:** Do not default to the rule of three. Lists should have the number of items the thought requires, not the number that sounds polished.

**Instance A (line 3):**
> "Stairs, kerbs, wet floors, door thresholds, any surface that used to be beneath notice suddenly expected terms."

Four items, so not technically a rule-of-three violation. Clean.

**Instance B (line 13 — the car park):**
> "two vans, one hatchback, and a delivery lorry idling by the kerb"

Three items. Neutral — this is incidental description and the number is plausible.

**Instance C (line 13 — the rail line):**
> "in dull steel, graffiti, and damp winter light"

Three items. Incidental.

**Instance D (line 13 — surveyor observations):**
> "He noticed the pole spacing, the standing water in the drainage channel, the lean on the third fence post from the gate, and the patch repairs on the retaining wall"

Four items. Fine in isolation.

**Instance E (line 15 — job description):**
> "remote utility corridors, rail spurs, access roads, and comms cabinets"

Four items.

**Instance F (line 15 — liked list):**
> "He had liked the movement, the temporary coffee, the bad maps, the half-broken sites, and the first few minutes somewhere new"

Five items — this is the longest list in the chapter and the one most at risk. It feels catalogued rather than remembered. Five parallel nouns in a "liked" list is an enumeration move, not a thought arriving in real time.

**Instance G (line 17):**
> "He had gone home soaked, cold, and stupidly pleased with himself."

Three items. This one is fine; the three-item shape earns its third beat because "stupidly pleased with himself" is the unexpected landing.

**Instance H (line 168 — quiet insults list):**
> "people carrying things because his grip could not be trusted, colleagues slowing down at stairs while pretending they were not slowing down for him, his mother opening jars before he had made it to the kitchen, and site work drying up until everyone involved preferred the lie that he had chosen to scale back."

Four items. This is the most substantive list in the chapter and works because each item is genuinely specific. Acceptable.

**Primary flag:** Instance F (line 15, "He had liked the movement...") is the revision target. A five-item "liked" catalogue reads as completeness-for-completeness. The list should be cut to the items that actually carry weight in context — the bad maps and the first few minutes somewhere new are the specific, interesting ones. The others are generic.

---

### FLAG 1.6 — Micro-paragraph percussion (consecutive single-sentence paragraphs)

**Rule:** More than four consecutive single-sentence paragraphs outside active combat is a revision target.

**Instance (lines 76–86):**
```
"I brought the folder," she said.

"I know."

"Your ID is in the front pocket."

"I know."

"And the-"

"Mum."
```

Six consecutive one-sentence paragraphs (or near-equivalent bare-dialogue lines) outside combat. This is the only instance and it is a dialogue sequence, not narration — which mitigates the flag somewhat, since rapid-exchange dialogue has always used this format in the reference style. However, the rule does not exempt dialogue explicitly. The sequence also follows the "I know / I know" repeat, which is its own structural pattern.

**Correction:** Insert at least one action beat or brief interjection inside the exchange to break the pure percussion. Something between the second "I know" and the interrupted "And the-" would relieve the metronomic quality without disrupting the emotional logic of the scene.

---

### FLAG 1.7 — Synthetic dramatic compression (aftermath rhythm unchanged)

**Rule:** Not every line should land like a trailer beat. After resolved tension, syntax and paragraph shape should change to show consequence.

**The countdown sequence (lines 172–174):**
> "A voice asked him to count backwards from ten. He made it to seven before the room started going soft at the edges. At six he thought of rail lines vanishing into bad weather. At five he thought of wet concrete, broken fencing, and all the ordinary half-rotten places he had meant to revisit once he got better. At four he thought of his mother's hand on the car door, opening it before he had to fail at something simple in public. At three he was still thinking about the scarf. At two he tried to move his fingers and could no longer tell whether they obeyed. At one the blue light narrowed to a white seam."

Then:
> "Then there was nothing."

This is the chapter's climax, so compression is appropriate. The problem is that every beat in the countdown is constructed to the same weight and polish. "At three he was still thinking about the scarf" is genuinely good — it is unexpected and honest. But the countdown format imposes machine regularity (at six / at five / at four / at three / at two / at one) on what should feel like a dissolving consciousness. Real sedation does not count down this evenly. The form is too controlled for a mind going under.

Additionally, "Then there was nothing." is a composed closing line — it has the cadence of a chapter ending the author decided on in advance. PROSE_ANALYSIS.md requires the closing line to feel like "the last thing this person would think before moving on," not an authorial stamp. A man losing consciousness to sedatives would not finish the thought cleanly.

**Correction:** Break the arithmetic regularity. The earlier numbers can hold their structure; somewhere around three or two, the countdown should become syntactically ragged, an incomplete thought, a repetition, something that performs dissolution rather than narrating it. The last line should be less composed — or absent.

---

## CATEGORY 2: ANTI-AI TELL LOCK (AGENTS.md)

### FLAG 2.1 — Steady stream of polished landing lines

**Rule:** Do not keep writing polished emotional landing lines just because they sound good. One or two sharp landings are craft. A steady stream of them is a tell.

The chapter produces a new landing line at the close of nearly every major unit:

- "The real insult was the endless string of tiny negotiations, the way his body had started treating every mundane movement like a proposal it might reject if the wording was off."
- "Mostly he liked that broken things usually made sense if you looked at them for long enough."
- "No glamour in it, no hidden destiny either, just the quiet satisfaction of being right about a failure before somebody more important found a worse way to describe it."
- "Worry always came out of her sideways. Logistics were armour."
- "That did the job."
- "A life could be padded for safety with frightening speed."
- "He was done sitting politely inside a life that kept shrinking."

Seven distinct landing-line moments, each constructed to close its unit with verbal weight. The rule allows one or two. At seven, the pattern becomes a tell — every paragraph is being written toward a mic-drop close. The prose no longer feels discovered; it feels built.

**Correction:** At minimum three of the above should be revised to end mid-thought or transition into the next beat rather than closing on a maxim. The most disposable are "Logistics were armour" (the mother's behaviour already shows this), "That did the job" (see Flag 1.2), and "A life could be padded for safety with frightening speed" (the list before it does this work without the summary statement).

---

### FLAG 2.2 — Too much symmetry in the chapter's architecture

**Rule:** Avoid too much symmetry, compositional neatness, or over-deliberate callback architecture.

The chapter opens with Adrian negotiating a staircase because of his leg. It closes with him counting down as sedatives take his body. The middle contains exactly one callback per major motif: the scarf appears in banter and reappears in the countdown; the car door slip mirrors the earlier stair negotiation; the surveyor habit is established in the car park and echoed in the lobby and at the red light. Each callback is purposeful in isolation. Together they produce a chapter that is almost perfectly symmetrical — every planted detail is paid off, every motif is revisited. This is more controlled than the reference style, which operates with looser, more organic connections and does not resolve every thread within the same chapter.

This is a mild flag rather than a hard violation. No specific correction is required, but future chapters should resist the impulse to close every loop within the same unit. Some details should simply exist.

---

### FLAG 2.3 — Repeated sentence skeleton: "It was not X. It was Y."

**Rule:** Do not default to repeated sentence skeletons across a chapter.

**Instances:**

- "It was not a fuss and not a performance, just the same quick, competent motion..."
- "It was not enough for anyone else in the world to notice and exactly enough for both of them to notice..."

Both sentences use the "It was not X [and not Y] / [just/exactly] Y" skeleton within three pages of each other. A third instance appears inverted: "She was not trying to encourage him, and she definitely was not pretending to believe." The not/not/but construction recurs enough to register as a rhythmic habit. In a short chapter this is a recognisable fingerprint.

**Correction:** One of the three instances should be recast in a different grammatical shape. The car-door moment ("It was not enough for anyone else...") is the strongest of the three; the other two are candidates for revision.

---

## CATEGORY 3: HARD BANS (AGENTS.md)

### FLAG 3.1 — Repeated paragraph (editorial error / possible draft artefact)

**Rule (Hard Bans):** No vague action writing that hides who did what. (Adjacent issue: text integrity.)

The paragraph beginning "Mid-afternoon in the city moved with its usual irritated drag..." appears **twice** in the chapter — once in full (line 41) and once as a truncated repeat opening (visible between the "No rewarding anybody..." paragraph and the "The buildings flattened..." paragraph). The second instance reads:

> "Mid-afternoon in the city moved with its usual irritated drag..."

This is a draft artefact: a paragraph duplicated during composition and then either not continued or not deleted. It does not belong in the final text. This is not a style violation per se, but it represents an unclosed editorial error that would fail any submission review.

**Correction:** Delete the duplicate opening line. The chapter flows from the "No rewarding anybody for saying continuity pathway with a straight face" paragraph directly to "The buildings flattened as they left the city centre."

---

## CATEGORY 4: DICTION / PROSE_ANALYSIS VOICE PATTERNS

### FLAG 4.1 — Self-correction move absent

**Rule (PROSE_ANALYSIS.md):** The self-correction move should appear in analytical voice. The character states something, then refines or undercuts it. This keeps the voice feeling like a mind in motion.

The chapter contains no instance of the self-correction move. There is no "Or rather," no "Well, not exactly," no "Scratch that," no "More accurately." The analytical passages are declarative and settled rather than in-motion. Given that Adrian is established as a diagnostician by profession — someone who specifically revisits his first explanations and rejects the cheap ones — the absence of any self-correction is a voice gap.

**Correction:** Insert at least one self-correction move in the surveyor backstory section or in Adrian's assessment of the Helix building. The building analysis passage ("Buildings told on themselves. The public entrance was restrained and welcoming...") would be the natural location: Adrian could begin with one inference, then revise it to something sharper.

---

### FLAG 4.2 — Pivot-word opener drought

**Rule (PROSE_ANALYSIS.md):** Pivot words ("Still," "Of course," "Granted," "Admittedly," "In truth," "On that note," "To be clear," "Naturally" as a sentence opener) should not be absent for more than 4 consecutive reasoning paragraphs.

The chapter uses "Naturally." once (as an isolated paragraph landing, line 19) and "obviously" once (embedded mid-sentence, line 11). Otherwise the analytical pivot openers that are listed as core connective tissue of the style — "Still," "Granted," "Admittedly," "Of course," "In truth" — are entirely absent from the narration. The long analytical passages (the backstory block, the Helix building assessment, the preparation room sequence) use subject-first declarative openers throughout.

This is consistent with a voice somewhat colder and more clipped than the reference style, which is not automatically wrong for this character. However, the analytical voice is meant to feel like a mind stitching its own reasoning together, and the pivot-word openers are a primary tool for that texture. Their complete absence is a gap.

**Correction:** Add two or three pivot-word openers in the analysis-heavy passages. The surveyor backstory section is the natural home: a "Granted, the pay was never" or "Admittedly, most of it was" would naturalise the analytical voice without disrupting the tone.

---

## CATEGORY 5: POV LOCK (AGENTS.md)

### FLAG 5.1 — Marginal free indirect inference claim

**Rule:** Narration stays inside Adrian's perception. Flag any sentence reporting something he couldn't see, infer, or sense.

**Instance (line 112):**
> "A man in a charcoal suit detached himself from the desk with the smoothness of someone trained to approach distressed relatives for a living."

The phrase "trained to approach distressed relatives" is an inference about the man's professional history and specific training that goes slightly beyond what Adrian could observe. He could reasonably infer that the man is trained in patient-family interaction from the behaviour alone — but "distressed relatives" is a specific role that implies knowledge of the facility's intake context the man may or may not occupy. Adrian has not been told this man's job title. The inference is plausible from context but it reaches one step further than pure observation.

This is a mild flag, not a hard violation. The free indirect style permits confident inferences, and Adrian is experienced at reading sites and people. However, the sentence could be made sharper by grounding the inference in observable behaviour: what specifically signals the training?

**Correction:** Optional but recommended. "...with the smoothness of someone who had spent long practice on the right approach speed" or similar — something that lands on the observable quality (the smoothness, the timing, the measured smile) rather than the institutional role being inferred.

---

## OVERALL COMPLIANCE SCORE: 5 / 10

The chapter is well-written at the sentence level and demonstrates a consistent, plausible version of the target voice. The characterisation of Adrian is competent, the banter is dry and earned, and the emotional core of the farewell scene works without becoming sentimental. The surveyor-reading-infrastructure habit is distinctive and genuinely character-filtered.

The dominant failure pattern is **structural over-engineering**. The chapter has been built rather than written. Nearly every paragraph ends on a landing line. Every planted motif is paid back before the chapter closes. The negation-reveal construction appears three times. There are two-line contrast stacks, a thesis-antithesis-synthesis resolution of the central decision, and a metronomically regular countdown that imposes too much formal control on a moment of physical dissolution. The self-correction move — a primary marker of the target analytical voice — is entirely absent. Taken together, these patterns produce prose that consistently sounds like competent genre writing rather than one specific mind talking to itself. The Anti-AI Tell Lock exists precisely to catch this: the tells are not in individual sentences but in the too-consistent architecture underneath them.

Priority revision targets, in order: (1) cut "That did the job" and two other landing lines; (2) break the countdown's arithmetic regularity and revise the final line; (3) remove the duplicate paragraph; (4) insert one self-correction move in the analytical sections; (5) revise the four-part negation block ("He did not want a speech...") to collapse the setup.
