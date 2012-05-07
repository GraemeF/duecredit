var url = require('url');
var http = require('http');
var twitter = require('ntwitter');
var _ = require('underscore');
var OAuth = require('oauth').OAuth;

const twitterConsumerKey = process.env.npm_package_config_consumerKey;
const twitterConsumerSecret = process.env.npm_package_config_consumerSecret;

const twitterAccessToken = process.env.npm_package_config_accessToken;
const twitterAccessTokenSecret = process.env.npm_package_config_accessTokenSecret;

const statusIdRegex = /\/status(es)?\/(\d+)/;

const antisocialUserId = process.env.npm_package_config_antisocialUserId;

oAuth = new OAuth("http://twitter.com/oauth/request_token",
                  "http://twitter.com/oauth/access_token",
                  twitterConsumerKey, twitterConsumerSecret,
                  "1.0A", null, "HMAC-SHA1");

var twit = new twitter({
                           consumer_key:twitterConsumerKey,
                           consumer_secret:twitterConsumerSecret,
                           access_token_key:twitterAccessToken,
                           access_token_secret:twitterAccessTokenSecret
                       });

function getStatusId(uri) {
    var parsed = url.parse(uri);

    if (parsed.host !== 'twitter.com')
        return null;

    if (parsed.path.indexOf('statuses') === -1)
        return null;

    var match = statusIdRegex.exec(parsed.path);
    if (match === null)
        return null;

    return match[2];
}

function retweet(statusId) {
    console.log("Retweeting status id", statusId);
    oAuth.post("http://api.twitter.com/1/statuses/retweet/" + statusId + ".json",
               twitterAccessToken,
               twitterAccessTokenSecret,
               null,
               function (error, data) {
                   if (error)
                       console.log('Failed to retweet:', error);
                   else {
                       console.log("Notification", JSON.parse(data).text);
                   }
               });
}

function decideWhatToDoWithLink(uri) {
    console.log("Checking for tweet at " + uri);

    var statusId = getStatusId(uri);
    console.log("Status id is " + statusId);

    if (statusId !== null)
        retweet(statusId);
}

function getLinks(status) {
    return _.map(status.entities.urls, function (link) {
        return link.url;
    });
}

function dealWithResponse(uri, res) {
    if (res.statusCode === 301) {
        followLink(res.headers.location);
    }
    else {
        decideWhatToDoWithLink(uri);
    }
}

function followLink(link) {
    var options = url.parse(link);
    options.method = 'HEAD';

    if (options.protocol === "http:") {
        console.dir("Following", link);
        var req = http.request(options, function (res) {
            dealWithResponse(link, res);
        });

        req.on('error', function (e) {
            console.log('Problem with request:', e.message);
        });

        req.end();
    }
    else
        console.log("Skipping", link);
}

function processStatus(status) {
    console.log("Processing tweet:", status.text);

    var links = getLinks(status);

    if (_.any(links)) {
        _.each(links, function (link) {
            followLink(link);
        });
    }
    else
        console.log("No links found.");
}

function startWatching(userId) {
    twit.stream('statuses/filter', {follow:userId}, function (stream) {
        console.log("Connected to stream");

        stream.on('error', function (error, x) {
            console.log(error, x);
        });

        stream.on('data', function (status) {
            console.log('New tweet detected.');
            processStatus(status);
        });

        stream.on('end', function () {
            console.log("Stream ended.");
            process.exit(1);
        });

        stream.on('destroy', function () {
            console.log("Stream destroyed.");
            process.exit(1);
        });
    });
}

startWatching(antisocialUserId);