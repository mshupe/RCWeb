// This code is owned and copyrighted by ZBS Technology, LLC 2013
var timerUpdateSeconds = null;
var controllerNetworks = null;
var UserInfo = null;
var Controllers = null;
var Controller = null;

var nZoneSecondsRemaining = 0;
var nScheduleSecondsRemaining = 0;
var nRefreshCountdown = 0; // After we send a command we need to refresh the data until the last command status = "Received"
var nRefreshRetryCount = 0; // Only refresh a max of 10 times until status = "Received"

var loginValidator;
var registerValidator;
var bInDataRefresh = false;
var bInLogin = false;
var ajaxPrefix = "https://raincommander.com";

$(function () {

    loginValidator = $("#frmLogin").validate();
    registerValidator = $("#frmRegister").validate();

    $('#startTime').mobiscroll().time({
        theme: 'jqm',
        display: 'modal',
        mode: 'scroller'
    });
    $('#setStartTime').click(function () {
        $('#startTime').mobiscroll('show');
        return false;
    });

    $('#loginUsername').keypress(function (e) {
        if (e.which == 13) {
            LoginClick();
        }
    });
    $('#loginPassword').keypress(function (e) {
        if (e.which == 13) {
            LoginClick();
        }
    });
    $('#forgotUsername').keypress(function (e) {
        if (e.which == 13) {
            RequestPasswordReset();
        }
    });
    $('#txtZoneName').keypress(function (e) {
        if (e.which == 13) {
            UpdateZone();
            return false;
        }
    });

    $('#regUsername').keypress(function (e) {
        if (e.which == 13) {
            Register();
            return false;
        }
    });

    $('#regPassword').keypress(function (e) {
        if (e.which == 13) {
            Register();
            return false;
        }
    });
    $('#regFirstName').keypress(function (e) {
        if (e.which == 13) {
            Register();
            return false;
        }
    });
    $('#regLastName').keypress(function (e) {
        if (e.which == 13) {
            Register();
            return false;
        }
    });
    $('#regPhone').keypress(function (e) {
        if (e.which == 13) {
            Register();
            return false;
        }
    });
    $('#regAddress').keypress(function (e) {
        if (e.which == 13) {
            Register();
            return false;
        }
    });
    $('#regCity').keypress(function (e) {
        if (e.which == 13) {
            Register();
            return false;
        }
    });
    $('#regState').keypress(function (e) {
        if (e.which == 13) {
            Register();
            return false;
        }
    });
    $('#regZip').keypress(function (e) {
        if (e.which == 13) {
            Register();
            return false;
        }
    });

    /*
    $(window).hashchange(function () {
    var hash = location.hash;
    if ((hash != "" && hash != "#pageWelcome" && hash != "#pageLogin" && hash != "#pageRegister" && hash != "#pageResetPassword" && hash != "#pageForgotPassword") &&
    (ValidData() == false)) {
    $.mobile.changePage("#pageWelcome");
    return;
    }

    });
    $(window).hashchange();
    */
});
/*
$(document).on('pageshow', function (event, ui) {
// Remove the previous page
$(ui.prevPage).remove();
});
*/

function LoadConfig() {
    $.cookie("savedUser", GetUser(), { expires: 10000, path: '/' });
    $.cookie("savedPassword", GetToken(), { expires: 10000, path: '/' });
    //document.location.href = "http://www.raincommander.com/Controller/configure.htm";
    document.location.href = "configure.html";
}


function GetUser() {
    // $.cookie("savedUser");
    return localStorage.getItem("user");
}

function GetToken() {
    return localStorage.getItem("token");
}

function SetUser(user) {
    localStorage.setItem("user", user);
}

function SetToken(token) {
    localStorage.setItem("token", token);
}

function ClearStorage() {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
}

function ValidUser() {
    var user = GetUser();
    if (user == null || user == "") {
        return false;
    }
    return true;
}

function ValidController() {

    if (ValidUser() == false)
        return false;

    if (!Controller || Controller === null) {
        return false;
    }
    return true;
}
function ValidData() {
    if (ValidUser() == false)
        return false;

    if (!UserInfo || UserInfo === null) {
        return false;
    }
    return true;
}

function SetTemp() {
    var t = $.cookie("savedPassword");
    $.cookie("temp", t, { expires: 36000000, path: '/' });
}


function PauseOrPlay() {
    if (Controller.Paused == true) {
        $("#dlgPlay").popup("open");
    }
    else {
        $("#dlgPause").popup("open");
    }
}
function SendPauseCommand() {
    $("#dlgPause").popup("close");
    SendCommand("Pause Controller", "cmd=pause&dur=" + $('#selPauseDuration').val(), false);
}
function SendPlayCommand() {
    $("#dlgPlay").popup("close");
    SendCommand("Start Controller", "cmd=unpause", false);
}

function RefreshControllers() {
    var options = ''

    if (Controllers === null || Controllers.length == 0 || Controllers[0] === null) {
        return;
    }

    // We have a new controller collection so update the local controller variable and refresh the controller objects
    if (Controller === null)
        Controller = Controllers[0];
    else {
        var i;
        for (i = 0; i < Controllers.length; i++) {
            if (Controllers[i].MACAddress == Controller.MACAddress)
                Controller = Controllers[i];
        }
    }
    RefreshController();
}
function RefreshController() {

    if (Controller === null)
        return;

    // Update the remaining seconds of schedules or zones and then controller Status
    UpdateSecondsRemaining();
    RefreshStatus();
}

function SelectController(MACAddress) {
    for (var i = 0; i < Controllers.length; i++) {
        if (Controllers[i].MACAddress == MACAddress) {
            Controller = Controllers[i];
            RefreshController();
            break;
        }
    }
    $('#dlgSelectController').popup('close');
}

function MainPageSecondTimer() {

    if (nScheduleSecondsRemaining > 0 || nZoneSecondsRemaining > 0) {
        UpdateSecondsRemaining();
        //nScheduleSecondsRemaining = nScheduleSecondsRemaining - 1;
        //nZoneSecondsRemaining = nZoneSecondsRemaining - 1;

        RefreshStatus();

        // If a zone has finished and the schedule is still running then refresh the data
        if (nScheduleSecondsRemaining > 0 && nZoneSecondsRemaining > -4 && nZoneSecondsRemaining < -2)
            RefreshData(false);
    }

    // If the controller has not confirmed it has the command then keep refreshing the data
    if (Controller.CommandStatus != "PENDING" && Controller.CommandStatus != "SENT") {
        nRefreshRetryCount = 0;
    }
    if (nRefreshCountdown == 0 && nRefreshRetryCount > 0) {
        nRefreshCountdown = 5;
        nRefreshRetryCount = nRefreshRetryCount - 1;
    }
    // If we are counting down a command refresh
    if (nRefreshRetryCount > 0 && nRefreshCountdown > 0) {
        nRefreshCountdown = nRefreshCountdown - 1;
        if (nRefreshCountdown == 0) {
            RefreshData(false);
        }
    }
}


