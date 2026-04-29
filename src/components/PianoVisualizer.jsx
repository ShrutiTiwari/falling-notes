import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as Tone from 'tone';
import { midiCollection, getMidiById } from '../data/midi/index';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const isBlackKey = (note) => [1, 3, 6, 8, 10].includes(note % 12);
const isWhiteKey = (note) => !isBlackKey(note);

// Key signatures that prefer flats over sharps
const FLAT_KEYS = ['F Major', 'Bb Major', 'Eb Major', 'Ab Major', 'Db Major', 'Gb Major', 'Cb Major',
                   'D minor', 'G minor', 'C minor', 'F minor', 'Bb minor', 'Eb minor', 'Ab minor'];

// Get note name without octave, context-aware for key signature
const getNoteName = (midiNote, keySignature) => {
  const noteIndex = midiNote % 12;
  const defaultNoteName = NOTE_NAMES[noteIndex];

  // If the key prefers flats, convert sharps to flats
  if (keySignature && FLAT_KEYS.includes(keySignature)) {
    const enharmonicMap = {
      'C#': 'Db',
      'D#': 'Eb',
      'F#': 'Gb',
      'G#': 'Ab',
      'A#': 'Bb'
    };
    return enharmonicMap[defaultNoteName] || defaultNoteName;
  }

  return defaultNoteName;
};

// Count white keys in a range
const countWhiteKeys = (minNote, maxNote) => {
  let count = 0;
  for (let n = minNote; n <= maxNote; n++) {
    if (isWhiteKey(n)) count++;
  }
  return count;
};

// Build position map for all keys based on white key positions
const buildKeyPositions = (minNote, maxNote, canvasWidth) => {
  const whiteKeyCount = countWhiteKeys(minNote, maxNote);
  const whiteKeyWidth = canvasWidth / whiteKeyCount;
  const blackKeyWidth = whiteKeyWidth * 0.65;

  const positions = {};
  let whiteKeyIndex = 0;

  // First pass: position all white keys
  for (let note = minNote; note <= maxNote; note++) {
    if (isWhiteKey(note)) {
      positions[note] = {
        x: whiteKeyIndex * whiteKeyWidth,
        width: whiteKeyWidth,
        isBlack: false
      };
      whiteKeyIndex++;
    }
  }

  // Second pass: position black keys between white keys
  for (let note = minNote; note <= maxNote; note++) {
    if (isBlackKey(note)) {
      // Find the white key to the left (note - 1 is always white for black keys)
      const leftWhiteX = positions[note - 1]?.x ?? 0;
      positions[note] = {
        x: leftWhiteX + whiteKeyWidth - blackKeyWidth / 2,
        width: blackKeyWidth,
        isBlack: true
      };
    }
  }

  return { positions, whiteKeyWidth, blackKeyWidth };
};

/**
 * @typedef {Object} PassacagliaPianoProps
 * @property {string} [selectedMidiId] - ID of the selected MIDI file
 * @property {Object} [midiData] - MIDI data object with notes, duration, etc.
 * @property {string} [title] - Custom title for the piece
 * @property {string} [composer] - Custom composer name
 */

