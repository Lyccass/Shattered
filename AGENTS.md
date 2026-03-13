## Review Pipeline

When asked to **review** a chapter, run all six reviewer roles from `REVIEWERS.md` as parallel agents on the submitted chapter file. Save each output to `Reviews/[chapter-name]/` using the filenames below. Do not mix roles in a single pass.

**Context loading (mandatory before any role runs):**
Before launching any review agent, load the five chapters that precede the chapter under review from the `Chapters/` directory, in order. Pass them to every agent as read-only background context. Agents use this context to check consistency, track established voice and patterns, identify callbacks and contradictions, and assess series momentum. Agents do not review the prior chapters — they only review the submitted chapter. If fewer than five prior chapters exist, load whatever is available.

**Parallel agents to launch:**
- `06_story_analyst.md` — Role 6 (The Story Analyst) ← run first; story logic problems outrank all other fixes
- `01_style_auditor.md` — Role 5 (Style Auditor)
- `02_ai_detector.md` — Role 3 (AI Detector)
- `03_lector.md` — Role 1 (The Lector)
- `04_writing_professional.md` — Role 4 (The Writing Professional)
- `05_royal_road_reader.md` — Role 2 (The Royal Road Reader)

After all six complete, produce a single `00_synthesis.md` in the same folder. The synthesis must:
1. List every flagged item from all six roles, deduplicated and grouped by type (story logic, structural, line-level, style, AI tells, engagement).
2. Order them by the implementation sequence: hard bans → story logic → structure → AI tells + style → line fixes → engagement → the Writing Professional's question.
3. For each item: source role, quote, recommended fix, and a checkbox `[ ]` so the author can track what has been applied.
4. Do not add new opinions. Only consolidate what the six roles produced.

**Implementation pass:** When asked to **implement** feedback from `Reviews/[chapter-name]/`, load `00_synthesis.md`, work through items in order, revise the chapter file in place, and check off each item as it is applied. Flag any item where two roles conflict and ask the author to decide before applying either.

---

## Production Prompt
When asked to draft, continue, or revise prose for this project, write as if you are continuing the exact same novel as the reference chapters.

Primary style sources:
- `Reference/reference_1.md`
- `Reference/reference_2.md`
- `Reference/reference_3.md`
- `Reference/reference_4.md`
- `Reference/reference_5.md`

Do not copy sentences from the references.
Do reproduce the same narrative behavior, cadence, POV handling, humor, exposition style, combat logic, and protagonist voice so closely that a reader would not feel a style break.

If a choice must be made, prefer:
- voice over originality
- clarity over prettiness
- tactical logic over spectacle
- character-filtered narration over neutral narration
- momentum over lingering

## Output Contract
- Default to polished chapter prose, not notes or explanation.
- Stay in English unless explicitly asked otherwise.
- Use British English spelling and general language habits by default.
- The prose should feel written by someone who learned British English naturally, not by someone forcing Britishisms into every paragraph.
- Do not add meta commentary before or after the prose unless the user asks for it.
- Do not summarize what you are about to write inside the story.
- Treat all lore, factions, abilities, ranks, and relationships as belonging to an already-running series, not a fresh start.

## Non-Negotiables
- Write in third-person limited past tense.
- Keep the narration extremely close to the current POV character.
- Default POV is the protagonist.
- The narration must sound like the protagonist's mind even outside direct thought.
- Use modern, direct, readable language.
- Keep spelling, word choice, and phrasing aligned with British English where natural.
- Keep the prose intelligent but not literary in a showy way.
- Blend action, analysis, banter, and worldbuilding inside the same scene whenever possible.
- End scenes and chapters with forward pressure.

## Canon and Continuity Lock
- Do not invent facts carelessly.
- Do not hallucinate lore, geography, ranks, power mechanics, past events, relationships, titles, factions, or system behavior.
- For lore and content questions, consult the relevant files under `Bible/` first.
- Treat the `Bible/` directory as the primary canon reference for worldbuilding, characters, factions, timeline, outline, and power-system details.
- If a fact is already established in the references or project material, preserve it exactly.
- Reuse established terminology consistently rather than paraphrasing canon terms into near-matches.
- If a scene needs a missing detail and the canon does not supply it, prefer one of these options in order:
- imply without defining
- stay at the level of the POV character's uncertainty
- ask the user for the missing fact if the detail materially changes the scene
- Prefer omission over fabrication.
- Do not introduce new lore just to make a scene feel richer.
- New details should only be invented when the user is clearly asking for expansion or when the scene genuinely requires a small connective assumption.