function PageRunRefresh() {
    if (Controller === null)
        return;

    // Add Schedules
    $('#divRunSchedules').empty();
    var scheduleList = '<ul data-role="listview" data-inset="true" data-theme="c" data-dividertheme="b"><li data-role="list-divider">Run Schedule</li>';
    var schedulesAdded = 0;

    for (var i = 0; i < Controller.Schedules.length; i++) {
        if (Controller.Schedules[i].Enabled) {
            scheduleList = scheduleList + '<li><a onclick="OpenConfirmRunScheduleDlg(' + i + ')">' + Controller.Schedules[i].Name + '</a></li>';
            schedulesAdded = schedulesAdded + 1;
        }
    }

    if (Controller.Schedules.length == 0) {
        scheduleList = scheduleList + '<li>No schedules exist</li>';
    }
    else if (schedulesAdded == 0) {
        scheduleList = scheduleList + '<li>No schedules are enabled</li>';
    }
    scheduleList = scheduleList + '</ul>';
    $('#divRunSchedules').append(scheduleList).trigger('create');

    // Add Zones
    $('#divRunZones').empty();
    var zoneList = '<ul data-role="listview" data-inset="true" data-theme="c" data-dividertheme="b"><li data-role="list-divider">Run Zone</li>';
    var zonesAdded = 0;

    zoneList = zoneList + '<li>Minutes To Water: <p></p><input type="range" id="slidRunZoneDuration" value="10" min="1" max="60" data-highlight="true" data-theme="b" data-inline="true" data-mini="true"/></li>';
    for (var i = 0; i < Controller.Zones.length; i++) {
        if (Controller.Zones[i].Enabled) {
            zoneList = zoneList + '<li><a onclick="OpenConfirmRunZoneDlg(' + i + ')">' + Controller.Zones[i].Name + '</a></li>';
            zonesAdded = zonesAdded + 1;
        }
    }

    if (zonesAdded == 0)
        zoneList = zoneList + '<li>No zones are enabled</li>';
    zoneList = zoneList + '</ul>';
    $('#divRunZones').append(zoneList).trigger('create');
}

function PageConfigureZoneRefresh() {
    if (Controller === null)
        return;

    // Add Zones
    $('#divConfigureZones').empty();

    var zoneList = '<ul data-role="listview" data-inset="true" data-theme="c" data-dividertheme="b">';
    if (Controller.Status == 'Online')
        zoneList = zoneList + '<li data-role="list-divider">' + Controller.Name + '</li>';
    else
        zoneList = zoneList + '<li data-role="list-divider">' + Controller.Name + ' - ' + Controller.Status + '</li>';

    var zonesAdded = 0;

    for (var i = 0; i < Controller.Zones.length; i++) {
        zoneList = zoneList + '<li><a onclick="ZoneSelected(' + i.toString() + ')" ';
        if (Controller.Zones[i].Enabled)
            zoneList = zoneList + '>' + Controller.Zones[i].Name + '</a></li>';
        else
            zoneList = zoneList + 'style="color: #C0C0C0" >' + Controller.Zones[i].Name + '</a></li>';

        zonesAdded = zonesAdded + 1;
    }

    if (zonesAdded == 0)
        zoneList = zoneList + '<li>No zones exist</li>';
    zoneList = zoneList + '</ul>';
    $('#divConfigureZones').append(zoneList).trigger('create');
}

function PageConfigureScheduleRefresh() {
    if (Controller === null)
        return;

    // Add Schedules
    $('#divConfigureSchedules').empty();

    var scheduleList;
    if (Controller.Schedules === null || Controller.Schedules.length < 10) {
        scheduleList = '<div id="divAddSchedule"><a data-role="button" data-inline="true" data-theme="b" onclick="AddSchedule()" data-icon="add">Add</a></div>';
    }
    scheduleList = scheduleList + '<ul data-role="listview" data-inset="true" data-theme="c" data-dividertheme="b">';
    if (Controller.Status == 'Online')
        scheduleList = scheduleList + '<li data-role="list-divider">' + Controller.Name + '</li>';
    else
        scheduleList = scheduleList + '<li data-role="list-divider">' + Controller.Name + ' - ' + Controller.Status + '</li>';

    var schedulesAdded = 0;

    for (var i = 0; i < Controller.Schedules.length; i++) {
        scheduleList = scheduleList + '<li><a onclick="ScheduleSelectedOffset(' + i.toString() + ')" '
        if (Controller.Schedules[i].Enabled)
            scheduleList = scheduleList + '>' + Controller.Schedules[i].Name + '</a></li>';
        else
            scheduleList = scheduleList + ' style="color: #C0C0C0" >' + Controller.Schedules[i].Name + '</a></li>';

        schedulesAdded = schedulesAdded + 1;
    }

    if (schedulesAdded == 0)
        scheduleList = scheduleList + '<li>No schedules exist</li>';
    scheduleList = scheduleList + '</ul>';
    $('#divConfigureSchedules').append(scheduleList).trigger('create');
}

function PageScheduleHistoryRefresh() {
    if (Controller === null)
        return;

    $('#divScheduleHistory').empty();
    var scheduleHistory;
    var currentStartDate = '';
    scheduleHistory = '<ul data-role="listview" data-inset="true" data-theme="c" data-dividertheme="b">';
    scheduleHistory = scheduleHistory + '<li data-role="list-divider">' + Controller.Name + '</li>';

    for (var i = 0; Controller.ScheduleHistory !== null && i < Controller.ScheduleHistory.length; i++) {

        if (currentStartDate != Controller.ScheduleHistory[i].LocalStartDate) {
            currentStartDate = Controller.ScheduleHistory[i].LocalStartDate;
            scheduleHistory = scheduleHistory + '<li data-role="list-divider">' + Controller.ScheduleHistory[i].LocalStartDate + '</li>';
        }

        scheduleHistory = scheduleHistory + '<li><h2>' + Controller.ScheduleHistory[i].Name + '</h2>';
        scheduleHistory = scheduleHistory + '<p><strong>Start Time: - ';
        scheduleHistory = scheduleHistory + Controller.ScheduleHistory[i].LocalStartTime + '</strong></p>';
        scheduleHistory = scheduleHistory + '<p><strong>Duration: - ';
        scheduleHistory = scheduleHistory + Controller.ScheduleHistory[i].Duration + ' Minutes</strong></p></li>';
        scheduleHistory = scheduleHistory + '';
    }

    if (Controller.ScheduleHistory === null || Controller.ScheduleHistory.length == 0)
        scheduleHistory = scheduleHistory + '<li>No history exists</li>';

    scheduleHistory = scheduleHistory + '</ul>';
    $('#divScheduleHistory').append(scheduleHistory).trigger('create');
}

function PageScheduleDetailRefresh() {

}

// Zone Detail Functions
function ZoneSelected(index) {

    $.mobile.changePage("#pageZoneDetail");

    // Set the zone values
    $('#txtZoneNumber').val(Controller.Zones[index].Number);
    $('#txtZoneName').val(Controller.Zones[index].Name);
    if (Controller.Zones[index].Enabled.toString() == "true")
        $('#cbZoneEnabled').attr('checked', true).checkboxradio("refresh");
    else
        $('#cbZoneEnabled').attr('checked', false).checkboxradio("refresh");

    return;
}

function UpdateZone() {
    var nZoneNumber = $('#txtZoneNumber').val();
    var sZoneName = $('#txtZoneName').val();
    var bEnabled = $('#cbZoneEnabled').prop('checked');
    var nEnabled = 0;
    Controller.Zones[nZoneNumber - 1].Name = sZoneName;
    Controller.Zones[nZoneNumber - 1].Enabled = bEnabled;

    if (bEnabled)
        nEnabled = 1;

    SendCommand("Update Zone - " + sZoneName, "cmd=updateZone&num=" + nZoneNumber.toString() + "&name=" + encodeURIComponent(sZoneName) + "&enabled=" + nEnabled.toString(), false);

    PageConfigureZoneRefresh();
    $.mobile.changePage("#pageConfigureZones");
}


