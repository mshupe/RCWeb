// This code is owned and copyrighted by ZBS Technology, LLC 2013

var networkIndex = -1;
var sConfigureNetwork = "your local wifi network"

var timerFindController = null;

var currentStatus = 'welcome';
var foundController = false;
var InFindController = false;
var InVerifyController = false;
var verifyControllerCount = 0;
var loadedNetworks = false;
var InGetNetworks = false;
var findTimmerDelayCount = 0;
var findRetryCount = 0;
var getNetworksDelayCount = 0;
var getNetworksRetryCount = 0;

var ControllerMAC = "";

//$(document).on('pageshow', function (event, ui) {
//    alert('yep');
//
//    // Remove the previous page
//      $(ui.prevPage).remove();
//});

$(function () {
    $('#txtNetworkKey').keypress(function (e) {
        if (e.which == 13) {
            ConfigureNetwork();
            return false;
        }
    });
});

function ConfigurePageSecondTimer() {
    // Welcome status finds controller
    if (currentStatus == 'welcome') {
        // Wait 2 seconds before trying to find a controller
        if (foundController == false && InFindController == false && findTimmerDelayCount > 2) {
            findController();
            findRetryCount++;
        }
        findTimmerDelayCount += 1;
    } else if (currentStatus == 'found') {
        // Wait 30 seconds before trying to load networks again
        if (foundController == true && loadedNetworks == false && InGetNetworks == false && getNetworksDelayCount > 30) {
            getNetworksRetryCount++;
            GetNetworks();
            getNetworksDelayCount = 0;
        }
        getNetworksDelayCount += 1;
    } else if (currentStatus == 'verify') {
        if (verifyControllerCount > 10) {
            RefreshSetupStatus('error');
        }
        else if (InVerifyController == false) {
            verifyController();
        }
    }
}

function findController() {
    InFindController = true;
    $.ajax({
        cache: false,
        dataType: 'jsonp',
        jsonp: 'status_callback',
        url: 'http://169.254.1.1/status.htm',
        timeout: 5000,
        success: function () {
            InFindController = false;
        },
        error: function (msg, e, f, g) {
            InFindController = false;
            if (msg.status == 200) {
                foundController = true;
                RefreshSetupStatus('found');
                getNetworksDelayCount = 28;
            }
        }
    });
}

function verifyController() {
    InVerifyController = true;
    var user = GetUser();

    $.ajax({
        url: "/Controller/wscmd.asmx/VerifyController",
        cache: false,
        type: "POST",
        dataType: "json",
        data: "{_Email:'" + user + "', _MAC:'" + ControllerMAC + "'}",
        contentType: "application/json; charset=utf-8",
        success: function (msg) {
            InVerifyController = false;
            if (msg.d.Data !== null) {
                if (msg.d.Data.Status == "Online")
                    RefreshSetupStatus('complete');
                else
                    verifyControllerCount = 15;
            }
            else {
                verifyControllerCount++;
            }

            if (verifyControllerCount > 15) {
                RefreshSetupStatus('error');
            }

        },
        error: function (e) {
            InVerifyController = false;
            if (verifyControllerCount > 10)
                RefreshSetupStatus('error');
            return false;
        }
    });
}

function status_callback(data) {
    foundController = true;
    RefreshSetupStatus('found');
    getNetworksDelayCount = 28;
}

