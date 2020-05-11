document.addEventListener('DOMContentLoaded', onDOMContentLoaded, false);
var objectsToLog = {};
var startAt = 0;
var totalResult = 0;
var maxResults = 10;
var pageIndex = 1;
var pageCount = 1;
var JIRA;

Date.prototype.toDateInputValue = (function () {
    var local = new Date(this);
    local.setMinutes(this.getMinutes() - this.getTimezoneOffset());
    return local.toJSON().slice(0, 10);
});

function onDOMContentLoaded() {

    chrome.storage.sync.get({
        username: '',
        password: '',
        baseUrl: '',
        apiExtension: '',
        jql: '',
        itemsOnPage: 10
    },
    init);
}

function init(options) {
    if (!options.username) {
        return errorMessage('Missing username');
    }
    if (!options.password) {
        return errorMessage('Missing password');
    }
    if (!options.baseUrl) {
        return errorMessage('Missing base URL');
    }
    if (!options.apiExtension) {
        return errorMessage('Missing API extension');
    }

    maxResults = !options.itemsOnPage ? 10 : options.itemsOnPage;

    JIRA = JiraAPI(options.baseUrl, options.apiExtension, options.username, options.password, options.jql);

    $('div[id=loader-container]').toggle();

    $("#paging").on('click', "#next, #prev", function (evt) {
        var $self = $(this);
        var direction = $self.data("direction");
        if (pageIndex == 1 && direction == "prev" || direction == "next" && pageIndex == pageCount) {
            return false;
        }

        navigate($self, evt);
    });

    JIRA.getIssues(startAt, maxResults, onFetchSuccess, onFetchError);
}

function onFetchSuccess(response) {
    var issues = response.issues;

    maxResults = response.maxResults;
    var total = response.total;
    var remains = total % maxResults;
    pageCount = (total - remains) / maxResults + 1;
    if (response.total > maxResults) {
        $("#paging").show();
    }
    else {
        $("#paging").hide();
    }
    $("#total_pages").text(pageCount);

    var $logTable = $('#jira-log-time-table');
    var $tbody = $logTable.children("tbody");
    $('#jira-log-time-table tbody tr').remove();
    LoadData();
    updateIcon();
    issues.forEach(function (issue) {
        var row = generateLogTableRow(issue.key, issue);
        row.appendTo($tbody);
    });
    $tbody.appendTo($logTable);

    $('div[id=loader-container]').hide();

    issues.forEach(function (issue) {
        getWorklog(issue.key);
    });

}

function onFetchError(error) {
    $('div[id=loader-container]').hide();
    genericResponseError(error);
}

function getWorklog(issueId) {
    var $totalTime = $('div.issue-total-time-spent[data-total-issue-id=' + issueId + ']');
    var $loader = $totalTime.prev();

    $totalTime.hide();
    $loader.show();

    JIRA.getIssueWorklog(issueId, onWorklogFetchSuccess, onWorklogFetchError);

    function onWorklogFetchSuccess(response) {
        $totalTime.text(sumWorklogs(response.worklogs));
        $totalTime.show();
        $loader.hide();
        var $timeInput = $('input[data-time-issue-id=' + issueId + ']');
        $timeInput.val('');
    }

    function onWorklogFetchError(error) {
        $totalTime.show();
        $loader.hide();
        genericResponseError(error);
    }
}

function sumWorklogs(worklogs) {
    var totalSeconds = worklogs.reduce(function (a, b) {
        return { timeSpentSeconds: a.timeSpentSeconds + b.timeSpentSeconds }
    }, { timeSpentSeconds: 0 }).timeSpentSeconds;
    var totalHours = totalSeconds / 3600;
    return (Math.round((totalHours + Number.EPSILON) * 100) / 100) + 'h';
}