function OpenConfirmRunZoneDlg(ZoneOffset) {

    $('#divConfirmZoneContent').empty();

    var nDuration = $('#slidRunZoneDuration').val();
    var zoneInfo;
    if (nDuration == 1)
        zoneInfo = '<div>Run Zone "' + Controller.Zones[ZoneOffset].Name + '" for ' + nDuration.toString() + ' minute?</div>';
    else
        zoneInfo = '<div>Run Zone "' + Controller.Zones[ZoneOffset].Name + '" for ' + nDuration.toString() + ' minutes?</div>';
    var sCommand = 'cmd=startZone&num=' + Controller.Zones[ZoneOffset].Number + '&dur=' + nDuration.toString();

    zoneInfo = zoneInfo + '<a data-role="button" data-inline="true" data-theme="b" data-rel="back" onclick="SendCommand(\'Start Zone - ' + Controller.Zones[ZoneOffset].Name + '\', \'' + sCommand + '\', true)">Yes</a>';
    zoneInfo = zoneInfo + '<a data-role="button" data-inline="true" data-theme="b" data-rel="back">No</a>';

    $('#divConfirmZoneContent').append(zoneInfo).trigger('create');
    $('#confirmRunZone').popup('open');
}
function OpenConfirmRunScheduleDlg(ScheduleOffset) {

    $('#divConfirmScheduleContent').empty();

    var sCommand = 'cmd=startSchedule&num=' + Controller.Schedules[ScheduleOffset].Number.toString();
    var scheduleInfo = '<div>Run Schedule "' + Controller.Schedules[ScheduleOffset].Name + '?</div>';

    scheduleInfo = scheduleInfo + '<a data-role="button" data-inline="true" data-theme="b" data-rel="back" onclick="SendCommand(\'Start Schedule - ' + Controller.Schedules[ScheduleOffset].Name + '\', \'' + sCommand + '\', true)">Yes</a>';
    scheduleInfo = scheduleInfo + '<a data-role="button" data-inline="true" data-theme="b" data-rel="back">No</a>';

    $('#divConfirmScheduleContent').append(scheduleInfo).trigger('create');
    $('#confirmRunSchedule').popup('open');
}

function RefreshWelcome() {
    $('#divWelcome').empty();
    var welcomeHTML = '';

    if (ValidUser() == true && ValidData() == false) {
        var savedUser = GetUser();
        // Update welcome html
        welcomeHTML = '<ul data-role="listview" data-inset="true" data-theme="c" data-dividertheme="b">' +
                                '<li><h2 style="text-align: center">Welcome back ' + savedUser.toString() + '</h2></li></ul>';
        $('#divWelcome').append(welcomeHTML).trigger('create');
        // Set a timeout so the loading dialog is displayed
        window.setTimeout("ReLogin()", 200);
    }
    else if (ValidUser() == true && ValidData() == true) {
        $.mobile.changePage("#pageMain");
    }
    else {
        welcomeHTML = '<ul data-role="listview" data-inset="true" data-theme="c" data-dividertheme="b">' +
                          '<li><h2 style="text-align: center">Welcome to RainCommander</h2><p style="text-align: center; font-size: medium;">Login or Register to access your RainCommander controller</p></li>' +
                          '</ul>' +
		                  '<p><a href="#pageLogin" data-role="button" data-inline="true" data-theme="b">Login</a>' +
		                  '<a href="#pageRegister" data-role="button" data-inline="true" data-theme="b">Register</a></p>';

        $('#divWelcome').append(welcomeHTML).trigger('create');
    }
}
function ReLogin() {
    if (bInLogin)
        return;
    var savedToken = GetToken();
    var savedUser = GetUser();
    LoginWithToken(savedToken, savedUser, "Loading Data...");
}

function RefreshAccountInfo() {
    var user = GetUser();

    $('#lblCurrentUser').html(user);
    $('#lblNameOnAccount').html(UserInfo.FirstName + ' ' + UserInfo.LastName);
    $('#lblPhone').html(UserInfo.Phone);

    // Update Address information
    $('#lblAccountAddress').html(GetAddressHTML(UserInfo));
}

function RefreshAccountAddress() {
    $('#editAddress').val(UserInfo.Address);
    $('#editCity').val(UserInfo.City);
    $('#editState').val(UserInfo.State);
    $('#editZip').val(UserInfo.Zip);
}

function RefreshControllerInfo() {
    $('#txtControllerName').val(Controller.Name);

    if (Controller.TimeZoneName == "Pacific")
        $('select#selTimeZone')[0].selectedIndex = 0;
    else if (Controller.TimeZoneName == "Arizona")
        $('select#selTimeZone')[0].selectedIndex = 1;
    else if (Controller.TimeZoneName == "Mountain")
        $('select#selTimeZone')[0].selectedIndex = 2;
    else if (Controller.TimeZoneName == "Central")
        $('select#selTimeZone')[0].selectedIndex = 3;
    else if (Controller.TimeZoneName == "Eastern")
        $('select#selTimeZone')[0].selectedIndex = 4;
    $('select#selTimeZone').selectmenu('refresh', true);

    $('#liConfigureController').html(Controller.Name);
    $('#lblConfigMAC').html('MAC Address: ' + Controller.MACAddress);
    $('#lblConfigVersion').html('Version: ' + Controller.Version);

}
function RefreshContactInfo() {
    $('#editFirstName').val(UserInfo.FirstName);
    $('#editLastName').val(UserInfo.LastName);
    $('#editPhone').val(UserInfo.Phone);
}

function ControllerChanged() {
    RefreshController();
}

function OpenSelectControllerDlg() {
    $('#dlgSelectController').empty();
    var controllerList = '<ul id="lvSelectController" data-role="listview" data-inset="true" data-theme="c" data-dividertheme="b">';
    for (var i = 0; i < Controllers.length; i++) {
        controllerList = controllerList + '<li><a onclick="SelectController(\'' + Controllers[i].MACAddress + '\');">' + Controllers[i].Name + ' - ' + Controllers[i].MACAddress + '</a></li>';
    }
    $('#dlgSelectController').append(controllerList).trigger('create');
    $('#dlgSelectController').popup('open', { y: 200, positionTo: 'origin' });
}

