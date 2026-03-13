# Role 5 — The Style Auditor

**Chapter under review:** Chapter 2
**Reference documents:** AGENTS.md, PROSE_ANALYSIS.md
**Scope:** Compliance only. No story quality evaluation.

---

## COMPLIANCE SUMMARY

**Total flags: 18**

| Category | Flag Count |
|---|---|
| Structural Tell Thresholds | 7 |
| Anti-AI Tell Lock | 4 |
| Sentence Rhythm | 2 |
| Paragraph Shape | 1 |
| Diction / Voice Patterns | 2 |
| Hard Bans | 1 |
| Opener Rotation | 1 |

**Heaviest failure cluster: Structural Tell Thresholds**, specifically two-line contrast stacks, negation-reveal constructions, micro-paragraph percussion, and one-word or single-sentence landing beats used too frequently. The chapter is considerably cleaner than Chapter 1 in several categories — the POV lock is solid, the thought pattern sequence is well-executed, and the diction is largely on-register. The dominant failure pattern is a tendency to close units of text with isolated single-sentence paragraphs functioning as landing beats, often at the end of scenes that have not earned the compression. This recurs throughout at a frequency that becomes a structural fingerprint rather than a deliberate tool.

---

## CATEGORY 1: STRUCTURAL TELL THRESHOLDS (AGENTS.md)

### FLAG 1.1 — Two-line contrast stacks (over threshold)

**Rule (AGENTS.md):** Two-line contrast or pivot stacks — max 2 per chapter. If the pair can be one sentence without loss, it should be one sentence.

The chapter contains the following clear instances:

**Instance A:**
> "It never came. He waited for it anyway. Still nothing."

Three short sentences performing a diminishing return beat: expectation confirmed absent, then re-checked, then confirmed again. "He waited for it anyway. Still nothing." is a two-beat contrast stack — the second unit exists only to underline what the first already said. These two sentences can be merged: "He waited for it anyway, and got nothing." The triple-sentence structure here also reads as micro-paragraph percussion (see Flag 1.3).

**Instance B:**
> "Hallucination or not, the room had other problems."

