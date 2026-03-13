# Chapter 2 — Review Synthesis

All six roles completed. Items below are deduplicated, grouped by type, and ordered by implementation sequence: **hard bans → story logic → structure → AI tells + style → line fixes → engagement → The One Question**.

---

## 1. HARD BANS

### 1.1 Exposition with no present-scene trigger
- **Source:** Role 5 (Style Auditor), Role 1 (Lector)
- **Quote:** *"He had chosen cryostasis on the assumption that, if the impossible happened, he would wake into better medicine. The possibility of waking into jurisdiction had not made the brochure."*
- **Issue:** The first sentence is backstory dropped in response to the system prompt. It does not bear on the present decision. The second sentence does the real work.
- **Fix:** Cut the first sentence. Start: *"The possibility of waking into jurisdiction had not made the brochure."*
- [ ]

---

## 2. STORY LOGIC

### 2.1 Mother's death: emotional weight not proportionate to relationship established *(CRITICAL)*
- **Source:** Role 6 (Story Analyst)
- **Quote:** *"Which meant the people he knew were gone. All of them. His mother included. There was no version of the timeline where she had waited this out and come back to collect him. [...] He looked at the mineral staining on the old wall [...] and chose not to finish the estimate."*
- **Issue:** Chapter 1 builds the mother relationship as the most sustained emotional fact in the chapter. The transition from recognition to closure happens in one sentence. "Chose not to finish the estimate" is doing all the emotional work by itself — it is not enough. One beat of actual confrontation is missing before Adrian closes it. Not grief, not sentiment: something in his register that acknowledges the scale before he shuts it.
- **Fix:** After *"He did not need a number to know the answer would be ruinous"*, add a single short passage (2–3 sentences) that stays with the realisation before *"Nothing came"* and the forward move. The closing beat can remain identical.
- [ ]

### 2.2 Class-selection reasoning: cognitive composure not earned by the situation *(CRITICAL)*
- **Source:** Role 6 (Story Analyst), Role 2 (Royal Road Reader), Role 1 (Lector)
- **Quote:** *"Ranger was the clever choice. He knew that at once, which was part of the problem. [...] Caster sounded worse. [...] Healer was not happening. [...] Fighter, on the other hand, was blunt enough to be almost stupid, which was exactly what he liked about it."*
- **Issue:** This is a composed, four-way comparative analysis of personal history and temperament, arrived at by careful elimination. The situation is: fifteen minutes awake, everyone probably dead, barefoot in a structurally unstable space. The conclusions are right for this character. The form — unhurried, fully resolved, psychologically reflective — is not. The Royal Road Reader also flags it: Adrian is usually quicker, more reactive. The Reader wanted him to pick Fighter on impulse with a flash of recognition, not deliberation.
- **Fix:** Shorten and roughen the reasoning. The Ranger section should be the emotional one (it is) but shorter. Caster and Healer can be single sentences. The Fighter choice should feel driven and slightly impulsive — a recognition more than a conclusion. The emotional logic is right; the analytical polish needs to come down.
- [ ]

### 2.3 System text appearance: composure arrives before any genuine destabilisation
- **Source:** Role 6 (Story Analyst), Role 2 (Royal Road Reader)
- **Quote:** *"He shut his eyes. The text stayed. He opened them again and took one careful breath. Right."*
- **Issue:** Text appearing inside his vision is perceptual, not physiological. A man who nearly cried at motor function returning should have one moment of real wrongness before the hypothesis forms. As written, he test-closes-eyes and reframes in one beat, which is too smooth given where he is.
- **Fix:** One additional sentence of genuine alarm or disorientation before "Right." The recovery can still be fast; it just needs to land before it happens.
- [ ]

---

## 3. STRUCTURAL

