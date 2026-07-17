import urllib.request
import json
import os

API_KEY = "sk_1247e51ca4bf7ef80825907cd6bdf2e9e9a69d812d9645e5"
HEADERS = {
    "Accept": "audio/mpeg",
    "Content-Type": "application/json",
    "xi-api-key": API_KEY
}

SCRIPT_TEXT = """Decentralized finance is autonomous, open, and fast. The future belongs to AI agents executing thousands of transactions per second.
But they have a fatal flaw. They are completely blind to the fundamental risks of what they are buying.
Enter Watch Tower. The first AI-native security oracle and onchain attestation protocol.
Before an agent acts, Watch Tower intercepts. It aggregates live risk signals across liquidity depth, contract DNA, whale concentration, and social sentiment.
Live demo. M C P Firewall Scan on Bitconnect. Suspicious signals detected, returning caution and review. The agent reviews the threat report before deciding its next move.
Live demo. Deep Scan on Pepe, plus x 4 0 2 settlement. The agent settles for intelligence with U S D T on X Layer. The report returns an execute verdict. The trade proceeds safely.
Human operators get a glass cockpit view. The Watch Tower Command Center provides real-time telemetry of every autonomous decision. Monitor scans across all supported EVM chains in real-time. Deep scans generate a deterministic receipt, cryptographically anchored on X Layer for immutable auditability.
With a few lines of our TypeScript SDK, any agent framework can integrate Watch Tower. By anchoring on X Layer, we make security receipts economically viable.
Build agents that trade faster. But more importantly… build agents that know when not to trade."""

def generate_audio(voice_name, voice_id, output_filename):
    print(f"Generating audio for {voice_name}...")
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    
    data = json.dumps({
        "text": SCRIPT_TEXT,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75
        }
    }).encode('utf-8')
    
    req = urllib.request.Request(url, data=data, headers=HEADERS, method='POST')
    try:
        with urllib.request.urlopen(req) as response:
            with open(output_filename, 'wb') as f:
                f.write(response.read())
            print(f"Saved: {output_filename}")
    except Exception as e:
        print(f"Failed to generate audio for {voice_name}: {e}")

def main():
    os.makedirs('public', exist_ok=True)
    
    voices_to_try = ["Marcus", "Callum", "Adam", "Antoni", "Josh"]
    found_voices = []
    
    url = "https://api.elevenlabs.io/v1/voices"
    req = urllib.request.Request(url, headers={"xi-api-key": API_KEY})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            voices = data.get("voices", [])
            voice_dict = {v["name"]: v["voice_id"] for v in voices}
            
            target_names = ["Marcus", "Callum"]
            for target in target_names:
                if target in voice_dict:
                    found_voices.append((target, voice_dict[target]))
                else:
                    for backup in voices_to_try:
                        if backup in voice_dict and backup not in [v[0] for v in found_voices]:
                            found_voices.append((backup, voice_dict[backup]))
                            break
    except Exception as e:
        print(f"Failed to fetch voices: {e}")
        return
        
    for i, (name, voice_id) in enumerate(found_voices[:2]):
        output_file = f"public/voiceover_{name.lower()}.mp3"
        generate_audio(name, voice_id, output_file)
        
    print("Done!")

if __name__ == "__main__":
    main()