function generateLogTableRow(id, issue) {

    console.log(issue);

	var icon = buildHTML("img", null, {src:issue.fields.issuetype.iconUrl, style:"vertical-align:bottom; padding-right:5px"});
    var idCell = buildHTML('td', icon[0].outerHTML + '<a target="_blank" href="' + JIRA.baseUrl + '/browse/' + id + '">' + id + '</a>', { class: 'issue-id' });

    var summaryCell = buildHTML('td', issue.fields.summary , { class: 'issue-summary', title: issue.fields.summary });

    var estimationCell = buildHTML('td', issue.fields.timeoriginalestimate / 3600 + 'h');

    var totalTimeContainer = buildHTML('td', null, { class: 'total-time-container', 'data-ttcont-issue-id': id });
    var totalTime = buildHTML('div', null, { class: 'issue-total-time-spent', 'data-total-issue-id': id });
    var loader = buildHTML('div', null, { class: 'loader-mini', 'data-loader-issue-id': id });
    totalTimeContainer.append(loader);
    totalTimeContainer.append(totalTime);

    var timeInput = buildHTML('input', null, { class: 'issue-time-input', 'data-time-issue-id': id });
    var timeInputCell = buildHTML('td');
    timeInputCell.append(timeInput);

    var dateInput = buildHTML('input', null, { type: 'date', class: 'issue-log-date-input', value: new Date().toDateInputValue(), 'data-date-issue-id': id });
    var dateInputCell = buildHTML('td',null,{style:"display:none"});
    dateInputCell.append(dateInput);

    statusCell = buildHTML('td');
    var statusLoaderDiv = buildHTML('div', null, { class: 'loader-mini', 'data-status-loader-issue-id': id }).appendTo(statusCell);
    statusLoaderDiv.hide();
    var $select = buildHTML("select", null, { "data-issue-id": id }).appendTo(statusCell);
    statusOptions($select, issue.fields.status.name)
    $select.on('change', updateStatus);

    var playButton = buildButton("play", id);
    var stopButton = buildButton("stop", id);
    var logButton = buildButton("save", id);

    if (objectsToLog && !objectsToLog[id])
        objectsToLog[id] = {};

    actionCell = buildHTML('td', null, {style:"text-align:center"});
    if (objectsToLog && objectsToLog[id] && !objectsToLog[id]["StartDate"]) {
        actionCell.append(playButton);
    }
    if (objectsToLog && objectsToLog[id] && objectsToLog[id]["StartDate"]) {
        actionCell.append(stopButton);
    }

    actionCell.append(logButton);

    var row = buildHTML('tr', null, { 'data-row-issue-id': id });
    row.append(idCell);
    row.append(summaryCell);
    row.append(estimationCell);
    row.append(totalTimeContainer);
    row.append(timeInputCell);
    row.append(dateInputCell);
    row.append(statusCell);
    row.append(actionCell);

    return row;
}

function logTimeClick(evt) {

    errorMessage('');

    var issueId = $(evt.target).data('issue-id');
    var timeInput = $('input.issue-time-input[data-time-issue-id=' + issueId + ']');
    var dateInput = $('input.issue-log-date-input[data-date-issue-id=' + issueId + ']');

    if (!timeInput.val().match(/[0-9]{1,4}[wdhm]/g)) {
        errorMessage('Time input in wrong format. You can specify a time unit after a time value "X", such as Xw, Xd, Xh or Xm, to represent weeks (w), days (d), hours (h) and minutes (m), respectively.');
        return;
    }

    $('div.issue-total-time-spent[data-total-issue-id=' + issueId + ']').toggle();
    $('div.loader-mini[data-loader-issue-id=' + issueId + ']').toggle();
    var comment = prompt("Comment");
    if (comment != null) {
        JIRA.updateWorklog(issueId, timeInput.val(), new Date(dateInput.val()), comment,
		function (data) {
		    getWorklog(issueId);
		}, genericResponseError);
    } else {
        alert("time will not be logged");
        getWorklog(issueId);
    }
}

function playButtonClick(evt) {
    var issueId = $(evt.target).data('issue-id');
    var timeInput = $('input[data-time-issue-id=' + issueId + ']');

    if (objectsToLog[issueId] && !objectsToLog[issueId].StartDate) {
        objectsToLog[issueId].StartDate = moment().format("YYYY-MM-DD HH:mm:ss");

        SaveData();

        var stopButton = buildButton("stop", issueId);
        var parent = evt.target.parentElement;
        evt.target.remove();
        stopButton.insertBefore(parent.childNodes[0]);
    }

    updateIcon();
}

function stopButtonClick(evt) {
    var issueId = $(evt.target).data('issue-id');
    var $timeInput = $('input[data-time-issue-id=' + issueId + ']');
    if (objectsToLog[issueId] && objectsToLog[issueId].StartDate) {
        var startDate = moment(objectsToLog[issueId].StartDate);
        var current = moment();
        var totalMinutes = current.diff(startDate, "minutes");

        var minutes = totalMinutes % 60;
        var hours = totalMinutes > minutes ? (totalMinutes - minutes) / 60 : 0;

        var text = (hours == 0 ? "" : hours + "h") + " " + minutes + "m";
        $timeInput.val(text);

        delete objectsToLog[issueId]["StartDate"];
        SaveData();
    }

    var parent = evt.target.parentElement;
    evt.target.remove();
    var playButton = buildButton("play", issueId);
    playButton.insertBefore(parent.childNodes[0]);

    updateIcon();
}

