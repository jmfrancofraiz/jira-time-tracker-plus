# Jira Time Tracker Plus Chrome Extension

Easily time track and log your work in Jira.

## Options

### URL 

This is your Jira server URL. Copy entire url, with protocol and port (if not default).

### REST Api Extension

This is your Jira server REST Api version. Default value is `/rest/api/2` because that is the default extension for most recent jira. 

If you are using older server of Jira it might be `/rest/api/1`.

### Username

Your JIRA username **not** your email. Go to your profile and locate your username at JIRA profile section.

### Password

Your Jira password. If you have trouble with it, you might need to change your password. You should see a _Change Password_ button/link below your email under **Account details** section.

### JQL - Jira Query Language

JQL which will be used to display all items which are available to log time. 
Default option is `assignee=currentUser()`, which will display all issues assigned to you. 

If you are not familiar with JQL, you can go to Jira and adjust all basic filters. Then switch to Advanced mode and just copy generated JQL to this field.

