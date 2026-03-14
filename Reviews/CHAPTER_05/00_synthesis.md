# Chapter 5 — Review Synthesis

All six roles completed. Items are deduplicated, grouped by type, and ordered by implementation sequence: hard bans → story logic → structure → AI tells + style → line fixes → engagement → The Writing Professional's question.

---

## HARD BANS (fix before anything else)

### HB-1 — Inner thoughts formatted with asterisks instead of `<em>` tags
**Source:** Style Auditor, Lector
**Quote:** `*So that means there were not only monsters, stats, and magic, but teleportation as well. This is crazy.*` and two others (lines 13, 71, 99)
**Rule:** AGENTS.md — "Two types of formatted inner thought are permitted, both using `<em>` tags (not markdown asterisks — the project targets Royal Road, which requires HTML formatting for italics to paste correctly)"
**Fix:** Replace all `*text*` inner thoughts with `<em>text</em>`. See HB-2 for the thought at line 99, which should be deleted.
- [ ] Applied

### HB-2 — Inner thought count exceeds ceiling (6 vs. max 2–3)
**Source:** Style Auditor
**Quote:** Six total instances across the chapter
**Rule:** AGENTS.md — "Use two to three instances per chapter across both types combined. Overuse kills the punch."
**Fix:** Keep the two strongest (see line 13 and line 71 after rewrite). Delete the thought at line 99 outright (see LL-6). Review and cut remaining instances.
- [ ] Applied

### HB-3 — Chapter ending stops without landing
**Source:** Style Auditor, Lector (implied)
**Quote:** *"The knife broke."*
**Rule:** AGENTS.md Hard Bans — "No chapter ending that simply stops instead of landing." AGENTS.md Chapter Engine — "End on momentum, not on idle reflection."
**Fix:** Add 1–3 lines after "The knife broke." — Adrian's immediate physical/tactical state, not reflection. The cliffhanger survives; it needs one beat to land in his body and push forward.
- [ ] Applied

### HB-4 — Secondary POV missing `--` scene break markers
**Source:** Style Auditor, Lector
**Quote:** *"From the higher ridge, Keiran Vale noticed the planes stir a moment before it opened."* (no `--` before or after this section)
**Rule:** AGENTS.md POV Lock — "If you use another POV, do it only after a clear scene break. Use `--` for scene breaks when shifting to another POV, matching the reference style."
**Fix:** Add `--` immediately before the Keiran section and `--` immediately after it. This is the minimum fix; see SL-3 for the deeper structural problem.
- [ ] Applied

### HB-5 — Omniscient narration in Keiran's POV
**Source:** Style Auditor
**Quote:** *"dead-Earth salvage worn with no understanding of how wrong it looked"*
**Rule:** AGENTS.md Hard Bans — "No omniscient narration." AGENTS.md POV Lock — narration must stay inside the current POV character's perception.
**Fix:** Keiran can observe the gear; he cannot state Adrian's internal understanding. Rewrite: *"dead-Earth salvage — coat from the wrong century, spear grip like a man who'd never trained with one."* Keep observation, remove the interiority.
- [ ] Applied

### HB-6 — POV drift within the Keiran section into Adrian's voice
**Source:** Lector
**Quote:** *"the patch of grass that now contained Adrian and most of his immediate dignity"*
**Rule:** AGENTS.md Hard Bans — "No mid-scene POV drift."
**Fix:** This line uses Adrian's sardonic register from inside Keiran's scene. Rewrite in Keiran's voice: *"The patch of grass that currently held a man doing a creditable impression of not moving."*
- [ ] Applied

---

## STORY LOGIC

### SL-1 — Boar attack arrives from wrong vector given Adrian's positional awareness
**Source:** Story Analyst
**Quote:** *"Then the wind shifted, and with it came a noise from behind him. Something crashed through the grass, charging right at him."*
**Logic failure:** Adrian has spent several pages managing his upslope sightlines. The boar attacks from behind (upslope) with no established distraction to explain the lapse.
**Fix (two options, pick one):**
- Give Adrian an explicit moment of forward fixation just before the charge — a specific action by someone in the group that pulls his complete attention for several seconds.
- Change the boar's approach angle to lateral or from the taller grass downslope, which his position would realistically leave unguarded.
- [ ] Applied

