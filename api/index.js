import requests
import random
from flask import Flask, jsonify, request
from datetime import datetime, timedelta, timezone
# L1RSON'S DIDDY BACKEND
#CREDITS TO WHOEVER MADE THE OG CODE FOR TS LOL
class GameInfo():
        def __init__(self):
                self.TitleId : str = "8D608"
                self.SecretKey : str = "N7XPOQJB8CPZB8U6Q7A1ZNGR1QQE41CAUXJGKC6Q4PIISC69EJ"
                self.ApiKey : str = "OC|1296841200171257|afac58dab345e294f3339925c9d11277"

        def GetAuthHeaders(self) -> dict:
                return {
                        "content-type": "application/json",
                        "X-SecretKey": self.SecretKey
                }

        def GetTitle(self) -> str:
                return self.TitleId

        def TuffNonceAuth(self, nonce: str, user_id: str):
                nonce_resp = requests.post(f"https://graph.oculus.com/user_nonce_validate?access_token={self.ApiKey}&nonce={nonce}&user_id={user_id}")
                if not nonce_resp.json().get("is_valid", False):
                        print(f"fella has an INVALID nonce! user_id: {user_id}")
                        return None
                
                org_resp = requests.get(f"https://graph.oculus.com/{user_id}?access_token={self.ApiKey}&fields=org_scoped_id")
                org_scoped_id = org_resp.json().get("org_scoped_id")
                if not org_scoped_id:
                        print(f"fellas nonce could NOT be verified! user_id: {user_id}")
                        return None
                
                print(f"fellas nonce is valid! org_scoped_id: {org_scoped_id}")
                return {"is_valid": True, "org_scoped_id": org_scoped_id, "user_id": user_id}


settings : GameInfo = GameInfo()
app : Flask = Flask(__name__)
playfabCache : dict = {}
muteCache : dict = {}

def GetMetaAlias(oculus_id: str):
    url = f"https://graph.oculus.com/{oculus_id}?access_token={settings.ApiKey}&fields=alias"
    res = requests.get(url, headers={"Content-Type": "application/json"})
    if res.status_code == 200:
        return res.json().get("alias")
    return None

def GetOrgScopedId(oculus_id: str):
    url = f"https://graph.oculus.com/{oculus_id}?access_token={settings.ApiKey}&fields=org_scoped_id"
    res = requests.get(url, headers={"Content-Type": "application/json"})
    if res.status_code == 200:
        return res.json().get("org_scoped_id")
    return None

def GetUserId(ticket):
    return ticket[:16].replace("'", "").replace("-", "").replace(".", "")

@app.before_request
def before_all_requests():
        print(request.headers.get("X-Real-Ip"))

        path = request.path
        method = request.method

        if path == "/api/photon" or path == "/":
                return None
        
        if method != "POST" :
                return "", 404

def ReturnFunctionJson(data, funcname, funcparam = {}):
        rjson = data["FunctionParameter"]

        userId : str = rjson.get("CallerEntityProfile").get("Lineage").get("TitlePlayerAccountId")

        req = requests.post(
                url = f"https://{settings.TitleId}.playfabapi.com/Server/ExecuteCloudScript",
                json = {
                        "PlayFabId": userId,
                        "FunctionName": funcname,
                        "FunctionParameter": funcparam
                },
                headers = settings.GetAuthHeaders()
        )

        if req.status_code == 200:
                return jsonify(req.json().get("data").get("FunctionResult")), req.status_code
        else:
                return jsonify({}), req.status_code

@app.route("/", methods = ["POST", "GET"])
def main():
        return '''<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
*{margin:0;padding:0}
body{background:#111;min-height:100vh;display:flex;justify-content:center;align-items:center}
.t{font:bold 5rem sans-serif;display:flex}
span{display:inline-block;animation:j .4s ease-in-out infinite alternate;color:#0af;text-shadow:0 0 20px #0af}
@keyframes j{0%{transform:translateY(-12px) scale(1.1)}100%{transform:translateY(12px) scale(.9)}}
</style>
</head>
<body>
<div class="t" id="t"></div>
<script>
[..."🦅 HAWK TUAH BOII 🦅"].forEach((c,i)=>{let s=document.createElement('span');s.textContent=c===' '?'\\u00A0':c;s.style.animationDelay=i*.06+'s';document.getElementById('t').appendChild(s)})
</script>
</body>
</html>'''