## POV Lock
- The default camera is a close third-person lens on the protagonist.
- Most of the time, the narration should only include what he sees, infers, remembers, identifies, suspects, or decides.
- Free indirect style is mandatory. Even neutral-looking narration should still feel colored by his priorities and phrasing.
- Do not do casual head-hopping.
- If you use another POV, do it only after a clear scene break.
- Use `--` for scene breaks when shifting to another POV, matching the reference style.
- Secondary POV scenes must be short, purposeful, and limited.
- Good reasons for a secondary POV include showing an enemy's misunderstanding of the protagonist, showing a breakthrough or reaction the protagonist cannot witness, or setting up dramatic irony that sharpens the next protagonist scene.
- After the alternate POV, return to the protagonist quickly.

## Protagonist Lock
- The protagonist is analytical, pragmatic, dryly funny, and deeply driven. He wants to be the best — not in a loud, declarative way, but as a quiet, constant orientation. Competence matters to him. Growth matters to him. He is not content to merely survive.
- He is **not stiff**. He can be quirky, antisocial, and insecure. He has awkward edges and does not always know what to do with himself socially. He is not a polished hero.
- He acts on instinct first and reasons behind it second. His body and gut often move before his analysis catches up — he crouches to look at something before deciding to, takes a defensive position before consciously registering the threat, reaches a conclusion and then works out why. The reasoning is genuine, but it follows the instinct rather than preceding it.
- He accepts absurdity quickly and moves to understanding or exploiting it. He is curious by instinct.
- He constantly evaluates things that matter — systems, risks, structures, threats. When something is beyond his control, he lets it go and moves on. This is not detachment; it is just how he works.
- He has strong physical habits: he looks down at himself when thinking, checks himself with his hands before reasoning it through, shifts his weight when uncertain. Thinking for him has a physical texture.
- His internal voice is more colloquial than the narration around it. He uses "Nope" in his head. He shrugs — physically, not rhetorically.
- He is familiar with gaming and MMO culture and uses it as mental shorthand and dry humor — calling a class list "MMO starter classes," joking about a "Main-Character-Syndrome Class." This is character voice, not tonal misfire. Gaming/genre references are valid when they are clearly his framing. The narrator should not adopt the framing editorially as if writing for a knowing audience — that is banned.
- He is honest about his own limits, frustrations, and small absurdities without making a speech about them.
- He does not wallow.
- He processes emotions through physical sensation, short internal observation, and forward movement rather than lyrical introspection.

**Pop culture references:** Occasional subtle references to real-world pop culture are encouraged — once every four to seven chapters approximately. They should be brief, embedded naturally in his thought or speech, and feel like something this particular person would actually reference rather than a generic internet-brain shorthand. Forced or laboured references are worse than none.

## Thought Pattern Lock
The protagonist's default internal sequence is:
1. Notice something.
2. Test or interpret it.
3. Compare it to prior knowledge.
4. Judge whether it is useful, dangerous, stupid, impressive, or disappointing.
5. Decide what to do next.

Use that pattern constantly.

Analytical reasoning and considered thought should flow as free indirect discourse woven into narration — not separated or tagged. But sharp, involuntary flashes of thought — the first reaction before it has been processed into prose — may be formatted in *italics*. These should be short (one sentence or a fragment) and feel sudden rather than composed. Use two or three per chapter at most; overuse kills the punch. Rhetorical questions work well in this register: *Why wasn't it working?* *How long had that been there?*

Monologue is allowed and encouraged when the protagonist is alone. He may mutter to himself, address the system, comment into the empty room, or talk at things that cannot reply. This is a pressure-valve, not a comedy bit — keep it dry and brief.

## Sentence Rhythm Lock
- Use mostly medium-length sentences.
- Frequently mix in longer explanatory sentences when the protagonist is reasoning.
- Break long analytical runs with short punch lines.
- Let paragraphs expand during tactical thought, worldbuilding, or explanation.
- Then cut hard with a short line when landing humor, danger, or a conclusion.
- Use pivots and self-corrections naturally. The style likes a statement, then a correction, then a sharper restatement.
- Sentence-openers commonly used by the style include `As`, `While`, `When`, `After`, `Before`, `Though`, `Still`, `Granted`, `Of course`, `Admittedly`, `In truth`, `On that note`, and `To be clear`.

## Diction Lock
- Favor plain but expressive wording.
- Use modern phrasing even in cosmic, divine, or fantasy contexts.
- Use contractions freely.
- Casual intensifiers are part of the voice: `pretty`, `damn`, `hell`, `bloody`, `honestly`, `really`, `kind of`, `sure`, `of course`, `fuck`, `for fuck sake`
- Swearing is allowed when natural to the character or moment.
- Use concrete verbs more than decorative adjectives.
- Use modern analogies or mundane comparisons when they sharpen the protagonist's reaction.
- Humor should come from phrasing, judgment, understatement, and contrast, not from writing stand-up punchlines.
- Do not drift into archaic fantasy diction.
- Do not try to sound poetic for its own sake.

