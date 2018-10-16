const argv = require('yargs').argv;
var request = require('request');
var N3 = require('n3');
var tripleParser = N3.Parser();

/*------------------
     PARAMETERS
------------------*/
var WIKIBASE_URI = argv.wikibase;
var WIKIBASE_API = argv.wikibaseApi || "/api.php";
var WIKIBASE_SPECIAL_ENTITY = argv.wikibaseSpecialEntity || "/index.php/Special:EntityData/";
var SPARQL_ENDPOINT = argv.sparql;
var START_DATE = argv.date || new Date().toISOString();

if (argv.wikibase === undefined || argv.sparql === undefined) {
    console.error("Please provide both Wikibase URL and SPARQL endpoint URL")
    process.exit();
}

/*------------------
     CONSTANTS
------------------*/
function WIKIBASE_ENTITYDATA (item) { return WIKIBASE_URI + WIKIBASE_SPECIAL_ENTITY + item + ".ttl?flavor=dump"; }
const getRecentChanges = WIKIBASE_URI + WIKIBASE_API + "?format=json&action=query&list=recentchanges&rcdir=newer" +
                       "&rcprop=title%7Cids%7Ctimestamp&rcnamespace=120%7C122&rclimit=500&rcstart=";
const rcContinue = "&rccontinue=";
function deleteItem (item) {
  return "DELETE { <" + WIKIBASE_URI + "/entity/" + item + "> ?p ?o }  WHERE { <" + WIKIBASE_URI + "/entity/" + item + "> ?p ?o }"
}


var itemsToUpdate = [];
var uniqItemsToUpdate = [];
var loading = false;


/*-----------------------------------------------------------------
     GET RECENT CHANGES FROM startDate USING rc IF PAGINATION
-----------------------------------------------------------------*/
function getRecent (startDate, rc) {
    var url = getRecentChanges + startDate;
    if (rc !== undefined) {
        url = getRecentChanges + startDate + rcContinue + rc;
    }

    var pageLog = rc || "";
    console.log("Asking for changes", startDate, pageLog);
    request(url, function (error, response, recentBody) {
        if (error) {
            console.error(error);
        }

        var jsonBody = JSON.parse(recentBody);
        var news = jsonBody.query.recentchanges;

        console.log("Got " + news.length + " changes")
        for (var i = 0; i < news.length; i++) {
            itemsToUpdate.push(news[i].title);
        }
        if (jsonBody.continue !== undefined) {
            rc = jsonBody.continue.rccontinue;
            console.log("Waiting next call...");
            setTimeout(function(){ getRecent(startDate, rc); }, 3000);
        } else {
            uniqItemsToUpdate = uniqItemsToUpdate.concat(uniq(itemsToUpdate));
            itemsToUpdate = [];
            console.log("-------------------------------");
            console.log(uniqItemsToUpdate.length + " items to triplify");
            console.log("-------------------------------");
            if (uniqItemsToUpdate.length > 0 && !loading)
                load();

            var now = new Date().toISOString();
            setTimeout(function(){ getRecent(now, rc); }, 10000);
        }
    });
}


/*-----------------------------------------------------------------
     GET TRIPLES FROM WIKIBASE, DELETE OLD AND ADD NEW ONES
-----------------------------------------------------------------*/
function load () {
    loading = true;
    var item = uniqItemsToUpdate.splice(-1,1)[0].replace("Item:","").replace("Property:","");
    console.log("Requesting", item);

    request(WIKIBASE_ENTITYDATA(item), {timeout: 1500}, function (error, response, turtle) {
        if (error) {
            uniqItemsToUpdate.push("Item:"+item);
            load();
            return;
        }

        var triples = [];
        try {
            tripleParser.parse(turtle, function (error, triple, prefixes) {
                if (triple) {
                    triples.push({subject: triple.subject, predicate: triple.predicate, object: triple.object});
                } else {
                    var tripleWriter = N3.Writer({ prefixes: prefixes });
                    for (var i = 0; i < triples.length; i++) {
                        tripleWriter.addTriple(triples[i]);
                    }
                    tripleWriter.end(function (error, result) {
                        var postOptions = {
                                uri: SPARQL_ENDPOINT,
                                body: result,
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'text/turtle'
                                }
                            }

                        console.log("Loading", item);
                        sparqlUpdate(deleteItem(item), function () {
                            request(postOptions, function (error, response) {
                                console.log("Loaded!")
                                if (uniqItemsToUpdate.length > 0) {
                                    setTimeout(function(){ load(); }, 100);
                                } else {
                                    loading = false;
                                }
                            });
                        });
                    });
                }
            });
        } catch (e) {
            console.log(e);
            uniqItemsToUpdate.push("Item:"+item);
            load();
            return;
        }
    });
}


/*---------------------------------------------------------
     PERFORM A SPARQL UPDATE TO A BLAZEGRAPH ENDPOINT
---------------------------------------------------------*/
function sparqlUpdate (query, callback) {
    var sparqlURL = SPARQL_ENDPOINT + "?update=" + encodeURIComponent(query);

    request.post({
        url: sparqlURL,
    }, function (error, response, body) {
        if (error) {
            console.error(error);
        }

        console.log(body);
        callback();
    });
}

function uniq (myArray) {
    return myArray.filter(function(elem, pos) {
        return myArray.indexOf(elem) == pos;
    });
}

getRecent(START_DATE);
