import { passacagliaMidiData } from './passacaglia';
import { twinkleMidiData } from './twinkle';
import { maryMidiData } from './mary';
import { odeToJoyMidiData } from './ode-to-joy';
import { walkingInTheAirMidiData } from './walking-in-the-air';
import { fuguebwv1080c01MidiData } from './fugue-bwv-1080-c01';
import type { MidiData } from './passacaglia';
import { ekladkibheegibhaagisiMidiData } from './ek-ladki-bheegi-bhaagi-si';
import { aachalketujheMidiData } from './aa-chal-ke-tujhe';

import { mariagedamourMidiData } from './mariage-damour';
import { dolafzonkihaiMidiData } from './do-lafzon-ki-hai';
import { lovestoryMidiData } from './love-story';
import { upmovieMidiData } from './up-movie';
import { hoshwalonkoMidiData } from './hosh-walon-ko';
import { tumhihoMidiData } from './tum-hi-ho';
import { raagyamanMidiData } from './raag-yaman';
import { eyeofthetigerMidiData } from './eye-of-the-tiger';
import { liftMeUpMidiData } from './lift-me-up';

export interface MidiCollection {
  id: string;
  title: string;
  composer: string;
  difficulty: 'Easy' | 'Medium' | 'Advanced';
  duration: string;
  scale?: string; // Optional field for musical scale/raga
  data: MidiData;
}

export const midiCollection: MidiCollection[] = [
  {
    id: 'passacaglia',
    title: 'Passacaglia',
    composer: 'Handel - Halvorsen',
    difficulty: 'Advanced',
    duration: '2:17',
    scale: 'C Major',
    data: passacagliaMidiData
  },
  
  {
    id: 'mariage-damour',
    title: 'Mariage d\'mour',
    composer: 'Intermediate',
    difficulty: 'Medium', // Adjust as needed
    duration: '4:12',
    scale: 'Bb Major',
    data: mariagedamourMidiData
  },
  {
    id: 'walking-in-the-air',
    title: 'Walking in the Air',
    composer: 'Howard Blake',
    difficulty: 'Advanced',
    duration: '0:27',
    scale: 'F Major',
    data: walkingInTheAirMidiData
  },
  {
    id: 'love-story',
    title: 'Love story',
    composer: 'Intermediate',
    difficulty: 'Medium', // Adjust as needed
    duration: '1:44',
    scale: 'Bb Major',
    data: lovestoryMidiData
  },
  {
    id: 'eye-of-the-tiger',
    title: 'Eye of the tiger',
    composer: 'Intermediate',
    difficulty: 'Medium', // Adjust as needed
    duration: '3:56',
    scale: 'Eb Major',
    data: eyeofthetigerMidiData
  },
  {
    id: 'up-movie',
    title: 'Up movie',
    composer: 'Intermediate',
    difficulty: 'Medium', // Adjust as needed
    duration: '3:52',
    scale: 'G Major',
    data: upmovieMidiData
  },
  {
    id: 'hosh-walon-ko',
    title: 'Hosh Walon ko',
    composer: 'Bollywood',
    difficulty: 'Medium', // Adjust as needed
    duration: '1:45',
    scale: 'G Major',
    data: hoshwalonkoMidiData
  },
  {
    id: 'ek-ladki-bheegi-bhaagi-si',
    title: 'Ek Ladki Bheegi Bhaagi Si',
    composer: 'Bollywood',
    difficulty: 'Medium', // Adjust as needed
    duration: '1:15',
    scale: 'C Major',
    data: ekladkibheegibhaagisiMidiData
  },
  {
    id: 'aa-chal-ke-tujhe',
    title: 'Aa Chal Ke Tujhe',
    composer: 'Bollywood',
    difficulty: 'Medium', // Adjust as needed
    duration: '4:43',
    scale: 'E Major',
    data: aachalketujheMidiData
  },

  {
    id: 'do-lafzon-ki-hai',
    title: 'Do lafzon ki hai',
    composer: 'Bollywood',
    difficulty: 'Medium', // Adjust as needed
    duration: '1:40',
    scale: 'F Major',
    data: dolafzonkihaiMidiData
  },
  {
    id: 'tum-hi-ho',
    title: 'Tum hi ho',
    composer: 'Bollywood',
    difficulty: 'Medium', // Adjust as needed
    duration: '5:22',
    scale: 'Ab Major',
    data: tumhihoMidiData
  },
  {
    id: 'raag-yaman',
    title: 'Aeri-aali-piya-bina',
    composer: 'Hindustani Classical',
    difficulty: 'Medium', // Adjust as needed
    duration: '1:01',
    scale: 'G Major',
    data: raagyamanMidiData
  },
  {
    id: 'lift-me-up',
    title: 'Lift Me Up',
    composer: "Rihanna / arr. L'Estrange",
    difficulty: 'Easy',
    duration: '0:44',
    scale: 'G Major',
    data: liftMeUpMidiData
  },
  {
    id: 'twinkle',
    title: 'Twinkle Twinkle Little Star',
    composer: 'Traditional',
    difficulty: 'Easy',
    duration: '0:24',
    scale: 'C Major',
    data: twinkleMidiData
  },
  {
    id: 'mary',
    title: 'Mary Had a Little Lamb',
    composer: 'Traditional',
    difficulty: 'Easy',
    duration: '0:16',
    scale: 'C Major',
    data: maryMidiData
  },
  {
    id: 'ode-to-joy',
    title: 'Ode to Joy',
    composer: 'Beethoven',
    difficulty: 'Medium',
    duration: '0:16',
    scale: 'C Major',
    data: odeToJoyMidiData
  },
  {
  id: 'fugue-bwv-1080-c01',
  title: 'Fugue BWV 1080 C01',
  composer: 'J.S. Bach',
  difficulty: 'Advanced',
  duration: '8:13',
  scale: 'F Major',
  data: fuguebwv1080c01MidiData
  }
];

export const getMidiById = (id: string): MidiCollection | undefined => {
  return midiCollection.find(midi => midi.id === id);
};