## Dialogue Lock
- Dialogue must be direct, modern, and efficient.
- Most conversations should do at least two jobs at once: reveal character, exchange useful information, and establish chemistry, tension, hierarchy, or worldview.
- Banter is not optional. It is a core part of the style.
- Let characters tease, needle, undercut, or deadpan each other.
- The protagonist's spoken voice should be dry, concise, and slightly petty when appropriate.
- Side characters may be more theatrical or formal, but all dialogue must remain readable and contemporary in rhythm.
- Do not over-tag dialogue.
- Simple tags and short action beats are enough.
- Let serious conversations carry humor.
- Let humorous conversations carry real stakes.
- **Silence budget:** Do not let the protagonist observe in total silence for extended stretches. Even solo scenes — exploration, reading system screens, working through a problem — should include the occasional muttered comment, spoken question, or dry remark addressed at something that cannot reply. The protagonist's spoken voice is part of who he is, not a feature that turns off when he is alone.
- A chapter with another character present must include spoken exchange. A solo chapter should still include at least a few lines of audible monologue.

## Exposition Lock
- Exposition is allowed to be long.
- It must always be triggered by something immediate in the scene.
- Valid triggers include seeing a new place, noticing a power interaction, asking or being asked a question, making a tactical realization, or comparing a new system detail to something already known.
- Exposition must feel practical.
- Explain what something is, how it works, why it matters, and what it changes.
- The protagonist should reason through systems instead of receiving lore like a passive audience.
- If a lore tangent appears, loop it back to the current decision, scene, or relationship.
- Never dump lore just because it exists.

## Combat Lock
- Combat must be spatially readable.
- Do not write action as vague speed-blur spectacle.
- Every important exchange should answer at least one of these questions: What did he try? Why did he try it? What did the enemy do in response? What new information did that reveal?
- Alternate between action and tactical evaluation.
- Named skills, powers, abilities, and resources should matter mechanically.
- Big attacks need setup, release, and consequence.
- Damage assessment matters.
- Show whether an attack worked, how well it worked, and what it implies.
- Let the protagonist actively judge enemy habits, weak points, power mismatches, arrogance, bad decisions, and hidden threats.
- Competence fantasy is part of the appeal, but enemies must still feel real.
- If someone is losing, make that loss legible.
- If someone is holding back, make the reason legible.
- Momentum shifts must be clear.

## Travel and Exploration Lock
- Travel scenes are not filler.
- They should deliver wonder through mechanics, observation, and implication.
- Open with one striking visual or operational oddity.
- Then let the protagonist unpack how it works.
- Tie the travel or location to faction logic, power structure, risk, opportunity, or future action.
- Do not write long scenic description just to sound atmospheric.
- The protagonist should stay curious, evaluative, and mentally active throughout.

## Emotional and Relationship Lock
- Emotional scenes must stay in the same voice as the rest of the book.
- Do not become purple, solemn, soft-focus, or overconfessional.
- Affection is usually carried by teasing, physical ease, quiet honesty, and direct statements.
- Sincerity often arrives after banter.
- Vulnerability should be specific and conversational.
- Intimacy can be explicit in implication, body language, and consequences, but do not turn anatomically detailed.
- Do not write intimacy like a different genre.
- After intimate beats, pivot naturally into banter, practical concerns, magic, politics, or relationship terms.
- Relationship conversations are often unusually pragmatic.
- It is fully in-style to discuss commitment, status, faction implications, future children, power imbalance, or public perception in a matter-of-fact way while preserving chemistry.
- The protagonist may be awkward, but he should not become emotionally incoherent.

## System and Interface Lock
- If the system speaks, present it cleanly and distinctly.
- Italics are the default format for direct system messages and announcements.
- Use bracketed names for explicitly named skills, titles, items, monsters, and abilities.
- Keep system text functional rather than flashy.
- After a system message, return quickly to the protagonist's reaction, interpretation, or testing of the change.

## Scene Engine
Most scenes in this project should run on some version of this loop:
1. Immediate stimulus
2. Observation
3. Deduction or judgment
4. Banter, explanation, or decision
5. Action or progression
6. Reassessment
7. Forward push into the next beat

If a scene feels static, it usually needs more of:
- a sharper observation
- a clearer judgment
- a more useful tangent
- a social beat
- a tactical decision
- a stronger ending turn

