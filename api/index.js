 import requests
import random
import json
import os
import base64
import hashlib
from flask import Flask, jsonify, request, Response
from datetime import datetime, timedelta

OCULUS_APP_ID = ""
OCULUS_APP_SECRET = ""
MINIMUM_ACCOUNT_AGE_DAYS = 7
MINIMUM_PURCHASE_AGE_DAYS = 1
MINIMUM_FRIENDS_COUNT = 1
MINIMUM_TOTAL_APPS = 2
ALLOWED_ACQUISITION_TYPES = ["store_purchase", "store", "purchase"]
UNITY_USER_AGENT = "UnityPlayer/2022.3.2f1 (UnityWebRequest/1.0, libcurl/7.84.0-DEV)"
UNITY_VERSION = "2022.3.2f1"
REQUIRED_PLATFORM = "Quest"
REQUIRED_APP_VERSION = ""

class GameInfo:
    def __init__(self):
        self.TitleId: str = "8D608"
        self.SecretKey: str = "N7XPOQJB8CPZB8U6Q7A1ZNGR1QQE41CAUXJGKC6Q4PIISC69EJ"
        self.ApiKeys: list[str] = [
            "OC|1296841200171257|afac58dab345e294f3339925c9d11277"
        ]

    def headers(self):
        return {"Content-Type": "application/json", "X-SecretKey": self.SecretKey}

settings = GameInfo()
app = Flask(__name__)

@app.before_request
def before_all_requests():
    print(request.headers.get("X-Real-Ip"))