function buildHTML(tag, html, attrs) {
    var $element = $("<" + tag + ">");
    if (html) 
		$element.html(html);

    for (attr in attrs) {
        if (attrs[attr] === false) continue;
        if (attr == "text") $element.text(attrs[attr]);
        if (attr == "value") $element.val(attrs[attr]);
        $element.attr(attr, attrs[attr]);
    }
    return $element;
}

function errorMessage(message) {
    var $error = $('#error');
    $error.text(message);
    $error.show();
}

function SaveData() {
    localStorage.setItem("objectsToLog", JSON.stringify(objectsToLog));
}

function LoadData() {
    objectsToLog = localStorage.objectsToLog ? JSON.parse(localStorage.objectsToLog) : {};
}

function buildButton(type, id) {
    var $button;
    if (type == "play") {
        $button = buildHTML("img", null, {
            src: "images/play.png",
            width: "16",
            height: "16",
            style: "width:16px; height:16px",
            "data-issue-id": id
        });
        $button.on('click', playButtonClick);
    }
    if (type == "stop") {
        $button = buildHTML("img", null, {
            src: "images/stop.png",
            width: "16",
            height: "16",
            style: "width:16px; height:16px",
            "data-issue-id": id
        });
        $button.on('click', stopButtonClick);
    }
    if (type == "pause") {
        $button = buildHTML("img", null, {
            src: "images/pause.png",
            width: "16",
            height: "16",
            style: "width:16px; height:16px",
            "data-issue-id": id
        });
    }
    if (type == "save") {
        $button = buildHTML("img", null, {
            src: "images/save.png",
            width: "16",
            height: "16",
            style: "width:16px; height:16px",
            "data-issue-id": id
        });
        $button.on('click', logTimeClick);
    }
    return $button;
}

function genericResponseError(error) {
    var response = error.response || '';
    var status = error.status || '';
    var statusText = error.statusText || '';

    if (response) {
        try {
            errorMessage(response.errorMessages.join(' '));
        } catch (e) {
            errorMessage('Error: ' + status + ' - ' + statusText);
        }
    } else {
        errorMessage('Error: ' + status + ' ' + statusText);
    }
}

function updateStatus(evt) {
    var self = $(this);
    var id = self.data("issue-id");
    var statusId = self.find(":selected").data("transition-id");
    var value = self.val();
    self.hide();
    var $div = $("div.loader-mini[data-status-loader-issue-id=" + id);
    $div.show();
    JIRA.changeStatus(id, statusId, function (status) {
        $div.hide();
        self.show();
        statusOptions(self, value);
    }, genericResponseError);
}

function statusOptions(combo, newStatusName) {
    combo.data('statusName',newStatusName);
    combo.html('');
    var $option = buildHTML("option", null, { text: newStatusName, value: newStatusName, "data-transition-id": "" });
    $option.attr("selected","selected");
    $option.appendTo(combo);
    combo.val(newStatusName);
    JIRA.getTransitions(combo.data("issueId"), (data) => {
        if (data != null) {
            for (var i in data.transitions) {
                var trans = data.transitions[i];
                if (combo.data('statusName') != trans.name) {
                    var $option = buildHTML("option", null, { text: trans.name, value: trans.name, "data-transition-id": trans.id });
                    $option.appendTo(combo);
                }
            }
        }
    }, genericResponseError);
}

function navigate(self, evt) {
    var direction = self.data("direction");

    if (direction == "next") {
        startAt = startAt + maxResults;
        JIRA.getIssues(startAt, maxResults, onFetchSuccess, onFetchError);
        pageIndex++;
    }

    if (direction == "prev") {
        startAt = startAt - maxResults;
        JIRA.getIssues(startAt, maxResults, onFetchSuccess, onFetchError);
        pageIndex--;
    }

    $("#page_number").text(pageIndex);
}

function updateIcon() {
    if (AnyTimerStarted())
        chrome.browserAction.setIcon({ path: "images/icon_run.png" });
    else
        chrome.browserAction.setIcon({ path: "images/icon.png" });
}

function AnyTimerStarted() {
    for (var key in objectsToLog) {
        if (objectsToLog[key] && objectsToLog[key].StartDate)
            return true;
    }
    return false;
}