@app.route("/api/PlayFabAuthentication", methods = ["POST", "GET"])
def playfabauthentication():
        if request.method == "GET":
                return jsonify({"BanMessage": "Your account has been traced and you have been banned.\n", "BanExpirationTime": "Indefinite"}), 403
        
        client_ip = request.headers.get("X-Real-Ip") or request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or request.remote_addr
        if client_ip:
                try:
                        ip_check = requests.get(url=f"http://ip-api.com/json/{client_ip}?fields=16974336", timeout=5)
                        if ip_check.status_code == 200:
                                ip_data = ip_check.json()
                                is_proxy = ip_data.get("proxy", False)
                                is_hosting = ip_data.get("hosting", False)
                                if is_proxy or is_hosting:
                                        return jsonify({"BanMessage": "VPN detected. Turn your VPN off and try again.\n", "BanExpirationTime": "Indefinite"}), 403
                except:
                        pass
        
        VALID_VERSIONS = {
                "2019.3.15f1": "UnityPlayer/2019.3.15f1 (UnityWebRequest/1.0, libcurl/7.52.0-DEV)",
                "2022.3.2f1": "UnityPlayer/2022.3.2f1 (UnityWebRequest/1.0, libcurl/7.84.0-DEV)"
        }
        
        agent = request.headers.get("User-Agent", "")
        unity_version = request.headers.get("X-Unity-Version", "")
        accept_encoding = request.headers.get("Accept-Encoding", "")
        
        if accept_encoding != "deflate, gzip":
                return "", 404
        
        if unity_version not in VALID_VERSIONS:
                return jsonify({"BanMessage": "Your account has been traced and you have been banned.\n", "BanExpirationTime": "Indefinite"}), 403
        
        if agent != VALID_VERSIONS[unity_version]:
                return jsonify({"BanMessage": "Your account has been traced and you have been banned.\n", "BanExpirationTime": "Indefinite"}), 403
        
        rjson = request.get_json()

        if rjson.get("Nonce") is None:
                return jsonify({"Message":"Missing Nonce parameter","Error":"BadRequest-NoNonce"})
        if rjson.get("AppId") is None:
                return jsonify({"Message":"Missing AppId parameter","Error":"BadRequest-NoAppId"})
        if rjson.get("Platform") is None:
                return jsonify({"Message":"Missing Platform parameter","Error":"BadRequest-NoPlatform"})
        if rjson.get("OculusId") is None:
                return jsonify({"Message":"Missing OculusId parameter","Error":"BadRequest-NoOculusId"})

        if rjson.get("AppId") != settings.TitleId:
                return jsonify({"Message":"Request sent for the wrong App ID","Error":"BadRequest-AppIdMismatch"})

        nonce_result = settings.TuffNonceAuth(rjson.get("Nonce"), rjson.get("OculusId"))
        if nonce_result is None:
                return jsonify({"BanMessage": "Your account has been traced and you have been banned.\n", "BanExpirationTime": "Indefinite"}), 403

        oculus_id = rjson.get("OculusId")
        meta_alias = GetMetaAlias(oculus_id)
        if not meta_alias:
                return jsonify({"BanMessage": "Your account has been traced and you have been banned.\n", "BanExpirationTime": "Indefinite"}), 403

        org_scoped_id = GetOrgScopedId(oculus_id)
        if not org_scoped_id:
                return jsonify({"BanMessage": "Your account has been traced and you have been banned.\n", "BanExpirationTime": "Indefinite"}), 403

        if org_scoped_id != nonce_result.get('org_scoped_id'):
                return jsonify({"BanMessage": "Your account has been traced and you have been banned.\n", "BanExpirationTime": "Indefinite"}), 403

        custom_id = f"OC{org_scoped_id}"

        url = f"https://{settings.TitleId}.playfabapi.com/Server/LoginWithServerCustomId"
        login_request = requests.post(
                url = url,
                json = {
                        "ServerCustomId": custom_id,
                        "CreateAccount": True
                },
                headers = settings.GetAuthHeaders()
        )
        
        if login_request.status_code == 200:
                data =  login_request.json().get("data")
                sessionTicket = data.get("SessionTicket")
                entityToken = data.get("EntityToken").get("EntityToken")
                playFabId = data.get("PlayFabId")
                entityType = data.get("EntityToken").get("Entity").get("Type")
                entityId = data.get("EntityToken").get("Entity").get("Id")

                link_response = requests.post(
                        url = f"https://{settings.TitleId}.playfabapi.com/Server/LinkServerCustomId",
                        json = {
                                "PlayFabId": playFabId,
                                "ServerCustomId": custom_id,
                                "ForceLink": True
                        },
                        headers = settings.GetAuthHeaders()
                )
                print(f"LinkServerCustomId response: {link_response.json()}")

                return jsonify({
                        "PlayFabId": playFabId,
                        "SessionTicket": sessionTicket,
                        "EntityToken": entityToken,
                        "EntityId": entityId,
                        "EntityType": entityType
                })
        else:
                if login_request.status_code == 403:
                        ban_info = login_request.json()
                        if ban_info.get('errorCode') == 1002:
                                ban_message = ban_info.get('errorMessage', "No ban message provided.")
                                ban_details = ban_info.get('errorDetails', {})
                                ban_expiration_key = next(iter(ban_details.keys()), None)
                                ban_expiration_list = ban_details.get(ban_expiration_key, [])
                                ban_expiration = ban_expiration_list[0] if len(ban_expiration_list) > 0 else "No expiration date provided."
                                print(ban_info)
                                return jsonify({
                                        'BanMessage': ban_expiration_key,
                                        'BanExpirationTime': ban_expiration
                                }), 403
                        else:
                                error_message = ban_info.get('errorMessage', 'Forbidden without ban information.')
                                return jsonify({
                                        'Error': 'PlayFab Error',
                                        'Message': error_message
                                }), 403
                else:
                        error_info = login_request.json()
                        error_message = error_info.get('errorMessage', 'An error occurred.')
                        return jsonify({
                                'Error': 'PlayFab Error',
                                'Message': error_message
                        }), login_request.status_code
                        
