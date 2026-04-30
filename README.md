
# Falling Notes 🎹

Interactive piano roll visualizer — watch notes fall as the music plays.

🎵 [Live Demo](https://falling-notes.vercel.app)


https://github.com/user-attachments/assets/8b3f418c-235a-4700-ba97-7dbae7cb088c

---

## What it does

Falling Notes visualizes music as animated notes descending onto a 
piano keyboard in real time. Select from 16 pieces across three 
genres — Western Classical, Bollywood, and Hindustani Classical — 
and watch each note light up as it plays, with note name labels, 
tempo control, and a 4-layer synthesized piano sound.

It's designed for piano learners who want to connect written music 
to physical keys — the gap between reading notation and playing 
is one of the hardest parts of learning piano, and visual 
reinforcement helps bridge it.

---

## Why I built this

I'm an active piano learner and a parent teaching my two children 
(aged 5 and 9) music at home. One of my children is working toward 
ABRSM Grade exams. I found that standard sheet music is abstract 
for young learners — they can follow a falling note far more 
intuitively than reading a stave.

I also have a background in Indian classical music (Hindustani 
vocal), so I specifically wanted to include ragas alongside Western 
pieces — most piano visualizers are exclusively Western. The 
Hindustani pieces in this app reflect that personal context.

---

## How AI was used in building this

This project was built using AI-assisted development with Claude 
(Anthropic). The AI involvement went beyond code generation:

**Prompt architecture decisions:** I designed structured prompts 
to generate the note sequence data for each piece in a consistent 
JSON format that the visualizer could consume directly. Getting 
the timing representation right — especially for Hindustani 
compositions where rhythm structures differ from Western notation 
— required prompt iteration.

**Musical representation problem:** Western pieces could be 
described in standard notation terms. For Hindustani ragas I had 
to design a different input vocabulary — sargam notation (Sa Re 
Ga Ma Pa Dha Ni) mapped to MIDI note numbers — and prompt Claude 
to reason about that mapping correctly. 

**What I learned about AI-assisted development:** Claude is
reliable for generating repetitive structured data (note
sequences) but needs explicit constraints on timing values to
avoid hallucinating durations. The next engineering step is a
validation layer that checks generated sequences against expected
bar lengths — without it, subtle timing errors in generated data
are only caught by ear.

---

## Technical decisions

- **React + TypeScript** — type safety for note data structures 
  was important given the volume of sequence data
- **Tone.js** — for Web Audio API synthesis; 4-layer timbre
  approach (warm sine body, percussive hammer transient, upper
  harmonics, sub bass for low notes) routed through reverb and
  compression creates a more realistic piano sound than a
  single-oscillator approach
- **Canvas API** — chosen over CSS animation for performance; 
  60fps animation with 88 keys and multiple simultaneous falling 
  notes needs direct pixel control
- **Vercel** — zero-config deployment with automatic preview 
  deploys on every commit

---

## What I'd build next

The natural extension is **sheet music photograph → visualizer**: 
a user photographs a physical piece of sheet music, Claude Vision 
extracts the notes, and the visualizer plays it automatically. 
This would add a genuine multimodal AI layer — image understanding 
feeding into structured musical data — rather than the current 
approach of pre-encoding sequences manually.

I'd also add a **practice mode**: the visualizer plays a bar, 
then pauses and waits for the learner to identify the next note 
before continuing. This transforms it from a passive visualizer 
into an active learning tool.

---

## About the builder

Built by Shruti Tiwari — independent AI product builder (2023–
present), 20 years backend engineering, former VP at Goldman Sachs. 
I build AI-native tools for music education and parenting, rooted 
in my own experience as a piano learner, Hindustani music 
practitioner, and parent of two young children.