function RefreshStatus() {
    $('#lvStatus').empty();
    var statusHTML = '';

    if (Controllers === null || Controller === null)
        return;

    var listHeader;
    if (Controller.Status == 'Online')
        listHeader = '<li data-role="list-divider" class="rcLIHeader">' + Controller.Name + '</li>';
    else
        listHeader = '<li data-role="list-divider" class="rcLIHeader">' + Controller.Name + ' - ' + Controller.Status + '</li>';

    if (Controllers.length > 1) {
        if (Controller.Status == 'Online') {
            listHeader = '<li data-role="list-divider" class="rcLIHeader">' + Controller.Name + '<button data-mini="true" data-inline="true" onclick="OpenSelectControllerDlg()" >...</button></li>';
        }
        else {
            listHeader = '<li data-role="list-divider" class="rcLIHeader">' + Controller.Name + ' - ' + Controller.Status + '<button data-mini="true" data-inline="true" onclick="OpenSelectControllerDlg()" >...</button></li>';
            //listHeader = '<li data-role="list-divider" class="rcLIHeader"><fieldset class="ui-grid-a"><div class="ui-block-a" style="margin: 0.5em 0.5em 0 0; width: 200px" >' +
            //Controller.Name + ' - ' + Controller.Status + '</div><div class="ui-block-b" style="width:50px; margin: 0.2em 0 0.5em 0;" ><button data-mini="true" onclick="OpenSelectControllerDlg()" >...</button></div></fieldset></li>';
        }
    }
    $("#lvStatus").append(listHeader).trigger('create');

    if (Controller.Status == "Offline") {
        statusHTML += '<li><h3>This controller has lost connectivity with our server<h3/>';
        statusHTML += '<p style="text-align: left; font-size: small;padding-left: 30px;">Click <a href="#" onclick="LoadConfig()">here</a> to reconnect</p></li>';
    }
    else {
        if (Controller.Paused == true) {
            statusHTML += '<li><fieldset class="ui-grid-a"><div class="ui-block-a"><h3>Controller Paused Until<h3/>';
            statusHTML += '<p>&nbsp;&nbsp;&nbsp;<strong>' + PausedUntilTime().toLocaleString() + '</strong></p></div>';
            statusHTML += '<div class="ui-block-b"><a id="bPlay" onclick="PauseOrPlay()" data-role="button" style="width: 120px">Resume</a></div></fieldset></li>'
        }
        if (nScheduleSecondsRemaining > 0 || nZoneSecondsRemaining > 0) {
            if (nScheduleSecondsRemaining > 0) {
                //statusHTML += '<li><h3>Running Schedule<h3/>';
                //statusHTML += '<p>&nbsp;&nbsp;&nbsp;<strong>' + Controller.LastScheduleRun + '</strong></p>';
                //statusHTML += '<p>&nbsp;&nbsp;&nbsp;<strong>Time Remaining ' + GetTimeString(nScheduleSecondsRemaining) + '</strong></p></li>';

                var liString = '<li><fieldset class="ui-grid-a"><div class="ui-block-a"><h3>Running Schedule<h3/>';
                liString += '<p>&nbsp;&nbsp;&nbsp;<strong>' + Controller.LastScheduleRun + '</strong></p>';
                liString += '<p>&nbsp;&nbsp;&nbsp;<strong>Time Remaining ' + GetTimeString(nScheduleSecondsRemaining) + '</strong></p></div>';
                liString += '<div class="ui-block-b"><a href="#" data-role="button" data-theme="none" data-corners="false" data-shadow="false" data-inline="true" onclick="SendCommand(\'Stop Schedule - ' + Controller.LastScheduleRun + '\', \'cmd=stop\', true)"><img id="imgStopZone" src="Controller/images/StopHand.png" alt="Stop" style="width: 50px; height: 50px" /></a></div></fieldset></li>';
                var $li = $(liString);
                $li.find('#stopCmd').buttonMarkup({
                    icon: "delete"
                });

                $("#lvStatus").append($li);

            }
            if (nZoneSecondsRemaining > 0) {
                var liString = '<li><fieldset class="ui-grid-a"><div class="ui-block-a"><h3>Running Zone<h3/>';
                liString += '<p>&nbsp;&nbsp;&nbsp;<strong>' + Controller.LastZoneRun + '</strong></p>';
                liString += '<p>&nbsp;&nbsp;&nbsp;<strong>Time Remaining ' + GetTimeString(nZoneSecondsRemaining) + '</strong></p></div>';
                // only add the button if a schedule isn't running
                if (nScheduleSecondsRemaining > 0) {
                    liString += '<div class="ui-block-b"></div></fieldset></li>';
                    var $li = $(liString);
                    $("#lvStatus").append($li);
                }
                else {
                    liString += '<div class="ui-block-b"><a href="#" data-role="button" data-theme="none" data-corners="false" data-shadow="false" data-inline="true" onclick="SendCommand(\'Stop Zone - ' + Controller.LastZoneRun + '\', \'cmd=stop\', true)"><img id="imgStopZone" src="Controller/images/StopHand.png" alt="Stop" style="width: 50px; height: 50px" /></a></div></fieldset></li>';
                    var $li = $(liString);
                    $li.find('#stopCmd').buttonMarkup({
                        icon: "delete"
                    });

                    $("#lvStatus").append($li);
                }
            }
            else if (nZoneSecondsRemaining < 0) {
                statusHTML += '<li><h3>Last Zone Run<h3/>';
                statusHTML += '<p>&nbsp;&nbsp;&nbsp;<strong>' + Controller.LastZoneRun + '</strong></p>';
                statusHTML += '<p>&nbsp;&nbsp;&nbsp;<strong>Waiting for next zone to start</strong></p></li>';

            }
        }
        else {
            var controllerTime;
            if (Controller.Paused == true) {
                controllerTime = PausedUntilTime();
            }
            else {
                controllerTime = ControllerTime();
            }

            var NextSchedule = null;
            var NextScheduleRunDate = null;
            for (var i = 0; i < Controller.Schedules.length; i++) {
                var schedule = Controller.Schedules[i];

                if (schedule.Enabled == true) {
                    // Get the next run date for the schedule
                    var NextRunDate = GetDateFromStartTime(controllerTime, schedule.LocalStartTime);

                    // Is the schedule start time later today?
                    if (NextRunDate < controllerTime) {
                        NextRunDate = new Date(NextRunDate.getFullYear(), NextRunDate.getMonth(), NextRunDate.getDate() + 1, NextRunDate.getHours(), NextRunDate.getMinutes());
                    }
                    var nDay = NextRunDate.getDay();

                    // Increment the date based on the type
                    if (schedule.ScheduleType == 1 && nDay % 2 != 1)
                        NextRunDate = new Date(NextRunDate.getFullYear(), NextRunDate.getMonth(), NextRunDate.getDate() + 1, NextRunDate.getHours(), NextRunDate.getMinutes());
                    else if (schedule.ScheduleType == 2 && nDay % 2 != 0)
                        NextRunDate = new Date(NextRunDate.getFullYear(), NextRunDate.getMonth(), NextRunDate.getDate() + 1, NextRunDate.getHours(), NextRunDate.getMinutes());
                    else if (schedule.ScheduleType == 4) {
                        for (var nCustomDay = 0; nCustomDay < 7; nCustomDay++) {
                            var nCustomOffset = (nCustomDay + nDay) % 7;
                            if (schedule.CustomDays[nCustomOffset] == 1)
                                break;
                            NextRunDate = new Date(NextRunDate.getFullYear(), NextRunDate.getMonth(), NextRunDate.getDate() + 1, NextRunDate.getHours(), NextRunDate.getMinutes());
                        }
                    }

                    if (NextScheduleRunDate === null || NextScheduleRunDate > NextRunDate) {
                        NextSchedule = schedule;
                        NextScheduleRunDate = NextRunDate;
                    }
                }
            }

            if (NextSchedule !== null) {
                statusHTML += '<li><fieldset class="ui-grid-a"><div class="ui-block-a"><h3>Next Schedule<h3/>';
                statusHTML += '<p>&nbsp;&nbsp;&nbsp;<strong>' + NextSchedule.Name + '</strong></p>';
                statusHTML += '<p>&nbsp;&nbsp;&nbsp;<strong>' + NextScheduleRunDate.toLocaleString() + '</strong></p></div>';
                if (Controller.Paused == false) {
                    statusHTML += '<div class="ui-block-b"><a id="bPause" onclick="PauseOrPlay()" data-role="button" style="width: 100px">Pause</a></div></fieldset></li>'
                }
                else {
                    statusHTML += '<div class="ui-block-b"></div></fieldset></li>'
                }
            }
            else {
                statusHTML += '<li><h3>Next Schedule<h3/>';
                statusHTML += '<p>&nbsp;&nbsp;&nbsp;<strong>' + 'No Schedule Found' + '</strong></p></li>';
            }

        }
    }
    if (Controller.CommandStatus != '') {
        if (Controller.CommandStatus == "PENDING" || Controller.CommandStatus == "SENT") {
            statusHTML += '<li><div class="ui-grid-a"><div class="ui-block-a"><h3>Last Activity<h3/>';
            statusHTML += '<p>&nbsp;&nbsp;&nbsp;<strong>' + Controller.CommandDescription + ' </strong> (' + Controller.CommandStatus + ')</p></div>';
            statusHTML += '<div class="ui-block-b"><img src="Controller/images/refresh.gif" style="width: 32px; height: 32px; padding-left: 100px; padding-top: 25px;" /></div></div></li>';
        }
        else {
            statusHTML += '<li><h3>Last Activity<h3/>';
            statusHTML += '<p>&nbsp;&nbsp;&nbsp;<strong>' + Controller.CommandDescription + ' </strong> (' + Controller.CommandStatus + ')</p></li>';
        }
    }

    if (statusHTML != "")
        $('#lvStatus').append(statusHTML).trigger('create');

    if ($('#lvStatus').hasClass('ui-listview')) {
        $('#lvStatus').listview('refresh');
    } else {
        $('#lvStatus').trigger('create');
        //$('#lvStatus').listview('refresh');
    }
}


