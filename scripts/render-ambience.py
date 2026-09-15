"""Render the original Continuum miniature from CC BY 3.0 acoustic samples.
Requires Python + numpy/scipy and ffmpeg. Temporary downloads stay outside repo.
See assets/audio/CREDITS.md. Run from any directory; output is reproducible.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess, tempfile
import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parents[1]
REV = '622c2f1c32c8cfce4158ddc3eb26e518ddef37e5'
RATE = 32000
# Eight spacious, freely phrased measures in E minor; original melody/arrangement.
SCORE = [
 [('E2',0,.8),('B3',1.1,.48),('G3',2.65,.56),('E3',4.3,.43),('D4',6.1,.32)],
 [('C3',0,.66),('E3',1.6,.42),('B3',3.1,.47),('G3',5.4,.38)],
 [('A2',0,.73),('E3',.85,.4),('A3',2.8,.51),('B3',4.2,.35),('E4',5.85,.26)],
 [('B2',0,.62),('D3',1.8,.42),('A3',3.4,.35),('G3',5.3,.32)],
 [('E2',0,.72),('G3',1.2,.48),('B3',2.9,.4),('D4',4.7,.3),('B3',6.3,.32)],
 [('G2',0,.65),('D3',1.5,.42),('E3',3.6,.42),('A3',5.6,.3)],
 [('C3',0,.62),('G3',1.25,.4),('E4',3.2,.25),('D4',4.9,.28),('B3',6.1,.28)],
 [('B2',0,.54),('E3',1.7,.36),('G3',3.8,.33),('B3',5.1,.24)]
]
with tempfile.TemporaryDirectory(prefix='continuum-guitar-') as tmp:
    tmp = Path(tmp)
    notes = sorted({n for bar in SCORE for n,_,_ in bar})
    def download(note):
        dest = tmp / (note+'.wav')
        url = f'https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/{REV}/samples/guitar-acoustic/{note}.wav'
        subprocess.run(['curl','-fsSL','--retry','2','--max-time','35',url,'-o',str(dest)],check=True)
        raw = subprocess.check_output(['ffmpeg','-v','error','-i',str(dest),'-f','f32le','-ac','1','-ar',str(RATE),'-'])
        a = np.frombuffer(raw,dtype='<f4').astype(float)
        a = signal.sosfilt(signal.butter(2,[65,4200],btype='bandpass',fs=RATE,output='sos'),a)
        a /= max(np.max(np.abs(a)),1e-6)
        fade = min(int(.12*RATE),len(a)//2)
        a[-fade:] *= np.linspace(1,0,fade)
        a[:128] *= np.linspace(0,1,128)
        return note,a
    samples = dict(ThreadPoolExecutor(max_workers=5).map(download,notes))
    length = RATE*64
    dry = np.zeros(length)
    for bar,events in enumerate(SCORE):
        for idx,(note,offset,velocity) in enumerate(events):
            # A little breathing room at each phrase, never a metronomic strum.
            start = int((bar*8 + .25 + offset)*RATE)
            a = samples[note]*velocity
            np.add.at(dry,(np.arange(len(a))+start)%length,a)
    rng = np.random.default_rng(932)
    stereo=[]
    for channel in range(2):
        t=np.arange(int(2.8*RATE))/RATE
        impulse=rng.normal(size=len(t))*np.exp(-t*2.6)
        impulse=signal.sosfilt(signal.butter(2,2300,fs=RATE,output='sos'),impulse)
        impulse[:int(.035*RATE)]=0
        impulse /= np.sqrt(np.sum(impulse**2))
        wet=signal.fftconvolve(dry,impulse)
        wrapped=wet[:length].copy()
        wrapped[:len(wet)-length]+=wet[length:]
        stereo.append(dry*.9+wrapped*.16)
    out=np.stack(stereo,axis=1)
    out*=.72/np.max(np.abs(out))
    # The last phrase decays before the loop boundary; no click or hard cut.
    out[:320]*=np.linspace(0,1,320)[:,None]
    out[-320:]*=np.linspace(1,0,320)[:,None]
    assert np.isfinite(out).all() and np.max(np.abs(out)) < .73
    dest=ROOT/'assets/audio'; dest.mkdir(parents=True,exist_ok=True)
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(RATE),'-ac','2','-i','pipe:0','-c:a','libmp3lame','-b:a','112k','-metadata','title=Entre páginas','-metadata','comment=Original Continuum arrangement; guitar samples Iowa / N. P. Brosowsky, CC BY 3.0. See CREDITS.md',str(dest/'entre-paginas.mp3')],input=out.astype('<f4').tobytes(),check=True)
    print(f'64 seconds, stereo; peak {np.max(np.abs(out)):.3f}, RMS {np.sqrt(np.mean(out**2)):.3f}; {(dest/"entre-paginas.mp3").stat().st_size} bytes')
