function JiraAPI(baseUrl, apiExtension, username, password, jql) {

    var apiDefaults = {
        type: 'GET',
        url: baseUrl + apiExtension,

        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(username + ':' + password)
        },
        responseType: 'json',
        data: ''
    };

    return {
        login: login,
        getIssue: getIssue,
        getIssues: getIssues,
        getIssueWorklog: getIssueWorklog,
        updateWorklog: updateWorklog,
        changeStatus: changeStatus,
        getTransitions: getTransitions,
        baseUrl: baseUrl
    };

    function login() {
        var options = {
            headers: {
                'Authorization': 'Basic ' + btoa(username + ':' + password)
            }
        }
        return ajaxWrapper("/", options);
    };

    function getIssue(id, success, error) {
        return ajaxWrapper('/issue/' + id, { success: success, error: error });
    }

    function getIssues(startAt, maxResults, success, error) {
        return ajaxWrapper('/search?jql=' + jql, { success: success, error: error, data: { startAt: startAt, maxResults: maxResults } });
    }

    function getIssueWorklog(id, success, error) {
        return ajaxWrapper('/issue/' + id + '/worklog', { success: success, error: error });
    }

    function changeStatus(id, statusid, success, error) {
        var url = '/issue/' + id + '/transitions';
        var options = {
            type: 'POST',
            data: JSON.stringify({ transition: { id: statusid } }),
            success: success,
            error: Error
        };
        return ajaxWrapper(url, options);
    }

    function updateWorklog(id, timeSpent, date, comment, newEstimate, success, error) {
        var url = '/issue/' + id + '/worklog' + (!!newEstimate ? '?adjustEstimate=new&newEstimate='+newEstimate : '');
        return ajaxWrapper(url, {
            type: 'POST',
            data: JSON.stringify({
                "started": moment(date).format('YYYY-MM-DDT' + moment().format('HH:mm:ss.SSS') + 'ZZ'),
                "timeSpent": timeSpent,
                "comment": comment
            }),
            success: success,
            error: error
        });
    }

    function getTransitions(issueid, success, error) {
        var url = "/issue/" + issueid + "/transitions";
        var options = {
            success: success,
            error: error,
            id: issueid
        };
        return ajaxWrapper(url, options);
    }

    function ajaxWrapper(urlExtension, optionsOverrides) {

        var options = $.extend(true, {}, apiDefaults, optionsOverrides || {});
        options.url += urlExtension;

        $.ajax({
            url: options.url,
            type: options.type,
            headers: options.headers,
            data: options.data,
            success: function (data) {
                if (options.success) {
                        options.success(data,options.id);
                }
            },
            error: function (xhr) {
                if (options.error)
                    options.error({
                        response: xhr.response,
                        status: xhr.status,
                        statusText: xhr.statusText
                    });
            }
        });
    }

}
