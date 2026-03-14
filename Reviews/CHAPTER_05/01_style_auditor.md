# Style Audit — Chapter 5: People
**Role 5 — The Style Auditor**

---

## Compliance Summary

**Total flags: 18**

**Categories with most hits:**
- Inner Thought Formatting / Structural Tell Thresholds: 5 flags
- Hard Bans: 4 flags
- Sentence Rhythm: 3 flags
- Diction / Anti-AI Tell Lock: 3 flags
- POV Lock: 2 flags
- Protagonist Thought Pattern: 1 flag

Categories with zero flags (skipped below): Opener Rotation, Paragraph Shape (post-pressure), Analytical Reasoning format, Dialogue Lock (the spoken lines present are compliant in register).

---

## 1. Inner Thought Formatting

### FLAG 1 — Markdown asterisks used instead of `<em>` tags (all six instances)

**Quote (line 13):**
> `*So that means there were not only monsters, stats, and magic, but teleportation as well. This is crazy.*`

**Quote (line 19):**
> `*If something out here wants me dead, I am making that very easy for it.*`

**Quote (line 37):**
> `*People use this route.*`

**Quote (line 71):**
> `*And if my luck keeps up, probably against me*`

**Quote (line 97):**
> `*Human is good. Human who cannot understand me is less good.*`