@app.route("/api/CachePlayFabId", methods = ["POST","GET"])
def cacheplatfabid():
        rjson = request.get_json()

        playfabCache[rjson.get("PlayFabId")] = rjson

        return jsonify({"Message":"Success"}), 200

@app.route("/api/TitleData", methods=["GET", "POST"])
def TitleData():
    return jsonify({
        "MOTD": "<color=green>WELCOME TO LAVA TAG</color>\n<color=red>MAKE SURE TO SHARE THE GAME WITH YOUR FRIENDS AND THANKS FOR THE SUPPORT!!</color>\n<color=red>JOIN OUR DISCORD</color>\n<color=green>DISCORD.GG/tvRUKnBDGH</color>\n\n<color=pink>FOUNDERS ARE : CURT</color>\n<color=white>DEVS : CURT</color>",
        "TOBDefCompTxt": "PLEASE SELECT A PACK TO TRY ON AND BUY",
        "TOBDefPurchaseBtnDefTxt": "SELECT A PACK",
        "TOBSafeCompTxt": "PURCHASE ITEMS IN YOUR CART AT THE CHECKOUT COUNTER",
        "TOBAlreadyOwnCompTxt": "YOU OWN THE BUNDLE ALREADY! THANK YOU!",
        "TOBAlreadyOwnPurchaseBtnTxt": "-",
        "BundleBoardSafeAccountSign": "DISCORD.GG/tvRUKnBDGH",
        "BundleBoardSign_SafeAccount": "DISCORD.GG/tvRUKnBDGH",
        "BundleBoardSign": "DISCORD.GG/",
        "BundleKioskButton": "ts doesnt exist anymore",
        "BundleKioskSign": "DISCORD.GG/tvRUKnBDGH",
        "BundleLargeSign": "DISCORD.GG/tvRUKnBDGH",
        "SeasonalStoreBoardSign": "DISCORD.GG/tvRUKnBDGH",
        "VStumpMOTD": "THERE HAS BEEN NEW MAPS IN VIRTUAL STUMP! (WHATEVER THE MAPS ARE HERE)",
        "VStumpDiscord": "DISCORD.GG/",
        "VStumpFeaturedMaps": "4623240,4602591,4409834,4540963",
        "AllowedClientVersions": "1.1.99",
        "ArenaForestSign": "^\nTO THE\nMAGMARENA!",
        "ArenaRulesSign": "RULES:\n\n+CAN'T RUN WITH THE BALL\n\n+CAN'T GRAB THE BALL WHEN IT'S THE OTHER TEAM'S COLOR\n\n+BALL COLOR CHANGES FOR A FEW SECONDS WHEN DROPPED\n\n+SCORE BY HOLDING THE BALL IN THE OTHER TEAM'S GOAL\n\n\nRESTARTING THE GAME:\n\nDROP THE BALL INTO THE START SLOT, THEN THE OTHER TEAM MUST PRESS START GAME",
        "AnnouncementData": {
            "ShowAnnouncement": "false",
            "AnnouncementID": "kID_Prelaunch",
            "AnnouncementTitle": "IMPORTANT NEWS",
            "Message": "We're working to make Gorilla Tag a better, more age-appropriate experience in our next update. To learn more, please check out our Discord."
        },
        "UseLegacyIAP": "False",
        "CreditsData": '[{"Title":"DEV TEAM/OWNERS","Entries":["kerestellwest","lemming","anotheraxiom","electronicwall"]}]'
    })