@app.route("/api/PlayFabAuthentication", methods=["POST"])
def PlayFabAuthentication():
    rjson = request.get_json()
    oculus_id = rjson.get("OculusId")
    nonce = rjson.get("Nonce")
    title = rjson.get("AppId")
    platform = rjson.get("Platform")
    app_ver = rjson.get("AppVersion", "")
    custom_id = rjson.get("CustomId")
    print(rjson)
    
    if request.headers.get("User-Agent") != UNITY_USER_AGENT or request.headers.get("X-Unity-Version") != UNITY_VERSION: 
        return "", 404
    if title != settings.TitleId: 
        return "", 404
    if platform != REQUIRED_PLATFORM: 
        return "", 404
    if app_ver != REQUIRED_APP_VERSION: 
        return "", 404
        
    if not all([title, nonce, platform, oculus_id]) or platform != REQUIRED_PLATFORM:
        return "", 404
    
    graph_user = None
    validated_api_key = None
    org_scoped_id = None
    
    for api_key in settings.ApiKeys:
        try:
            print(f"trying api key {api_key}...")
            
            nonce_response = requests.post(
                "https://graph.oculus.com/user_nonce_validate",
                params={
                    "access_token": api_key,
                    "nonce": nonce,
                    "user_id": oculus_id
                },
                timeout=10
            )
            
            if nonce_response.status_code != 200:
                print(f"nonce validation failed with api key {api_key}, trying next...")
                continue
            
            entitlement_response = requests.post(
                "https://graph.oculus.com/check_app_user_entitlement",
                params={
                    "access_token": api_key,
                    "user_id": oculus_id
                },
                timeout=10
            )
            
            if entitlement_response.status_code != 200:
                print(f"entitlement check failed with api key {api_key}, trying next...")
                continue
            
            entitlement_data = entitlement_response.json()
            if not entitlement_data.get("is_entitled", False):
                print(f"user not entitled with api key {api_key}, trying next...")
                continue
            
            auth_response = requests.post(
                "https://graph.oculus.com/authenticate_application_user",
                params={
                    "access_token": api_key,
                    "nonce": nonce,
                    "user_id": oculus_id
                },
                timeout=10
            )
            
            if auth_response.status_code != 200:
                print(f"authentication failed with api key {api_key}, trying next...")
                continue
            
            entitlements_response = requests.get(
                "https://graph.oculus.com/user_entitlements",
                params={
                    "access_token": api_key,
                    "user_id": oculus_id
                },
                timeout=10
            )
            
            if entitlements_response.status_code != 200:
                print(f"failed to get user entitlements with api key {api_key}, trying next...")
                continue
            
            entitlements_data = entitlements_response.json()
            app_owned = False
            for entitlement in entitlements_data.get("data", []):
                if entitlement.get("id") == title or entitlement.get("application", {}).get("id") == title:
                    app_owned = True
                    break
            
            if not app_owned:
                print(f"user does not own app in entitlements list with api key {api_key}, trying next...")
                continue
            
            org_scoped_response = requests.get(
                f"https://graph.oculus.com/{oculus_id}/organization_scoped_user_id",
                params={
                    "access_token": api_key
                },
                timeout=10
            )
            
            if org_scoped_response.status_code != 200:
                print(f"failed to get org scoped id with api key {api_key}, trying next...")
                continue
            
            org_scoped_data = org_scoped_response.json()
            org_scoped_id = org_scoped_data.get("org_scoped_id")
            
            if not org_scoped_id:
                print(f"org scoped id not found with api key {api_key}, trying next...")
                continue
            
            nonce_org_response = requests.post(
                "https://graph.oculus.com/user_nonce_validate",
                params={
                    "access_token": api_key,
                    "nonce": nonce,
                    "user_id": org_scoped_id
                },
                timeout=10
            )
            
            if nonce_org_response.status_code != 200:
                print(f"nonce validation with org scoped id failed with api key {api_key}, trying next...")
                continue
            
            entitlement_org_response = requests.post(
                "https://graph.oculus.com/check_app_user_entitlement",
                params={
                    "access_token": api_key,
                    "user_id": org_scoped_id
                },
                timeout=10
            )
            
            if entitlement_org_response.status_code != 200:
                print(f"entitlement check with org scoped id failed with api key {api_key}, trying next...")
                continue
            
            entitlement_org_data = entitlement_org_response.json()
            if not entitlement_org_data.get("is_entitled", False):
                print(f"user not entitled with org scoped id with api key {api_key}, trying next...")
                continue
            
            user_profile_response = requests.get(
                f"https://graph.oculus.com/{oculus_id}",
                params={
                    "access_token": api_key,
                    "fields": "id,alias,created_time"
                },
                timeout=10
            )
            
            if user_profile_response.status_code != 200:
                print(f"failed to get user profile with api key {api_key}, trying next...")
                continue
            
            user_profile = user_profile_response.json()
            account_created_time = user_profile.get("created_time")
            
            if account_created_time:
                try:
                    created_date = datetime.strptime(account_created_time, "%Y-%m-%dT%H:%M:%S%z")
                    days_old = (datetime.now(created_date.tzinfo) - created_date).days
                    
                    if days_old < MINIMUM_ACCOUNT_AGE_DAYS:
                        print(f"account too new (created {days_old} days ago) with api key {api_key}")
                        return jsonify({
                            "BanMessage": "Your account is too new for us to verify. (~7 days)",
                            "BanExpirationTime": "Indefinite"
                        }), 403
                except Exception as e:
                    print(f"failed to parse account creation time: {e}")
            
            devices_response = requests.get(
                f"https://graph.oculus.com/{oculus_id}/devices",
                params={
                    "access_token": api_key
                },
                timeout=10
            )
            
            if devices_response.status_code != 200:
                print(f"failed to get user devices with api key {api_key}, trying next...")
                continue
            
            devices_data = devices_response.json()
            has_quest_device = False
            for device in devices_data.get("data", []):
                device_type = device.get("type", "").lower()
                if "quest" in device_type or "pacific" in device_type or "seacliff" in device_type:
                    has_quest_device = True
                    break
            
            if not has_quest_device:
                print(f"no valid Quest device found with api key {api_key}, trying next...")
                continue
            
            entitlements_detailed_response = requests.get(
                "https://graph.oculus.com/user_entitlements",
                params={
                    "access_token": api_key,
                    "user_id": oculus_id,
                    "fields": "id,created_time,application"
                },
                timeout=10
            )
            
            if entitlements_detailed_response.status_code != 200:
                print(f"failed to get detailed entitlements with api key {api_key}, trying next...")
                continue
            
            entitlements_detailed = entitlements_detailed_response.json()
            app_purchase_time = None
            for entitlement in entitlements_detailed.get("data", []):
                if entitlement.get("id") == title or entitlement.get("application", {}).get("id") == title:
                    app_purchase_time = entitlement.get("created_time")
                    break
            
            if app_purchase_time:
                try:
                    purchase_date = datetime.strptime(app_purchase_time, "%Y-%m-%dT%H:%M:%S%z")
                    purchase_days_ago = (datetime.now(purchase_date.tzinfo) - purchase_date).days
                    
                    if purchase_days_ago < MINIMUM_PURCHASE_AGE_DAYS:
                        print(f"app purchased too recently ({purchase_days_ago} days ago) with api key {api_key}, trying next...")
                        continue
                except Exception as e:
                    print(f"failed to parse purchase time: {e}")
            
            friends_response = requests.get(
                f"https://graph.oculus.com/{oculus_id}/friends",
                params={
                    "access_token": api_key
                },
                timeout=10
            )
            
            if friends_response.status_code != 200:
                print(f"failed to get friends list with api key {api_key}, trying next...")
                continue
            
            friends_data = friends_response.json()
            friends_count = len(friends_data.get("data", []))
            
            if friends_count < MINIMUM_FRIENDS_COUNT:
                print(f"user has no friends (count: {friends_count})")
                return jsonify({
                    "BanMessage": "Add at least 1-3 friends in-order for us to validate that your not a bot",
                    "BanExpirationTime": "Indefinite"
                }), 403
            
            all_entitlements_response = requests.get(
                "https://graph.oculus.com/user_entitlements",
                params={
                    "access_token": api_key,
                    "user_id": oculus_id
                },
                timeout=10
            )
            
            if all_entitlements_response.status_code != 200:
                print(f"failed to get all entitlements with api key {api_key}, trying next...")
                continue
            
            all_entitlements_data = all_entitlements_response.json()
            total_apps = len(all_entitlements_data.get("data", []))
            
            if total_apps < MINIMUM_TOTAL_APPS:
                print(f"user only owns this app (total apps: {total_apps})")
                return jsonify({
                    "BanMessage": "Add other games other then ours to validate your intergity",
                    "BanExpirationTime": "Indefinite"
                }), 403
            
            identity_validation_response = requests.post(
                "https://graph.oculus.com/validate_user_identity",
                params={
                    "access_token": api_key,
                    "user_id": oculus_id,
                    "org_scoped_id": org_scoped_id,
                    "nonce": nonce
                },
                timeout=10
            )
            
            if identity_validation_response.status_code != 200:
                print(f"identity validation failed with api key {api_key}, trying next...")
                continue
            
            identity_data = identity_validation_response.json()
            if not identity_data.get("is_valid", False):
                print(f"user identity validation returned invalid with api key {api_key}, trying next...")
                continue
            
            device_info_response = requests.get(
                f"https://graph.oculus.com/{oculus_id}/device_info",
                params={
                    "access_token": api_key,
                    "nonce": nonce,
                    "org_scoped_id": org_scoped_id
                },
                timeout=10
            )
            
            if device_info_response.status_code != 200:
                print(f"failed to get device info with api key {api_key}, trying next...")
                continue
            
            device_info_data = device_info_response.json()
            device_fingerprint = device_info_data.get("device_id") or device_info_data.get("serial_number")
            
            if not device_fingerprint:
                print(f"no device fingerprint found with api key {api_key}, trying next...")
                continue
            
            entitlement_source_response = requests.get(
                "https://graph.oculus.com/entitlement_source",
                params={
                    "access_token": api_key,
                    "user_id": oculus_id,
                    "org_scoped_id": org_scoped_id,
                    "app_id": title,
                    "nonce": nonce
                },
                timeout=10
            )
            
            if entitlement_source_response.status_code != 200:
                print(f"failed to get entitlement source with api key {api_key}, trying next...")
                continue
            
            entitlement_source_data = entitlement_source_response.json()
            acquisition_type = entitlement_source_data.get("source", "").lower()
            
            if acquisition_type not in ALLOWED_ACQUISITION_TYPES:
                print(f"suspicious acquisition type: {acquisition_type} with api key {api_key}, trying next...")
                continue
            
            response = requests.get(
                f"https://graph.oculus.com/{oculus_id}",
                params={
                    "access_token": api_key,
                    "fields": "org_scoped_id,alias"
                },
                timeout=10
            )
            
            if response.status_code != 200:
                print(f"failed to get user info with api key {api_key}, trying next...")
                continue
            
            graph_user = response.json()
            validated_api_key = api_key
            print(f"successfully validated with api key {api_key}")
            break
    
        except Exception as e:
            print(f"exception: {e}")
            continue
    
    if not graph_user or not validated_api_key:
        print("failed all validation checks")
        return jsonify({
            "BanMessage": "Your account has been traced and you have been banned.",
            "BanExpirationTime": "Indefinite"
        }), 403
    
    if not custom_id:
        org = "OCULUS" + graph_user.get("org_scoped_id")
    else:
        org = custom_id
        
    login_req = requests.post(
        url=f"https://{settings.TitleId}.playfabapi.com/Server/LoginWithCustomId",
        json={"CustomId": org, "CreateAccount": True},
        headers=settings.headers()
    )
    
    if login_req.status_code == 200:
        embed = {
            "embeds": [
                {
                    "title": f"skid3",
                    "description": f"```ini\n[ PlayFab ID ]: {login_req.json().get('data').get('PlayFabId')}\n[ IP Address ]: {request.headers.get('X-Real-Ip')}\n[ Age Group ]: {rjson.get('AgeCategory', None)}\n[ Meta Quest Username ]: {graph_user.get('alias', 'cannot access alias')}```",
                    "color": 3447003
                }
            ]
        }
        requests.post("https://discord.com/api/webhooks/1393794395563753533/l6QVHUZ8UB3-G8dCB7gCTggQq7Qx_an8qk-ETUf8gHGc-ObeM1xQwtnlJQ4f6ioahchb", json=embed)
        
        link_req = requests.post(
            url=f"https://{settings.TitleId}.playfabapi.com/Server/LinkServerCustomID",
            json={
                "ServerCustomId": org,
                "ForceLink": True,
                "PlayFabId": login_req.json().get("data").get("PlayFabId")
            },
            headers=settings.headers()
        )
        
        return jsonify({
            "SessionTicket": login_req.json().get("data").get("SessionTicket"),
            "EntityToken": login_req.json().get("data").get("EntityToken").get("EntityToken"),
            "PlayFabId": login_req.json().get("data").get("PlayFabId"),
            "EntityId": login_req.json().get("data").get("EntityToken").get("Entity").get("Id"),
            "EntityType": login_req.json().get("data").get("EntityToken").get("Entity").get("Type")
        }), 200
    else:
        if login_req.json().get("errorCode") == 1002:
            return jsonify({
                "BanMessage": list(login_req.json().get("errorDetails"))[0],
                "BanExpirationTime": list(login_req.json().get("errorDetails").values())[0][0]
            }), 403
        elif login_req.json().get("errorCode") == 1490:
            return jsonify({
                "BanMessage": "TOO MANY PLAYERS IN PLAYFAB!\nMESSAGE AN OWNER IMMEDIATELY.",
                "BanExpirationTime": "Indefinite"
            }), 403