**Quote (line 99):**
> `*Or maybe I can guess it, but I don`t want to. Because the I have the feeling it will not be in favour for me.*`

**Rule violated:** AGENTS.md, Thought Pattern Lock — "Two types of formatted inner thought are permitted, both using `<em>` tags (not markdown asterisks — the project targets Royal Road, which requires HTML formatting for italics to paste correctly)."

**Correction:** Every one of these instances must be converted from `*text*` to `<em>text</em>`. This applies to all six occurrences above without exception. This is a production-blocking error — markdown asterisks will not render as italics on Royal Road.

---

## 2. Structural Tell Thresholds

### FLAG 2 — Inner thought count exceeds the two-to-three per chapter ceiling

The chapter contains six formatted inner thought instances (lines 13, 19, 37, 71, 97, 99), all identified above. The ceiling is two to three instances per chapter across both types combined.

**Rule violated:** AGENTS.md, Thought Pattern Lock — "Use two to three instances per chapter across both types combined. Overuse kills the punch."

**Correction:** Reduce to three maximum. The weakest candidates for removal are:

- Line 37: `*People use this route.*` — this realisation is already delivered cleanly by the surrounding narration ("Too many repeated footfalls had gone this way for too long. The line was not paved, fenced, or built up in any serious sense, but people had used it often enough to teach the land a route.") and does not require a formatted thought to carry it. The formatted beat adds nothing the prose has not already said.

- Line 97: `*Human is good. Human who cannot understand me is less good.*` — the paragraph that immediately follows (lines 99–103) states this reasoning plainly in narration. The formatted thought pre-empts its own elaboration.

- Line 99: The second inner thought on the same page. It also contains prose errors (see Flag 12 below) and is the weakest in terms of character voice.

Retain the three most involuntary and unprocessed instances. Lines 13 and 19 are the strongest candidates to keep; the third keeper should be selected from the remaining four based on which feels least pre-processed.

### FLAG 3 — Negation-reveal construction used three times (threshold: max 2)

**Instance 1 (line 87):**
> "Not approximately. Not if he squinted and pretended. Human in all the obvious ways that mattered..."

**Instance 2 (line 49):**
> "No reason to assume they spoke English. No reason to assume they could read anything he wrote, if he even had a way to write it. No reason to assume they would see a lone stranger carrying a spear and dressed in a coat stolen from a corpse and think anything charitable at all."

**Instance 3 (line 117, secondary POV):**
> "No language, then. No local guidance. No escort."

All three follow the negation-reveal scaffold: a series of negatives that prepare or deliver the positive conclusion. Three uses in one chapter crosses the stated threshold.

**Rule violated:** AGENTS.md, Structural Tell Thresholds — "Negation-reveal constructions such as `Not X. Not Y. The real thing.` may appear at most twice per chapter. A third use is a revision target."

**Correction:** One of the three must be collapsed into a positive construction. The secondary POV instance (line 117) is the most expendable: "No language, then. No local guidance. No escort." can become "The route had delivered someone with no local language, no guidance, and no escort" — same information, no negation scaffold. This also reduces the parallel stacking count (see Flag 5).

### FLAG 4 — Micro-paragraph percussion: consecutive very short units outside combat

**Quote (lines 129–133):**
> "He shifted to ease the pull in his ribs and began edging along the slope, meaning to keep them in sight a little longer before he committed. Closer first. Learn what he could. Then decide.
>
> Then the wind shifted, and with it came a noise from behind him.
>
> Something crashed through the grass, charging right at him."

"Closer first. Learn what he could. Then decide." is a three-beat micro-staccato inside a paragraph — three sentence fragments functioning as a percussion block. The paragraph immediately following is a single medium sentence. The one after that is also a single sentence. This gives three consecutive short-to-single-sentence units in a non-combat, pre-combat staging moment before the boar's arrival.

Neither "Then the wind shifted" nor "Something crashed through the grass" qualifies as the pressure exchange itself — the fight begins in the paragraph after ("Adrian started to turn and only got halfway there..."). The staccato precedes the combat, not the other way around.

**Quote (lines 63–65):**
> "They were farther off than he had first thought, spread across the lower slope in a loose line that kept changing shape as they moved. Six of them, maybe seven if the last flicker behind the others had been a person rather than brush. Armed. Human-shaped, at least, which was the first thing that mattered.
>
> He took his time with the second."

"Armed." functions as a near-isolated beat inside the preceding paragraph, which then closes with a medium sentence. "He took his time with the second." is a single-sentence paragraph following it. The compression here is clipped beyond the base rhythm for an observation moment.

**Rule violated:** AGENTS.md, Structural Tell Thresholds — "Micro-paragraph percussion is banned outside active combat. More than four consecutive single-sentence paragraphs outside a pressure exchange is a revision target."

**Correction:** At lines 129–133, absorb "Closer first. Learn what he could. Then decide." into the preceding sentence as a trailing clause ("...meaning to keep them in sight a little longer before he committed — closer first, learn what he could, then decide"). This reduces the staccato count before the boar. "Something crashed through the grass, charging right at him." can remain as its own short opening to the combat paragraph, which is where percussion is permitted.

### FLAG 5 — Parallel stacking density: four clearly similar vertical/syntactic stacks in one chapter (threshold: max 3)

**Stack 1 (line 67):**
> "No matched step, no polished formation, no effort spent looking impressive."

**Stack 2 (line 49):**
> "No reason to assume they spoke English. No reason to assume they could read anything he wrote... No reason to assume they would see a lone stranger..."

**Stack 3 (line 87):**
> "Human nose. Human mouth. Human brow."

**Stack 4 (line 117, secondary POV):**
> "No language, then. No local guidance. No escort."

Four clearly parallel stacks of three items each across the chapter. The rule permits the device but caps it.

**Rule violated:** AGENTS.md, Structural Tell Thresholds — "Parallel stacking and tri-line blocks must be treated as rare emphasis devices, not default rhythm. More than three clearly similar vertical stacks in one chapter is a revision target."

**Correction:** The secondary POV instance (line 117) is the most efficient cut and is also the recommended fix for Flag 3. Eliminating it resolves both violations simultaneously. Alternatively, the "No matched step, no polished formation" list (line 67) can be rewritten in a non-parallel construction since it is the least load-bearing of the four — the information it carries does not depend on the parallel rhythm.

### FLAG 6 — One-word / short isolation beats used three times (threshold: max 2)

**Instance 1 (line 41):**
> "Writing."

**Instance 2 (line 85):**
> "Human."

**Instance 3 (line 149):**
> "He was too slow."

"He was too slow." is a three-word sentence deployed as a single-sentence paragraph beat, functioning identically to the one-word beats that precede it — isolation for added weight. All three are used for emphasis through typographic separation rather than content. Three instances exceeds the stated maximum.

**Rule violated:** AGENTS.md, Structural Tell Thresholds — "One-word paragraph landing beats such as `Real.` or `Good.` may appear at most twice per chapter. Use only when the isolation genuinely changes the force of the line."

**Correction:** One of the three must be absorbed. "Writing." (line 41) is the most replaceable — it can be folded into the previous sentence as a dependent clause or absorbed into the following paragraph's opening sentence. "Human." (line 85) earns its isolation clearly, as a single-word revelation after extended tension. "He was too slow." (line 149) is inside active combat and retains its function there. Removing "Writing." resolves the count.

---

## 3. Sentence Rhythm

### FLAG 7 — Three consecutive short sentences outside a pressure exchange (lines 99–101)

**Quote:**
> "They were human. That mattered. It mattered a great deal. They also lived in a world where he could not understand the first thing they said, and if he walked down there now with a stranger's clothes, a spear in hand, and no language in common, the outcome of that meeting was no longer something he could safely guess."

"They were human." — short. "That mattered." — short. "It mattered a great deal." — short. Three consecutive short sentences before the long reasoning sentence that closes the paragraph. The self-repetition of "That mattered. It mattered a great deal." is a rhythm device, but it occurs between two other short sentences, producing three shorts in a row in a non-combat reasoning moment.

**Rule violated:** PROSE_ANALYSIS.md — base sentence length 15–30 words; "flag stretches of 3+ consecutive short sentences outside pressure exchanges."

**Correction:** Collapse "That mattered. It mattered a great deal." into one sentence, or absorb one of the short beats into the long reasoning sentence that follows: "They were human — and that mattered, genuinely mattered, in a way he had not fully registered until just now."

### FLAG 8 — Short staccato block before combat in staging passage (lines 129–133, cross-reference with Flag 4)

**Quote:**
> "Closer first. Learn what he could. Then decide.
>
> Then the wind shifted, and with it came a noise from behind him.
>
> Something crashed through the grass, charging right at him."

Three consecutive short-to-single-sentence units before the pressure exchange begins. The pattern also violates the micro-paragraph percussion rule (Flag 4) and is addressed there.

**Rule violated:** PROSE_ANALYSIS.md — "flag stretches of 3+ consecutive short sentences outside pressure exchanges." The fight does not begin until the next paragraph ("Adrian started to turn..."), so this block falls outside the pressure-exchange exemption.

**Correction:** As noted under Flag 4 — absorb the fragment triplet into the preceding sentence as a trailing clause.

### FLAG 9 — Missing short cutoff after sustained analytical run (secondary POV, lines 111–117)

**Quote:**
> "A lone human emerging from a failing route was unusual enough to justify a little patience. No local marks worth noticing, dead-Earth salvage worn with no understanding of how wrong it looked, fresh injuries, and a spear carried like a walking stick rather than a chosen discipline. The man had the expression of someone trying very hard to remain functional while reality became progressively less cooperative.
>
> The human checked the arch first, then the horizon, then the nearest rise. Sensible. Not because the land was kind, but because higher ground at least offered information, and information was the only useful thing available to him in any quantity.
>
> Fear sat on him plainly enough, though it had not yet made him stupid. That was worth something. Plenty of stronger people performed worse when dropped into uncertainty with better odds and more help.
>
> Keiran watched him climb. He watched him find the marker post and linger over the inscription long enough to confirm the obvious conclusion. No language, then. No local guidance. No escort. The route had not simply pushed out another March fool a little farther from home than intended. It had delivered someone genuinely separate."

The Keiran section runs entirely in medium-to-long sentences with no short cutoff landing. "It had delivered someone genuinely separate." is the closest thing to a short landing but runs to 8 words and does not hit with the clean punch the style calls for after a sustained analytical run. The passage has no rhythm variation across four paragraphs.

**Rule noted:** PROSE_ANALYSIS.md — "Break long analytical runs with short punch lines." / "The short sentence after a long one is the most reliable tool in the style. It works like a full stop with extra weight."

**Correction:** After "It had delivered someone genuinely separate." add a short cutoff, or rewrite the landing sentence to be shorter and more precise. A three-to-five word sentence closing the Keiran section would resolve the rhythm flatness.

---

## 4. Diction

### FLAG 10 — "I am probably dead" — uncontracted speech in dialogue

**Quote (line 15):**
> `"I am probably dead," he muttered. "Or hallucinating. That would honestly be easier."`

The spoken line "I am probably dead" uses the uncontracted formal register. The diction lock requires contractions to be used freely; in spoken dialogue especially, "I'm probably dead" is the natural form for this character in this moment.

**Rule violated:** AGENTS.md, Diction Lock — "Use contractions freely."

**Correction:** Change "I am probably dead" to "I'm probably dead."

### FLAG 11 — Prose errors in narration: "ressources" and "waken" (line 25)

**Quote:**
> "...drank sparingly some of the water ressources he had found in the place he had waken up in..."

"ressources" is a misspelling of "resources." "waken" is a non-standard past participle; the standard British English form is "woken." Additionally, the phrasing "drank sparingly some of the water resources" is syntactically awkward — "some of the water resources" reads as system-speak or inventory language rather than character voice; "drank sparingly from the water he had found" is cleaner and more in register.

**Rule noted:** These are production-level prose errors. While they do not map to a single named rule in AGENTS.md or PROSE_ANALYSIS.md, they constitute diction surface failures that would be immediately visible to a reader.

**Correction:** "resources" and "woken." Rewrite the full clause for natural flow: "drank sparingly from the water he'd found in the place he'd woken up in" — or restructure to avoid the trailing prepositional phrase.

### FLAG 12 — Inner thought at line 99 contains prose errors and broken register

**Quote:**
> `*Or maybe I can guess it, but I don`t want to. Because the I have the feeling it will not be in favour for me.*`