NotSoNiceNames = [
    "NIG", "NIIG", "KKK", "NIGA", "NAZI", "BIGNIG", "BLACKNIG", "NIGAH", "BANANANIG", "NIGIS", "GAYNIG",
    "FAG", "NIGGA", "NIGNIG", "NIGZILLA", "NIGG", "NIGABALLS", "NIGMON", "NIGNOG", "NIGSY", "NIGRE",
    "GORILLANIG", "NIGKEY", "GORNIGA", "DADDYNIGA", "NIGMON", "HITLER", "NIIG", "N1GGA", "N1GA", "NIGR",
    "N1GGA", "N1GA", "N199A", "KKKLORD", "KKKMEMBER", "KKKMAN", "KKKMASTER", "KKKLEADER", "STINKYJEW",
    "NIGAB", "NIGAMO", "NIBBA", "NIGLET", "NIGWERD", "NIGUH", "NIGK", "NIGWARD", "NIQQA", "NIGDIRT", "NI99",
    "MONKENIGA", "NIGAB", "NIGHA", "H1TLER", "HITL3R", "H1TL3R", "KKKOFFICIAL", "NIGBA11S", "SPIDERNIG",
    "NIGSLAVE", "NIGILA", "NIGBALL", "NIGILLA", "SPIDANIGA", "BLACKNIGA", "NIG2MONKE", "NIGMAN", "NIGATOES",
    "NIGMAN", "NIGWAD", "MYNIGA", "NIGTARD", "NIGTURD", "NIGWORD", "NIGLIT", "NIGMAN", "NIGLER", "NIGSBALL",
    "SANDNIG", "SNOWNIG", "NIGQA", "DIRTYNIG", "NIGAFUCK", "HITTLER", "NIGFART", "NIGBA", "N1GWARD", "NIGHKA",
    "LITTLENIG", "NIGAH", "NIGBOB", "MASTERNIG", "NIGBOT", "NIGVR", "WARNIG",
    "NIGGER", "NIGGGER", "NIGERZ", "FAGGOT", "NIGAR", "NIGUR", "NIGG3R", "N1GGER", "N1GG3R", "NIGER",
    "NIGKILL", "NIGASLAYER", "NIGERMON", "NI66ER", "GEORGEFL", "GEORGFL", "NIIGGE", "NIIGGR", "CHINK",
    "N1GUR", "N1GER", "NICKG", "NIKGU", "NIKGE", "N199GE", "GASJEW", "KILLJEW", "JEWSLAYER", "JEWSSUCK",
    "GASTHEJEW", "KIKE", "NIBBER", "NIGOR", "NIGCER", "FUCKBLACK", "NIQQER", "FUCKJEW", "NI99ER", "NATEHIG",
    "FUCKLGBT", "FVCKLGBT", "HATELGBT", "NIG5ER", "IHATEGAY", "IH8GAY", "IH8LGBT", "IH8JEW", "IH8BLACK",
    "NICGER", "NIGQER", "H8NIG", "NIG3ER", "NIG3R", "NIGHER", "IHATENIG", "MONKEYNIG", "NIGEATSKFC",
    "FUCKGAYS", "N199ER", "N1663R", "N1993R", "N166ER", "NIGHUR", "N1G3R", "N1GGGERR", "NIG4R", "NIGEER",
    "NIGYR", "NIGBIGGER", "NIGCKER", "NIGIR", "NIG33R", "KXK", "KKX", "XXK", "KXX", "JMAN", "K9", "GAY9", "SLAVE",
    "H1TLER", "PENIS", "VAGINA", "MAXO", "ELLIOT", "KILLNIGGERS", "PORNHUB", "CHILDPORN", "CP", "DICK", "ANAL",
    "MINI99", "GAYSEX", "RAPE", "PORNO", "LESBIAN", "CUMSLUT", "DEEPTHROAT", "JMANCURLY", "DAISY09", "J3VU", "BOT",
    "TTTPIG", "JMANCURLY", "STATUE", "JMANFAN", "TTT", "MOSA", "H4PKY", "WARNING", "HACKER", "GAYMANCURLY",
    "TTTPIGFAN", "ELLIOTFAN", "H4PKYFAN", "MOSAFAN", "TOP1GROUND", "TOP1FLICK", "PIG", "BRN", "BRNMOSA", "GTC",
    "BODA", "K9", "K9FAN", "MAXOFAN", "ELLIOTJR", "TTTPIGJR", "TTTJR", "PIGJR", "MAXOJR", "JMANJR", "JMANCURLYJR",
    "911", "TERRORIST", "TWINTOWERS", "SKIBIDI", "SKIBIDITOILET", "L1RSONISGAY", "SILLYISGAY", "TOP1", "VMT", "VMTFAN",
    "VMTJR", "TTPIG", "LEMMING", "CJVR", "NIGER", "NIGA", "ALECVR", "GAYPIG", "FUCKNIGGERS", "FUCKNIGGAS", "SAVAFAN", 
    "SAVA", "SAVAJR", "FUCKNIGAS", "NIGA", "NIGGERA", "NIGERA", "SUCKMYDICK", "SAVAFAN", "SAVA", "SAVAVR", "COSMO" # add more if needed lol
]

