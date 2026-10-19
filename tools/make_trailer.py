#!/usr/bin/env python3
"""Cut the raw Xvfb capture (/tmp/trailer/xgrab.mkv from test/trailer_rec.js, XGRAB=:99) into the Yandex Games
horizontal promo video: 1920x1080, 30 fps, H.264 + AAC, <=28 s.
Music: original pentatonic melody synthesised here with numpy (no third-party / copyrighted audio)."""
import subprocess, json, sys, wave, os
import numpy as np
RAW = '/tmp/trailer/xgrab.mkv'; OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'release/yandex_assets/trailer_1920x1080.mp4')
WAV = '/tmp/trailer/music.wav'
O = float(sys.argv[1]) if len(sys.argv) > 1 else 0.7
m = {k: t for k, t in json.load(open('/tmp/trailer/marks.json'))}; t0 = m['home']
M = {k: v - t0 + O for k, v in m.items()}
seg = [
  (M['home'] + 2.3, M['game'] + 0.95, 1),
  (M['game'] + 1.5, M['swiped'] + 0.95, 1),
  (M['card'] - 0.7, M['card'] + 1.9, 1),
  (M['map'] + 0.05, M['map'] + 2.25, 1),
  (M['daily'] + 1.2, M['daily'] + 5.1, 1),
  (M['spin'] + 0.8, M['spin'] + 2.2, 1),
  (M['spin'] + 2.2, M['spin'] + 6.2, 2),
  (M['spin'] + 6.2, M['spin'] + 6.9, 1),
  (M['spin'] + 8.1, M['spin'] + 9.3, 1),
  (M['end'] + 0.1, M['end'] + 1.3, 1),
]
dur = sum((e - s) / sp for s, e, sp in seg); print('total', round(dur, 2)); assert dur <= 28.0, dur

# --- synth music: major pentatonic (folk-like), 100 bpm, plucked lead + soft pad + light drum
SR = 48000; bpm = 100; beat = 60 / bpm; n = int(SR * (dur + 1)); out = np.zeros((n, 2))
def pluck(f, t0, d, a=.25, pan=0):
    s = int(t0 * SR); L = int(d * SR); tt = np.arange(L) / SR
    w = (np.sin(2*np.pi*f*tt) + .35*np.sin(4*np.pi*f*tt) + .12*np.sin(6*np.pi*f*tt)) * np.exp(-tt*4.5) * a
    w *= np.minimum(1, tt / .005); e = min(n, s + L); w = w[:e-s]
    out[s:e, 0] += w * (1 - pan) ; out[s:e, 1] += w * (1 + pan)
def pad(fs, t0, d, a=.05):
    s = int(t0 * SR); L = int(d * SR); tt = np.arange(L) / SR
    env = np.minimum(1, tt / .4) * np.minimum(1, (d - tt) / .5)
    w = sum(np.sin(2*np.pi*f*tt) + .5*np.sin(2*np.pi*f*1.003*tt) for f in fs) * env * a
    e = min(n, s + L); w = w[:e-s]; out[s:e] += w[:, None]
def kick(t0, a=.35):
    s = int(t0 * SR); L = int(.25 * SR); tt = np.arange(L) / SR
    w = np.sin(2*np.pi*(55 + 90*np.exp(-tt*30))*tt) * np.exp(-tt*14) * a; e = min(n, s + L); out[s:e] += w[:e-s, None]
def hat(t0, a=.04):
    s = int(t0 * SR); L = int(.06 * SR); w = np.random.randn(L) * np.exp(-np.arange(L)/SR*70) * a; e = min(n, s + L); out[s:e] += w[:e-s, None]
N = {'G3':196.0,'A3':220.0,'C4':261.63,'D4':293.66,'E4':329.63,'G4':392.0,'A4':440.0,'C5':523.25,'D5':587.33,'E5':659.25}
mel = ['C5','A4','G4','A4','C5','D5','E5','D5', 'C5','A4','G4','E4','G4','A4','C5','A4',
       'E5','D5','C5','A4','C5','D5','C5','A4', 'G4','A4','C5','D5','C5','A4','G4','G4']
chords = [['C4','E4','G4'],['A3','C4','E4'],['G3','C4','D4'],['C4','E4','G4']]
t = 0; i = 0
while t < dur + 1:
    bar = int(t / (4*beat))
    if abs(t / beat - round(t / beat)) < 1e-6:
        b = round(t / beat)
        if b % 4 == 0: pad([N[x] for x in chords[bar % 4]], t, 4*beat)
        if b % 2 == 0: kick(t)
        hat(t + beat/2)
    note = mel[i % len(mel)]; ln = beat/2 if i % 8 not in (3, 7) else beat
    pluck(N[note], t, 1.2, pan=.15 if i % 2 else -.15)
    if i % 8 == 0: pluck(N[note]/2, t, 1.5, a=.18)
    t += ln; i += 1
out = out[:int(SR*dur)]; out /= np.max(np.abs(out)) * 1.15
with wave.open(WAV, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype('<i2').tobytes())

fc = []
for i, (s, e, sp) in enumerate(seg):
    fc.append(f"[0:v]trim=start={s:.3f}:end={e:.3f},setpts=(PTS-STARTPTS)/{sp},fps=30[v{i}]")
fc.append(''.join(f'[v{i}]' for i in range(len(seg))) + f"concat=n={len(seg)}:v=1:a=0,format=yuv420p,fade=t=in:st=0:d=0.25,fade=t=out:st={dur - 0.6:.3f}:d=0.6,setsar=1[v]")
fc.append(f"[1:a]afade=t=in:st=0:d=0.3,afade=t=out:st={dur - 2.5:.3f}:d=2.5,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]")
cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-i', RAW, '-i', WAV, '-filter_complex', ';'.join(fc), '-map', '[v]', '-map', '[a]',
       '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1', '-preset', 'slow', '-crf', '18', '-maxrate', '12M', '-bufsize', '24M', '-pix_fmt', 'yuv420p', '-r', '30', '-g', '60',
       '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-movflags', '+faststart', '-t', f'{dur:.3f}', OUT]
subprocess.run(cmd, check=True); print('->', OUT)