function ControllerTime() {

    // create Date object for current location
    var d = new Date();

    // convert to msec
    // add local time zone offset
    // get UTC time in msec
    var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    var controllerDate = new Date(utc + (60000 * Controller.TimeZoneOffset));

    return controllerDate;
}
function PausedUntilTime() {
    // create Date object from utc second
    var d = new Date(Controller.utcSecPausedUntil * 1000);

    // convert to msec
    // add local time zone offset
    // get UTC time in msec
    var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    var pausedUntilDate = new Date(utc + (60000 * Controller.TimeZoneOffset));

    return pausedUntilDate;
}
function GetDateFromStartTime(d, startTime) {
    var dStartTime = new Date(d);
    dStartTime.setSeconds(0);
    dStartTime.setMilliseconds(0);

    var h = parseInt(startTime.substring(0, 2));
    if (startTime.substring(6, 8) == "PM" && h < 12)
        h += 12;
    dStartTime.setHours(h);
    var m = parseInt(startTime.substring(3, 5));
    dStartTime.setMinutes(m);
    return dStartTime;
}

function GetTimeString(sec) {
    var secDate = new Date(sec * 1000)

    var minutes = secDate.getMinutes();
    var seconds = secDate.getSeconds();

    var strMinutes = "00";
    if (parseInt(minutes) < 10 && minutes.toString().length < 2)
        strMinutes = "0" + minutes;
    else
        strMinutes = minutes;

    var strSeconds = "00";
    if (parseInt(seconds) < 10 && seconds.toString().length < 2)
        strSeconds = "0" + seconds;
    else
        strSeconds = seconds;

    return strMinutes + ":" + strSeconds;
}
function UpdateSecondsRemaining() {
    nScheduleSecondsRemaining = 0;
    nZoneSecondsRemaining = 0;

    if (Controller === null || Controller.Status == "Offline")
        return;

    var d = new Date();
    var utcSec = new Date().getTime() / 1000;

    if (Controller.utcSecLastScheduleRunOn > 0 && Controller.LastScheduleDuration > 0)
        nScheduleSecondsRemaining = Controller.utcSecLastScheduleRunOn + (Controller.LastScheduleDuration * 60) - utcSec;

    if (Controller.utcSecLastZoneRunOn > 0 && Controller.LastZoneDuration > 0)
        nZoneSecondsRemaining = Controller.utcSecLastZoneRunOn + (Controller.LastZoneDuration * 60) - utcSec;

    //        var ControllerTime = ControllerTime();

    //        //var now = new Date();
    //        //var now_utc = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
    //        //var now_utc_mill = now_utc.getTime();
    //        //// Add the Controller offset (in minutes)
    //        //var now_Controller_utc_sec = (now_utc_mill/1000) + (60 * controller.TimeZoneOffset);

    //        if (controller.utcSecLastScheduleRunOn > 0 && controller.LastScheduleDuration > 0)
    //            nScheduleSecondsRemaining = controller.utcSecLastScheduleRunOn + (controller.LastScheduleDuration * 60) - (controllerTime.getTime()/1000);
    //            //nScheduleSecondsRemaining = controller.utcSecLastScheduleRunOn + (controller.LastScheduleDuration * 60) - now_controller_utc_sec;

    //        if (controller.utcSecLastZoneRunOn > 0 && controller.LastZoneDuration > 0)
    //            nZoneSecondsRemaining = controller.utcSecLastZoneRunOn + (controller.LastZoneDuration * 60) - (controllerTime.getTime()/1000);
    //            //nZoneSecondsRemaining = controller.utcSecLastZoneRunOn + (controller.LastZoneDuration * 60) - now_controller_utc_sec;
}

function UpdateController() {
    var sName = $('#txtControllerName').val();
    var sTimeZoneName = $('#selTimeZone').val();
    var observeDST = "1";
    var tzo = "-420"; // Mountain
    if (sTimeZoneName == "Pacific") {
        tzo = "-480";
    }
    else if (sTimeZoneName == "Arizona") {
        observeDST = "0";
        tzo = "-420";
    }
    else if (sTimeZoneName == "Mountain") {
        tzo = "-420";
    }
    else if (sTimeZoneName == "Central") {
        tzo = "-360";
    }
    else if (sTimeZoneName == "Eastern") {
        tzo = "-300";
    }

    var cmd = "cmd=updateController&name=" + encodeURIComponent(sName) + "&tzn=" + sTimeZoneName + "&tzo=" + tzo + "&odst=" + observeDST;
    SendCommand("Update Controller", cmd, false);
}


// Schedule Detail Functions
function AddSchedule() {
    $.mobile.changePage("#pageScheduleDetail");

    // Find the next available Schedule Number
    var nNextScheduleNumber;
    var bScheduleAvailable = 0;
    for (nNextScheduleNumber = 1; nNextScheduleNumber <= 10; nNextScheduleNumber++) {
        bScheduleAvailable = 1;
        var nCurrentSchedule;
        for (nCurrentSchedule = 0; nCurrentSchedule < Controller.Schedules.length; nCurrentSchedule++) {
            if (Controller.Schedules[nCurrentSchedule].Number == nNextScheduleNumber) {
                bScheduleAvailable = 0;
                break;
            }
        }
        if (bScheduleAvailable == 1)
            break;
    }
    // Schedule number should always match index + 1
    if (bScheduleAvailable == 0) {
        alert("The max number of schedules is 10");
        return;
    }

    var newSchedule = new Object();
    newSchedule.Number = nNextScheduleNumber;
    newSchedule.Name = "New Schedule";
    newSchedule.LocalStartTime = "8:00 AM";
    newSchedule.Enabled = true;
    newSchedule.ScheduleType = 4;
    newSchedule.CustomDays = "1010101";
    newSchedule.ZonesAndDuration = "1:10~2:10~3:10~4:10~5:10~6:10~7:10~8:10~9:10~10:10~11:10~12:10"
    //newSchedule.ZonesAndDuration = "1:1~2:2~3:3~4:4~5:5~6:6~7:7~8:8~9:9~10:10~11:11~12:12"
    //var nNextSchedule = Controller.Schedules.length;
    //Controller.Schedules[nNextSchedule] = newSchedule;
    ScheduleSelected(newSchedule);
}

function ScheduleSelectedOffset(nOffset) {
    ScheduleSelected(Controller.Schedules[nOffset]);
}

