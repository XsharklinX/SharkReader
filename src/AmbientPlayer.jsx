import React, { useState, useEffect, useRef, useCallback } from 'react';

// Pink noise buffer — more natural than white noise for ambient sounds
const makePinkNoise = (ctx, seconds = 10) => {
    const n = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
        for (let i = 0; i < n; i++) {
            const w = Math.random() * 2 - 1;
            b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
            b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
            b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
            d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;
            b6 = w*0.115926;
        }
    }
    return buf;
};

const addLfo = (ctx, targetParam, rate, depth) => {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = rate;
    lfoGain.gain.value = depth;
    lfo.connect(lfoGain);
    lfoGain.connect(targetParam);
    lfo.start();
    return lfo;
};

// Each preset builds its own Web Audio graph and returns a cleanup fn
const BUILDERS = {
    rain: (ctx, masterGain, vol) => {
        // Gentle rain: lowpass + very fast subtle shimmer
        const src = ctx.createBufferSource();
        src.buffer = makePinkNoise(ctx);
        src.loop = true;
        const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=500; f.Q.value=0.7;
        const g = ctx.createGain(); g.gain.value = vol * 0.9;
        src.connect(f); f.connect(g); g.connect(masterGain);
        const lfos = [addLfo(ctx, g.gain, 9, vol * 0.07)]; // fast droplet shimmer
        src.start();
        return () => { try{src.stop();}catch(_){} lfos.forEach(l=>{try{l.stop();}catch(_){}}) };
    },

    storm: (ctx, masterGain, vol) => {
        // Heavy storm: deep lowpass + slow dramatic surges + bass rumble oscillator
        const src = ctx.createBufferSource();
        src.buffer = makePinkNoise(ctx);
        src.loop = true;
        const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=320; f.Q.value=0.5;
        const g = ctx.createGain(); g.gain.value = vol * 0.6; // base, LFO adds surges
        src.connect(f); f.connect(g); g.connect(masterGain);

        // Thunder rumble: low-freq sine oscillator
        const rumble = ctx.createOscillator(); rumble.type='sine'; rumble.frequency.value=58;
        const rumbleGain = ctx.createGain(); rumbleGain.gain.value = vol * 0.07;
        rumble.connect(rumbleGain); rumbleGain.connect(masterGain);
        rumble.start(); src.start();

        const lfos = [
            addLfo(ctx, g.gain, 0.22, vol * 0.55), // slow storm surges
            addLfo(ctx, f.frequency, 0.07, 120),    // filter sweep (thunder roll)
        ];
        return () => {
            [src, rumble].forEach(n=>{try{n.stop();}catch(_){}});
            lfos.forEach(l=>{try{l.stop();}catch(_){}});
        };
    },

    forest: (ctx, masterGain, vol) => {
        // Forest: highpass filtered (airy, no heavy bass) + gentle slow breeze
        const src = ctx.createBufferSource();
        src.buffer = makePinkNoise(ctx);
        src.loop = true;
        const hp = ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=700; hp.Q.value=0.4;
        const bp = ctx.createBiquadFilter(); bp.type='peaking'; bp.frequency.value=2200; bp.Q.value=0.8; bp.gain.value=5;
        const g = ctx.createGain(); g.gain.value = vol * 0.5;
        src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(masterGain);
        src.start();
        const lfos = [
            addLfo(ctx, g.gain, 0.13, vol * 0.22),    // gentle breeze
            addLfo(ctx, hp.frequency, 0.08, 200),      // filter wander (wind direction)
        ];
        return () => { try{src.stop();}catch(_){} lfos.forEach(l=>{try{l.stop();}catch(_){}}) };
    },

    cafe: (ctx, masterGain, vol) => {
        // Café: bandpass focused on speech frequencies + subtle chatty rhythm
        const src = ctx.createBufferSource();
        src.buffer = makePinkNoise(ctx);
        src.loop = true;
        const f1 = ctx.createBiquadFilter(); f1.type='bandpass'; f1.frequency.value=1400; f1.Q.value=0.5;
        const f2 = ctx.createBiquadFilter(); f2.type='highshelf'; f2.frequency.value=3000; f2.gain.value=-8;
        const g = ctx.createGain(); g.gain.value = vol * 0.65;
        src.connect(f1); f1.connect(f2); f2.connect(g); g.connect(masterGain);
        src.start();
        // Multiple LFOs at conversational rhythm create a "chatter" texture
        const lfos = [
            addLfo(ctx, g.gain, 1.6, vol * 0.1),
            addLfo(ctx, g.gain, 2.4, vol * 0.07),
            addLfo(ctx, f1.frequency, 0.5, 200),
        ];
        return () => { try{src.stop();}catch(_){} lfos.forEach(l=>{try{l.stop();}catch(_){}}) };
    },

    ocean: (ctx, masterGain, vol) => {
        // Ocean: very deep lowpass + extremely slow wave LFO (waves crashing)
        const src = ctx.createBufferSource();
        src.buffer = makePinkNoise(ctx);
        src.loop = true;
        const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=200; f.Q.value=1.1;
        // Base gain is low; LFO brings it up to full vol — creates silence then crash
        const g = ctx.createGain(); g.gain.value = vol * 0.1;
        src.connect(f); f.connect(g); g.connect(masterGain);
        src.start();
        const lfos = [
            addLfo(ctx, g.gain, 0.07, vol * 0.85), // big slow wave (every ~14s)
            addLfo(ctx, g.gain, 0.19, vol * 0.25), // secondary wave
            addLfo(ctx, f.frequency, 0.07, 80),     // frequency sweep with wave
        ];
        return () => { try{src.stop();}catch(_){} lfos.forEach(l=>{try{l.stop();}catch(_){}}) };
    },

    fire: (ctx, masterGain, vol) => {
        // Fire: bandpass + multiple staggered LFOs create irregular crackling
        const src = ctx.createBufferSource();
        src.buffer = makePinkNoise(ctx);
        src.loop = true;
        const f = ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=680; f.Q.value=1.6;
        const g = ctx.createGain(); g.gain.value = vol * 0.55;
        src.connect(f); f.connect(g); g.connect(masterGain);
        src.start();
        // Prime-ish frequencies create pseudo-random crackling pattern
        const lfos = [
            addLfo(ctx, g.gain, 3.7, vol * 0.28),
            addLfo(ctx, g.gain, 5.3, vol * 0.18),
            addLfo(ctx, g.gain, 7.1, vol * 0.12),
            addLfo(ctx, f.frequency, 2.9, 150),
        ];
        return () => { try{src.stop();}catch(_){} lfos.forEach(l=>{try{l.stop();}catch(_){}}) };
    },
};