This follows directly after the system text apparition and a two-paragraph response. The sentence stands alone as its own paragraph and functions as a pivot/dismissal landing — the exact two-line contrast shape (system appears / protagonist dismisses it as hallucination-or-not-it-doesn't-matter). It is a functional single-sentence pivot paragraph. As a standalone landing beat it also contributes to the one-sentence paragraph count (see Flag 1.2).

**Instance C:**
> "The chamber gave another low structural groan, and dust shifted towards the ring."
> "He had already been standing still too long."

Two sentences, separate paragraphs, forming a cause-and-effect contrast stack: external pressure / internal decision. The second sentence is a landing beat that can be absorbed into the surrounding reasoning paragraph without loss. It performs a closing mic-drop on the class-selection deliberation that the deliberation paragraph does not need.

**Instance D:**
> "Close enough."

Following the restatement of the Fighter description, this one-word-sentence paragraph is a pure contrast landing — a deliberate undercut of the system's language. It earns its isolation in isolation, but it is the fourth instance of this two-beat pivot pattern in the chapter. Beyond two, the rule applies.

**Correction for Instances C and D:** "He had already been standing still too long" should be folded into the preceding paragraph as a clause. "Close enough" can remain only if one earlier contrast landing is cut or consolidated. Instance B ("Hallucination or not...") is the cleanest candidate for folding into the paragraph above it.

---

### FLAG 1.2 — One-word or micro-sentence paragraph landing beats (over threshold)

**Rule (AGENTS.md):** One-word paragraph landing beats — max 2 per chapter.

The chapter uses the following isolated single-sentence paragraphs as landing beats — not as transitional beats or dialogue lines, but as deliberate closing punches:

1. **"Right."** — After the system text appears. Standalone paragraph.
2. **"If anything, that was worse."** — After the second system message. Standalone paragraph.
3. **"Hallucination or not, the room had other problems."** — After the apparition sequence. Standalone paragraph.
4. **"That felt almost insulting."** — After the Healer description. Standalone paragraph.
5. **"He had already been standing still too long."** — After the class deliberation. Standalone paragraph.
6. **"Close enough."** — After the Fighter description reread. Standalone paragraph.
7. **"He had not."** — Final line of chapter. Standalone paragraph.

That is seven instances. The rule permits two. Even granting that some of these are tonally justified in isolation, the aggregate produces a chapter that punches out of nearly every unit with a compressed landing line. The rhythm becomes predictable: long paragraph → short standalone. The reader begins to anticipate the beat rather than feel it.

**Correction:** Identify the two strongest landing beats and preserve them. The clearest candidates for preservation are "Right." (the best single-word reaction beat in the chapter — it is genuinely funny and economical) and "He had not." (the chapter's closing line, which earns its isolation). The remaining five should be absorbed into the paragraphs above them, recast as subordinate clauses, or simply cut where the preceding content already makes the point.

---

### FLAG 1.3 — Micro-paragraph percussion outside combat (over threshold)

**Rule (AGENTS.md):** More than four consecutive single-sentence paragraphs outside active combat is a revision target.

**Instance A — the body-check sequence:**
> "It never came. He waited for it anyway. Still nothing."
> [next paragraph: "Carefully now..."]

Three consecutive very short units (the two-sentence paragraph "It never came. He waited for it anyway." and then "Still nothing." as a standalone). This is on the edge of the threshold but does not breach four consecutive single-sentence paragraphs.

**Instance B — the corridor discovery sequence:**
> "Somebody had stood in this corridor long after Helix had finished being Helix and marked the place for other people."
>
> "Which meant the people he knew were gone. All of them. His mother included. There was no version of the timeline where she had waited this out and come back to collect him."
>
> "He looked at the mineral staining on the old wall, the way the later plates had weathered differently against it, and chose not to finish the estimate. He had made a living reading age and failure off surfaces. He did not need a number to know the answer would be ruinous."
>
> "The old instinct to conserve movement caught him standing still for half a second, waiting for fatigue and waiting for the price."
>
> "Nothing came."
>
> "He went right, following the colder air and what little emergency light remained."

The sequence "Nothing came." followed by "He went right..." are two consecutive single-sentence paragraphs. The unit as a whole is not a percussion run of more than four consecutive single-sentence paragraphs, but the pattern of short/medium/short creates a staccato that does not reflect the aftermath of a major realisation. This is the moment Adrian processes that everyone he knew is dead. The paragraph shape should expand after this peak, not continue at the same clipped rhythm. This is also a flag under Anti-AI Tell Lock (see Flag 2.3).

**Instance C — the class-selection wind-down:**
> "The chamber gave another low structural groan, and dust shifted towards the ring."
>
> "He had already been standing still too long."
>
> "Adrian stopped in front of the arch and focused on the first option again."

Three single-sentence (or near) paragraphs in succession, closing the deliberation sequence. Not a breach of the four-consecutive rule, but a third location in the chapter where clipped percussion substitutes for aftermath breathing. The pattern is consistent enough across the chapter to constitute a structural habit.

---

### FLAG 1.4 — Negation-reveal constructions (at threshold, approaching violation)

**Rule (AGENTS.md):** Negation-reveal constructions (`Not X. Not Y. The real thing.`) — max 2 per chapter.

**Instance A:**
> "His body just worked. Not gracefully, not with any sudden hidden athlete waiting underneath, but it worked."

Structure: positive claim → negation of two sub-expectations → restatement. This is the cleanest negation-reveal in the chapter and the most justified. It earns its form.

**Instance B:**
> "It was not pain, not in any ordinary sense. Pain he understood. This felt more like being assembled under protest."

Structure: negation of category → positive restatement. A second negation-reveal. Justified and effective.

**Instance C:**
> "Something inside him had taken shape that had not been there before, or perhaps had always been possible and simply arrived too late for any useful explanation."

Soft negation-reveal: the positive claim is partially negated by the "or perhaps" revision. This is not a strict not-X/not-Y construction but it performs the same rhetorical function — stating a thing, denying it, landing on a qualified alternative. At two explicit instances already, this soft third instance puts the chapter at threshold.

The chapter is at the boundary of the rule. No revision is technically required for the current count, but any future draft addition of a negation-reveal construction will breach the threshold.

---

### FLAG 1.5 — Rule of three (completeness lists)

**Rule (AGENTS.md):** Do not default to the rule of three. Lists should have the number of items the thought actually requires, not the number that sounds polished.

**Instance A:**
> "Cold metal. Dead dust. A stale, shut-in smell underneath..."

Three items in the smell inventory. The first two ("Cold metal. Dead dust.") are sharp and specific. The third ("A stale, shut-in smell underneath, the sort rooms got after being sealed too long and opened too rarely") is elaborated rather than equal — which partially saves it. However, this is also the second appearance of "cold metal" as a smell descriptor in three paragraphs (the opening paragraph already has "tasted of cold metal, dust"), making the inventory feel like padding toward three rather than observation.

**Instance B:**
> "No explanation of who was offering the choices. No recommended option. No note for the recently thawed."

Three parallel negations. The list exists to give the system's silence three beats of dryness. The third item ("No note for the recently thawed") is the sharpest and funniest. The first two exist to set it up, which is a classic rule-of-three move: two straight beats, one turn. This works comedically, but it is a three-for-polish construction. The second item ("No recommended option") could be cut: the absence of recommendation is already implied by the absence of explanation. Two items, sharper.

**Instance C:**
> "Strength was force. Agility was speed and coordination. Endurance was toughness or recovery, probably both. Sense was perception unless the system had chosen a very stupid synonym for something mystical. Will was harder."

Five items parsed one at a time. This is not a rule-of-three violation — it is an analytical run through six stats, which is appropriate. However, the parsing of the first three items ("Strength was force. Agility was speed and coordination. Endurance was toughness or recovery...") produces three consecutive subject-verb-noun sentences of identical skeleton. This is a parallel stack issue (see Flag 1.6).

**Correction for Instance B:** Cut "No recommended option." Run as: "No explanation of who was offering the choices. No note for the recently thawed." Two beats. Sharper.

---

### FLAG 1.6 — Parallel stacking / tri-line blocks

**Rule (AGENTS.md):** More than three clearly similar vertical stacks in one chapter is a revision target.

**Instance A — stat parsing (subject-verb-complement):**
> "Strength was force. Agility was speed and coordination. Endurance was toughness or recovery, probably both. Sense was perception..."

Four consecutive "X was Y" sentences. The skeleton is identical across all four. This is a parallel stack. The analytical voice should vary the approach within the same reasoning block — deduction, then comparison, then question — rather than mechanically parsing each item in the same grammatical form.

**Instance B — class description recap (sentence-per-quality):**
> "Physical reinforcement meant body first. Close combat meant no pretending distance solved everything. Weapon familiarity sounded broad rather than precious, which helped."

Three consecutive "X meant/sounded Y" sentences parsing the Fighter description point by point. This is a lighter parallel stack — the third sentence breaks the "meant" pattern — but the point-by-point parsing skeleton is identical.

**Instance C — the corridor scan:**
> "Ceiling compromised at the far end. One exit still looked intact. No obvious cameras. No movement."

Four clipped scan items in parallel. This is in a pressure-adjacent context (post-system-appearance threat assessment), which somewhat justifies the compression. However it sits outside active combat, and "No obvious cameras. No movement." is a pair of negation sentences that stack parallel negations.

**Instance D — the Ranger reasoning:**
> "Roads, routes, bad ground, finding the line through a problem instead of taking it head-on..."
> "...adjustment, efficiency, careful movement, and getting very good at making do with less."

Two parallel lists in the same paragraph, each building a life-stage picture. Each list is internally varied, so neither triggers the rule alone. Together, in a paragraph already performing thesis-antithesis-synthesis reasoning (see Flag 1.7), they reinforce the compositional neatness problem.

Four identifiable parallel stacks. The rule flags at more than three. The stat-parsing block (Instance A) is the revision priority.

**Correction for Instance A:** Break the "X was Y" series after two items. The third stat should arrive via a comparative inference rather than a direct equation: something like "Endurance probably covered toughness and recovery both, which put it closer to a damage floor than a damage ceiling — useful." The analytical voice reasons through, it does not define and move on.

---

### FLAG 1.7 — Thesis-antithesis-synthesis in internal reasoning

**Rule (AGENTS.md):** Do not let internal reasoning turn into thesis-antithesis-synthesis essays. The logic should feel lived-in, biased, partial, and in motion.

**Instance — class selection deliberation:**
> "Ranger was the clever choice. He knew that at once, which was part of the problem. It fit roads, scanning, uncertain ground, and the old version of himself who had made sense of broken sites for money and bad coffee. It also sounded too much like the life he had already been forced into at the end: adjustment, efficiency, careful movement, and getting very good at making do with less. He had already spent enough of one life adapting gracefully to smaller options."
>
> "Caster sounded worse. It was abstract and indirect, something built on understanding rules he did not know yet while staying away from whatever tried to kill him. Healer was not happening. Stability had had its turn. Stability had been doctors, handrails, reduced hours, and very sensible language about realistic outcomes."
>
> "Fighter, on the other hand, was blunt enough to be almost stupid, which was exactly what he liked about it."

Structure: Ranger established as the smart choice (thesis) → Ranger rejected for personal-history reasons → Caster dismissed → Healer dismissed → Fighter chosen because it is blunt and refuses cleverness (synthesis). This is clean dialectical reasoning. Each class gets its moment; the wrong options are retired in logical order; the chosen option is reached by elimination with an emotional rationale at the end.

The problem is not the conclusion but the architecture. The paragraph breaks follow the logical structure so cleanly that the text reads as an internal essay rather than a mind arguing with itself. Adrian's reasoning is biased and personal — the Healer rejection ("Stability had had its turn") is genuinely sharp and character-filtered — but the sequencing is too orderly. A partial, biased mind does not evaluate options in turn from most plausible to least. It doubles back. It catches itself. It makes a decision and then second-guesses it once.

**Correction:** Introduce one self-correction move or loop-back inside the reasoning block. Adrian could move toward Ranger, provisionally accept it, then catch himself and revise — rather than dismissing it cleanly and moving on. The anti-clever rationale for Fighter is the right landing; the path to it is too composed.

---

## CATEGORY 2: ANTI-AI TELL LOCK (AGENTS.md)

### FLAG 2.1 — Steady stream of polished landing lines

**Rule (AGENTS.md):** Do not keep writing polished emotional landing lines just because they sound good. One or two sharp landings are craft. A steady stream of them is a tell.

In addition to the isolated paragraph beats catalogued under Flag 1.2, the chapter produces polished closing lines at the end of most major scene units even where the closing sentence is not isolated into its own paragraph:

- "He had to look away before he did something embarrassing, like start thanking a room." (closes the body-check sequence)
- "The whole room suddenly reminded him of a cupboard at the end of the world." (closes the lid-opening)
- "Somebody had needed the corridor to stay standing. Nobody had spent a second caring what it looked like afterwards." (closes the corridor description)
- "He had made a living reading age and failure off surfaces. He did not need a number to know the answer would be ruinous." (closes the timeline realisation)
- "It was hard not to read the whole thing like a game screen." (opens the stat-analysis paragraph with a self-aware winking line)

Each of these is individually well-crafted. Collectively they indicate a writing mode in which the author is driving every unit toward a closing formulation rather than letting units arrive where they arrive. The chapter does not have paragraphs that simply end because the observation is complete — nearly every unit ends on something quotable.

**Correction:** At minimum two of the above should be revised to end in the middle of a thought or to transition forward rather than closing down. "He had made a living reading age and failure off surfaces. He did not need a number to know the answer would be ruinous." is the strongest candidate for cut: the preceding realisation (everyone is gone, his mother is gone) does not need the professional-competence callback to land. It lands harder without it.

---

### FLAG 2.2 — Paragraphs that could belong to a different book

**Rule (AGENTS.md):** The narration must sound like one particular mind, not like competent-prose-in-general. Flag any paragraph that could belong to a different book without adjustment.

**Instance:**
> "The corridor beyond had once matched the chamber: white walls, inset lights, rounded corners, and corporate money trying to look like mercy. Time had not been interested. One wall had split at some point and been repaired with materials that definitely did not come from Helix. Dark fitted plates, almost stone but not quite, had been pinned over the old breach with ribbed black bands. The work was ugly in the competent way emergency repairs usually were. Somebody had needed the corridor to stay standing. Nobody had spent a second caring what it looked like afterwards."

This paragraph is technically competent and well-observed. "Corporate money trying to look like mercy" is a strong phrase. But the paragraph could slot into any post-apocalyptic or bunker-fiction novel without adjustment. The environment description is not filtered through Adrian's specific professional competence — a structural surveyor with years of reading age and failure off surfaces should have a more pointed, technical response to emergency repair work than "ugly in the competent way." What type of plates? What does the ribbed-band fixing tell him about the load? How long ago was this done relative to the Helix infrastructure? This is exactly the kind of surface Adrian established he can read. The narration defaults to generic atmospheric observation instead.

**Correction:** Replace "The work was ugly in the competent way emergency repairs usually were" with something Adrian would actually notice and interpret. The materials, the fixing method, or the weathering differential should tell him something specific — even if what it tells him is uncertain.

---

### FLAG 2.3 — Aftermath rhythm unchanged after pressure peak

**Rule (AGENTS.md):** After pressure scenes, widen back out. The aftermath should breathe differently from the peak tension.

The corridor sequence immediately following Adrian's realisation that everyone he knew is dead ("Which meant the people he knew were gone. All of them. His mother included.") continues at the same clipped paragraph rhythm as the approach. The realisation arrives in a short paragraph, is followed by one analytical paragraph, then moves directly to "Nothing came. / He went right..." — both single-sentence paragraphs — and into the corridor slope description with no change in rhythm or paragraph shape.

This is the chapter's single highest-pressure non-physical moment. The prose should expand after it. Instead, the paragraph shape tightens further — "Nothing came" and "He went right" are the shortest units in the surrounding section — and then the chapter moves forward as if the realisation were equivalent in weight to noticing the floor slope. The rule requires the aftermath to breathe differently.

**Rule source:** AGENTS.md Anti-AI Tell Lock ("After pressure scenes, widen back out") and PROSE_ANALYSIS.md ("After a pressure peak, paragraphs lengthen").

**Correction:** Expand the paragraph that follows "He did not need a number to know the answer would be ruinous." into at least a three-sentence unit that stays with the realisation before moving forward. "Nothing came" and "He went right" can remain, but they should arrive after a wider passage, not immediately after the single analytical beat.

---

### FLAG 2.4 — Detail that feels generically evocative rather than character-specific

**Rule (AGENTS.md):** Details should arrive because the current POV character would notice them, care about them, compare them, or judge them. Flag any detail that feels generically evocative rather than specific to this character's priorities.

**Instance:**
> "The whole room suddenly reminded him of a cupboard at the end of the world."

This simile is atmospheric and evocative, but it does not feel like a structural surveyor's first-reaching comparison. A man who has spent years reading buildings and broken infrastructure does not default to a mythic/literary figure (cupboard at the end of the world) as his first associative register. He reaches for functional comparisons — spaces he has been in, structural analogies, site-type classifications. This reads as an author's simile rather than the character's. It is also the only instance of this register in the chapter, which makes it more conspicuous, not less.

**Correction:** Replace with a comparison that fits Adrian's professional and personal frame of reference. Something from site work, from the kind of sealed spaces he has actually been in. The emotional weight of "end of the world" can be preserved through the specific comparison rather than the mythic label.

---

## CATEGORY 3: SENTENCE RHYTHM (PROSE_ANALYSIS.md)

### FLAG 3.1 — Consecutive short sentences outside pressure exchange

**Rule (PROSE_ANALYSIS.md):** Flag any stretch of three or more consecutive sentences all short (under 10 words) outside a pressure exchange.

**Instance A — corridor scan:**
> "Ceiling compromised at the far end. One exit still looked intact. No obvious cameras. No movement."

Four consecutive sentences, each under 10 words, outside active combat. This is a tactical scan delivered in clipped notation — the compression is character-justified (Adrian is cataloguing quickly), but the sequence sits outside any active pressure exchange. The chapter has not yet established the arch as a threat at this point. This is still exploratory movement.

**Instance B — body-check sequence:**
> "It never came. He waited for it anyway. Still nothing."

Three consecutive sentences each under 10 words, with the third functioning as its own paragraph. Outside pressure context (the chamber is quiet, there is no immediate threat at this moment). The sequence performs emotional weight through compression, but the rule applies regardless of emotional register.

**Correction for Instance A:** Expand one of the scan items into a fuller observation. "One exit still looked intact" could carry an inference: intact by what measure, and what did that imply? The clipped notation can remain for two items; the third should expand.

---

### FLAG 3.2 — Long analytical sentence during physical action beat

**Rule (PROSE_ANALYSIS.md):** Long analytical sentences (40+ words) should appear only during reasoning and exposition, not during action.

**Instance:**
> "He had spent years learning the rhythms of a failing body, the hesitation, the drag, the practical little betrayals. This was something else entirely, a new pulse catching somewhere deep and hidden and pulling the rest of him into line behind it."

The second sentence (30 words) is borderline. The flag is not on this sentence but on the paragraph that precedes the class-acceptance physical event:

> "Pressure, sudden and structural, drew inward beneath his sternum hard enough to fold him half forward. Heat flashed through his ribs, down his spine, and out into his limbs. He dropped to one knee on the cracked plate with the metal bar clattering from his hand. It was not pain, not in any ordinary sense. Pain he understood. This felt more like being assembled under protest."

The paragraph is action — physical event, physical response. The sentences are appropriately short-to-medium. This is clean and not flagged.

The flagged instance occurs in the stat-analysis block:

> "He read it twice, then a third time more slowly, because if a system insisted on dropping a status sheet in front of him with no manual attached, he could at least try to mug the paperwork."

This is 42 words. It is reasoning/exposition, which is the correct register for a long sentence. Not flagged.

The actual rhythm flag is in the stat-parsing run:

> "Strength was force. Agility was speed and coordination. Endurance was toughness or recovery, probably both. Sense was perception unless the system had chosen a very stupid synonym for something mystical. Will was harder. Discipline, maybe, or pain tolerance, or some form of control. It sat highest beside Strength and Endurance, which he chose to treat as flattering until evidence said otherwise."

This analytical block contains five sentences under 12 words followed by one 20-word sentence, with no long analytical sentence building the reasoning before the short cutoff. The rhythm pattern calls for medium → longer analytical → short cutoff. Here the entire block is short-to-medium with no long sentence anchoring the reasoning. The analysis feels rushed rather than thorough. The "Will was harder" payoff is earned, but there is no analytical sentence building toward it.

**Correction:** Expand one of the stat-parsing sentences into a 30-40 word analytical form that shows the deductive step rather than just stating the conclusion. The Will entry is the natural candidate: why is Will harder to read? What does its position relative to Strength and Endurance imply about the system's structure?

---

## CATEGORY 4: PARAGRAPH SHAPE (PROSE_ANALYSIS.md)

### FLAG 4.1 — Clipped paragraph shape continuing into aftermath of emotional peak

**Rule (PROSE_ANALYSIS.md):** After a pressure peak, paragraphs lengthen. If the clipped rhythm continues unchanged after resolved tension, flag it.

(This flag overlaps with Anti-AI Tell Lock Flag 2.3 and is recorded here separately for completeness.)

The section immediately following the highest emotional moment in the chapter — the realisation that all known people, including Adrian's mother, are dead — consists of:

1. One 4-sentence paragraph (the timeline realisation).
2. One sentence: "The old instinct to conserve movement caught him standing still for half a second, waiting for fatigue and waiting for the price."
3. One sentence: "Nothing came."
4. One sentence: "He went right, following the colder air and what little emergency light remained."

The paragraph shape does not lengthen after this peak. Units 2, 3, and 4 are single sentences, each shorter than the one before. The pressure rhythm has not resolved — it has been bypassed. The chapter moves directly from the highest emotional beat to forward momentum without a widening passage.

**Correction:** After "He did not need a number to know the answer would be ruinous," insert a passage of at least three sentences that stays inside the moment — not lingering sentimentally, but not immediately cutting to movement either. The character's instinct to conserve movement can still be the beat that ends the pause, but it needs more space before it.

---

## CATEGORY 5: DICTION AND VOICE PATTERNS (AGENTS.md / PROSE_ANALYSIS.md)

### FLAG 5.1 — Self-correction move absent from extended analytical passages

**Rule (PROSE_ANALYSIS.md):** The self-correction move must appear in analytical voice. Absence across extended reasoning passages is a flag.

The class-selection deliberation (the chapter's longest analytical passage — approximately 400 words across multiple paragraphs) contains no self-correction move. Adrian moves through Ranger → Caster → Healer → Fighter with settled, declarative reasoning. He does not catch himself mid-inference, revise a claim, or undercut a statement with a sharper restatement. The entire analysis is resolved and uninterrupted.

Separately, the stat-analysis block also contains no self-correction. Every stat is parsed in one step without revision.

The self-correction move is defined in PROSE_ANALYSIS.md as a primary marker of the analytical voice — it keeps reasoning feeling like a mind in motion rather than a composed narrator. Its complete absence from the chapter's two longest analytical passages removes a core texture of the style.

**Correction:** Insert at least one self-correction in the class-selection block and one in the stat-analysis block. The Ranger passage is the natural location for the first: Adrian should start to accept it, then catch himself. Something on the order of: "It was the clever choice. Or rather, it was the choice that would have been clever for the version of himself that had something to be cautious about." For the stat-analysis, Will is the natural location for revision: the first interpretation should be offered and then questioned.

---

### FLAG 5.2 — Casual intensifier drought

**Rule (AGENTS.md / PROSE_ANALYSIS.md):** Casual intensifiers (pretty, damn, hell, bloody, honestly, really, kind of) should appear in proportion to the reference style. Flag their total absence across a scene.

The chapter contains no casual intensifiers in narration. The entire chapter — including the extended analytical passages and the aftermath of the class selection — is written without a single "pretty," "damn," "hell," "bloody," "honestly," "really," or "kind of" in the narrative voice. The dialogue contributes "terrible" ("terrible timing") but no casual intensifier.

The reference style uses these as part of the POV character's casual, analytical register. Their complete absence from a chapter of this length (approximately 3,800 words) creates narration that reads as more formal and composed than the style requires — particularly during the class-selection reasoning, where the character is making a personal, somewhat defiant choice that should carry some informal register.

**Correction:** Add two or three casual intensifiers in the analytical sections. The Fighter rationale is the natural location: "blunt enough to be almost stupid" could become "blunt enough to be pretty much stupid." The stat-analysis would also benefit from one honest/really in the Will entry.

---

## CATEGORY 6: HARD BANS (AGENTS.md)

### FLAG 6.1 — Exposition with no present-scene trigger

**Rule (AGENTS.md):** No exposition with no present-scene trigger.

**Instance:**
> "He had chosen cryostasis on the assumption that, if the impossible happened, he would wake into better medicine. The possibility of waking into jurisdiction had not made the brochure."

This is backstory exposition delivered as a two-sentence standalone paragraph. The trigger for this exposition is the system's second message ("Initial class selection required"), but the information delivered — that Adrian entered cryostasis hoping for better medicine — goes beyond what the trigger demands. The system message requires a response. Instead the paragraph delivers an internal summary of Adrian's pre-sleep reasoning, which is backstory rather than present-scene interpretation.

The second sentence ("The possibility of waking into jurisdiction had not made the brochure") is a wry observation on the present situation, which is appropriate. The first sentence is historical context delivered without interrogation of the present scene. Adrian does not need to recall why he entered cryostasis in response to seeing a class-selection prompt — the recall does not bear on the immediate decision. It is backstory serving the author's need to remind the reader of context, not the character's present cognitive need.

**Correction:** Cut the first sentence. "The possibility of waking into jurisdiction had not made the brochure" is the only sentence doing present-scene work. Starting the paragraph there tightens the response and removes the bare exposition.

---

## CATEGORY 7: OPENER ROTATION (PROSE_ANALYSIS.md)

### FLAG 7.1 — Pivot-word openers sparse across reasoning passages

**Rule (PROSE_ANALYSIS.md):** Pivot words (Still, Of course, Granted, Admittedly, In fact, On that note, To be clear, Naturally, Evidently) should not be absent for more than four consecutive paragraphs of reasoning.

The chapter contains the following pivot-word openers in narration:

- "Still nothing." — a pivot word used as a standalone sentence rather than an opener.
- No "Granted," "Admittedly," "Of course," "In fact," "To be clear," or "Evidently" openers appear in the narration.

The class-selection deliberation (paragraphs beginning "Ranger was the clever choice..." through "Fighter, on the other hand...") runs for six consecutive reasoning paragraphs with no pivot-word opener. All six paragraphs open either subject-first or with a subject-name. This is the longest analytical passage in the chapter and it has no analytical pivot connectives, which removes the stitching texture that makes the analytical voice feel like live reasoning rather than composed prose.

This is an improvement over Chapter 1 (where the same absence was flagged across the entire chapter), but the six-paragraph reasoning run without a single pivot opener still violates the four-consecutive rule.

**Correction:** Add at least one pivot-word opener inside the class-selection reasoning block. "Granted, Ranger was the clever choice" or "Admittedly, it fit roads and uncertain ground..." Both immediately naturalise the analytical voice and signal that the reasoning is aware of its own biases.

---

## OVERALL COMPLIANCE SCORE: 6 / 10

Chapter 2 is a stronger chapter than Chapter 1 on several dimensions: the POV lock is clean throughout (no sentences that report what Adrian cannot observe or infer), the thought pattern sequence is well-executed across the class-selection deliberation, the diction is largely on-register, and there is no duplicate paragraph or editorial artefact. The system-text integration is handled efficiently without purple-prose escalation.

The dominant failure pattern is **landing-line saturation combined with persistent clipped rhythm that does not widen after emotional peaks.** The chapter produces a mini-conclusion at the end of nearly every unit — isolated single-sentence paragraphs, two-line contrast stacks, or polished closing formulations — at a frequency that overrides their individual force. By the seventh isolated paragraph beat, the reader has learned to expect the compression and the beats stop landing. This is the structural fingerprint of prose that has been built top-down (unit → landing → next unit) rather than discovered from inside the character's experience. The missing self-correction moves and casual intensifiers compound this: the narration sounds more composed and authorially controlled than the target voice requires. The target voice is a specific, biased, partially-self-aware mind that catches itself and revises; this chapter's voice is a well-managed analytical register that arrives at conclusions without revision. Fixing the landing-line saturation (Flag 1.2), inserting self-correction in the two analytical blocks (Flag 5.1), and expanding the aftermath of the dead-mother realisation (Flag 4.1 / Flag 2.3) are the three highest-priority revisions.