function ScheduleSelected(schedule) {
    $.mobile.changePage("#pageScheduleDetail");

    // Set the schedule values
    $('#txtScheduleNumber').val(schedule.Number);
    $('#txtScheduleName').val(schedule.Name);
    if (schedule.Enabled.toString() == "true")
        $('#cbScheduleEnabled').attr('checked', true).checkboxradio("refresh");
    else
        $('#cbScheduleEnabled').attr('checked', false).checkboxradio("refresh");

    $('#startTime').val(schedule.LocalStartTime);

    $('#selectScheduleType').val(schedule.ScheduleType);
    $('#selectScheduleType').selectmenu('refresh');

    if (schedule.ScheduleType == 4)
        $('#divCustomDays').show();
    else
        $('#divCustomDays').hide();

    var CustomDays = [];
    if (schedule.CustomDays[0] == 1)
        CustomDays.push("Su");
    if (schedule.CustomDays[1] == 1)
        CustomDays.push("Mo");
    if (schedule.CustomDays[2] == 1)
        CustomDays.push("Tu");
    if (schedule.CustomDays[3] == 1)
        CustomDays.push("We");
    if (schedule.CustomDays[4] == 1)
        CustomDays.push("Th");
    if (schedule.CustomDays[5] == 1)
        CustomDays.push("Fr");
    if (schedule.CustomDays[6] == 1)
        CustomDays.push("Sa");

    $('#selectCustomDays').val(CustomDays);
    $('#selectCustomDays').selectmenu('refresh');

    // Update the Zone Duration Detail
    $('#divScheduleDetailZoneDuration').empty();

    var zoneInfo = '<h3>Minutes to water:</h3>';
    var zonesAdded = 0;

    var durationArray = new Array();
    for (var i = 0; i < 12; i++) {
        durationArray[i] = 0;
    }

    var sZonesAndDuration = schedule.ZonesAndDuration;
    var saZDs = sZonesAndDuration.split("~");
    for (var i in saZDs) {
        var sZD = saZDs[i];
        var saZD = sZD.split(":");
        if (saZD.length == 2) {
            durationArray[saZD[0] - 1] = saZD[1];
        }
    }

    for (var i = 0; Controller && i < Controller.Zones.length; i++) {
        var nZoneNumber = i + 1;
        if (Controller.Zones[i].Enabled) {
            zoneInfo = zoneInfo + '<div data-role="fieldcontain"><label for="slidDuration' + nZoneNumber.toString() + '" id="lblSlidDuration' + nZoneNumber + '">' + Controller.Zones[i].Name + ':</label>';
            zoneInfo = zoneInfo + '<input type="range" name="slidDuration' + nZoneNumber.toString() + '" id="slidDuration' + nZoneNumber.toString() + '" value="' + durationArray[i] + '" min="0" max="60" data-highlight="true" data-theme="b" data-mini="true" /></div>';
            zonesAdded = zonesAdded + 1;
        }
    }

    if (zonesAdded == 0)
        zoneInfo = zoneInfo + '<h4>No zones are enabled</h4>';
    $('#divScheduleDetailZoneDuration').append(zoneInfo).trigger('create');

    $("#selectScheduleType").change(OnScheduleTypeChange);

    return;
}

function OnScheduleTypeChange() {
    if ($('#selectScheduleType').val() == 4) {
        $('#divCustomDays').show();
    }
    else {
        $('#divCustomDays').hide();
    }
}

function UpdateSchedule() {
    var nScheduleNumber = $('#txtScheduleNumber').val();
    var sScheduleName = $('#txtScheduleName').val();
    var startTime = $('#startTime').val();
    var bEnabled = $('#cbScheduleEnabled').prop('checked');
    if (nScheduleNumber < 1 || nScheduleNumber >= 10) {
        alert("Invalid Schedule Number: " + nScheduleNumber);
        return;
    }
    if (startTime.length < 7) {
        alert("Please enter a start time")
        return;
    }
    // Find the schedule
    var Schedule;
    var nOffset;
    var bFound = 0;
    for (nOffset = 0; nOffset < Controller.Schedules.length; nOffset++) {
        if (Controller.Schedules[nOffset].Number == nScheduleNumber) {
            bFound = 1;
            Schedule = Controller.Schedules[nOffset];
            break;
        }
    }
    // If we didn't find the schedule then add it to the schedule array
    if (bFound == 0) {
        var Schedule = new Object();
        var nNextSchedule = Controller.Schedules.length;
        Controller.Schedules[nNextSchedule] = Schedule;
        Schedule.Number = nScheduleNumber;
    }
    Schedule.Name = sScheduleName;
    Schedule.Enabled = bEnabled;
    Schedule.LocalStartTime = startTime;

    Schedule.ScheduleType = $('#selectScheduleType').val();
    var sSu = "0", sMo = "0", sTu = "0", sWe = "0", sTh = "0", sFr = "0", sSa = "0";

    if (Schedule.ScheduleType == 4) {
        var SelectedCustomDays = $('#selectCustomDays').val();
        for (var nCustomIndex = 0; nCustomIndex < SelectedCustomDays.length; nCustomIndex++) {
            if (SelectedCustomDays[nCustomIndex] == "Su")
                sSu = "1";
            else if (SelectedCustomDays[nCustomIndex] == "Mo")
                sMo = "1";
            else if (SelectedCustomDays[nCustomIndex] == "Tu")
                sTu = "1";
            else if (SelectedCustomDays[nCustomIndex] == "We")
                sWe = "1";
            else if (SelectedCustomDays[nCustomIndex] == "Th")
                sTh = "1";
            else if (SelectedCustomDays[nCustomIndex] == "Fr")
                sFr = "1";
            else if (SelectedCustomDays[nCustomIndex] == "Sa")
                sSa = "1";
        }
    }
    Schedule.CustomDays = sSu + sMo + sTu + sWe + sTh + sFr + sSa;

    var sZonesAndDuration = "";
    for (var index = 0; index < 12; index++) {
        if ($('#slidDuration' + (index + 1).toString()).val() > 0) {
            if (sZonesAndDuration == "")
                sZonesAndDuration = (index + 1).toString() + ":" + $('#slidDuration' + (index + 1).toString()).val();
            else
                sZonesAndDuration += "~" + (index + 1).toString() + ":" + $('#slidDuration' + (index + 1).toString()).val();
        }
    }
    Schedule.ZonesAndDuration = sZonesAndDuration;
    var sCMD = "cmd=updateSchedule&num=" + Schedule.Number.toString() + "&name=" + encodeURIComponent(Schedule.Name) + "&enabled=";
    if (Schedule.Enabled)
        sCMD += "1";
    else
        sCMD += "0";

    var nHours = 0;
    var nMinutes = 0;
    nHours = parseInt(startTime.substring(0, 2));
    nMinutes = parseInt(startTime.substring(3, 6));
    if (startTime.substring(6, 8) == "PM" && nHours < 12)
        nHours += 12;

    var nLocalStartTime = nHours * 60 + nMinutes;
    sCMD += "&start=" + nLocalStartTime.toString();
    sCMD += "&type=" + Schedule.ScheduleType.toString();
    sCMD += "&days=" + Schedule.CustomDays;
    sCMD += "&zd=" + Schedule.ZonesAndDuration;

    SendCommand("Update Schedule - " + Schedule.Name, sCMD, false);
    PageConfigureScheduleRefresh();

    $.mobile.changePage("#pageConfigureSchedules");
}



function Logout() {
    $('#loginUsername').val("");
    $('#loginPassword').val("");

    ClearStorage();
    document.location.href = "index.html";
}



function LoginClick() {
    $('#lblLoginError').html('');

    // Make sure reset password vars are set and the popup is closed
    //    ResetPasswordRequest = 0;
    //    $('#dlgForgotPassword').popup('close');

    var txtUser = $('#loginUsername'),
        txtPassword = $('#loginPassword');

    if (txtUser.val() == '' || txtPassword.val() == '')
        $('#lblLoginError').html('Please enter a valid user and password');
    else if (txtUser.hasClass('error') || txtPassword.hasClass('error'))
        $('#lblLoginError').html('Please fix errors and try again');
    else {
        Login(txtUser.val(), txtPassword.val(), "Logging In...");
        return true;
    }

    return false;
}