const PRESETS = [
    { id: 'rain',   emoji: '🌧️', label: 'Lluvia' },
    { id: 'storm',  emoji: '⛈️', label: 'Tormenta' },
    { id: 'forest', emoji: '🌲', label: 'Bosque' },
    { id: 'cafe',   emoji: '☕', label: 'Café' },
    { id: 'ocean',  emoji: '🌊', label: 'Océano' },
    { id: 'fire',   emoji: '🔥', label: 'Hoguera' },
];

const AmbientPlayer = () => {
    const [playing, setPlaying]   = useState(false);
    const [preset, setPreset]     = useState('rain');
    const [volume, setVolume]     = useState(0.4);
    const [expanded, setExpanded] = useState(false);

    const audioCtxRef   = useRef(null);
    const masterGainRef = useRef(null);
    const cleanupRef    = useRef(null);

    const stop = useCallback(() => {
        cleanupRef.current?.();
        cleanupRef.current = null;
    }, []);

    const start = useCallback(async () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') await ctx.resume();

        stop();

        const master = ctx.createGain();
        master.gain.value = 1;
        master.connect(ctx.destination);
        masterGainRef.current = master;

        const builder = BUILDERS[preset] || BUILDERS.rain;
        cleanupRef.current = builder(ctx, master, volume);
    }, [preset, volume, stop]);

    // Restart when preset changes while playing
    useEffect(() => {
        if (playing) start();
        else stop();
        return stop;
    }, [playing, preset]);

    // Smooth volume changes without restarting
    useEffect(() => {
        if (masterGainRef.current) {
            masterGainRef.current.gain.setTargetAtTime(volume > 0 ? 1 : 0, audioCtxRef.current?.currentTime || 0, 0.1);
        }
        // Also update internal gain by restarting — simplest approach for now
        if (playing) start();
    }, [volume]);

    const currentPreset = PRESETS.find(p => p.id === preset);

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-2">
            {expanded && (
                <div className="rounded-2xl shadow-2xl border p-4 w-64 fade-in"
                    style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>

                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-3">Sonido Ambiente</p>

                    <div className="grid grid-cols-3 gap-1.5 mb-4">
                        {PRESETS.map(p => (
                            <button key={p.id} onClick={() => setPreset(p.id)}
                                className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl text-xs font-bold transition"
                                style={{
                                    backgroundColor: preset === p.id ? 'var(--highlight)' : 'var(--bg-color)',
                                    color: preset === p.id ? 'white' : 'var(--text-color)',
                                    opacity: preset === p.id ? 1 : 0.6,
                                }}>
                                <span className="text-base leading-none">{p.emoji}</span>
                                <span className="text-[9px]">{p.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm opacity-50">{volume < 0.15 ? '🔈' : volume < 0.6 ? '🔉' : '🔊'}</span>
                        <input type="range" min="0.05" max="1" step="0.05" value={volume}
                            onChange={e => setVolume(parseFloat(e.target.value))}
                            className="flex-1 h-1.5 rounded-full"
                            style={{ accentColor: 'var(--highlight)' }} />
                        <span className="text-[10px] font-black opacity-40 w-7 text-right">{Math.round(volume * 100)}%</span>
                    </div>
                </div>
            )}

            <button
                onClick={() => {
                    if (!playing) { setPlaying(true); setExpanded(true); }
                    else setExpanded(p => !p);
                }}
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-xl transition hover:scale-105 active:scale-95 relative"
                style={{
                    background: playing ? 'linear-gradient(135deg, var(--topbar-bg), var(--highlight))' : 'var(--surface-bg)',
                    border: '1px solid var(--border-color)',
                    color: playing ? 'white' : 'var(--text-color)',
                }}
                title={playing ? `${currentPreset?.label} — clic para expandir` : 'Música ambiente'}>
                {playing ? currentPreset?.emoji : '🎵'}
                {playing && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400 border-2 border-white dark:border-gray-900 animate-pulse" />}
            </button>

            {playing && (
                <button onClick={() => { setPlaying(false); setExpanded(false); }}
                    className="text-[10px] font-black opacity-40 hover:opacity-100 transition px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5">
                    ■ Stop
                </button>
            )}
        </div>
    );
};

export default AmbientPlayer;
