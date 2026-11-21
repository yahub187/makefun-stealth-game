// Sound, synthesised with WebAudio: no audio files, nothing over the network. Footsteps
// tell you where a guard is (panned left and right, louder when close); a short sting
// marks the alarm, a chime marks a file, a clink marks a thrown coin.
export function createAudio() {
  let context = null;
  let master = null;
  let ambient = null;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, gain, when = 0, slideTo = null) {
    if (!ensure()) return;
    const start = context.currentTime + when;
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    amp.gain.setValueAtTime(0, start);
    amp.gain.linearRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(amp);
    amp.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  function noiseBurst(dur, filterFreq, gain, pan = 0) {
    if (!ensure()) return;
    const start = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const amp = context.createGain();
    amp.gain.value = gain;
    const panner = context.createStereoPanner ? context.createStereoPanner() : null;
    source.connect(filter);
    filter.connect(amp);
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      amp.connect(panner);
      panner.connect(master);
    } else {
      amp.connect(master);
    }
    source.start(start);
  }

  return {
    /** Call on the first gesture: browsers only let sound start after one. */
    unlock() {
      ensure();
    },
    startAmbient() {
      if (!ensure() || ambient) return;
      const osc = context.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 55;
      const amp = context.createGain();
      amp.gain.value = 0.035;
      const lfo = context.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoAmp = context.createGain();
      lfoAmp.gain.value = 0.015;
      lfo.connect(lfoAmp);
      lfoAmp.connect(amp.gain);
      osc.connect(amp);
      amp.connect(master);
      osc.start();
      lfo.start();
      ambient = { osc, lfo };
    },
    /** A guard's step: closer is louder, left and right follow the guard. */
    footstep(distance, pan) {
      const gain = Math.max(0, 0.22 * (1 - distance / 520));
      if (gain < 0.02) return;
      noiseBurst(0.07, 420, gain, pan);
    },
    noticed() {
      tone(660, 0.14, 'sine', 0.16);
      tone(880, 0.18, 'sine', 0.14, 0.09);
    },
    alarm() {
      tone(220, 0.32, 'sawtooth', 0.14, 0, 440);
      tone(220, 0.32, 'sawtooth', 0.12, 0.16, 440);
    },
    pickup() {
      tone(880, 0.1, 'sine', 0.16);
      tone(1318, 0.16, 'sine', 0.14, 0.08);
    },
    coin() {
      tone(2093, 0.07, 'triangle', 0.14);
      tone(1568, 0.1, 'triangle', 0.1, 0.06);
    },
    caught() {
      tone(196, 0.5, 'sawtooth', 0.16, 0, 98);
    },
    levelDone() {
      tone(523, 0.12, 'sine', 0.15);
      tone(659, 0.12, 'sine', 0.15, 0.1);
      tone(784, 0.22, 'sine', 0.15, 0.2);
    },
    win() {
      [523, 659, 784, 1046].forEach((freq, i) => tone(freq, 0.3, 'sine', 0.15, i * 0.13));
    },
  };
}