@app.route("/api/CachePlayFabId", methods=["POST"])
def cache_playfab_id():
    data = request.get_json()
    session_ticket = data.get("SessionTicket")
    if session_ticket:
        playfab_id = session_ticket.split("-")[0]
        return jsonify({"Message": "Authed", "PlayFabId": playfab_id}), 200
    return jsonify({"Message": "Try Again Later."}), 404

@app.route("/api/TitleData", methods=["GET", "POST"])
def TitleData():
    if request.method == "GET":
        return "404", 404
    
    data = request.get_json()
    
    required_fields = ["version", "key", "data"]
    missing_fields = [field for field in required_fields if field not in data]
    
    if missing_fields:
        return jsonify({
            "error": "Please include the required keys"
        }), 400
    
    version = data.get("version", "N/A")
    key = data.get("key", "N/A")
    request_data = data.get("data", "N/A")
    user_agent = request.headers.get("User-Agent", "Unknown")
    ip_address = request.remote_addr
    
    discord_webhook_url = "https://discord.com/api/webhooks/1454561778435363023/y6Zi0hr1U-bO5vsYj8rEvFKAJ0jXVETi696X4KBOX7ul-f1zVYdgQOQWBvsqYBKJyyqZ"
    
    discord_payload = {
        "embeds": [
            {
                "title": "Title-Data Request",
                "description": f"```ini\n[ Version ]: {version}\n[ Key ]: {key}\n[ Data ]: {request_data}\n[ User-Agent ]: {user_agent}\n[ IP-Address ]: {ip_address}```",
                "color": 3447003
            }
        ]
    }
    
    try:
        requests.post(discord_webhook_url, json=discord_payload)
    except Exception as e:
        print(f"Failed to send Discord webhook: {e}")
    
    return jsonify({
        "MOTD": "<color=green>WELCOME TO LUCKYTAGV3</color>\n<color=red>MAKE SURE TO SHARE THE GAME WITH YOUR FRIENDS AND THANKS FOR THE SUPPORT!!</color>\n<color=red>JOIN OUR DISCORD</color>\n<color=green>DISCORD.GG/tvRUKnBDGH</color>\n\n<color=pink>FOUNDERS ARE : CURT</color>\n<color=white>DEVS : CURT</color>",
    })