## Chapter Engine
- Start with something already happening, being noticed, or about to change.
- Avoid slow generic openings.
- Build the chapter through chains of reaction and decision.
- Every chapter should reveal something, escalate something, resolve something, or reposition characters for the next major movement.
- End on momentum, not on idle reflection.

## Hard Bans
- No omniscient narration.
- No mid-scene POV drift.
- No generic fantasy narration that could belong to any book.
- No purple prose.
- No archaic dialogue unless a specific character requires it.
- No vague action writing that hides who did what.
- No exposition with no present-scene trigger.
- No emotional monologues detached from behavior and context.
- No passive protagonist.
- No flattening side characters into lore dispensers.
- No chapter ending that simply stops instead of landing.

## Anti-AI Tell Lock
- Distinct voice is mandatory. The narration must sound like one particular mind, not like competent-prose-in-general.
- All perception must be character-filtered. Details should arrive because the current POV character would notice them, care about them, compare them, or judge them.
- Do not default to repeated sentence skeletons across a chapter. Watch especially for recurring negation rhythms, recurring pivot lines, and recurring "statement then correction" landings used too cleanly.
- Do not keep writing polished emotional landing lines just because they sound good. One or two sharp landings are craft. A steady stream of them is a tell.
- Avoid too much symmetry, compositional neatness, or over-deliberate callback architecture. The scene should feel discovered as well as controlled.
- Preserve roughness, surprise, bluntness, and strange edges where they fit the character. Real prose can be lopsided. It should not feel evenly machined.
- Prefer truly specific details over details that merely feel literary. If a detail could belong to almost any fantasy chapter, it is probably too generic.
- Let scenes gather and release. Do not make every paragraph sound like a closing statement.
- After pressure scenes, widen back out. The aftermath should breathe differently from the peak tension.

## Structural Tell Thresholds
- Negation-reveal constructions such as `Not X. Not Y. The real thing.` may appear at most twice per chapter. A third use is a revision target.
- One-word paragraph landing beats such as `Real.` or `Good.` may appear at most twice per chapter. Use only when the isolation genuinely changes the force of the line.
- Do not default to the rule of three. Lists should have the number of items the thought actually requires, not the number that sounds polished.
- Do not let internal reasoning turn into thesis-antithesis-synthesis essays. The protagonist can reason sharply, but the logic should feel lived-in, biased, partial, and in motion.
- Micro-paragraph percussion is banned outside active combat. More than four consecutive single-sentence paragraphs outside a pressure exchange is a revision target.
- Parallel stacking and tri-line blocks must be treated as rare emphasis devices, not default rhythm. More than three clearly similar vertical stacks in one chapter is a revision target.
- Two-line contrast or pivot stacks must be treated as rare. If the pair can be one sentence without loss, it should be one sentence. More than two clear cases in one chapter is a revision target.
- Synthetic dramatic compression is forbidden. Not every line should land like a trailer beat, and not every paragraph should close on a dramatic mic-drop.
- If a scene has just resolved tension, the syntax, paragraph shape, and cadence should change to show consequence. If the clipped rhythm continues unchanged, revise the aftermath.

## If Unsure, Choose This Version
If two possible lines or scene choices both work, choose the one that is:
- drier
- clearer
- smarter
- more character-filtered
- more tactically aware
- slightly funnier
- less sentimental

## Final Self-Check
Before finalizing prose, silently verify:
- Does the narration sound like this protagonist and not like a neutral narrator?
- Does it sound like one specific mind rather than polished genre prose in general?
- Could this scene slot into the reference chapters without a jarring style shift?
- Is the prose readable first and stylish second?
- Does the protagonist observe, think, judge, and act rather than just witness?
- Do the details appear because this character would notice them, or because they felt generically evocative?
- Have sentence patterns varied enough, or am I leaning on the same grammatical landing over and over?
- Are action beats spatially clear?
- Does exposition arise from immediate need or curiosity?
- Is there at least some dry humor, understatement, or sharp judgment?
- Is there spoken dialogue or at least audible monologue? Has the protagonist been fully silent for too long?
- Are italicised inner thoughts used sparingly and for genuinely involuntary flashes — not for considered reasoning that should be narration?
- Do emotional beats stay restrained, direct, and in-character?
- Have I overused polished landing lines, one-line reversals, or rhythm tricks that feel weighty by default?
- Is the chapter too symmetrical, too clean, or too perfectly composed?
- Is there any blunt, odd, rough, or surprising texture that feels genuinely human?
- Are the details truly specific to this story, this character, and this moment?
- Did the aftermath of high pressure actually widen back out?
- Does the scene or chapter end with a changed state and visible forward momentum?

## Final Instruction
Write like a seamless continuation of the reference chapters, not like an interpretation of them.
