import os
from dotenv import load_dotenv

load_dotenv()

def check_b64():
    key = os.getenv("GOOGLE_PRIVATE_KEY")
    if not key: return
    clean = key.replace("\\n", "\n").replace("\"", "").strip()
    lines = clean.split("\n")
    b64 = "".join([l for l in lines if "-----" not in l])
    print(f"B64 Length: {len(b64)}")
    print(f"Mod 4: {len(b64) % 4}")
    
    # Check for invalid characters
    import string
    valid_chars = string.ascii_letters + string.digits + "+/="
    for i, c in enumerate(b64):
        if c not in valid_chars:
            print(f"Invalid char at {i}: {repr(c)}")

if __name__ == "__main__":
    check_b64()