### 3.1 Class selection sequence too long by approximately one-third
- **Source:** Role 1 (Lector), Role 2 (Royal Road Reader), Role 4 (Writing Professional), Role 5 (Style Auditor)
- **Quote:** *[The full Ranger-through-Fighter deliberation — approximately 20 paragraphs from first prompt to confirmation]*
- **Issue:** Ranger is rejected twice (once for being clever, once for resembling his old adaptive life — these overlap). The Fighter justification restates what each prior class lacked. The environment warning (*[Environment unstable]* appears mid-sequence and the deliberation continues for several more paragraphs. The Royal Road Reader was skimming by the third option. The Writing Professional puts the sequence at ~700 words and calls it too long given the active environmental threat.
- **Fix:** Collapse Ranger to one rejection pass (the personal-history angle — keep it). Caster and Healer to single sentences each. Cut the Fighter justification's restatement of the other classes. The emotional logic (Fighter = body that finally answers, after a life of bodily adaptation) is established early; it does not need three passes.
- [ ]

### 3.2 Metatextual intrusions inconsistent with established character
- **Source:** Role 1 (Lector), Role 4 (Writing Professional)
- **Quote (A):** *"More likely it was a universal starter spread: direct combatant, mobile scout, ranged or arcane specialist, support."*
- **Quote (B):** *"Whatever this world used instead of mana while pretending it had invented a more serious name for the same idea."*
- **Quote (C):** *"It was hard not to read the whole thing like a game screen. The difference was that games usually did the decent thing and came with a tutorial..."*
- **Issue:** All three assume Adrian has genre-familiarity with system/game idiom. He is an infrastructure engineer from the near future. There is no established basis for the gaming analogy. The Lector calls them the chapter's most significant tonal register failure — they flatten the strangeness of the situation and wink at the reader over the character's head.
- **Fix (A):** Replace "universal starter spread" with something Adrian would actually think: *"More likely it was a standard intake spread — four directions, no overlap."*
- **Fix (B):** Replace mana reference: *"Whatever this world used instead — energy, fuel, something the system treated as fundamental and expected him to recognise."*
- **Fix (C):** Replace game screen analogy: *"It was hard not to read the whole thing like a schematic — something that looked legible and turned out to require knowledge he did not yet have."*
- [ ]

### 3.3 Chapter front-loaded: momentum stalls before the best closing beat
- **Source:** Role 1 (Lector), Role 2 (Royal Road Reader)
- **Issue:** The waking sequence and body discovery are the strongest material. The corridor, arch, and class selection progressively slow pace. *"Trait: Empty"* is the chapter's best closing beat but arrives after reader attention has been worn down. The fix is not restructuring but cutting accumulated fat in the middle third (items 3.1, 3.4, 3.5 below).
- **Fix:** Addressed by the cuts in 3.1, 3.4, and 3.5. No separate action needed if those are applied.
- [ ]

### 3.4 Arch description over-explained
- **Source:** Role 1 (Lector), Role 4 (Writing Professional)
- **Quote:** *"Whoever built it had expected maintenance from the inside while it was active. You only specified that when shutting the thing down would have been catastrophically inconvenient."*
- **Issue:** Adrian reaches the engineering inference and then explains it. The explanation is for the reader; the image already implies it.
- **Fix:** Cut at *"just practical access points sized for a person."* The implication is present without the gloss.
- [ ]

### 3.5 Corridor description over-explained at close
- **Source:** Role 1 (Lector), Role 5 (Style Auditor)
- **Quote:** *"The work was ugly in the competent way emergency repairs usually were. Somebody had needed the corridor to stay standing. Nobody had spent a second caring what it looked like afterwards."*
- **Issue:** "Ugly in the competent way emergency repairs usually were" already contains the idea. The two follow-up sentences repeat it.
- **Fix:** End at *"The work was ugly in the competent way emergency repairs usually were."*
- [ ]

### 3.6 Pulse continuity error
- **Source:** Role 1 (Lector)
- **Quote:** *"He had no idea what Pulse was yet, though the fact it appeared in both a class description and the status framework at least narrowed it down."*
- **Issue:** At the point Adrian reads the Caster description, no status framework has appeared yet. It arrives after class selection. This is a factual error.
- **Fix:** *"He had no idea what Pulse was yet, though its appearance in the class description confirmed it was something real in the system rather than decorative terminology."*
- [ ]

---

## 4. AI TELLS + STYLE

### 4.1 Landing-line saturation: seven isolated single-sentence paragraph beats (max 2 allowed)
- **Source:** Role 5 (Style Auditor), Role 3 (AI Detector)
- **Instances:** *"Right."* / *"If anything, that was worse."* / *"Hallucination or not, the room had other problems."* / *"That felt almost insulting."* / *"He had already been standing still too long."* / *"Close enough."* / *"He had not."*
- **Issue:** Seven isolated landing beats. The rule permits two. The rhythm becomes predictable — long paragraph → short standalone — and the beats stop landing individually. The chapter drives every unit toward a closing formulation.
- **Fix:** Keep *"Right."* (the best single-word beat) and *"He had not."* (the chapter closing — earns its isolation). The remaining five should be absorbed into the surrounding paragraphs as subordinate clauses or simply cut where the preceding content already makes the point.
- [ ]

### 4.2 Two-line contrast stacks over threshold (4 instances, max 2)
- **Source:** Role 5 (Style Auditor)
- **Instance A:** *"It never came. He waited for it anyway. Still nothing."*
- **Instance B:** *"Hallucination or not, the room had other problems."* (standalone pivot paragraph)
- **Instance C:** *"The chamber gave another low structural groan..." / "He had already been standing still too long."* (two paragraphs, cause-effect stack)
- **Instance D:** *"Close enough."* (fourth instance)
- **Fix:** If *"Right."* and *"He had not."* are kept per 4.1, then *"If anything, that was worse."* and *"Hallucination or not..."* are the cleanest candidates for folding into adjacent paragraphs. *"He had already been standing still too long"* should become a clause within the preceding paragraph. *"Close enough"* can stay only once two others are consolidated.
- [ ]

### 4.3 Thesis-antithesis-synthesis architecture in class selection
- **Source:** Role 5 (Style Auditor), Role 3 (AI Detector)
- **Quote:** *[The four-class evaluation — each class evaluated, critiqued, dismissed in logical order, Fighter confirmed via emotional rationale]*
- **Issue:** Each class gets the same word count, the same logic arc, the same dismissal mechanism. It is too clean. A partial, biased mind does not evaluate options in symmetrical turn. The reasoning should feel lived-in rather than composed.
- **Fix:** Introduce one self-correction or loop-back in the reasoning. Adrian could provisionally accept Ranger, then catch himself revising rather than dismissing cleanly. The anti-clever rationale for Fighter is right; the path should have one false start.
- [ ]

### 4.4 Self-correction move absent from both major analytical passages
- **Source:** Role 5 (Style Auditor)
- **Issue:** The class-selection deliberation (~400 words) contains no self-correction. The stat-analysis block contains no self-correction. Both are resolved and uninterrupted. PROSE_ANALYSIS.md defines the self-correction move as a primary marker of the analytical voice — its complete absence from the two longest analytical passages removes the "mind in motion" texture.
- **Fix (class selection):** See 4.3 above — insert one false start toward Ranger. Or: *"Ranger was the clever choice. The clever choice for the old version of himself, anyway."*
- **Fix (stat analysis):** The Will entry is the natural location for a revision. First interpretation offered, then questioned.
- [ ]

### 4.5 Casual intensifier drought
- **Source:** Role 5 (Style Auditor)
- **Issue:** Zero casual intensifiers (pretty, damn, hell, bloody, honestly, really, kind of) in narration across ~3,800 words. The reference style uses these as part of the POV character's informal analytical register. Their absence makes the narration more formal and composed than the target voice.
- **Fix:** Add two or three in the analytical sections. The Fighter rationale and Will entry are natural locations.
- [ ]

### 4.6 Aftermath rhythm unchanged after highest emotional peak
- **Source:** Role 5 (Style Auditor), Role 6 (Story Analyst)
- **Quote:** *[Paragraph after mother realisation: "The old instinct to conserve movement..." → "Nothing came." → "He went right..."]*
- **Issue:** The mother realisation is the chapter's highest emotional beat. The paragraph shape after it does not widen — units 2, 3, 4 are single sentences, each shorter than the one before. PROSE_ANALYSIS.md: after a pressure peak, paragraphs lengthen. Here the rhythm tightens further and moves directly forward. (See also 2.1 above.)
- **Fix:** Addressed by 2.1. The widening passage required there will resolve the rhythm problem simultaneously.
- [ ]

### 4.7 Parallel stacking: stat-parsing "X was Y" × 4
- **Source:** Role 5 (Style Auditor), Role 3 (AI Detector)
- **Quote:** *"Strength was force. Agility was speed and coordination. Endurance was toughness or recovery, probably both. Sense was perception unless the system had chosen a very stupid synonym for something mystical."*
- **Issue:** Four consecutive "X was Y" sentences of identical skeleton. The analytical voice should reason through rather than define and move on.
- **Fix:** Break the parallel after two items. The third stat should arrive via comparative inference: *"Endurance probably covered toughness and recovery both — a damage floor more than a ceiling."* The fourth can be direct again.
- [ ]

### 4.8 Pivot-word openers absent from 6-paragraph class-selection reasoning block
- **Source:** Role 5 (Style Auditor)
- **Issue:** The class-selection reasoning runs six consecutive paragraphs with no pivot-word opener (Still, Granted, Admittedly, Of course, In fact). All open subject-first. PROSE_ANALYSIS.md: pivot words are the connective tissue of the analytical voice. Their absence makes the reasoning feel composed rather than live.
- **Fix:** Add one pivot opener in the block. *"Granted, Ranger was the clever choice"* or *"Admittedly, it fit the old version of himself..."* Either naturalises the analytical voice immediately.
- [ ]

### 4.9 Rule of three: two instances of lists-for-completeness
- **Source:** Role 5 (Style Auditor), Role 3 (AI Detector)
- **Quote (A):** *"No explanation of who was offering the choices. No recommended option. No note for the recently thawed."*
- **Quote (B):** *"Cold metal. Dead dust. A stale, shut-in smell underneath..."* (also echoes opening paragraph's "cold metal" from two paragraphs prior)
- **Fix (A):** Cut the middle item: *"No explanation of who was offering the choices. No note for the recently thawed."* Two beats, sharper.
- **Fix (B):** "Cold metal" already appeared in paragraph 1 ("tasted of cold metal, dust"). Drop the first item of this inventory to avoid the near-repetition.
- [ ]

### 4.10 Corridor description not character-filtered
- **Source:** Role 5 (Style Auditor), Role 4 (Writing Professional)
- **Quote:** *"The work was ugly in the competent way emergency repairs usually were. Somebody had needed the corridor to stay standing. Nobody had spent a second caring what it looked like afterwards."*
- **Issue:** This could belong to any post-apocalyptic novel. A structural surveyor with years of reading age and failure off surfaces should have a more pointed, technical response to emergency repair work — what type of fixing method, what does the weathering differential tell him, how old is this relative to the Helix build? The narration defaults to generic atmospheric observation.
- **Fix:** Replace "The work was ugly in the competent way emergency repairs usually were" with something Adrian would actually notice and interpret: the materials, the fixing method, or what the weathering tells him about timing. (Note: this is partially addressed by 3.5 — cutting the over-explanation — but the replacement sentence itself also needs to be character-filtered.)
- [ ]

### 4.11 Emotional labelling told not shown — two instances
- **Source:** Role 3 (AI Detector), Role 1 (Lector)
- **Quote (A):** *"For a second he very nearly laughed. For another second he very nearly cried, which was worse..."*
- **Quote (B):** *"That one tightened something in his chest for a different reason."*
- **Issue (A):** "which was worse" is a clinical gloss on top of the already-clear beat. The Lector's fix: cut "which was worse" — the pivot to action carries the suppression.
- **Issue (B):** "For a different reason" tags the emotion categorically rather than rendering it. The content of the Ranger section already distinguishes this response.
- **Fix (A):** *"For a second he very nearly laughed. For another he very nearly cried. He got on with the more immediate problem of being trapped in a box."*
- **Fix (B):** Cut "for a different reason." The subsequent lines carry it.
- [ ]

### 4.12 Protagonist growth stated explicitly after being shown
- **Source:** Role 3 (AI Detector)
- **Quote:** *"His body just worked. Not gracefully, not with any sudden hidden athlete waiting underneath, but it worked."*
- **Issue:** The physical recovery has been shown through the crouching and rising. The qualification *"Not gracefully, not with any sudden hidden athlete..."* is a defensive explanation for the reader, pre-empting misreading. The action already shows it.
- **Fix:** Cut the qualification. *"His body just worked."* Trust the crouching and rising.
- [ ]

---

## 5. LINE FIXES

### 5.1 Redundant clause: "and there was no give in it at all"
- **Source:** Role 1 (Lector)
- **Quote:** *"The plastic felt dead, and there was no give in it at all."*
- **Fix:** *"The plastic felt dead and gave nothing."*
- [ ]

### 5.2 Weak verb: "hard enough to make him freeze"
- **Source:** Role 1 (Lector)
- **Quote:** *"Metal shrieked. The noise cracked through the dark hard enough to make him freeze, but the lid jumped a fraction upward."*
- **Fix:** *"Metal shrieked through the dark. He went still. The lid had jumped a fraction upward."*
- [ ]

### 5.3 Tonal misfire: "cupboard at the end of the world"
- **Source:** Role 1 (Lector), Role 5 (Style Auditor)
- **Quote:** *"The whole room suddenly reminded him of a cupboard at the end of the world."*
- **Issue:** Reaches for mythic register in a voice that has been precise and dry throughout. Not character-filtered — Adrian's professional instinct reaches for functional comparisons, not literary ones.
- **Fix:** Cut the sentence. The chamber description that follows does the work without the simile. If a comparison is wanted, anchor it in his site-work experience rather than literary mythology.
- [ ]

### 5.4 Pre-digested image: "Not a body in any useful present-tense sense"
- **Source:** Role 1 (Lector)
- **Quote:** *"Something lay inside. Not a body in any useful present-tense sense, just straps, grey residue, and a shape that had once relied on bones."*
- **Issue:** The qualifier precedes the image it qualifies, softening the landing before it arrives.
- **Fix:** *"Something lay inside — straps, grey residue, and a shape that had once relied on bones."*
- [ ]

### 5.5 Vague closing clause: "this much time had been allowed to do whatever it liked"
- **Source:** Role 1 (Lector)
- **Quote:** *"He saw none in the dust, but that meant less than he would have preferred when this much time had been allowed to do whatever it liked."*
- **Fix:** *"He saw none in the dust, but dust settled undisturbed long enough told him less than he wanted."* Or be specific about what he means.
- [ ]

### 5.6 Ambiguous phrasing: "The words reached him before the sound did"
- **Source:** Role 1 (Lector)
- **Quote:** *"The words reached him before the sound did, not through his ears but across his vision."*
- **Issue:** Implies the text makes a sound, which it does not. The contrast doesn't arrive cleanly.
- **Fix:** *"The words came without sound — not in the room but across his vision."*
- [ ]

### 5.7 Vague beat: "If anything, that was worse"
- **Source:** Role 1 (Lector)
- **Quote:** *"If anything, that was worse."*
- **Issue:** Worse than what is undefined. Coasts on emotional credit without specifying the comparison.
- **Fix:** Cut. Or replace: *"Jurisdiction was worse than hallucination. Hallucinations did not have paperwork."*
- [ ]

### 5.8 Register borrowed from Chapter 1: "corporate money trying to look like mercy"
- **Source:** Role 1 (Lector)
- **Quote:** *"white walls, inset lights, rounded corners, and corporate money trying to look like mercy"*
- **Issue:** This was the register of Adrian observing Helix from outside as a patient. Using it here — inside, awake — makes the observation feel borrowed rather than fresh. The character has moved.
- **Fix:** *"The corridor had once matched the chamber: white walls, inset lights, rounded corners."*
- [ ]

### 5.9 Wrong word: "ruinous"
- **Source:** Role 1 (Lector)
- **Quote:** *"He did not need a number to know the answer would be ruinous."*
- **Issue:** "Ruinous" implies financial or structural damage, not the scale of temporal loss being described.
- **Fix:** *"He did not need a number to know it would not be small."* Or: *"He did not want the number."*
- [ ]

### 5.10 Tonal misfire: "insultingly small increment"
- **Source:** Role 1 (Lector)
- **Quote:** *"Just a patient, steady drag towards the ring as if vibration had been pulling at the dust one insultingly small increment at a time."*
- **Issue:** "Insultingly" is too cute for Adrian's register — dry, direct, professional.
- **Fix:** *"Just a patient, steady drag towards the ring as if vibration had been pulling at the dust, one small increment at a time."*
- [ ]

### 5.11 Over-written setup before good closing line
- **Source:** Role 1 (Lector)
- **Quote:** *"Healer was not happening. Stability had had its turn. Stability had been doctors, handrails, reduced hours, and very sensible language about realistic outcomes."*
- **Issue:** "Stability had had its turn" is precious — the double past perfect draws attention without adding anything. The third sentence already carries the beat.
- **Fix:** *"Healer was not happening. Stability had been doctors, handrails, reduced hours, and very sensible language about realistic outcomes."*
- [ ]

### 5.12 Telling not showing: "The word sat there uselessly"
- **Source:** Role 1 (Lector)
- **Quote:** *"The word sat there uselessly for half a second."*
- **Fix:** *"The word sat there. Nothing changed. Then the prompt shifted."*
- [ ]

### 5.13 Over-explained physical sensation — cut setup before punchline
- **Source:** Role 1 (Lector)
- **Quote:** *"It was not pain, not in any ordinary sense. Pain he understood. This felt more like being assembled under protest."*
- **Issue:** The first two sentences explain what the third already implies. "Being assembled under protest" carries the distinction without the bracket.
- **Fix:** *"This felt more like being assembled under protest."* Cut the preceding two sentences.
- [ ]

### 5.14 Register echo from Chapter 1: "practical little betrayals"
- **Source:** Role 1 (Lector)
- **Quote:** *"He had spent years learning the rhythms of a failing body, the hesitation, the drag, the practical little betrayals."*
- **Issue:** "Practical little betrayals" is the Chapter 1 register — Adrian observing his illness from sardonic distance, before. Using the same formulation in a moment structurally meant to contrast with that past dulls the contrast.
- **Fix:** *"He had spent years learning the rhythms of a failing body."* Stop there. The new thing stands against the plain description.
- [ ]

---

## 6. ENGAGEMENT

### 6.1 "Almost laughed, almost cried" needs one more breath
- **Source:** Role 2 (Royal Road Reader)
- **Quote:** *"For a second he very nearly laughed. For another second he very nearly cried, which was worse, so he got on with the more immediate problem of being trapped in a box."*
- **Issue:** The Reader: *"He's been sick for years. His body works. That is enormous. The chapter handles it with admirable restraint but I think it could afford a few more seconds of him being a person before he goes back to being competent."*
- **Fix:** Already addressed structurally by line fix 5.1 (cutting "which was worse"). The Reader also flags a desire for the beat to sit slightly longer — consider adding one line of physical sensation (what does his throat do? what does his jaw do?) before the pivot to action.
- [ ]

### 6.2 Fighter choice should feel more impulsive
- **Source:** Role 2 (Royal Road Reader)
- **Quote (Reader):** *"That Adrian would probably have stopped on Fighter, read it once, muttered something short and sharp, and picked it — not because he'd fully eliminated everything else, but because it matched a mood."*
- **Issue:** Addressed by story logic item 2.2 and structural item 3.1. Roughening the deliberation and shortening the Caster/Healer dismissals will give the Fighter choice its impulsive quality.
- **Fix:** Covered by 2.2 and 3.1. No separate action needed.
- [ ]

### 6.3 Professional competence observed but not mechanically deployed
- **Source:** Role 4 (Writing Professional)
- **Issue:** Adrian notices the floor tilt, the non-Helix repair work, the weathering differential, the writing added in a second hand. None of these produce decisions or advantages. The competence is atmospheric rather than functional. The genre rewards competence deployment.
- **Note:** This is a *chapter-level* note, not a single fixable line. The Writing Professional flags it as the most important unanswered question for series viability. Not a revision for this draft — a flag to carry forward.
- [ ]

### 6.4 No relational investment axis at chapter close
- **Source:** Role 4 (Writing Professional)
- **Issue:** The chapter closes with Adrian alone, trait-empty, in front of a humming arch, with no human horizon visible. For a genre that depends on relationship chemistry, this is commercially isolating. A named person, an intention, or a signal of the world's social structure would give readers a relational investment axis heading into Chapter 3.
- **Note:** A *forward-looking* flag for Chapter 3 drafting, not a revision for this chapter.
- [ ]

---

## 7. THE WRITING PROFESSIONAL'S QUESTION

*"The chapter introduces Adrian as a man whose professional value was reading physical structures — knowing what they were doing, what they had done, how long they had been doing it, and what was about to give. He looks at the arch. He feels the pulse in the floor. He sees the non-Helix repair work, the unfamiliar writing, the crack pattern at the base. He registers all of it. Then he picks a class, reads a stat screen, and moves on.*

**What does Adrian's professional competence actually do in this world, and does the author know the answer to that question yet?"**

---

*Synthesis compiled from: 06_story_analyst.md, 01_style_auditor.md, 02_ai_detector.md, 03_lector.md, 04_writing_professional.md, 05_royal_road_reader.md*