function RefreshSetupStatus(status) {
    currentStatus = status;

    if (status != 'complete') {
        //$('#bGetStarted').hide();
    }

    $('#divGetNetworks').empty();
    var statusHTML = '<ul id="lvSetupStatus" data-role="listview" data-inset="true" data-theme="c" data-dividertheme="b">';
    var user = GetUser();

    if (status == 'welcome') {
        statusHTML = '<h3>Connect RainCommander to your WIFI network</h3>';
        statusHTML += "<h4>Step 1) Go to your device's WiFi settings and select \"RC SETUP\"</h4>";
        statusHTML += '<h5>Your internet connection will be temporarily unavailable until setup is complete</h5>';
    }
    else if (status == 'found') {
        InFindController = false;
        foundController = true;
        statusHTML = '<h3>RainCommander is finding available WiFi networks...</h3>';
    }
    else if (status == 'networks found') {
        InGetNetworks = false;
        loadedNetworks = true;
        $('#divNetworks').show();
        statusHTML = '<h3>Step 2) Select the WiFi network RainCommander will use</h3>';
    }
    else if (status == 'verify') {
        $('#divNetworks').hide();
        statusHTML = '<h3>Step 3) Go back to your device\'s WiFi settings and select the <b>"' + sConfigureNetwork + '"</b> network</h3>';
    }
    else if (status == 'no networks') {
        loadedNetworks = true;
        $('#divNetworks').show();
        statusHTML += '<h3>The RainCommander controller did not find any available WiFi networks</h3>';
    }
    else if (status == 'complete') {
        $('#divNetworks').hide();
        $('#bGetStarted').show();
        statusHTML = '<h3>RainCommander was set up successfully!</h3>';
    }
    else if (status == 'error') {
        $('#divNetworks').hide();
        statusHTML = '<h3>Configuration Error!</h3><h4>RainCommander could not connect to "' + sConfigureNetwork + '".</h4><h4>For help resolving this issue click <a href="http://www.raincommander.com/public/support/setup.aspx" >here</a></h4>';
    }
    else if (status == 'login') {
        statusHTML += '<h3>You must log in to the RainCommander site before you can configure your controller</h3>';
    }
    else if (status == 'android') {
        statusHTML += '<h3>An Android phone can not configure a Rain Commander Controller</h3>';
    }

    //statusHTML += '</ul>';
    $('#divGetNetworks').append(statusHTML).trigger('create');
//    $('#lvSetupStatus').append(statusHTML);
//    if ($('#lvSetupStatus').hasClass('ui-listview')) {
//        $('#lvSetupStatus').listview('refresh');
//    } else {
//        $('#lvSetupStatus').trigger('create');
//        //$('#lvSetupStatus').listview('refresh');
//    }
}


function GetNetworks() {
    if (foundController == false) {
        alert('Please connect to the "RC" wifi network');
        return;
    }
    InGetNetworks = true;

    $('#lvNetworks').empty();

    $.ajax({
        cache: false,
        dataType: 'jsonp',
        jsonp: 'wifi_callback',
        url: 'http://169.254.1.1/wifi.htm',
        timeout: 10000,
        success: function () {
            loadedNetworks = true;
            InGetNetworks = false;
        },
        error: function (msg, e, f, g) {
            InGetNetworks = false;
            if (loadedNetworks == false) {
                // Refresh the retry count in the status
                RefreshSetupStatus('found');
            }
        }
    });
}
function wifi_callback(data) {
    controllerNetworks = data;
    if (data.scancount == 0 || data.networks == null || data.networks.length == 0) {
        RefreshSetupStatus('no networks');
        return;
    }

    var network;
    ControllerMAC = data.ssid;
    $('#lvNetworks').append('<li data-role="list-divider"><h3>Available Networks - ' + ControllerMAC + '</h3></li>');
    for (var i = 0; i < data.networks.length; i++) {
        if (data.networks[i].name !== null && data.networks[i].name != "" && data.networks[i].name != data.ssid && data.networks[i].name != "RC SETUP")
            $('#lvNetworks').append('<li><a onclick="NetworkSelected(' + i.toString() + ')">' + data.networks[i].name + '</a></li>');
    }
    $('#lvNetworks').listview('refresh');
    RefreshSetupStatus('networks found');

    return true;
}


function NetworkSelected(index) {
    networkIndex = index;
    if (controllerNetworks.networks[index].privacy > 0) {
        $("#dlgNetworkKey").popup("open");
        return;

    }
    Configure(controllerNetworks.networks[index].name, 'no', '');
    return;
}
function ConfigureOther() {

    var ssid = $('#txtOtherSSID').val();
    var sec = $('#selSecurity').val();
    var key = $('#txtKey').val();

    if (ssid == "") {
        $('#lblOtherError').html("Please provide a SSID");
        return;
    }

    if (sec != "none" && key == "") {
        $('#lblOtherError').html("Please provide a security key.");
        return;
    }
    $("#dlgOther").popup("close");
    Configure(ssid, sec, key);
    return;
}

function ConfigureNetwork() {

    var ssid = controllerNetworks.networks[networkIndex].name;
    var key = $('#txtNetworkKey').val();
    var sec = "no";
    if (controllerNetworks.networks[networkIndex].privacy == 1) {
        // Check the length of the password - 10 chars = wep40 else wep104
        if (key.length == 10)
            sec = "wep40";
        else
            sec = "wep104";
    }
    else if (controllerNetworks.networks[networkIndex].privacy == 5 || controllerNetworks.networks[networkIndex].privacy == 9 || controllerNetworks.networks[networkIndex].privacy == 13)
        sec = "wpa";

    if (sec != "no" && (key == null || key == "")) {
        $("#lblNetworkKeyError").html("Please provide a security key.");
        return;
    }
    if (key.length == 64)
        sec = "calc";

    Configure(ssid, sec, key);
    $("#dlgNetworkKey").popup("close");

    return;
}