This inner thought contains: a backtick used instead of an apostrophe ("don`t"); "the I" which is an error ("I have the feeling"); "it will not be in favour for me" which is grammatically awkward in standard British English ("not in my favour"). Beyond the mechanical errors, the register is wrong — the phrasing is stiff and over-formal, the opposite of the casual first-person voice required for Type 2 inner thoughts.

**Rule violated:** AGENTS.md, Thought Pattern Lock — "written in casual first-person register — not 'he needed to move' but 'I need to move'... Should feel like a mind in motion: not a conclusion already reached but the process of arriving there."

**Correction:** This entire inner thought should be cut (the narration surrounding it already covers the reasoning) or replaced. If kept, a corrected version in proper register: `<em>Or maybe I can, and I just don't like where that guess lands.</em>` — shorter, drier, character-filtered, and without the mechanical errors.

---

## 5. POV Lock

### FLAG 13 — Secondary POV section lacks the required `--` scene break markers

**Quote (line 107):**
> "From the higher ridge, Keiran Vale noticed the planes stir a moment before it opened."

This secondary POV section begins after two blank lines with no `--` scene break marker. The same absence occurs at the return to Adrian's POV at line 125. The project style establishes `--` as the explicit separator for POV shifts, used consistently in the prior chapters.

**Rule violated:** AGENTS.md, POV Lock — "Use `--` for scene breaks when shifting to another POV, matching the reference style."

