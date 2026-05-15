import requests
import time
import sys

URL = "http://127.0.0.1:8080/api/public/sms"
# Make sure to set your secret to match process.env.WEBHOOK_SECRET
# If you don't have a secret configured in your env, you might need to adjust the code.
WEBHOOK_SECRET = "bluwaves_secret_123"

def send_sms(sender, text):
    payload = {
        "from": sender,
        "text": text,
        "sentStamp": int(time.time() * 1000),
        "receivedStamp": int(time.time() * 1000),
        "sim": "SIM1"
    }
    
    headers = {
        "x-webhook-secret": WEBHOOK_SECRET,
        "Content-Type": "application/json"
    }
    
    print(f"Sending payload to {URL}...")
    try:
        response = requests.post(URL, json=payload, headers=headers)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 2:
        sender = sys.argv[1]
        text = sys.argv[2]
        send_sms(sender, text)
    else:
        print("Running default test messages...")
        
        print("\n--- Test 1: HDFC Credit (Income) ---")
        msg1 = "Rs.200 credited to a/c XXXXXX1234 on 14-05-26 by linked a/c to VPA jid@okaxis (UPI Ref No 123456789012)."
        send_sms("AD-HDFCBK", msg1)
        
        time.sleep(1)
        print("\n--- Test 2: ICICI Debit (Expense) ---")
        msg2 = "Dear Customer, Acct XX5678 is debited with Rs 150.00 on 14-May-26 for UPI/1234567890/Coffee Shop. Avl Bal: Rs 1500.00"
        send_sms("AD-ICICIB", msg2)