### SL-2 — The knife breaking is causally unearned
**Source:** Story Analyst
**Quote:** *"He drove the blade in under the jaw. The knife broke."*
**Logic failure:** The knife was taken in Chapter 4 deliberately as a backup. The system labelled the pipe "Inferior Quality" and the spear "Proven" but gave the rusted knife no rating — which should have been a signal. The knife breaks without that signal being planted, converting a character decision into a plot device.
**Fix (belongs in Chapter 4):** When Adrian takes the knife from the dead worker, add a specific note about structural fragility — pitting, a hairline crack, rust that looks deeper than surface. Let the system's silence on it be the second signal. No changes needed in Chapter 5.
- [ ] Applied

### SL-3 — Keiran observes Adrian throughout, then disappears with no consequence
**Source:** Story Analyst, Lector, Writing Professional
**Quote:** *"What a curious little fella," he mused mildly curious now, as the lone human began shadowing the group through the grass.*
**Logic failure / structural problem:** Keiran has a clear sightline to Adrian during the entire shadowing sequence and presumably during the boar fight. He then disappears from the chapter with no action, no decision, and no bridge to a future scene. The scene delivers dramatic irony but no payoff and answers the chapter's central tension (is Adrian in danger from the group?) before Adrian must act on it.
**Fix (three options in priority order):**
1. Cut the Keiran section entirely. Introduce him in Chapter 6 when he intervenes or makes contact. The cliffhanger is stronger without the reassurance.
2. Move the Keiran section to after "The knife broke." — two or three sentences showing Keiran decide to act. This gives the scene function and creates forward pressure.
3. If kept in current position, strip all emotional/competence assessment of Adrian and include only world-information unavailable to Adrian (e.g. that the boar is a territorial animal for this area, or that the arch the group has been watching is now cold).
- [ ] Applied

---

## STRUCTURAL / FORMATTING

### ST-1 — Double creature description stalls the boar fight
**Source:** Lector, AI Detector (parallel stacking)
**Quote (first):** *"It looked like a boar, but meaner, with dark scales plating much of its body and coarse bristles running along its neck. It looked like an armoured living tank."*
**Quote (second):** *"It had the heavy front and brutal low charge of one, with coarse dark bristles running along a neck too thick for grace..."*
**Fix:** Consolidate into one description timed to the charge, before impact: *It charged from behind, something with the low heavy run of a boar but bigger — dark-scaled, bristle-necked, tusks curving higher than any pig had a right to grow. Adrian started to turn and only got halfway there.* Delete the second block. Fold the eyes detail into the recovery.
- [ ] Applied

### ST-2 — Post-Keiran scene restart restates known information
**Source:** Lector
**Quote:** *"Adrian stayed where he was, crouched low in the grass with the spear held close and his weight resting more on his good leg than the other one. The group below had slowed near a line of darker stone... It already was stupid, admittedly."*
**Fix:** Delete the restatement paragraph ("It already was stupid..."). Resume with new forward observation.
- [ ] Applied

### ST-3 — Three micro-paragraph percussion beats outside combat
**Source:** Style Auditor, Lector
**Quote:** *"Adrian let the breath out slowly through his nose and stayed where he was until the group had moved another twenty yards. / "That was close enough," he muttered. / He trailed them a little lower after that..."*
**Rule:** AGENTS.md — "Micro-paragraph percussion is banned outside active combat."
**Fix:** Merge into one paragraph. *Adrian let the breath out slowly and stayed where he was until the group had moved another twenty yards before trailing them lower.*
- [ ] Applied

### ST-4 — Three negation-reveal constructions (threshold: max 2)
**Source:** Style Auditor, AI Detector, Lector
**Instances:**
1. *"There was no chamber behind it now, no dark corridor, no trace of the place he had stepped out of."*
2. *"There was no reason to assume they spoke English. No reason to assume... No reason to assume..."*
3. *"Not as deep as he wanted but deep enough to matter."*
**Rule:** AGENTS.md Structural Tell Thresholds — max 2 per chapter.
**Fix:** Reduce to one. The triple "No reason to assume" cascade (instance 2) is the most AI-shaped and the most redundant — the prose around it already implies the concerns. Rewrite as a single sentence: *"No reason to assume they spoke English, and less reason to assume they'd look at a stranger with a stolen spear and react charitably."*
- [ ] Applied

### ST-5 — Three one-word/short isolation beats (threshold: max 2)
**Source:** Style Auditor
**Instances:** *"Writing."* / *"Human."* / *"Human."* (second instance)
**Rule:** AGENTS.md — "One-word paragraph landing beats... may appear at most twice per chapter."
**Fix:** Remove one. The second *"Human."* is the weaker of the two human-confirmation beats — the face-confirmation scene that follows is the real payoff. Fold it into its surrounding paragraph.
- [ ] Applied