function Login(sNewUser, sNewPassword, sMessage) {
    if (bInLogin)
        return;
    bInLogin = true;

    $.mobile.loading('show', {
        text: sMessage,
        textVisible: true,
        theme: "a" || $.mobile.loader.prototype.options.theme,
        textonly: false,
        html: ""
    });

    var url = ajaxPrefix + "/Controller/wsCmd.asmx/ValidUser" + '?nocache=' + new Date().getTime();

    $.ajax({
        url: url,
        cache: false,
        type: "POST",
        dataType: "json",
        data: "{_Email:'" + sNewUser + "', _Password:'" + sNewPassword + "'}",
        contentType: "application/json; charset=utf-8",
        success: function (msg) {
            bInLogin = false;
            $.mobile.loading('hide');
            if (msg.d.ReturnCode == 1) {

                var date = new Date();
                var days = 10000;
                date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));

                //$.cookie("savedUser", sNewUser, { expires: date, path: '/' });
                //$.cookie("savedPassword", sNewPassword, { expires: date, path: '/' });

                Controllers = msg.d.Data.Controllers;
                UserInfo = msg.d.Data;

                // Save the user and token
                SetUser(sNewUser);
                SetToken(UserInfo.Token);

                if (Controllers === null || Controllers.length == 0 || Controllers[0] === null) {
                    $.mobile.changePage("#pageNoControllers");
                }
                else {
                    RefreshControllers();
                    $.mobile.changePage("#pageMain");
                }

            }
            else {
                $('#lblLoginError').html("Error: " + msg.d.Status);
                ClearStorage();
            }
        },
        error: function (e) {
            bInLogin = false;
            $.mobile.loading('hide');
            $('#lblLoginError').html("Error: " + e.statusText.toString());
            return false;
        }
    });
}
function LoginWithToken(sToken, sUser, sMessage) {
    if (bInLogin)
        return;
    bInLogin = true;

    $.mobile.loading('show', {
        text: sMessage,
        textVisible: true,
        theme: "a" || $.mobile.loader.prototype.options.theme,
        textonly: false,
        html: ""
    });

    var url = ajaxPrefix + "/Controller/wsCmd.asmx/LoginWithToken" + '?nocache=' + new Date().getTime();

    $.ajax({
        url: url,
        cache: false,
        type: "POST",
        dataType: "json",
        data: "{_Email:'" + sUser + "', _Token:'" + sToken + "'}",
        contentType: "application/json; charset=utf-8",
        success: function (msg) {
            bInLogin = false;
            $.mobile.loading('hide');
            if (msg.d.ReturnCode == 1) {

                Controllers = msg.d.Data.Controllers;
                UserInfo = msg.d.Data;

                if (Controllers === null || Controllers.length == 0 || Controllers[0] === null) {
                    $.mobile.changePage("#pageNoControllers");
                }
                else {
                    RefreshControllers();
                    $.mobile.changePage("#pageMain");
                }

            }
            else {
                $('#lblLoginError').html("Error: " + msg.d.Status);
                ClearStorage();
                $.mobile.changePage("#pageLogin");
            }
        },
        error: function (e) {
            bInLogin = false;
            $.mobile.loading('hide');
            $('#lblLoginError').html("Error: " + e.statusText.toString());
            return false;
        }
    });
}

function RequestPasswordReset() {

    var sResetUser = $('#forgotUsername').val();
    if (sResetUser == '') {
        $('#lblForgotPasswordError').html('Please enter a valid user');
        return;
    }

    $.mobile.loading('show', {
        text: "Requesting password reset...",
        textVisible: true,
        theme: "a" || $.mobile.loader.prototype.options.theme,
        textonly: false,
        html: ""
    });

    var url = ajaxPrefix + "/Controller/wsCmd.asmx/RequestPasswordReset" + '?nocache=' + new Date().getTime();

    $.ajax({
        url: url,
        cache: false,
        type: "POST",
        dataType: "json",
        data: "{_Email:'" + sResetUser + "'}",
        contentType: "application/json; charset=utf-8",
        success: function (msg) {
            $.mobile.loading('hide');
            if (msg.d.ReturnCode == 1) {
                $('#forgotUsername').textinput('disable');
                $('#requestButton').addClass('ui-disabled');
                $('#lblForgotPasswordError').html(msg.d.Status);
            }
            else {
                $('#lblForgotPasswordError').html("Error: " + msg.d.Status);
            }
        },
        error: function (e) {
            $.mobile.loading('hide');
            $('#lblForgotPasswordError').val = "Error: " + e.statusText.toString();
            return false;
        }
    });
}

function SaveContact() {
    $.mobile.loading('show', {
        text: "Saving Contact...",
        textVisible: true,
        theme: "a" || $.mobile.loader.prototype.options.theme,
        textonly: false,
        html: ""
    });

    var sFirstName = $('#editFirstName').val();
    var sLastName = $('#editLastName').val();
    var sPhone = $('#editPhone').val();
    var user = GetUser();
    var token = GetToken();

    var url = ajaxPrefix + "/Controller/wsCmd.asmx/SaveContact" + '?nocache=' + new Date().getTime();

    $.ajax({
        url: url,
        cache: false,
        type: "POST",
        dataType: "json",
        data: "{_Email:'" + user + "', _Token:'" + token + "', _FirstName:'" + sFirstName + "', _LastName:'" + sLastName + "', _Phone:'" + sPhone + "'}",
        contentType: "application/json; charset=utf-8",
        success: function (msg) {
            $.mobile.loading('hide');
            if (msg.d.ReturnCode == 1) {
                $("#dlgEditContact").popup("close");
                UserInfo.FirstName = sFirstName;
                UserInfo.LastName = sLastName;
                UserInfo.Phone = sPhone;
                RefreshAccountInfo();
            }
            else {
                $('#lblEditContactError').html("Error: " + msg.d.Status);
            }
        },
        error: function (e) {
            $.mobile.loading('hide');
            $('#lblEditContactError').html("Error: " + e.statusText.toString());
            return false;
        }
    });
}

function SaveAccountAddress() {
    $.mobile.loading('show', {
        text: "Saving Address...",
        textVisible: true,
        theme: "a" || $.mobile.loader.prototype.options.theme,
        textonly: false,
        html: ""
    });

    var user = GetUser();
    var token = GetToken();

    var sAddress = $('#editAddress').val();
    var sCity = $('#editCity').val();
    var sState = $('#editState').val();
    var sZip = $('#editZip').val();

    var url = ajaxPrefix + "/Controller/wsCmd.asmx/SaveAddress" + '?nocache=' + new Date().getTime();

    $.ajax({
        url: url,
        cache: false,
        type: "POST",
        dataType: "json",
        data: "{_Email:'" + user + "', _Token:'" + token + "', _Address:'" + sAddress + "', _City:'" + sCity + "', _State:'" + sState + "', _Zip:'" + sZip + "'}",
        contentType: "application/json; charset=utf-8",
        success: function (msg) {
            $.mobile.loading('hide');
            if (msg.d.ReturnCode == 1) {
                $("#dlgEditAccountAddress").popup("close");
                UserInfo.Address = sAddress;
                UserInfo.City = sCity;
                UserInfo.State = sState;
                UserInfo.Zip = sZip;
                RefreshAccountInfo();
            }
            else {
                $('#lblEditAccountAddressError').html("Error: " + msg.d.Status);
            }
        },
        error: function (e) {
            $.mobile.loading('hide');
            $('#lblEditAccountAddressError').val = "Error: " + e.statusText.toString();
            return false;
        }
    });
}