# result : 1 warns the user
# result : 2 kicks the user from the game
# result : 0 means the name is good

@app.route("/api/CheckForBadName", methods=["POST"])
def Check():
    room = request.get_json().get("FunctionArgument", {}).get("forRoom")
    name = request.get_json().get("FunctionArgument", {}).get("name")

    if name in NotSoNiceNames:
        return jsonify({
            "result": 1
        }), 200
    
    else:
        return jsonify({
            "result": 0
        })

@app.route("/api/GetAcceptedAgreements", methods=['POST'])
def GetAcceptedAgreements():
    data = request.get_json(silent=True) or {}
    return jsonify({
        "ResultCode": 1,
        "StatusCode": 200,
        "Message": "",
        "result": 0,
        "CallerEntityProfile": data.get('CallerEntityProfile'),
        "TitleAuthenticationContext": data.get('TitleAuthenticationContext')
    })


@app.route("/api/SubmitAcceptedAgreements", methods=['POST'])
def SubmitAcceptedAgreements():
    data = request.get_json(silent=True) or {}
    return jsonify({
        "ResultCode": 1,
        "StatusCode": 200,
        "Message": "",
        "result": 0,
        "CallerEntityProfile": data.get('CallerEntityProfile'),
        "TitleAuthenticationContext": data.get('TitleAuthenticationContext'),
        "FunctionArgument": data.get('FunctionArgument')
    })

@app.route('/api/GetName', methods=['POST', 'GET'])
def GetName():
        return jsonify({"result": f"GORILLA{random.randint(1000,9999)}"})