export default function PianoVisualizer({
  selectedMidiId = 'passacaglia',
  midiData,
  title,
  composer
} = {}) {
  const navigate = useNavigate();
  const { piece } = useParams();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeNotes, setActiveNotes] = useState(new Set());
  const [currentMidiId, setCurrentMidiId] = useState(piece || selectedMidiId);
  const [tempoMultiplier, setTempoMultiplier] = useState(1.0); // 1.0 = normal speed
  const [showNoteNames, setShowNoteNames] = useState(true); // Toggle for note names

  // Get current MIDI data
  const currentMidi = midiData ?
    { title: title || 'Custom', composer: composer || '', data: midiData, difficulty: 'Custom' } :
    getMidiById(currentMidiId) || midiCollection[0];

  const activeMidiData = currentMidi.data;
  
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const startTimeRef = useRef(null);
  const pianoRef = useRef(null);
  const reverbRef = useRef(null);
  const scheduledNotesRef = useRef(new Set());
  const pausedTimeRef = useRef(0);
  const audioInitializedRef = useRef(false);
  
  const duration = activeMidiData.duration;
  const minNote = activeMidiData.minNote;
  const maxNote = activeMidiData.maxNote;
  const totalKeys = maxNote - minNote + 1;

  // Categorize MIDI collection
  const categorizeMusic = () => {
    const categories = {
      '🎼 Classical & Traditional': [],
      '🎵 Hindustani Classical': [],
      '🎬 Bollywood Hits': [],
      '🎹 Contemporary': []
    };

    midiCollection.forEach(midi => {
      if (midi.composer === 'Bollywood') {
        categories['🎬 Bollywood Hits'].push(midi);
      } else if (midi.composer === 'Hindustani Classical') {
        categories['🎵 Hindustani Classical'].push(midi);
      } else if (midi.composer === 'Traditional' ||
                 midi.composer === 'Beethoven' ||
                 midi.composer === 'J.S. Bach' ||
                 midi.composer === 'Handel - Halvorsen') {
        categories['🎼 Classical & Traditional'].push(midi);
      } else {
        categories['🎹 Contemporary'].push(midi);
      }
    });

    return categories;
  };

  const categorizedMusic = categorizeMusic();
  
  // Initialize audio only after user gesture
  const initAudio = async () => {
    if (audioInitializedRef.current) return;

    await Tone.start();

    // Create effects chain
    const compressor = new Tone.Compressor({
      threshold: -20,
      ratio: 3,
      attack: 0.01,
      release: 0.1
    }).toDestination();

    reverbRef.current = new Tone.Reverb({
      decay: 3.5,
      wet: 0.28,
      preDelay: 0.02
    }).connect(compressor);

    // Layer 1: Main tone (fat sine for warmth)
    const mainSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'fatsine',
        count: 3,
        spread: 15
      },
      envelope: {
        attack: 0.005,
        decay: 1.5,
        sustain: 0.1,
        release: 1.8
      }
    });
    mainSynth.volume.value = -12;

    // Layer 2: Hammer attack (short percussive hit)
    const hammerSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'triangle'
      },
      envelope: {
        attack: 0.001,
        decay: 0.08,
        sustain: 0,
        release: 0.1
      }
    });
    hammerSynth.volume.value = -18;

    // Layer 3: Harmonics (adds brightness)
    const harmonicSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'sine',
        partialCount: 4
      },
      envelope: {
        attack: 0.01,
        decay: 0.8,
        sustain: 0.05,
        release: 1.2
      }
    });
    harmonicSynth.volume.value = -22;

    // Layer 4: Sub bass for low notes
    const bassSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'sine'
      },
      envelope: {
        attack: 0.01,
        decay: 2.0,
        sustain: 0.15,
        release: 2.5
      }
    });
    bassSynth.volume.value = -15;

    // Connect all layers
    mainSynth.connect(reverbRef.current);
    hammerSynth.connect(reverbRef.current);
    harmonicSynth.connect(reverbRef.current);
    bassSynth.connect(reverbRef.current);

    // Set max polyphony
    mainSynth.maxPolyphony = 24;
    hammerSynth.maxPolyphony = 24;
    harmonicSynth.maxPolyphony = 24;
    bassSynth.maxPolyphony = 16;

    // Store all synths with custom trigger method
    pianoRef.current = {
      main: mainSynth,
      hammer: hammerSynth,
      harmonic: harmonicSynth,
      bass: bassSynth,

      triggerAttackRelease: (freq, duration, time, velocity) => {
        // Check if synths are still valid (not disposed)
        if (!mainSynth.disposed && !hammerSynth.disposed && !harmonicSynth.disposed && !bassSynth.disposed) {
          try {
            const midiNote = 12 * Math.log2(freq / 440) + 69;

            const isLowNote = midiNote < 55;
            const isMidNote = midiNote >= 55 && midiNote < 72;
            const isHighNote = midiNote >= 72;

            // Main tone
            mainSynth.triggerAttackRelease(freq, duration, time, velocity * 0.9);

            // Hammer attack
            const hammerVel = isHighNote ? velocity * 0.7 : velocity * 0.4;
            hammerSynth.triggerAttackRelease(freq * 2, 0.05, time, hammerVel);

            // Harmonics
            if (isHighNote) {
              harmonicSynth.triggerAttackRelease(freq * 2, duration * 0.6, time, velocity * 0.4);
            } else if (isMidNote) {
              harmonicSynth.triggerAttackRelease(freq * 1.5, duration * 0.5, time, velocity * 0.25);
            }

            // Sub bass for low notes
            if (isLowNote) {
              bassSynth.triggerAttackRelease(freq, duration * 1.2, time, velocity * 0.7);
              if (midiNote < 48) {
                bassSynth.triggerAttackRelease(freq / 2, duration * 1.5, time, velocity * 0.3);
              }
            }
          } catch (error) {
            console.warn('Audio playback error (synth may be disposed):', error);
          }
        }
      },

      releaseAll: () => {
        try {
          if (!mainSynth.disposed) {
            mainSynth.releaseAll();
            // Force silence by setting volume to -Infinity momentarily
            const originalVolume = mainSynth.volume.value;
            mainSynth.volume.rampTo(-Infinity, 0.05);
            setTimeout(() => {
              if (!mainSynth.disposed) mainSynth.volume.value = originalVolume;
            }, 100);
          }
          if (!hammerSynth.disposed) {
            hammerSynth.releaseAll();
            const originalVolume = hammerSynth.volume.value;
            hammerSynth.volume.rampTo(-Infinity, 0.05);
            setTimeout(() => {
              if (!hammerSynth.disposed) hammerSynth.volume.value = originalVolume;
            }, 100);
          }
          if (!harmonicSynth.disposed) {
            harmonicSynth.releaseAll();
            const originalVolume = harmonicSynth.volume.value;
            harmonicSynth.volume.rampTo(-Infinity, 0.05);
            setTimeout(() => {
              if (!harmonicSynth.disposed) harmonicSynth.volume.value = originalVolume;
            }, 100);
          }
          if (!bassSynth.disposed) {
            bassSynth.releaseAll();
            const originalVolume = bassSynth.volume.value;
            bassSynth.volume.rampTo(-Infinity, 0.05);
            setTimeout(() => {
              if (!bassSynth.disposed) bassSynth.volume.value = originalVolume;
            }, 100);
          }
        } catch (error) {
          console.warn('Audio release error:', error);
        }
      },

      forceStop: () => {
        try {
          // Immediately silence all synths
          if (!mainSynth.disposed) {
            mainSynth.releaseAll();
            mainSynth.volume.value = -Infinity;
            // Clear any scheduled notes
            mainSynth._voices.forEach(voice => {
              if (voice && !voice.disposed) {
                try {
                  voice.triggerRelease();
                } catch (e) {}
              }
            });
            // Restore volume after a brief moment
            setTimeout(() => {
              if (!mainSynth.disposed) mainSynth.volume.value = -12;
            }, 150);
          }
          if (!hammerSynth.disposed) {
            hammerSynth.releaseAll();
            hammerSynth.volume.value = -Infinity;
            hammerSynth._voices.forEach(voice => {
              if (voice && !voice.disposed) {
                try {
                  voice.triggerRelease();
                } catch (e) {}
              }
            });
            setTimeout(() => {
              if (!hammerSynth.disposed) hammerSynth.volume.value = -18;
            }, 150);
          }
          if (!harmonicSynth.disposed) {
            harmonicSynth.releaseAll();
            harmonicSynth.volume.value = -Infinity;
            harmonicSynth._voices.forEach(voice => {
              if (voice && !voice.disposed) {
                try {
                  voice.triggerRelease();
                } catch (e) {}
              }
            });
            setTimeout(() => {
              if (!harmonicSynth.disposed) harmonicSynth.volume.value = -22;
            }, 150);
          }
          if (!bassSynth.disposed) {
            bassSynth.releaseAll();
            bassSynth.volume.value = -Infinity;
            bassSynth._voices.forEach(voice => {
              if (voice && !voice.disposed) {
                try {
                  voice.triggerRelease();
                } catch (e) {}
              }
            });
            setTimeout(() => {
              if (!bassSynth.disposed) bassSynth.volume.value = -15;
            }, 150);
          }
        } catch (error) {
          console.warn('Force stop error:', error);
        }
      },

      dispose: () => {
        try {
          if (!mainSynth.disposed) mainSynth.dispose();
          if (!hammerSynth.disposed) hammerSynth.dispose();
          if (!harmonicSynth.disposed) harmonicSynth.dispose();
          if (!bassSynth.disposed) bassSynth.dispose();
        } catch (error) {
          console.warn('Audio disposal error:', error);
        }
      }
    };

    audioInitializedRef.current = true;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pianoRef.current) {
        pianoRef.current.dispose();
      }
      if (reverbRef.current) {
        reverbRef.current.dispose();
      }
    };
  }, []);

  // Update currentMidiId when URL parameter changes
  useEffect(() => {
    if (piece && piece !== currentMidiId) {
      setCurrentMidiId(piece);

      // Stop current playback
      setIsPlaying(false);
      setCurrentTime(0);
      startTimeRef.current = null;
      pausedTimeRef.current = 0;
      scheduledNotesRef.current.clear();
      setActiveNotes(new Set()); // Clear visual active notes
      setTempoMultiplier(1.0); // Reset tempo to normal

      // Safely release and dispose current audio
      if (pianoRef.current) {
        try {
          pianoRef.current.forceStop(); // Force stop all audio
          pianoRef.current.dispose();
        } catch (error) {
          console.warn('Error disposing audio during MIDI change:', error);
        }
        pianoRef.current = null;
      }

      // Reset audio initialization flag so it reinitializes on next play
      audioInitializedRef.current = false;
    }
  }, [piece, currentMidiId]);
  
  // Get visual properties for a note
  const getNoteVisuals = useCallback((note, track) => {
    const hue = track === 0 ? 35 : 25; // Warm gold/amber
    const saturation = 70 + (note % 12) * 2;
    const lightness = 50 + ((note - minNote) / totalKeys) * 15;
    return {
      color: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
      glow: `hsl(${hue}, 90%, 60%)`
    };
  }, []);
  
  // Draw piano roll
  const draw = useCallback((time) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const keyboardHeight = 100;
    const rollHeight = height - keyboardHeight;
    const lookAhead = 4000; // 4 seconds visible ahead

    // Build key position map (correct piano layout)
    const { positions, whiteKeyWidth, blackKeyWidth } = buildKeyPositions(minNote, maxNote, width);

    // Clear with dark background
    ctx.fillStyle = '#0a0908';
    ctx.fillRect(0, 0, width, height);

    // Draw subtle grid lines (only for white keys)
    ctx.strokeStyle = 'rgba(255, 200, 100, 0.05)';
    ctx.lineWidth = 1;
    for (let note = minNote; note <= maxNote; note++) {
      if (isWhiteKey(note) && positions[note]) {
        const x = positions[note].x;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, rollHeight);
        ctx.stroke();
      }
    }
    
    // Active notes for this frame
    const newActiveNotes = new Set();
    
    // Draw falling notes
    activeMidiData.notes.forEach(([note, startMs, durationMs, velocity, track]) => {
      const noteEnd = startMs + durationMs;
      
      // Check if note should be played
      if (startMs <= time && noteEnd > time) {
        newActiveNotes.add(note);
        
        // Schedule sound if not already scheduled
        const noteKey = `${note}-${startMs}`;
        if (!scheduledNotesRef.current.has(noteKey) && pianoRef.current && pianoRef.current.triggerAttackRelease) {
          scheduledNotesRef.current.add(noteKey);
          // Convert MIDI note to frequency
          const freq = 440 * Math.pow(2, (note - 69) / 12);
          try {
            pianoRef.current.triggerAttackRelease(freq, durationMs / 1000, undefined, velocity / 127 * 0.6);
          } catch (error) {
            console.warn('Note scheduling error:', error);
          }
        }
      }
      
      // Only draw notes in visible range
      if (noteEnd < time - 100 || startMs > time + lookAhead) return;

      // Get position from the map
      const pos = positions[note];
      if (!pos) return;

      const x = pos.x;
      const noteWidth = pos.width;
      const noteHeight = Math.max(4, (durationMs / lookAhead) * rollHeight);

      // Calculate y position: notes fall from top to keyboard
      const timeUntilNote = startMs - time;
      const y = rollHeight - noteHeight - (timeUntilNote / lookAhead) * rollHeight;

      const { color, glow } = getNoteVisuals(note, track);
      const isActive = startMs <= time && noteEnd > time;

      // Draw glow effect for active notes
      if (isActive) {
        const gradient = ctx.createRadialGradient(
          x + noteWidth / 2, y + noteHeight / 2, 0,
          x + noteWidth / 2, y + noteHeight / 2, noteWidth * 2
        );
        gradient.addColorStop(0, 'rgba(255, 180, 80, 0.4)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(x - noteWidth, y - noteWidth, noteWidth * 3, noteHeight + noteWidth * 2);
      }

      // Draw note bar with rounded corners
      const radius = Math.min(4, noteWidth / 3);
      ctx.beginPath();
      ctx.roundRect(x + 1, y, noteWidth - 2, noteHeight, radius);

      // Gradient fill
      const noteGradient = ctx.createLinearGradient(x, y, x + noteWidth, y);
      noteGradient.addColorStop(0, color);
      noteGradient.addColorStop(0.5, isActive ? glow : color);
      noteGradient.addColorStop(1, color);
      ctx.fillStyle = noteGradient;
      ctx.fill();

      // Bright edge
      if (isActive) {
        ctx.strokeStyle = 'rgba(255, 255, 200, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw note name on the bar (if enabled and bar is wide enough)
      if (showNoteNames && noteWidth > 15 && noteHeight > 10) {
        // Only show note name if:
        // 1. Note is starting soon (within 1 second of start)
        // 2. OR it's a long note and we show it periodically (every 2 seconds)
        const timeUntilStart = startMs - time;
        const timeSinceStart = time - startMs;
        const showAtStart = timeUntilStart > -500 && timeUntilStart < 1000; // Show when note starts
        const showPeriodically = durationMs > 2000 && timeSinceStart > 0 && (Math.floor(timeSinceStart / 2000) % 2 === 0); // Show every 2 seconds for long notes

        if (showAtStart || showPeriodically) {
          const noteName = getNoteName(note, currentMidi.scale);
          ctx.save();

          // Use a larger, bold font for better mobile readability
          const fontSize = Math.min(24, Math.max(12, noteWidth * 0.5));
          ctx.font = `bold ${fontSize}px Arial, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Draw thicker dark outline for better contrast
          ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
          ctx.lineWidth = Math.max(3, fontSize * 0.2);
          ctx.strokeText(noteName, x + noteWidth / 2, y + noteHeight / 2);

          // Draw bright white text on top
          ctx.fillStyle = '#ffffff';
          ctx.fillText(noteName, x + noteWidth / 2, y + noteHeight / 2);

          ctx.restore();
        }
      }
    });
    
    setActiveNotes(newActiveNotes);
    
    // Draw keyboard
    const keyY = rollHeight;

    // Draw white keys first
    for (let note = minNote; note <= maxNote; note++) {
      if (!isWhiteKey(note)) continue;

      const pos = positions[note];
      if (!pos) continue;

      const x = pos.x;
      const isActive = newActiveNotes.has(note);

      // Key gradient
      const keyGrad = ctx.createLinearGradient(x, keyY, x, height);
      if (isActive) {
        keyGrad.addColorStop(0, '#ffd280');
        keyGrad.addColorStop(1, '#cc9540');
      } else {
        keyGrad.addColorStop(0, '#f8f4f0');
        keyGrad.addColorStop(0.9, '#d8d4d0');
        keyGrad.addColorStop(1, '#c8c4c0');
      }

      ctx.fillStyle = keyGrad;
      ctx.fillRect(x, keyY, whiteKeyWidth, keyboardHeight);

      // Draw separator line on right edge
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + whiteKeyWidth, keyY);
      ctx.lineTo(x + whiteKeyWidth, height);
      ctx.stroke();
    }

    // Draw black keys on top
    for (let note = minNote; note <= maxNote; note++) {
      if (!isBlackKey(note)) continue;

      const pos = positions[note];
      if (!pos) continue;

      const x = pos.x;
      const blackKeyHeight = keyboardHeight * 0.6;
      const isActive = newActiveNotes.has(note);

      // Draw shadow for depth
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.roundRect(x + 2, keyY + 2, blackKeyWidth, blackKeyHeight, [0, 0, 3, 3]);
      ctx.fill();

      const keyGrad = ctx.createLinearGradient(x, keyY, x, keyY + blackKeyHeight);
      if (isActive) {
        keyGrad.addColorStop(0, '#ffb060');
        keyGrad.addColorStop(1, '#cc7020');
      } else {
        keyGrad.addColorStop(0, '#3a3836');
        keyGrad.addColorStop(0.5, '#2a2826');
        keyGrad.addColorStop(1, '#1a1816');
      }

      ctx.fillStyle = keyGrad;
      ctx.beginPath();
      ctx.roundRect(x, keyY, blackKeyWidth, blackKeyHeight, [0, 0, 3, 3]);
      ctx.fill();

      // Highlight on top edge
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 2, keyY + 1);
      ctx.lineTo(x + blackKeyWidth - 2, keyY + 1);
      ctx.stroke();
    }
    
    // Draw playhead line
    ctx.strokeStyle = 'rgba(255, 200, 100, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, rollHeight);
    ctx.lineTo(width, rollHeight);
    ctx.stroke();
    
  }, [getNoteVisuals, totalKeys, activeMidiData]);
  
  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;
    
    const animate = (timestamp) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp - pausedTimeRef.current;
      }

      const elapsed = (timestamp - startTimeRef.current) * tempoMultiplier;
      setCurrentTime(elapsed);

      if (elapsed >= duration) {
        setIsPlaying(false);
        setCurrentTime(0);
        startTimeRef.current = null;
        pausedTimeRef.current = 0;
        scheduledNotesRef.current.clear();
        setActiveNotes(new Set()); // Clear visual active notes
        pianoRef.current?.forceStop(); // Force stop all audio
        return;
      }
      
      draw(elapsed);
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, draw, duration, activeMidiData, tempoMultiplier]);
  
  // Initial draw when not playing
  useEffect(() => {
    if (!isPlaying && canvasRef.current) {
      draw(currentTime);
    }
  }, [isPlaying, currentTime, draw, activeMidiData]);

  // Auto-play when component mounts or MIDI changes
  useEffect(() => {
    const autoPlay = async () => {
      try {
        await initAudio();
        if (!isPlaying) {
          scheduledNotesRef.current.clear();
          setIsPlaying(true);
        }
      } catch (error) {
        console.warn('Auto-play failed (user gesture may be required):', error);
      }
    };

    // Small delay to ensure component is fully mounted
    const timer = setTimeout(autoPlay, 100);
    return () => clearTimeout(timer);
  }, [currentMidiId]); // Trigger when MIDI changes

  // Update meta tags for social sharing
  useEffect(() => {
    const songTitle = currentMidi.title || 'Piano Piece';
    const composer = currentMidi.composer || '';
    const pageTitle = `${songTitle} - Piano Visualizer${composer ? ` | ${composer}` : ''}`;
    const description = `Watch and listen to ${songTitle}${composer ? ` by ${composer}` : ''} on our interactive piano visualizer. See the notes fall as the music plays!`;

    // Update document title
    document.title = pageTitle;

    // Update or create meta tags
    const updateMetaTag = (property, content) => {
      let meta = document.querySelector(`meta[property="${property}"]`) ||
                 document.querySelector(`meta[name="${property}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(property.startsWith('og:') ? 'property' : 'name', property);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    // Open Graph tags for social sharing
    updateMetaTag('og:title', pageTitle);
    updateMetaTag('og:description', description);
    updateMetaTag('og:type', 'website');
    updateMetaTag('description', description);
    updateMetaTag('twitter:title', pageTitle);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:card', 'summary_large_image');

    return () => {
      // Reset title when component unmounts
      document.title = 'Piano Learning App';
    };
  }, [currentMidi]);
  
  const handlePlay = async () => {
    await initAudio();

    if (isPlaying) {
      setIsPlaying(false);
      pausedTimeRef.current = currentTime;
      startTimeRef.current = null;
      setActiveNotes(new Set()); // Clear visual active notes
      pianoRef.current?.forceStop(); // Force stop all audio
    } else {
      scheduledNotesRef.current.clear();
      setIsPlaying(true);
    }
  };
  
  const handleRestart = async () => {
    await initAudio();

    setIsPlaying(false);
    setCurrentTime(0);
    startTimeRef.current = null;
    pausedTimeRef.current = 0;
    scheduledNotesRef.current.clear();
    setActiveNotes(new Set()); // Clear visual active notes
    pianoRef.current?.forceStop(); // Force stop all audio

    setTimeout(() => {
      scheduledNotesRef.current.clear();
      setIsPlaying(true);
    }, 100);
  };
  
  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newTime = (x / rect.width) * duration;
    
    setCurrentTime(newTime);
    pausedTimeRef.current = newTime;
    startTimeRef.current = null;
    scheduledNotesRef.current.clear();
    pianoRef.current?.releaseAll();
    
    if (!isPlaying) {
      draw(newTime);
    }
  };

  const handleMidiChange = (e) => {
    const newMidiId = e.target.value;

    // Navigate to the new URL
    navigate(`/${newMidiId}`);
  };

  const getDifficultyColor = (difficulty) => {
    switch(difficulty) {
      case 'Easy': return '#4ade80';
      case 'Medium': return '#f59e0b';
      case 'Advanced': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0908 0%, #1a1614 50%, #0a0908 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px',
      fontFamily: '"Cormorant Garamond", Georgia, serif',
      color: '#e8e0d8'
    }}>
      {/* MIDI Selection Dropdown */}
      {!midiData && (
        <div style={{
          width: '100%',
          maxWidth: '1200px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'center',
          padding: '0 16px'
        }}>
          <div style={{
            background: 'rgba(212, 168, 85, 0.1)',
            border: '1px solid rgba(212, 168, 85, 0.3)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            maxWidth: '400px'
          }}>
            <label style={{
              fontSize: '0.9rem',
              color: '#d4a855',
              fontWeight: '500',
              letterSpacing: '0.05em'
            }}>
              SELECT PIECE:
            </label>
            <select
              value={currentMidiId}
              onChange={handleMidiChange}
              style={{
                background: 'rgba(10, 9, 8, 0.8)',
                border: '1px solid rgba(212, 168, 85, 0.5)',
                borderRadius: '6px',
                color: '#e8e0d8',
                padding: '8px 12px',
                fontSize: '0.85rem',
                fontFamily: '"Cormorant Garamond", Georgia, serif',
                cursor: 'pointer',
                width: '100%',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onMouseEnter={(e) => {
                e.target.style.borderColor = '#d4a855';
                e.target.style.boxShadow = '0 0 10px rgba(212, 168, 85, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = 'rgba(212, 168, 85, 0.5)';
                e.target.style.boxShadow = 'none';
              }}
            >
              {Object.entries(categorizedMusic).map(([category, songs]) => (
                <optgroup key={category} label={category}>
                  {songs.map((midi) => (
                    <option key={midi.id} value={midi.id}>
                      {midi.title} - {midi.composer} ({midi.difficulty}, {midi.duration})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

          </div>
        </div>
      )}

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '16px', padding: '0 16px' }}>
        <h1 style={{
          fontSize: `clamp(1.2rem, ${Math.min(2, Math.max(1.2, 35 / (title || currentMidi.title || 'PIANO PLAYER').length))}rem, 2rem)`,
          fontWeight: 300,
          letterSpacing: '0.05em',
          color: '#d4a855',
          margin: 0,
          textShadow: '0 0 20px rgba(212, 168, 85, 0.3)',
          lineHeight: 1.1,
          wordBreak: 'break-word',
          hyphens: 'auto'
        }}>
          {title || currentMidi.title || 'PIANO PLAYER'}
        </h1>

        <p style={{
          fontSize: '0.75rem',
          letterSpacing: '0.1em',
          color: '#8a7a6a',
          marginTop: '4px',
          fontWeight: 300,
          lineHeight: 1.2
        }}>
          {composer || currentMidi.composer || ''}
        </p>
      </div>
      
      {/* Canvas */}
      <div style={{
        width: '100%',
        maxWidth: '1200px',
        aspectRatio: '16/10',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(212, 168, 85, 0.2)',
        background: '#0a0908'
      }}>
        <canvas
          ref={canvasRef}
          width={1200}
          height={750}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
      
      {/* Controls */}
      <div style={{
        width: '100%',
        maxWidth: '1200px',
        marginTop: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* Progress bar */}
        <div
          onClick={handleSeek}
          style={{
            height: '6px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '3px',
            cursor: 'pointer',
            overflow: 'hidden'
          }}
        >
          <div style={{
            height: '100%',
            width: `${(currentTime / duration) * 100}%`,
            background: 'linear-gradient(90deg, #d4a855, #f0c878)',
            borderRadius: '3px',
            transition: isPlaying ? 'none' : 'width 0.1s ease'
          }} />
        </div>

        {/* Buttons and time */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px'
        }}>
          <span style={{ fontSize: '0.9rem', color: '#8a7a6a', minWidth: '50px' }}>
            {formatTime(currentTime)}
          </span>
          
          <button
            onClick={handleRestart}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              border: '1px solid rgba(212, 168, 85, 0.3)',
              background: 'transparent',
              color: '#d4a855',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => e.target.style.background = 'rgba(212, 168, 85, 0.1)'}
            onMouseLeave={e => e.target.style.background = 'transparent'}
          >
            ⟲
          </button>
          
          <button
            onClick={handlePlay}
            disabled={false}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              border: '2px solid #d4a855',
              background: 'linear-gradient(180deg, rgba(212, 168, 85, 0.2) 0%, rgba(212, 168, 85, 0.1) 100%)',
              color: '#d4a855',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              transition: 'all 0.2s ease',
              boxShadow: '0 0 20px rgba(212, 168, 85, 0.2)'
            }}
            onMouseEnter={e => {
              e.target.style.boxShadow = '0 0 30px rgba(212, 168, 85, 0.4)';
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={e => {
              e.target.style.boxShadow = '0 0 20px rgba(212, 168, 85, 0.2)';
              e.target.style.transform = 'scale(1)';
            }}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          
          <div style={{ width: '48px' }} />
          
          <span style={{ fontSize: '0.9rem', color: '#8a7a6a', minWidth: '50px', textAlign: 'right' }}>
            {formatTime(duration)}
          </span>
        </div>

        {/* Tempo Control */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 0',
          borderTop: '1px solid rgba(212, 168, 85, 0.2)',
          borderBottom: '1px solid rgba(212, 168, 85, 0.2)'
        }}>
          {/* Tempo Display */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '0.8rem', color: '#d4a855', fontWeight: '500' }}>
              TEMPO: {Math.round(((activeMidiData.tempo || 120) * tempoMultiplier))} BPM
            </span>
            <span style={{ fontSize: '0.7rem', color: '#8a7a6a' }}>
              ({tempoMultiplier.toFixed(1)}x speed)
            </span>
          </div>

          {/* Tempo Slider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <span style={{ fontSize: '0.7rem', color: '#8a7a6a' }}>0.25x</span>
            <input
              type="range"
              min="0.25"
              max="2.0"
              step="0.05"
              value={tempoMultiplier}
              onChange={(e) => setTempoMultiplier(parseFloat(e.target.value))}
              style={{
                width: '200px',
                height: '4px',
                borderRadius: '2px',
                background: 'linear-gradient(90deg, rgba(212, 168, 85, 0.3) 0%, rgba(212, 168, 85, 0.6) 50%, rgba(212, 168, 85, 1) 100%)',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
            <span style={{ fontSize: '0.7rem', color: '#8a7a6a' }}>2.0x</span>
          </div>

          {/* Tempo Presets */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginTop: '4px'
          }}>
            {[0.5, 0.75, 1.0, 1.25, 1.5].map(speed => (
              <button
                key={speed}
                onClick={() => setTempoMultiplier(speed)}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.7rem',
                  border: `1px solid ${tempoMultiplier === speed ? '#d4a855' : 'rgba(212, 168, 85, 0.3)'}`,
                  background: tempoMultiplier === speed ? 'rgba(212, 168, 85, 0.2)' : 'transparent',
                  color: tempoMultiplier === speed ? '#d4a855' : '#8a7a6a',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => {
                  if (tempoMultiplier !== speed) {
                    e.target.style.background = 'rgba(212, 168, 85, 0.1)';
                    e.target.style.color = '#d4a855';
                  }
                }}
                onMouseLeave={e => {
                  if (tempoMultiplier !== speed) {
                    e.target.style.background = 'transparent';
                    e.target.style.color = '#8a7a6a';
                  }
                }}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Note Names Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '8px',
            justifyContent: 'center'
          }}>
            <span style={{ fontSize: '0.7rem', color: '#8a7a6a' }}>Note Names:</span>
            <button
              onClick={() => setShowNoteNames(!showNoteNames)}
              style={{
                padding: '4px 12px',
                fontSize: '0.7rem',
                border: `1px solid ${showNoteNames ? '#d4a855' : 'rgba(212, 168, 85, 0.3)'}`,
                background: showNoteNames ? 'rgba(212, 168, 85, 0.2)' : 'transparent',
                color: showNoteNames ? '#d4a855' : '#8a7a6a',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                if (!showNoteNames) {
                  e.target.style.background = 'rgba(212, 168, 85, 0.1)';
                  e.target.style.color = '#d4a855';
                }
              }}
              onMouseLeave={e => {
                if (!showNoteNames) {
                  e.target.style.background = 'transparent';
                  e.target.style.color = '#8a7a6a';
                }
              }}
            >
              {showNoteNames ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '16px',
        fontSize: '0.7rem',
        color: '#5a4a3a',
        letterSpacing: '0.05em'
      }}>
        Click progress bar to seek • {activeMidiData.notes.length} notes • FM Piano
      </div>
    </div>
  );
}
