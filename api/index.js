import requests
import json
from flask import Flask, jsonify, request
from typing import List, Any

DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1443428789710356490/WvQkeyXpdPwHSyo3PSTqAPpiXqaLTZZ6XIXSklD1N4ba8iMXgwBHGjK0MWCTgsJmZ00h"


def send_discord(msg):
    try:
        requests.post(DISCORD_WEBHOOK_URL, json={"content": msg})
    except Exception as e:
        print(f"Discord webhook failed: {e}")


class GameInfo:
    def __init__(self):
        self.titleId: str = "8D608"
        self.secretKey: str = "N7XPOQJB8CPZB8U6Q7A1ZNGR1QQE41CAUXJGKC6Q4PIISC69EJ"
        self.ApiKey: str = "OC|1296841200171257|afac58dab345e294f3339925c9d11277"

    def GetAuthHeaders(self) -> dict:
        return {
            "content-type": "application/json",
            "X-SecretKey": self.secretKey
        }


settings = GameInfo()
app: Flask = Flask(__name__)
playfabCache: dict = {}

titleider = settings.titleId
secretkey = settings.secretKey
settings.ApiKey = settings.ApiKey

ApplabInfo: dict = {
    "testing": {"Credential": settings.ApiKey},
    "GameNameHere2": {"Credential": "yourcred"},
}

class AppLab:
    def __init__(self, cred):
        self.Credential = cred


AllApplabs = [AppLab(v["Credential"]) for v in ApplabInfo.values()]


@app.route("/", methods=["GET"])
def index():
    return "Backend is working, made by Nate"


@app.route("/api/PlayFabAuthentication", methods=["POST"])
def playfabauthenticate():
    rjson = request.get_json()
    CustomId = rjson.get("CustomId")
    Nonce = rjson.get("Nonce")
    OculusId = rjson.get("OculusId")
    AppId = rjson.get("AppId")
    Platform = rjson.get("Platform")
    MothershipToken = rjson.get("MothershipToken")
    MothershipId = rjson.get("MothershipId")
    MothershipEnv = rjson.get("MothershipEnv")
    AttestationToken = rjson.get("AttestationToken")

    send_discord(f"PlayFab Authenticate Request:\nNonce: `{Nonce}`\nCustomId: `{CustomId}`\nMothershipId: `{MothershipId}`\nOculusId: `{OculusId}`\nAppId: `{AppId}`\nMothershipEnv: `{MothershipEnv}`\nMothershipToken: `{MothershipToken}`")

    MothershipUserInfo = {"Token": "expected_token", "Id": "expected_id"}

    if MothershipToken != MothershipUserInfo.get("Token", "Not found"):
        return jsonify({"BanMessage": "INVALID MOTHERSHIP TOKEN bro no can bypass this dum dum", "BanExpirationTime": "Indefinite"}), 403

    if MothershipId != MothershipUserInfo.get("Id", "Not found"):
        return jsonify({"BanMessage": "INVALID MOTHERSHIPId TOKEN | DISCORD.GG/BC", "BanExpirationTime": "Indefinite"}), 403

    if MothershipEnv != MothershipUserInfo.get("MothershipEnv", "Not found"):
        return jsonify({"BanMessage": "INVALID MOTHERSHIP Env |", "BanExpirationTime": "Indefinite"}), 403

    if not AttestationToken:
        return jsonify({
            "BanMessage": "Missing Attestation_token dum dum made by Nate the great",
            "BanExpirationTime": "Indefinite"
        }), 403

    required = ["CustomId", "Nonce", "AppId", "Platform", "OculusId", "MothershipInfo"]
    for param in required:
        if rjson.get(param) is None:
            return jsonify({"Message": f"Missing {param} parameter", "Error": f"BadRequest-No{param}"}), 400

    if AppId != titleider:
        return jsonify({"Message": "Request sent for the wrong App ID", "Error": "BadRequest-AppIdMismatch"})

    if not CustomId.startswith("OC") and not CustomId.startswith("PI"):
        return jsonify({"Message": "Bad request", "Error": "BadRequest-No OC or PI Prefix"})

    IsValid = False
    for i in AllApplabs:
        cred = i.Credential
        r = requests.post(
            url=f"https://graph.oculus.com/user_nonce_validate?user_id={OculusId}&nonce={Nonce}&access_token={cred}"
        )
        if r.status_code == 200 and r.json().get("is_valid") is True:
            IsValid = True
            break

    for i in AllApplabs:
        cred = i.Credential
        r = requests.get(
            url=f"https://graph.oculus.com/{CustomId.split('OCULUS')[0]}?access_token={cred}"
        )
        if r.status_code == 200 and r.json().get("id"):
            IsValid = True
            break

    if not IsValid:
        return jsonify({"error": "fuh no gng, you stinky asl"}), 400

    if not NonceCheck(Nonce, OculusId):
        return jsonify({"BanMessage": "Invalid Nonce", "BanExpirationTime": "Indefinite"}), 403

    OrgScope = CustomId.replace("OCULUS", "")
    if not OrgScopeCheck(OrgScope):
        return jsonify({"BanMessage": "Invalid CustomID", "BanExpirationTime": "Indefinite"}), 403

    PlayFabRequest = requests.post(
        f"https://{titleider}.playfabapi.com/Server/LoginWithServerCustomId",
        json={"ServerCustomId": CustomId, "CreateAccount": True},
        headers={"x-secretkey": secretkey, "content-type": "application/json"}
    )

    if PlayFabRequest.status_code == 200:
        data = PlayFabRequest.json().get("data", {})
        return jsonify({
            "PlayFabId": data.get("PlayFabId", 'not found'),
            "SessionTicket": data.get("SessionTicket", 'not found'),
            "EntityId": data.get("EntityToken", {}).get("Entity", {}).get("Id"),
            "EntityType": data.get("EntityToken", {}).get("Entity", {}).get("Type"),
            "EntityToken": data.get("EntityToken", {}).get("EntityToken", "not found")
        }), 200
    elif PlayFabRequest.status_code == 403:
        BanInfo = PlayFabRequest.json()
        if BanInfo.get("errorCode") == 1002:
            Details = BanInfo.get("errorDetails", {})
            Reason = next(iter(Details))
            Expiration = next(iter(Details[Reason]))
            return jsonify({'BanMessage': Reason, 'BanExpirationTime': Expiration}), 403

    return jsonify({"Message": "Unknown error"}), 500


@app.route("/api/cacheplayfabid", methods=["POST", "GET"])
def cacheplayfabid():
    rjson = request.get_json()
    playfabCache[rjson.get("PlayFabId")] = rjson
    return jsonify({"Message": "Success"}), 200


@app.route("/api/TitleData", methods=["POST", "GET"])
def titledata():
    req = requests.post(f"https://{settings.titleId}.playfabapi.com/Server/GetTitleData", headers=settings.GetAuthHeaders())
    if req.status_code == 200:
        return jsonify(req.json().get("data", {}).get("Data", {}))
    return jsonify({})


@app.route("/api/consumeiap", methods=["POST", "GET"])
def consumeoculusiap():
    rjson = request.get_json()
    req = requests.post(
        f"https://graph.oculus.com/consume_entitlement?nonce={rjson.get('nonce')}&user_id={rjson.get('userID')}&sku={rjson.get('sku')}&access_token={settings.ApiKey}",
        headers={"content-type": "application/json"}
    )
    return jsonify({"result": True} if req.json().get("success") else {"error": True})


@app.route("/api/GetTier", methods=["GET"])
def GetTier():
    r = request.get
