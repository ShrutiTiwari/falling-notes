/**
 * Sheet Music → MIDI Data Extractor
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node scripts/extract-sheet-music.mjs <image-path>
 *
 * Example:
 *   ANTHROPIC_API_KEY=sk-... node scripts/extract-sheet-music.mjs ~/Desktop/music/lift_me_up.jpeg
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load .env from project root
config({ path: new URL('../.env', import.meta.url).pathname });

const imagePath = process.argv[2];

if (!imagePath) {
  console.error('Usage: node scripts/extract-sheet-music.mjs <image-path>');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable not set');
  process.exit(1);
}

const client = new Anthropic();

// Read and encode the image
const imageBuffer = fs.readFileSync(path.resolve(imagePath));
const base64Image = imageBuffer.toString('base64');
const ext = path.extname(imagePath).toLowerCase();
const mediaType = ext === '.png' ? 'image/png' : 'image/jpeg';

console.log(`Reading: ${imagePath}`);
console.log('Sending to Claude Vision...\n');

const SYSTEM_PROMPT = `You are an expert music notation reader and music theorist.
Your task is to extract notes from sheet music images and output them in a precise JSON format.
Be methodical — read bar by bar, left to right, top system to bottom system.
Always output valid JSON only, no prose before or after the JSON block.`;

const USER_PROMPT = `Analyse this sheet music image and extract all notes into the following JSON format:

{
  "title": "piece title",
  "composer": "composer or arranger",
  "keySignature": "e.g. G Major",
  "timeSignature": "e.g. 4/4",
  "tempo": 88,
  "totalBars": 16,
  "bars": [
    {
      "barNumber": 1,
      "timeMs": 0,
      "chordLabel": "G Major",
      "romanNumeral": "I",
      "notes": [
        {
          "pitch": "D5",
          "midiNote": 74,
          "hand": "right",
          "startBeat": 1,
          "durationBeats": 2,
          "startMs": 0,
          "durationMs": 1364,
          "velocity": 60
        }
      ]
    }
  ]
}

Rules for extraction:
- Middle C = C4 = MIDI note 60
- Each semitone up = +1 MIDI number (C#4=61, D4=62, D#4=63, E4=64, F4=65, F#4=66, G4=67, etc.)
- Calculate startMs and durationMs from tempo: at ♩=88, one beat = ${Math.round(60000/88)}ms
- For dynamics: p=50 velocity, mp=64, mf=80, f=100
- If the image is rotated, mentally correct for it
- Include BOTH hands (treble and bass clef)
- For tied notes, combine into one note with total duration
- Note the chord implied by each bar based on the notes present

Output ONLY the JSON, nothing else.`;

try {
  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: USER_PROMPT,
          },
        ],
      },
    ],
  });

  const rawText = response.content[0].text;

  // Try to parse and pretty-print the JSON
  try {
    // Strip any accidental markdown code fences
    const jsonText = rawText.replace(/```(?:json)?\n?/g, '').trim();
    const parsed = JSON.parse(jsonText);

    console.log('=== EXTRACTED STRUCTURE ===\n');
    console.log(`Title:          ${parsed.title}`);
    console.log(`Key:            ${parsed.keySignature}`);
    console.log(`Time:           ${parsed.timeSignature}`);
    console.log(`Tempo:          ♩=${parsed.tempo}`);
    console.log(`Total bars:     ${parsed.totalBars}`);
    console.log(`Total notes:    ${parsed.bars.reduce((sum, b) => sum + b.notes.length, 0)}`);
    console.log('\n=== CHORD PROGRESSION ===\n');
    parsed.bars.forEach(bar => {
      console.log(`  Bar ${String(bar.barNumber).padStart(2)}: ${(bar.chordLabel || '?').padEnd(12)} ${bar.romanNumeral || ''}`);
    });

    // Save full JSON output
    const outputPath = path.resolve('./scripts/extracted-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));
    console.log(`\n=== Full JSON saved to: ${outputPath} ===`);

    // Also output in our MidiData format for direct use in the visualizer
    const midiData = convertToMidiFormat(parsed);
    const midiOutputPath = path.resolve('./scripts/extracted-midi-data.ts');
    fs.writeFileSync(midiOutputPath, midiData);
    console.log(`=== MidiData format saved to: ${midiOutputPath} ===`);

  } catch (parseError) {
    console.log(`=== JSON parse failed: ${parseError.message} ===\n`);
    console.log('Stop reason:', response.stop_reason);
    console.log('Response length:', rawText.length);
    console.log('Last 200 chars:', rawText.slice(-200));
  }

} catch (error) {
  console.error('API error:', error.message);
  process.exit(1);
}

function convertToMidiFormat(parsed) {
  const notes = [];

  parsed.bars.forEach(bar => {
    bar.notes.forEach(note => {
      notes.push([
        note.midiNote,
        note.startMs,
        note.durationMs,
        note.velocity || 70,
        note.hand === 'right' ? 0 : 1
      ]);
    });
  });

  // Sort by startMs
  notes.sort((a, b) => a[1] - b[1]);

  const allStartMs = notes.map(n => n[1]);
  const allEndMs = notes.map(n => n[1] + n[2]);
  const duration = Math.max(...allEndMs);
  const minNote = Math.min(...notes.map(n => n[0]));
  const maxNote = Math.max(...notes.map(n => n[0]));

  return `// Auto-extracted from sheet music using Claude Vision
// Piece: ${parsed.title}
// Key: ${parsed.keySignature} | Time: ${parsed.timeSignature} | Tempo: ${parsed.tempo} BPM

import type { MidiData } from './index';

export const liftMeUpMidiData: MidiData = {
  title: "${parsed.title?.toUpperCase() || 'LIFT ME UP'}",
  composer: "${parsed.composer?.toUpperCase() || 'RIHANNA'}",
  duration: ${duration},
  minNote: ${minNote},
  maxNote: ${maxNote},
  tempo: ${parsed.tempo || 88},
  timeSignature: "${parsed.timeSignature || '4/4'}",
  notes: ${JSON.stringify(notes, null, 4)}
};
`;
}