function ChangePasswordClick() {
    $('#lblChangePasswordError').html("");

    var password = $.cookie("savedPassword");
    var sCurrentPassword = $('#currentPass').val();
    var sNewPassword = $('#newPass').val();
    var sConfirmPassword = $('#confirmNewPass').val();
    if (sCurrentPassword != password) {
        $('#lblChangePasswordError').html("Invalid Password");
        return;
    }
    if (sNewPassword != sConfirmPassword) {
        $('#lblChangePasswordError').html("New passwords do not match");
        return;
    }
    ChangePassword(sCurrentPassword, sNewPassword);
}
function ChangePassword(sCurrentPassword, sNewPassword) {
    $.mobile.loading('show', {
        text: "Changing Password...",
        textVisible: true,
        theme: "a" || $.mobile.loader.prototype.options.theme,
        textonly: false,
        html: ""
    });

    var user = GetUser();

    var url = ajaxPrefix + "/Controller/wsCmd.asmx/ChangePassword" + '?nocache=' + new Date().getTime();

    $.ajax({
        url: url,
        cache: false,
        type: "POST",
        dataType: "json",
        data: "{_Email:'" + user + "', _Password:'" + sCurrentPassword + "', _NewPassword:'" + sNewPassword + "'}",
        contentType: "application/json; charset=utf-8",
        success: function (msg) {
            $.mobile.loading('hide');
            if (msg.d.ReturnCode == 1) {
                Login(user, sNewPassword, "Logging in");
            }
            else {
                $('#lblChangePasswordError').html("Error: " + msg.d.Status);
            }
        },
        error: function (e) {
            $.mobile.loading('hide');
            $('#lblChangePasswordError').val = "Error: " + e.statusText.toString();
            return false;
        }
    });
}


function Register() {

    $('#lblRegisterError').html('');

    var txtUser = $('#regUsername'),
        txtPassword = $('#regPassword'),
        txtFirstName = $('#regFirstName'),
        txtLastName = $('#regLastName'),
        txtPhone = $('#regPhone'),
        txtAddress = $('#regAddress'),
        txtCity = $('#regCity'),
        txtState = $('#regState'),
        txtZip = $('#regZip');

    if (txtUser.val() == '' || txtPassword.val() == '') {
        $('#lblRegisterError').html('Please enter a valid user and password');
        return;
    }
    else if (txtAddress.val() == '' || txtCity.val() == '' || txtState.val() == '' || txtZip.val() == '') {
        $('#lblRegisterError').html('Please enter a valid address');
        return;
    }
    else if (txtUser.hasClass('error') || txtPassword.hasClass('error') || txtAddress.hasClass('error') || txtState.hasClass('error') || txtCity.hasClass('error') || txtZip.hasClass('error')) {
        $('#lblRegisterError').html('Please fix errors and try again');
        return;
    }

    $.mobile.loading('show', {
        text: "Registering User...",
        textVisible: true,
        theme: "a" || $.mobile.loader.prototype.options.theme,
        textonly: false,
        html: ""
    });


    var sNewUser = txtUser.val(),
        sNewPassword = txtPassword.val(),
        sFirstName = txtFirstName.val(),
        sLastName = txtLastName.val(),
        sPhone = txtPhone.val(),
        sAddress = txtAddress.val(),
        sCity = txtCity.val(),
        sState = txtState.val(),
        sZip = txtZip.val();

    var sRegisterData = "{_Email:'" + sNewUser + "', _Password:'" + sNewPassword + "', _FirstName:'" + sFirstName + "', _LastName:'" + sLastName + "', _Phone:'" + sPhone
                    + "', _Address:'" + sAddress + "', _City:'" + sCity + "', _State:'" + sState + "', _Zip:'" + sZip + "'}";

    var url = ajaxPrefix + "/Controller/wsCmd.asmx/AddNewUser" + '?nocache=' + new Date().getTime();


    $.ajax({
        url: url,
        cache: false,
        type: "POST",
        dataType: "json",
        data: sRegisterData,
        contentType: "application/json; charset=utf-8",
        success: function (msg) {
            $.mobile.loading('hide');
            if (msg.d.ReturnCode == 1) {
                //Controllers = null;
                //RefreshData(true);
                //document.location.href = "default.htm#pageNoControllers";

                Login(sNewUser, sNewPassword, "logging in");
            }
            else {
                $('#lblRegisterError').html("Error: " + msg.d.Status);
            }
        },
        error: function (e) {
            $.mobile.loading('hide');
            $('#lblRegisterError').val = "Error: " + e.statusText.toString();
            return false;
        }
    });
}

function RefreshData(displayLoader) {
    $('#lblPageMainError').html("");

    if (bInDataRefresh == true)
        return;

    bInDataRefresh = true;

    if (displayLoader) {
        $.mobile.loading('show', {
            text: "Refreshing Data...",
            textVisible: true,
            theme: "a" || $.mobile.loader.prototype.options.theme,
            textonly: false,
            html: ""
        });
    }

    var user = GetUser();
    var token = GetToken();

    var url = ajaxPrefix + "/Controller/wsCmd.asmx/RCData" + '?nocache=' + new Date().getTime();
    var sRefreshData = "{_Email:'" + user + "', _Token:'" + token + "'}";

    $.ajax({
        url: url,
        cache: false,
        type: "POST",
        dataType: "json",
        data: sRefreshData,
        contentType: "application/json; charset=utf-8",
        success: function (msg) {
            if (displayLoader)
                $.mobile.loading('hide');

            if (msg.d.ReturnCode == 1) {
                UserInfo = msg.d.Data;
                Controllers = msg.d.Data.Controllers;
                RefreshControllers();
                $.mobile.changePage("#pageMain");
            }
            else {
                $('#lblPageMainError').html("Error: " + msg.d.Status);
            }
            bInDataRefresh = false;
        },
        error: function (e) {
            if (displayLoader)
                $.mobile.loading('hide');

            $('#lblPageMainError').val = "Error: " + e.statusText.toString();
            bInDataRefresh = false;
            return false;
        }
    });
}


function SendCommand(desc, cmd, showMainOnSuccess) {
    if (Controller == null) {
        return;
    }
    Controller.CommandStatus = "PENDING";
    Controller.CommandDescription = desc;

    $.mobile.loading('show', {
        text: "Sending Command...",
        textVisible: true,
        theme: "a" || $.mobile.loader.prototype.options.theme,
        textonly: false,
        html: ""
    });

    var url = ajaxPrefix + "/Controller/wsCmd.asmx/SendCommand" + '?nocache=' + new Date().getTime();

    var user = GetUser();
    var password = GetToken();

    var sData = "{ _Email:'" + user + "', _Token:'" + password + "', _ControllerID:'" + Controller.ControllerID.toString() + "', _Desc:'" + desc + "', _Cmd:'" + cmd + "'}";
    $.ajax({
        url: url,
        cache: false,
        type: "POST",
        dataType: "json",
        data: sData,
        contentType: "application/json; charset=utf-8",
        success: function (msg) {
            $.mobile.loading('hide');
            nRefreshCountdown = 5;
            nRefreshRetryCount = 10;
            if (msg.d.ReturnCode != 1) {
                Controller.CommandStatus = "ERROR";
                Controller.CommandDescription = msg.d.Status;
            }
            else {
                if (showMainOnSuccess) {
                    $.mobile.changePage("#pageMain");
                    RefreshData();
                }
            }
        },
        error: function (e) {
            $.mobile.loading('hide');
            Controller.CommandStatus = "ERROR";
            Controller.CommandDescription = e.statusText.toString();
            return false;
        }
    });

    RefreshStatus();
}

function GetAddressHTML(ui) {
    var sAddressHTML = '';
    sAddressHTML += ui.City;
    if (sAddressHTML != '')
        sAddressHTML += ', ';
    sAddressHTML += ui.State;
    if (sAddressHTML != '')
        sAddressHTML += ' ';
    sAddressHTML += ui.Zip;
    if (ui.Address != '' && sAddressHTML != '')
        sAddressHTML = ui.Address + '<br />' + sAddressHTML;
    else
        sAddressHTML += ui.Address;
    return sAddressHTML;
}

