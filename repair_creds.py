import json
import os
from dotenv import load_dotenv

load_dotenv()

def repair():
    env_key = os.getenv("GOOGLE_PRIVATE_KEY")
    if not env_key: return
    
    clean_key = env_key.strip()
    if clean_key.startswith('"') and clean_key.endswith('"'):
        clean_key = clean_key[1:-1]
    
    # Replace literal \n with actual newlines
    clean_key = clean_key.replace("\\n", "\n")
    
    creds = {
        "type": "service_account",
        "project_id": os.getenv("GOOGLE_PROJECT_ID"),
        "private_key_id": "1237ce5f4ad6b2d740c0f9e7b82adef537cf93a5",
        "private_key": clean_key,
        "client_email": os.getenv("GOOGLE_CLIENT_EMAIL"),
        "client_id": "104356932892311999468",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{os.getenv('GOOGLE_CLIENT_EMAIL').replace('@', '%40')}",
        "universe_domain": "googleapis.com"
    }
    
    with open("credentials.json", "w") as f:
        json.dump(creds, f, indent=4)
        print("Repaired credentials.json")

if __name__ == "__main__":
    repair()
