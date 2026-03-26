import os
from dotenv import load_dotenv

load_dotenv()

def check_pem():
    key = os.getenv("GOOGLE_PRIVATE_KEY")
    if not key: return
    clean = key.replace("\\n", "\n").replace("\"", "").strip()
    lines = clean.split("\n")
    for i, line in enumerate(lines):
        print(f"Line {i}: {len(line)} chars | {repr(line[:10])}...{repr(line[-10:])}")

if __name__ == "__main__":
    check_pem()