@app.route("/api/ConsumeOculusIAP", methods = ["POST", "GET"])
def consumeoculusiap():
        rjson = request.get_json()

        accessToken = rjson.get("userToken")
        userId = rjson.get("userID")
        playFabId = rjson.get("playFabId")
        nonce = rjson.get("nonce")
        platform = rjson.get("platform")
        sku = rjson.get("sku")
        debugParams = rjson.get("debugParemeters")

        req = requests.post(
                url = f"https://graph.oculus.com/consume_entitlement?nonce={nonce}&user_id={userId}&sku={sku}&access_token={settings.ApiKey}",
                headers = {
                        "content-type": "application/json"
                }
        )

        if bool(req.json().get("success")):
                return jsonify({"result":True})
        else:
                return jsonify({"error":True})

@app.route("/api/ReturnMyOculusHashV2")
def returnmyoculushashv2():
        return ReturnFunctionJson(request.get_json(), "ReturnMyOculusHash")

@app.route("/api/ReturnCurrentVersionV2", methods = ["POST", "GET"])
def returncurrentversionv2():
        return ReturnFunctionJson(request.get_json(), "ReturnCurrentVersion")

@app.route("/api/TryDistributeCurrencyV2", methods=["POST"])
def TryDistributeCurrencyV2():
        if request.method != "POST":
                return "", 404
                
        rjson = request.json
        sr_a_day = 100
        current_player_id = rjson.get("CallerEntityProfile", {}).get("Lineage", {}).get("MasterPlayerAccountId")

        get_data_response = requests.post(
                f"https://{settings.TitleId}.playfabapi.com/Server/GetUserReadOnlyData",
                headers=settings.GetAuthHeaders(),
                json={
                        "PlayFabId": current_player_id,
                        "Keys": ["DailyLogin"]
                }
        )

        daily_login_value = get_data_response.json().get("data").get("Data").get("DailyLogin", {}).get("Value", None)

        last_login_date = None
        if daily_login_value:
                last_login_date = datetime.fromisoformat(daily_login_value.replace("Z", "+00:00")).astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

        if not last_login_date or last_login_date < datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc):
                requests.post(
                        f"https://{settings.TitleId}.playfabapi.com/Server/AddUserVirtualCurrency",
                        headers=settings.GetAuthHeaders(),
                        json={
                                "PlayFabId": current_player_id,
                                "VirtualCurrency": "SR",
                                "Amount": sr_a_day
                        }
                )

                requests.post(
                        f"https://{settings.TitleId}.playfabapi.com/Server/UpdateUserReadOnlyData",
                        headers=settings.GetAuthHeaders(),
                        json={
                                "PlayFabId": current_player_id,
                                "Data": {
                                        "DailyLogin": datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc).isoformat()
                                }
                        }
                )

        return "", 200

@app.route("/api/BroadCastMyRoomV2", methods = ["POST", "GET"])
def broadcastmyroomv2():
        return ReturnFunctionJson(request.get_json(), "BroadCastMyRoom", request.get_json()["FunctionParameter"])

@app.route("/api/ShouldUserAutomutePlayer", methods = ["POST", "GET"])
def shoulduserautomuteplayer():
        return jsonify(muteCache)