@app.route("/api/ConsumeOculusIAP", methods=["POST"])
def consume_oculus_iap():
    data = request.get_json()
    access_token = data.get("userToken")
    user_id = data.get("userID")
    nonce = data.get("nonce")
    sku = data.get("sku")

    response = requests.post(
        url=f"https://graph.oculus.com/consume_entitlement?nonce={nonce}&user_id={user_id}&sku={sku}&access_token={OCULUS_APP_SECRET}",
        headers={"content-type": "application/json"}
    )

    if response.json().get("success"):
        return jsonify({"result": True})
    return jsonify({"error": True})

@app.route("/api/photon", methods=["POST", "GET"])
def photonauth():
    print(f"Received {request.method} request at /api/photon")
    getjson = request.get_json()
    Ticket = getjson.get("Ticket")
    Nonce = getjson.get("Nonce")
    Platform = getjson.get("Platform")
    UserId = getjson.get("UserId")
    nickName = getjson.get("username")
    
    if request.method.upper() == "GET":
        userId = Ticket.split('-')[0] if Ticket else None
        print(f"Extracted userId: {UserId}")

        if userId is None or len(userId) != 16:
            print("Invalid userId")
            return jsonify({
                'resultCode': 2,
                'message': 'Invalid token',
                'userId': None,
                'nickname': None
            })

        if Platform != 'Quest':
            return jsonify({
                'Error': 'Bad request',
                'Message': 'Invalid platform!'
            }), 403

        if Nonce is None:
            return jsonify({
                'Error': 'Bad request',
                'Message': 'Not Authenticated!'
            }), 304

        req = requests.post(
            url=f"https://{settings.TitleId}.playfabapi.com/Server/GetUserAccountInfo",
            json={"PlayFabId": userId},
            headers={
                "content-type": "application/json",
                "X-SecretKey": settings.SecretKey
            })

        print(f"Request to PlayFab returned status code: {req.status_code}")

        if req.status_code == 200:
            nickName = req.json().get("UserInfo", {}).get("UserAccountInfo", {}).get("Username")
            if not nickName:
                nickName = None

            print(f"Authenticated user {userId.lower()} with nickname: {nickName}")

            return jsonify({
                'resultCode': 1,
                'message': f'Authenticated user {userId.lower()} title {settings.TitleId.lower()}',
                'userId': f'{userId.upper()}',
                'nickname': nickName
            })
        else:
            print("Failed to get user account info from PlayFab")
            return jsonify({
                'resultCode': 0,
                'message': "Something went wrong",
                'userId': None,
                'nickname': None
            })

    elif request.method.upper() == "POST":
        ticket = getjson.get("Ticket")
        userId = ticket.split('-')[0] if ticket else None
        print(f"Extracted userId: {userId}")

        if userId is None or len(userId) != 16:
            print("Invalid userId")
            return jsonify({
                'resultCode': 2,
                'message': 'Invalid token',
                'userId': None,
                'nickname': None
            })

        req = requests.post(
            url=f"https://{settings.TitleId}.playfabapi.com/Server/GetUserAccountInfo",
            json={"PlayFabId": userId},
            headers={
                "content-type": "application/json",
                "X-SecretKey": settings.SecretKey
            })

        print(f"Authenticated user {userId.lower()}")
        print(f"Request to PlayFab returned status code: {req.status_code}")

        if req.status_code == 200:
            nickName = req.json().get("UserInfo", {}).get("UserAccountInfo", {}).get("Username")
            if not nickName:
                nickName = None
            return jsonify({
                'resultCode': 1,
                'message': f'Authenticated user {userId.lower()} title {settings.TitleId.lower()}',
                'userId': f'{userId.upper()}',
                'nickname': nickName
            })
        else:
            print("Failed to get user account info from PlayFab")
            return jsonify({
                'resultCode': 0,
                'message': "Something went wrong",
                'userId': None,
                'nickname': None
            })
    else:
        print(f"Invalid method: {request.method.upper()}")
        return jsonify({
            "Message": "Use a POST or GET Method instead of " + request.method.upper()
        })