function Configure(ssid, security, key) {
    // Calculate the key if security is wpa
    if (security == "wpa") {
        security = "calc";
        key = fcalc(ssid, key);
    }

    var user = GetUser();
    var temp = GetToken();

    sConfigureNetwork = ssid;
    var sConfigUrl = 'http://169.254.1.1/configure.htm?u=' + encodeURIComponent(user) + '&p=' + encodeURIComponent(temp) + '&wlan=infra&ssid=' + encodeURIComponent(ssid) + '&sec=' + security + '&key=' + encodeURIComponent(key);

    $.mobile.loading('show', {
        text: "Configuring Controller...",
        textVisible: true,
        theme: "a" || $.mobile.loader.prototype.options.theme,
        textonly: false,
        html: ""
    });

    // Reset the verify count
    verifyControllerCount = 0;


    $.ajax({
        cache: false,
        dataType: 'jsonp',
        jsonp: 'config_callback',
        url: sConfigUrl,
        success: function () {
            $.mobile.loading('hide');
        },
        error: function (msg, e, f, g) {
            $.mobile.loading('hide');
        }
    });
}

function configure_callback(data) {

    RefreshSetupStatus('verify');

    return true;
}


function getWpaPskKeyFromPassphrase(pass, salt) {

    /* pad string to 64 bytes and convert to 16 32-bit words */
    function stringtowords(s, padi) {
        /* return a 80-word array for later use in the SHA1 code */
        var z = new Array(80);
        var j = -1, k = 0;
        var n = s.length;
        for (var i = 0; i < 64; i++) {
            var c = 0;
            if (i < n) {
                c = s.charCodeAt(i);
            } else if (padi) {
                /* add 4-byte PBKDF2 block index and
                standard padding for the final SHA1 input block */
                if (i == n) c = (padi >>> 24) & 0xff;
                else if (i == n + 1) c = (padi >>> 16) & 0xff;
                else if (i == n + 2) c = (padi >>> 8) & 0xff;
                else if (i == n + 3) c = padi & 0xff;
                else if (i == n + 4) c = 0x80;
            }
            if (k == 0) { j++; z[j] = 0; k = 32; }
            k -= 8;
            z[j] = z[j] | (c << k);
        }
        if (padi) z[15] = 8 * (64 + n + 4);
        return z;
    }

    /* compute the intermediate SHA1 state after processing just
    the 64-byte padded HMAC key */
    function initsha(w, padbyte) {
        var k;
        var t;
        var pw = (padbyte << 24) | (padbyte << 16) | (padbyte << 8) | padbyte;
        for (t = 0; t < 16; t++) w[t] ^= pw;
        var s = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
        var a = s[0], b = s[1], c = s[2], d = s[3], e = s[4];
        for (k = 16; k < 80; k++) {
            t = w[k - 3] ^ w[k - 8] ^ w[k - 14] ^ w[k - 16];
            w[k] = (t << 1) | (t >>> 31);
        }
        for (k = 0; k < 20; k++) {
            t = ((a << 5) | (a >>> 27)) + e + w[k] + 0x5A827999 + ((b & c) | ((~b) & d));
            e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t & 0xffffffff;
        }
        for (k = 20; k < 40; k++) {
            t = ((a << 5) | (a >>> 27)) + e + w[k] + 0x6ED9EBA1 + (b ^ c ^ d);
            e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t & 0xffffffff;
        }
        for (k = 40; k < 60; k++) {
            t = ((a << 5) | (a >>> 27)) + e + w[k] + 0x8F1BBCDC + ((b & c) | (b & d) | (c & d));
            e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t & 0xffffffff;
        }
        for (k = 60; k < 80; k++) {
            t = ((a << 5) | (a >>> 27)) + e + w[k] + 0xCA62C1D6 + (b ^ c ^ d);
            e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t & 0xffffffff;
        }
        s[0] = (s[0] + a) & 0xffffffff;
        s[1] = (s[1] + b) & 0xffffffff;
        s[2] = (s[2] + c) & 0xffffffff;
        s[3] = (s[3] + d) & 0xffffffff;
        s[4] = (s[4] + e) & 0xffffffff;
        return s;
    }

    /* compute the intermediate SHA1 state of the inner and outer parts
    of the HMAC algorithm after processing the padded HMAC key */
    var hmac_istate = initsha(stringtowords(pass, 0), 0x36);
    var hmac_ostate = initsha(stringtowords(pass, 0), 0x5c);

    /* output is created in blocks of 20 bytes at a time and collected
    in a string as hexadecimal digits */
    var hash = '';
    var i = 0;
    var j;
    var k;
    var t;
    while (hash.length < 64) {
        /* prepare 20-byte (5-word) output vector */
        var u = [0, 0, 0, 0, 0];
        /* prepare input vector for the first SHA1 update (salt + block number) */
        i++;
        var w = stringtowords(salt, i);
        /* iterate 4096 times an inner and an outer SHA1 operation */
        for (j = 0; j < 2 * 4096; j++) {
            /* alternate inner and outer SHA1 operations */
            var s = (j & 1) ? hmac_ostate : hmac_istate;
            /* inline the SHA1 update operation */
            var a = s[0], b = s[1], c = s[2], d = s[3], e = s[4];
            for (k = 16; k < 80; k++) {
                t = w[k - 3] ^ w[k - 8] ^ w[k - 14] ^ w[k - 16];
                w[k] = (t << 1) | (t >>> 31);
            }
            for (k = 0; k < 20; k++) {
                t = ((a << 5) | (a >>> 27)) + e + w[k] + 0x5A827999 + ((b & c) | ((~b) & d));
                e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t & 0xffffffff;
            }
            for (k = 20; k < 40; k++) {
                t = ((a << 5) | (a >>> 27)) + e + w[k] + 0x6ED9EBA1 + (b ^ c ^ d);
                e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t & 0xffffffff;
            }
            for (k = 40; k < 60; k++) {
                t = ((a << 5) | (a >>> 27)) + e + w[k] + 0x8F1BBCDC + ((b & c) | (b & d) | (c & d));
                e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t & 0xffffffff;
            }
            for (k = 60; k < 80; k++) {
                t = ((a << 5) | (a >>> 27)) + e + w[k] + 0xCA62C1D6 + (b ^ c ^ d);
                e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t & 0xffffffff;
            }
            /* stuff the SHA1 output back into the input vector */
            w[0] = (s[0] + a) & 0xffffffff;
            w[1] = (s[1] + b) & 0xffffffff;
            w[2] = (s[2] + c) & 0xffffffff;
            w[3] = (s[3] + d) & 0xffffffff;
            w[4] = (s[4] + e) & 0xffffffff;
            if (j & 1) {
                /* XOR the result of each complete HMAC-SHA1 operation into u */
                u[0] ^= w[0]; u[1] ^= w[1]; u[2] ^= w[2]; u[3] ^= w[3]; u[4] ^= w[4];
            } else if (j == 0) {
                /* pad the new 20-byte input vector for subsequent SHA1 operations */
                w[5] = 0x80000000;
                for (k = 6; k < 15; k++) w[k] = 0;
                w[15] = 8 * (64 + 20);
            }
        }
        /* convert output vector u to hex and append to output string */
        for (j = 0; j < 5; j++)
            for (k = 0; k < 8; k++) {
                t = (u[j] >>> (28 - 4 * k)) & 0x0f;
                hash += (t < 10) ? t : String.fromCharCode(87 + t);
            }
    }

    /* return the first 32 key bytes as a hexadecimal string */
    return hash.substring(0, 64);
}

function fcalc(ssid, pass) {
    if (ssid.length < 1) {
        alert("ERROR: You must enter the network SSID string.");
        return;
    }
    if (ssid.length > 32) {
        alert("ERROR: The SSID string must not be longer than 32 characters.");
        return;
    }
    if (pass.length < 1) {
        alert("ERROR: Passphrase must be at least 8 characters.");
        return;
    }
    if (pass.length > 63) {
        alert("ERROR: Passphrase must not be longer than 63 characters.");
        return;
    }
    var i;
    for (i = 0; i < pass.length; i++)
        if (pass.charCodeAt(i) < 1 || pass.charCodeAt(i) > 126) {
            alert("ERROR: Passphrase contains strange characters.");
            return;
        }
    for (i = 0; i < ssid.length; i++)
        if (ssid.charCodeAt(i) < 1 || ssid.charCodeAt(i) > 126) {
            alert("ERROR: SSID string contains strange characters.");
            return;
        }
    var hash = getWpaPskKeyFromPassphrase(pass, ssid);
    return hash;
}


function GetUser() {
    return $.cookie("savedUser");
    //return localStorage.getItem("user");
}

function GetToken() {
    return $.cookie("savedPassword");
    //return localStorage.getItem("token");
}