**Correction:** Add `--` as a dedicated scene break line before "From the higher ridge, Keiran Vale noticed the planes stir..." and again before "Adrian stayed where he was, crouched low in the grass..." (line 125). Both transitions require the marker.

### FLAG 14 — Omniscient narration slip in secondary POV: attributed internal state to observed character

**Quote (line 111):**
> "A lone human emerging from a failing route was unusual enough to justify a little patience. No local marks worth noticing, dead-Earth salvage worn with no understanding of how wrong it looked, fresh injuries, and a spear carried like a walking stick rather than a chosen discipline."

The phrase "with no understanding of how wrong it looked" attributes an internal state — ignorance — to Adrian as a directly known fact. Keiran can observe the gear and its incongruity with local norms from a distance. He cannot observe Adrian's understanding of it. This is a slip from Keiran's inference into omniscient access to the observed character's mind.

**Rule violated:** AGENTS.md, POV Lock — "The narration must sound like the protagonist's mind even outside direct thought" and "Most of the time, the narration should only include what he sees, infers, remembers, identifies, suspects, or decides." Also Hard Bans — "No omniscient narration."

**Correction:** Rewrite as Keiran's observable inference: "dead-Earth salvage worn as though the man had no idea what it marked him as" or "dead-Earth salvage with none of the modifications that said he knew where it had come from." Both versions keep the observation anchored in Keiran's inference from visible evidence rather than stating Adrian's internal state as direct fact.