@app.route("/api/photon", methods=["POST", "GET"])
def photonauth():
        print(f"Received {request.method} request at /api/photon")
        getjson = request.get_json()
        Ticket = getjson.get("Ticket")
        Nonce = getjson.get("Nonce")
        Platform = getjson.get("Platform")
        UserId = getjson.get("UserId")
        AppId = getjson.get("AppId")
        nickName = getjson.get("username")
        
        if request.method.upper() == "GET":
                rjson = request.get_json()
                print(f"{request.method} : {rjson}")

                userId = GetUserId(Ticket) if Ticket else None
                print(f"Extracted userId: {userId}")

                if userId is None or len(userId) != 16:
                        print("Invalid userId")
                        return jsonify({
                                'resultCode': 2,
                                'message': 'Invalid token',
                                'userId': None,
                                'nickname': None
                        })

                if Platform != 'Quest':
                        return jsonify({'Error': 'Bad request', 'Message': 'Invalid platform!'}),403

                if Nonce is None:
                        return jsonify({'Error': 'Bad request', 'Message': 'Not Authenticated!'}),304

                req = requests.post(
                        url=f"https://{settings.TitleId}.playfabapi.com/Server/GetUserAccountInfo",
                        json={"PlayFabId": userId},
                        headers=settings.GetAuthHeaders())

                print(f"Request to PlayFab returned status code: {req.status_code}")

                if req.status_code == 200:
                        nickName = req.json().get("UserInfo",
                                                  {}).get("UserAccountInfo",
                                                          {}).get("Username")
                        if not nickName:
                                nickName = None

                        print(
                                f"Authenticated user {userId.lower()} with nickname: {nickName}"
                        )

                        return jsonify({
                                'resultCode': 1,
                                'message':
                                f'Authenticated user {userId.lower()} title {settings.TitleId.lower()}',
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
                rjson = request.get_json()
                print(f"{request.method} : {rjson}")

                auth_session = requests.post(
                        f"https://{settings.TitleId}.playfabapi.com/Server/AuthenticateSessionTicket",
                        json={"SessionTicket": Ticket},
                        headers=settings.GetAuthHeaders()
                )
                
                if auth_session.status_code != 200:
                        print("Failed to authenticate session ticket")
                        successJson = {
                                'resultCode': 0,
                                'message': "Something went wrong",
                                'userId': None,
                                'nickname': None
                        }
                        authPostData = {}
                        for key, value in authPostData.items():
                                successJson[key] = value
                        print(f"Returning successJson: {successJson}")
                        return jsonify(successJson)
                
                user_info = auth_session.json()["data"]["UserInfo"]
                userId = user_info["PlayFabId"]
                
                print(f"Extracted userId: {userId}")

                if userId is None or len(userId) != 16:
                        print("Invalid userId")
                        return jsonify({
                                'resultCode': 2,
                                'message': 'Invalid token',
                                'userId': None,
                                'nickname': None
                        })

                if Platform != "Quest":
                        return jsonify({'Error': 'Bad request', 'Message': 'Invalid platform!'}), 403
                
                if AppId != settings.TitleId:
                        return jsonify({"ResultCode": 0, "message": "Invalid AppId"}), 400

                print(f"Authenticated user {userId.lower()}")
                print(f"Request to PlayFab returned status code: {auth_session.status_code}")

                if auth_session.status_code == 200:
                         nickName = user_info.get("TitleInfo", {}).get("DisplayName")
                         if not nickName:
                                 nickName = None
                         return jsonify({
                                 'resultCode': 1,
                                 'message':
                                 f'Authenticated user {userId.lower()} title {settings.TitleId.lower()}',
                                 'userId': f'{userId.upper()}',
                                 'nickname': nickName
                         })
                else:
                         print("Failed to get user account info from PlayFab")
                         successJson = {
                                 'resultCode': 0,
                                 'message': "Something went wrong",
                                 'userId': None,
                                 'nickname': None
                         }
                         authPostData = {}
                         for key, value in authPostData.items():
                                 successJson[key] = value
                         print(f"Returning successJson: {successJson}")
                         return jsonify(successJson)
        else:
                 print(f"Invalid method: {request.method.upper()}")
                 return jsonify({
                         "Message":
                         "Use a POST or GET Method instead of " + request.method.upper()
                 })


def ReturnFunctionJson(data, funcname, funcparam={}):
        print(f"Calling function: {funcname} with parameters: {funcparam}")
        rjson = data.get("FunctionParameter", {})
        userId = rjson.get("CallerEntityProfile",
                           {}).get("Lineage", {}).get("TitlePlayerAccountId")

        print(f"UserId: {userId}")

        req = requests.post(
                url=f"https://{settings.TitleId}.playfabapi.com/Server/ExecuteCloudScript",
                json={
                        "PlayFabId": userId,
                        "FunctionName": funcname,
                        "FunctionParameter": funcparam
                },
                headers=settings.GetAuthHeaders())

        if req.status_code == 200:
                result = req.json().get("data", {}).get("FunctionResult", {})
                print(f"Function result: {result}")
                return jsonify(result), req.status_code
        else:
                print(f"Function execution failed, status code: {req.status_code}")
                return jsonify({}), req.status_code

if __name__ == "__main__":

        app.run("0.0.0.0", 8080)