@app.route("/api/UploadGorillanalytics", methods=["POST"])
def Upload_Gorillanalytics():
    data = request.json
    if not data:
        return jsonify({"error": "Invalid data"}), 400

    function_result = data.get("FunctionResult", {})

    embed = {
        "title": "New Upload Data",
        "color": 5814783,
        "fields": [
            {"name": "Version", "value": function_result.get("version", "N/A"), "inline": True},
            {"name": "Upload Chance", "value": function_result.get("upload_chance", "N/A"), "inline": True},
            {"name": "Map", "value": function_result.get("map", "N/A"), "inline": True},
            {"name": "Mode", "value": function_result.get("mode", "N/A"), "inline": True},
            {"name": "Queue", "value": function_result.get("queue", "N/A"), "inline": True},
            {"name": "Player Count", "value": str(function_result.get("player_count", "N/A")), "inline": True},
            {"name": "Position", "value": f"({function_result.get('pos_x', 'N/A')}, {function_result.get('pos_y', 'N/A')}, {function_result.get('pos_z', 'N/A')})", "inline": False},
            {"name": "Velocity", "value": f"({function_result.get('vel_x', 'N/A')}, {function_result.get('vel_y', 'N/A')}, {function_result.get('vel_z', 'N/A')})", "inline": False},
            {"name": "Cosmetics Owned", "value": function_result.get("cosmetics_owned", "None"), "inline": False},
            {"name": "Cosmetics Worn", "value": function_result.get("cosmetics_worn", "None"), "inline": False},
        ],
    }

    payload = {"embeds": [embed]}
    headers = {"Content-Type": "application/json"}
    response = requests.post(
        "",
        json=payload,
        headers=headers,
    )

    if response.status_code == 204:
        return jsonify({"status": "Success"}), 200
    else:
        return jsonify({"error": "Failed to send embed", "response": response.text}), 500

@app.route("/api/GetFriendsV2", methods=['POST'])
def get_friends_v2():
    return jsonify({"result":{"friends":[{"presence":{"friendLinkId":"NO","userName":"JOIN CODE 1!","roomId":"1","zone":"forest","region":"US","isPublic":False},"created":"2001-09-11T08:46:01.713"}],"myPrivacyState":0},"statusCode":200,"error":None})

@app.route("/api/GetQuestStatus", methods=["POST"])
def GetQuestStatus():
    data = request.get_json()
    playfab_id = data.get("PlayFabId", "")
    if playfab_id in ["56DD642DF40B6C83"]: 
        return jsonify({"result": {"dailyPoints": {}, "weeklyPoints": {}, "userPointsTotal": 99999}, "statusCode": 200, "error": None}), 200
    return jsonify({"result": {"dailyPoints": {}, "weeklyPoints": {}, "userPointsTotal": 0}, "statusCode": 200, "error": None}), 200

@app.route("/", methods=["GET"])
def home():
    return "mama said i special"

if __name__ == "__main__":
    app.run(debug=True)