---

## 6. Protagonist Thought Pattern

### FLAG 15 — Compare-to-prior-knowledge step absent in the footprint-reading sequence (lines 55–57)

**Quote:**
> "Some looked smaller than the others. One print seemed deeper at the heel, which might have meant more weight or simply a heavier step. Another did not look quite like a boot at all, though he had no idea whether that meant local fashion, local practicality, or something stranger.
>
> He crouched for a moment and looked anyway, because uncertain information still beat none. What he could say with confidence was simple enough: nobody had been running, nobody had churned the ground into a panic, and the path had been used by people who knew where they were going well enough not to hesitate every few steps."

Adrian executes Notice → Test/Interpret → Judge competently here, but the Compare-to-prior-knowledge step (step 3 of the required pattern) is entirely absent. His professional background is forensic inspection of structures and infrastructure — reading surfaces for age, use-frequency, and failure mode is specifically identified in PROSE_ANALYSIS.md as his character's signature deduction pattern. The boot-print reading stays generic: any observant person might note "nobody was running." The analysis is not anchored in Adrian's specific voice or experience.

**Rule violated:** AGENTS.md, Thought Pattern Lock, step 3 — "Compare it to prior knowledge. (this can vary and does not have to be his job but anything from memories, to family, work, school, popculture or random)." PROSE_ANALYSIS.md, Adrian Keller Voice Patterns — "Forensic Reading of Surfaces: reads physical surfaces for age, use-frequency, and failure mode, then situates evidence in time relative to known reference points."

**Correction:** Add a brief anchoring comparison — one sentence connecting the footprint-reading to something in his prior experience. It does not have to be his exact job; a reference to how worn pavement tells you about usage frequency, or how he has looked at mud around construction sites, would suffice. The comparison should arrive before the judgment, not after.

---

## 7. Hard Bans

### FLAG 16 — Vague action writing: redundant boar description split across two paragraphs (lines 137–139)

**Quote (lines 137–139):**
> `"What is this thing?" Adrian cursed under his breath. It looked like a boar, but meaner, with dark scales plating much of its body and coarse bristles running along its neck. It looked like an armoured living tank.`
>
> `It had the heavy front and brutal low charge of one, with coarse dark bristles running along a neck too thick for grace and a pair of tusks that curved higher than any normal pig had business growing. Its shoulders came nearly to his hip even with the angle of the slope against it, and its small eyes had that flat animal certainty that meant it had already decided what he was for.`

