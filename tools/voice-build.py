# Renders every fixed spoken line of the game (simulator/voice-lines.js) with Piper, Indonesian voice id_ID-news_tts-medium,
# into small MP3 clips, and keeps the model next to them so the game can synthesise the other lines on the device.
#   node tools/voice-lines.mjs | python3 tools/voice-build.py <out-dir> <model.onnx>
# Output: <out>/clips/<hash>.mp3, <out>/index.json ({hash: {file, text}}), <out>/model/id_ID-news_tts-medium.onnx(.json)
import json, os, shutil, subprocess, sys, wave
from piper import PiperVoice, SynthesisConfig

out, model = sys.argv[1], sys.argv[2]
lines = json.load(sys.stdin)
os.makedirs(f'{out}/clips', exist_ok=True); os.makedirs(f'{out}/model', exist_ok=True)
voice = PiperVoice.load(model)
cfg = SynthesisConfig(length_scale=1.02, noise_scale=0.6, noise_w_scale=0.75)
index = {}
for item in lines:
    h, text = item['hash'], item['text']
    mp3 = f'{out}/clips/{h}.mp3'
    if not os.path.exists(mp3):
        wav = f'/tmp/{h}.wav'
        with wave.open(wav, 'wb') as w: voice.synthesize_wav(text, w, syn_config=cfg)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-ac', '1', '-ar', '22050', '-b:a', '48k', mp3], check=True)
        os.remove(wav)
    index[h] = {'file': f'clips/{h}.mp3', 'text': text}
    print(h, os.path.getsize(mp3), text[:60])
for f in [model, model + '.json']: shutil.copy(f, f'{out}/model/' + os.path.basename(f))
json.dump({'voice': 'id_ID-news_tts-medium', 'model': 'model/' + os.path.basename(model), 'clips': index}, open(f'{out}/index.json', 'w'), ensure_ascii=False, indent=1)
print(len(index), 'clips')
