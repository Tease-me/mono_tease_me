import urllib.request
import subprocess

# Download a tiny 1-second silence MP3
url = "https://github.com/mathiasbynens/small/raw/master/mp3.mp3"
mp3_bytes = urllib.request.urlopen(url).read()

CHANNELS = 2
SAMPLE_RATE = 48000

result = subprocess.run(
    [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-i", "pipe:0",
        "-f", "s16le",
        "-ac", str(CHANNELS),
        "-ar", str(SAMPLE_RATE),
        "-acodec", "pcm_s16le",
        "pipe:1",
    ],
    input=mp3_bytes,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    timeout=30,
)
print("Return code:", result.returncode)
print("Stderr:", result.stderr.decode()[:500])
print("Output length:", len(result.stdout))