### ST-6 — Four parallel stacking constructions (threshold: max 3)
**Source:** Style Auditor
**Location:** The group-observation section — clothing description, weapon description, and movement description each run as a clean parallel inventory.
**Rule:** AGENTS.md — "More than three clearly similar vertical stacks in one chapter is a revision target."
**Fix:** Break up one stack. The clothing paragraph is the most uniform — introduce an interruption, a digression, or an irregular ordering.
- [ ] Applied

---

## AI TELLS + STYLE

### AS-1 — Tension-release emotional beat deployed twice in the same chapter using near-identical architecture
**Source:** AI Detector
**Instance 1:** *"a tension he didnt even know he held left his body in an instant."* (path discovery)
**Instance 2:** *"Adrian had not realised quite how tightly some part of him had been wound around that question until it loosened."* (face confirmation)
**Fix:** Cut Instance 1. Reserve the pattern for the face-confirmation scene, which is the more earned payoff. Replace with a physical action: *"He straightened without meaning to."*
- [ ] Applied

### AS-2 — Emotional states named directly instead of shown through behaviour
**Source:** AI Detector
**Instance 1:** *"a tension he didnt even know he held left his body in an instant."* (covered by AS-1)
**Instance 2:** *"Adrian had not realised quite how tightly some part of him had been wound around that question until it loosened."*
**Instance 3:** *"The relief lasted right up until he heard them."*
**Fix:** AS-1 covers Instance 1. Instance 2: replace with a physical beat — *"He let the breath out through his nose and kept looking."* Instance 3: rewrite — *"He had been glad for about four seconds."*
- [ ] Applied

### AS-3 — Parenthetical mid-sentence explanations doing reader-service work
**Source:** AI Detector
**Instance 1:** *"wide enough that one problem would not catch all of them at once and tight enough that nobody drifted out of help"* — translates physical spacing into tactical principle for the reader.
**Instance 2:** *"its small eyes had that flat animal certainty that meant it had already decided what he was for"* — glosses a physical detail with an interpretation.
**Fix 1:** *"Their spacing was practical — not bunched, not scattered."*
**Fix 2:** *"its small eyes had the flat animal certainty of something that had already made up its mind."*
- [ ] Applied

### AS-4 — Thesis-antithesis-synthesis internal reasoning
**Source:** AI Detector
**Quote:** *"Alone was bad. Approaching blind might be worse. The trouble was that by the look of the country around him, dark would soon begin making both options uglier."*
**Fix:** *"Dark was going to make every option worse. That was the conclusion, anyway, and it didn't help."*
- [ ] Applied

### AS-5 — "They had just made him more capable than he had been." — explicit growth statement after demonstrated action
**Source:** AI Detector
**Fix:** Cut the sentence. The demonstration precedes the statement and does not need the gloss.
- [ ] Applied

### AS-6 — "The ordinary ease of people who expected to be understood" — clinical precision replacing sensation
**Source:** AI Detector
**Fix:** *"The voices were easy with each other — no hesitation, no raised volume, the back-and-forth of people who'd been walking together long enough."*
- [ ] Applied

### AS-7 — Self-correction move absent for extended analytical stretches
**Source:** Style Auditor (PROSE_ANALYSIS.md)
**Location:** The boot-print-reading sequence and the group-assessment sequence both run as clean analytical deliveries with no revision or self-correction.
**Rule:** PROSE_ANALYSIS.md — "This self-correction move appears constantly."
**Fix:** Introduce one correction beat in each section. The boot-print section already has the material: *"Some looked smaller than the others."* — add a second look that qualifies the first reading.
- [ ] Applied

---

## LINE FIXES (typos, grammar, specific sentences)

### LF-1 — "ressources" / "waken up in"
**Source:** All roles
**Quote:** *"drank sparingly some of the water ressources he had found in the place he had waken up in"*
**Fix:** *"drank from the water bladder more sparingly than he wanted to"*
- [ ] Applied

### LF-2 — "bu it did tell him" (typo)
**Source:** All roles
**Quote:** *"That did not tell Adrian who they were,bu it did tell him the weapons were real."*
**Fix:** *"but it did tell him"*
- [ ] Applied

