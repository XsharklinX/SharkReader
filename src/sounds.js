let ctx = null;

function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

function play(fn, volume = 0.3) {
    try {
        const ac = getCtx();
        const gain = ac.createGain();
        gain.gain.value = volume;
        gain.connect(ac.destination);
        fn(ac, gain);
    } catch (_) {}
}

function tone(ac, gain, freq, start, dur, type = 'sine') {
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(ac.currentTime + start);
    osc.stop(ac.currentTime + start + dur);
}

export const sounds = {
    achievement(vol) {
        play((ac, g) => {
            g.gain.setValueAtTime(vol ?? 0.25, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.6);
            tone(ac, g, 587, 0, 0.12, 'triangle');
            tone(ac, g, 784, 0.1, 0.12, 'triangle');
            tone(ac, g, 1047, 0.2, 0.3, 'triangle');
        }, vol);
    },

    levelUp(vol) {
        play((ac, g) => {
            g.gain.setValueAtTime(vol ?? 0.2, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.8);
            tone(ac, g, 523, 0, 0.1, 'triangle');
            tone(ac, g, 659, 0.08, 0.1, 'triangle');
            tone(ac, g, 784, 0.16, 0.1, 'triangle');
            tone(ac, g, 1047, 0.24, 0.1, 'triangle');
            tone(ac, g, 1319, 0.32, 0.35, 'sine');
        }, vol);
    },

    streakMilestone(vol) {
        play((ac, g) => {
            g.gain.setValueAtTime(vol ?? 0.2, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.5);
            tone(ac, g, 440, 0, 0.1, 'sine');
            tone(ac, g, 554, 0.08, 0.1, 'sine');
            tone(ac, g, 659, 0.16, 0.25, 'sine');
        }, vol);
    },

    streakLost(vol) {
        play((ac, g) => {
            g.gain.setValueAtTime(vol ?? 0.15, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.5);
            tone(ac, g, 330, 0, 0.15, 'sine');
            tone(ac, g, 262, 0.12, 0.3, 'sine');
        }, vol);
    },

    pageTurn(vol) {
        play((ac, g) => {
            g.gain.setValueAtTime(vol ?? 0.06, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.08);
            const buf = ac.createBuffer(1, ac.sampleRate * 0.08, ac.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
            }
            const src = ac.createBufferSource();
            src.buffer = buf;
            const hp = ac.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 2000;
            src.connect(hp);
            hp.connect(g);
            src.start();
        }, vol);
    },

    bookFinished(vol) {
        play((ac, g) => {
            g.gain.setValueAtTime(vol ?? 0.2, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 1.0);
            tone(ac, g, 523, 0, 0.15, 'sine');
            tone(ac, g, 659, 0.12, 0.15, 'sine');
            tone(ac, g, 784, 0.24, 0.15, 'sine');
            tone(ac, g, 1047, 0.36, 0.15, 'sine');
            tone(ac, g, 1319, 0.48, 0.4, 'triangle');
        }, vol);
    },

    sharkyChirp(vol) {
        play((ac, g) => {
            g.gain.setValueAtTime(vol ?? 0.1, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.15);
            const osc = ac.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, ac.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, ac.currentTime + 0.05);
            osc.frequency.exponentialRampToValueAtTime(900, ac.currentTime + 0.12);
            osc.connect(g);
            osc.start();
            osc.stop(ac.currentTime + 0.15);
        }, vol);
    },

    click(vol) {
        play((ac, g) => {
            g.gain.setValueAtTime(vol ?? 0.08, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.03);
            tone(ac, g, 1000, 0, 0.03, 'square');
        }, vol);
    },
};
