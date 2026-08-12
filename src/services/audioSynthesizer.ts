// Web Audio API Synthesizer for Flutter Messenger ringtones and sound effects

class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private ringtoneInterval: number | null = null;
  private outgoingInterval: number | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Incoming Call Ringtone sound loop
  startRingtone() {
    this.stopRingtone();
    const playRing = () => {
      try {
        const ctx = this.getContext();
        const now = ctx.currentTime;

        // Two burst tones (Flutter / Phone ringstyle)
        [0, 0.4].forEach((delay) => {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(440, now + delay); // A4
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(480, now + delay); // Freq shift for ring tone

          gain.gain.setValueAtTime(0.15, now + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          osc1.start(now + delay);
          osc2.start(now + delay);
          osc1.stop(now + delay + 0.35);
          osc2.stop(now + delay + 0.35);
        });
      } catch (e) {
        console.warn('Audio play error:', e);
      }
    };

    playRing();
    this.ringtoneInterval = window.setInterval(playRing, 2200);
  }

  stopRingtone() {
    if (this.ringtoneInterval !== null) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
  }

  // Outgoing call ring tone
  startOutgoingRing() {
    this.stopOutgoingRing();
    const playBeep = () => {
      try {
        const ctx = this.getContext();
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(425, now);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(450, now);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.2);
        osc2.stop(now + 1.2);
      } catch (e) {
        console.warn('Outgoing ring error:', e);
      }
    };

    playBeep();
    this.outgoingInterval = window.setInterval(playBeep, 3000);
  }

  stopOutgoingRing() {
    if (this.outgoingInterval !== null) {
      clearInterval(this.outgoingInterval);
      this.outgoingInterval = null;
    }
  }

  // Call connected tone
  playConnectedChime() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        gain.gain.setValueAtTime(0.1, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.2);
      });
    } catch (e) {
      console.warn('Sound chime error:', e);
    }
  }

  // Hangup tone
  playHangupTone() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      [440, 350, 280].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);

        gain.gain.setValueAtTime(0.12, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.15);
      });
    } catch (e) {
      console.warn('Hangup tone error:', e);
    }
  }

  // Message Sent Pop Sound
  playMessageSentSound() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.06);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {
      console.warn('Message sound error:', e);
    }
  }

  // Message Received Notification Sound
  playMessageReceivedSound() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.setValueAtTime(1050, now + 0.08);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {
      console.warn('Received message sound error:', e);
    }
  }
}

export const sounds = new SoundSynthesizer();