"Coarse bristles running along its neck" appears in line 137. "Coarse dark bristles running along a neck too thick for grace" repeats the same image with minimal variation in line 139. The description is split across two adjacent paragraphs that together constitute a doubled beat — Adrian describes the animal, then the narration re-describes the same animal with overlapping details as though the first pass had not happened. The two-paragraph structure also inserts a description pause in the middle of a combat sequence, slowing momentum at the worst possible moment.

**Rule violated:** AGENTS.md, Hard Bans — "No vague action writing that hides who did what." The repeated bristle detail and the split construction are both symptoms of the same drafting failure: the passage does not know which description is the real one, so it runs both.

**Correction:** Merge the two description paragraphs into one, eliminating the repeated bristle detail. The spoken line "What is this thing?" should remain and can open the merged paragraph. The final description should be lean — one pass, hitting only the details that affect the fight (the scale plating, the tusk height and angle, the eye expression) — then cutting immediately to the next combat beat.

### FLAG 17 — Chapter ending stops at maximum crisis without a landing or forward-pressure beat

**Quote (line 157):**
> "The knife broke."

The chapter ends here. The protagonist is on the ground, has lost his spear down the slope, is grappling with a wounded and enraged scaled boar, and has just had his only remaining weapon fail. There is no subsequent line — no character-filtered beat, no redirect, no forward lean. The chapter simply cuts to black at the worst possible moment with no turn, no personality, and no momentum.

**Rule violated:** AGENTS.md, Hard Bans — "No chapter ending that simply stops instead of landing." Also Chapter Engine — "End on momentum, not on idle reflection." Also PROSE_ANALYSIS.md — "The closing line should feel like the last thing this person would think before moving on — not a thesis sentence for the chapter."

The rule does not require resolution. It requires a landing — something that tells the reader what Adrian's mind does at this precise juncture, even under physical and tactical crisis. A hard cut at maximum disadvantage with no character voice is not a cliffhanger. It is an incomplete sentence.

**Correction:** Add one to three lines after "The knife broke." A correct example of the register: a brief involuntary beat (the physical sensation, the absurdity of the situation) followed by a forward redirect — what does his body do, what does his mind reach for, what is the last thing he registers before the next action? The closing line should carry Adrian's voice and personality even under full crisis. It does not need to resolve the fight. It needs to land.

### FLAG 18 — "What a curious little fella" — mismatched register and malformed dialogue tag (line 121)

**Quote (line 121):**
> `Keiran remained where he was and let the scene continue without him. "What a curious little fella", he mused mildly curious now, as the lone human began shadowing the group through the grass.`

"What a curious little fella" is tonally inconsistent with the deliberate, observational voice Keiran has been given throughout the section. The register is whimsical and colloquial in a way that belongs to a different kind of character. The dialogue tag "he mused mildly curious now" is malformed — "mused" takes a dialogue tag, not an appended adjectival phrase; "mildly curious now" is telling rather than showing, arriving as an author intrusion that explains the emotional state the dialogue should carry itself. The comma placement before the closing quotation mark is also non-standard.

**Rule violated:** AGENTS.md, Dialogue Lock — "Dialogue must be direct, modern, and efficient." Hard Bans — "No archaic dialogue unless a specific character requires it." The "fella" register is not archaic, but it is inconsistent with the character's established voice in the same passage.

