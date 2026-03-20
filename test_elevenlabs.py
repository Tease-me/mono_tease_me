import requests
import json
import sys

API_KEY = "dummy" # we will pull from env
with open(".env", "r") as f:
    for line in f:
        if line.startswith("ELEVENLABS_API_KEY="):
            API_KEY = line.strip().split("=")[1].strip('"')
            break

url_query = "https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL/stream?output_format=pcm_24000"
resp = requests.post(
    url_query,
    headers={"xi-api-key": API_KEY, "Content-Type": "application/json"},
    json={
        "text": "Hello world. Testing connection.",
        "model_id": "eleven_turbo_v2_5"
    }
)
print(resp.status_code)
if resp.status_code == 200:
    print(len(resp.content))
    with open("test.pcm", "wb") as f:
        f.write(resp.content)
else:
    print(resp.text)
