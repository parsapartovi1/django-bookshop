#CELERY CONFIGURATION

import requests

from celery import shared_task
from config.settings import KAVENEGAR_API_KEY


@shared_task(bind=True, max_retries=3)
def send_otp_sms(self, number, otp_code):
    api_key = KAVENEGAR_API_KEY

    url = (
        f"https://api.kavenegar.com/v1/"
        f"{api_key}/sms/send.json"
    )

    payload = {
        "sender": "2000660110",
        "receptor": number,
        "message": f"کد ورود شما: {otp_code}",
    }

    try:
        res = requests.post(
            url,
            data=payload,
            timeout=10,
        )

        print("KAVENEGAR STATUS:", res.status_code)
        print("KAVENEGAR RESPONSE:", res.text)

        if 400 <= res.status_code < 500:
            return {
                "success": False,
                "status_code": res.status_code,
                "response": res.text,
            }

        res.raise_for_status()

        return {
            "success": True,
            "status_code": res.status_code,
            "response": res.text,
        }

    except requests.Timeout as exc:
        raise self.retry(exc=exc, countdown=10)

    except requests.ConnectionError as exc:
        raise self.retry(exc=exc, countdown=10)

    except requests.RequestException as exc:
        print("KAVENEGAR REQUEST ERROR:", exc)
        raise self.retry(exc=exc, countdown=10)