**Correction:** The spoken line should either be cut entirely (the secondary POV section works without it — Keiran's interest is already established by his continued observation) or replaced with something that fits his established register. If kept, a simple dry line in his observational voice. The tag "he mused mildly curious now" must be removed and replaced with a clean simple tag ("he said quietly" or "he murmured") or a short action beat. The comma before the closing quotation should follow standard British punctuation rules.

---

## 8. Anti-AI Tell Lock

Note: the following observation addresses a patterning issue across a sustained section rather than a single quotable violation.

The group-observation section (lines 63–103) contains a noticeable density of three-part parallel constructions used as observation beats: "Six of them, maybe seven" framing / "Armed. Human-shaped, at least" / "No matched step, no polished formation, no effort spent looking impressive" / "No reason to assume... No reason to assume... No reason to assume" / "One speaker had a rougher voice... Another clipped... A third spoke more slowly." Five parallel or near-parallel list constructions within forty lines of continuous narration creates a compositional smoothness that conflicts with the Anti-AI Tell Lock's requirement for roughness, surprise, and genuine texture.

The same section contains multiple "That did not X. It did Y." pivot constructions: "That did not tell Adrian who they were, but it did tell him the weapons were real." / "That did not stop him from almost missing them." / "The stalking part of it felt ridiculous, but so did almost everything else that day." These pivot-contrast moves are valid individually. Clustered at this density they become a default rhythm rather than a deliberate device.

**Rule noted:** AGENTS.md, Anti-AI Tell Lock — "Do not default to repeated sentence skeletons across a chapter. Watch especially for recurring negation rhythms, recurring pivot lines, and recurring 'statement then correction' landings used too cleanly." / "Preserve roughness, surprise, bluntness, and strange edges where they fit the character. Real prose can be lopsided. It should not feel evenly machined."

**Correction:** In the group-observation section, vary at least two of the parallel list constructions into non-parallel constructions. Break at least one "That did not X" pivot with a different syntactic approach. The goal is not to eliminate these devices but to prevent them from becoming the section's default mode.

---

## Overall Compliance Score: 5/10

The chapter has genuine strengths. The forensic path-reading sequence, the stalking observation, and the boar combat all carry momentum and character-filtered detail that fit the established voice. The opening transition through the arch is well-handled — the disorientation is physical and specific rather than generic. Several of the spoken lines hit the correct register precisely ("Brilliant. Civilisation. Immediately complicated." is exactly right). The descent and boot-print reading sections show the right instincts: observation grounded in professional habit, judgment without over-explanation.

However, the chapter accumulates a significant number of mechanical violations that together undermine the precision the style requires.

The inner thought formatting errors are a production-level failure. All six instances use markdown asterisks instead of required `<em>` HTML tags, and there are six instances against a ceiling of three — both problems must be fixed before the chapter can be considered draft-ready for publication. The count issue also dilutes the device itself: when inner thoughts appear every few pages, they lose the involuntary punch that makes them work.

The secondary POV section is the weakest passage in the chapter. It lacks scene-break markers on both sides, contains an omniscient slip in the opening description, runs rhythmically flat with no short landing, and closes with a line of speech ("What a curious little fella") that belongs to a different character in a different story. The section has a clear structural purpose and Keiran's observational voice is competently rendered in the middle paragraphs, but the framing errors compromise it on entry and exit.

The chapter ending is a hard rule violation. "The knife broke." as a final line cuts the chapter at maximum crisis with no character voice, no beat of recognition, and no forward pressure. This is not a cliffhanger — it is an incomplete thought. One to three lines are needed after it.

The structural tell thresholds (negation-reveals, one-word beats, parallel stacks) are individually near or at their limits and collectively create a section of the chapter that runs too smooth and too architecturally clean. The diction flag on "I am probably dead" is minor but symptomatic — contractions are the character's spoken register, and the formal construction is a small audible misfire. The boar double-description is a drafting error that needs a clean merge.

**Priority revision order:**
1. Convert all six inner thoughts from `*text*` to `<em>text</em>` — production-blocking
2. Reduce inner thought count to three maximum
3. Add `--` scene break markers before and after the Keiran POV section
4. Fix the chapter ending — add a landing after "The knife broke."
5. Fix the omniscient POV slip in Keiran's description of Adrian
6. Merge the boar double-description into one paragraph
7. Fix the Keiran dialogue line and tag
8. Address the negation-reveal and staccato rhythm flags
9. Fix contractions ("I'm"), prose errors ("resources", "woken"), and the broken inner thought at line 99