### LF-3 — "an sour expression" (grammar) + redundant action tag
**Source:** Lector, Royal Road Reader
**Quote:** *"He noted with an sour expression"*
**Fix:** Cut the tag entirely. Replace with a physical action: *He adjusted his grip on his own spear.*
- [ ] Applied

### LF-4 — "studipid" (typo)
**Source:** Multiple roles
**Quote:** *"Running straight at armed strangers would have been a studipid decision."*
**Fix:** "stupid"
- [ ] Applied

### LF-5 — "beeing" (typo) / "didnt" (missing apostrophe)
**Source:** Multiple roles
**Quote:** *"Realising that he was not the only sapient beeing around, a tension he didnt even know he held"*
**Fix:** "being" / "didn't"
- [ ] Applied

### LF-6 — Inner thought at line 99: broken grammar, wrong register, redundant
**Source:** Lector, Style Auditor
**Quote:** `*Or maybe I can guess it, but I don`t want to. Because the I have the feeling it will not be in favour for me.*`
**Fix:** Delete entirely. The surrounding sentence (*"the outcome of that meeting was no longer something he could safely guess"*) already does this work.
- [ ] Applied

### LF-7 — "I am probably dead" — uncontracted speech
**Source:** Style Auditor
**Quote:** *"I am probably dead," he muttered.*
**Rule:** AGENTS.md Diction Lock — "Use contractions freely."
**Fix:** *"I'm probably dead."*
- [ ] Applied

### LF-8 — "What is this thing?" Adrian cursed under his breath
**Source:** Royal Road Reader
**Quote:** *"What is this thing?" Adrian cursed under his breath.*
**Issue:** "Cursed under his breath" implies an expletive, not a question. Mismatched tag.
**Fix:** *"What is this thing?" he muttered.*
- [ ] Applied

### LF-9 — "It did not stop the attack." — redundant
**Source:** Lector
**Quote:** *"In desperation Adrian threw his empty hand out to brace against it as it came in. It did not stop the attack. It slammed into him anyway..."*
**Fix:** Cut "It did not stop the attack." The next sentence shows it immediately.
- [ ] Applied

### LF-10 — "Out here there was only grass, stone, wind, a few trees and far too much space." — dead summary
**Source:** Lector
**Fix:** Cut. The preceding detail already established this.
- [ ] Applied

### LF-11 — Keiran: "he mused mildly curious now" — redundancy + register mismatch
**Source:** Lector, multiple
**Quote:** *"What a curious little fella", he mused mildly curious now*
**Fix:** *"What a curious little fella," he said quietly.* (or cut in favour of the deeper Keiran fix at SL-3)
- [ ] Applied

### LF-12 — "That was already more useful than the rest." — summary evaluation
**Source:** AI Detector
**Fix:** Cut.
- [ ] Applied

---

## ENGAGEMENT (Royal Road Reader)

### EN-1 — Keiran section placement kills momentum at the chapter's central tension point
**Source:** Royal Road Reader (strongly), Writing Professional, Lector
**Issue:** The chapter builds toward Adrian's decision about whether to approach the group. The Keiran section intercepts this at exactly the wrong moment, deflating tension by showing Adrian is not in danger, then forces the reader to rebuild investment when the POV returns.
**Fix:** See SL-3. Cut or move. The Royal Road Reader would drop rating from "Would read the next one" to "On the fence" based on this one structural choice.
- [ ] Applied

### EN-2 — Water resources sentence reads as placeholder
**Source:** Royal Road Reader
**Quote:** *"drank sparingly some of the water ressources he had found in the place he had waken up in"*
**Fix:** Covered by LF-1.
- [ ] Applied

---

## THE WRITING PROFESSIONAL'S QUESTION

*"What does this author believe the Empty Trait actually is — not in terms of eventual revelation, but in terms of dramatic function right now?"*

In Chapter 5, Adrian's first extended encounter with the outside world, the Empty Trait does not appear in his thinking, his approach to the humans, his combat decisions, or his self-assessment. For a series whose central premise and title are built on the thing this character is missing, five chapters in, this absence is worth sitting with before the next draft.

---

## SCORES BY ROLE

| Role | Score |
|---|---|
| Story Analyst | Logic holds in first half; two critical failures in second half |
| Style Auditor | **5/10** — 18 flags across 8 categories |
| AI Detector | **7/10** — No vocabulary flags; structural tells present throughout |
| Lector | Not ready to post; three major structural problems |
| Writing Professional | Publishable-tier material; not submission-ready |
| Royal Road Reader | **Would read the next one** — but only because the knife broke |
