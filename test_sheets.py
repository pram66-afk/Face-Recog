import os
import json
import gspread
from google.oauth2 import service_account
from dotenv import load_dotenv

load_dotenv()

def test_sheets():
    env_key = os.getenv("GOOGLE_PRIVATE_KEY")
    if not env_key: return print("No key")
    
    clean_key = env_key.strip()
    if clean_key.startswith('"') and clean_key.endswith('"'):
        clean_key = clean_key[1:-1]
    clean_key = clean_key.replace("\\n", "\n")
    
    SCOPE = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
    
    try:
        info = {
            "type": "service_account",
            "project_id": os.getenv("GOOGLE_PROJECT_ID"),
            "private_key": clean_key,
            "client_email": os.getenv("GOOGLE_CLIENT_EMAIL"),
            "token_uri": "https://oauth2.googleapis.com/token",
        }
        creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPE)
        client = gspread.authorize(creds)
        spreadsheet = client.open(os.getenv("GOOGLE_SHEET_NAME", "attendence"))
        print("Success!")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_sheets()
