var http = require("http");
var xml2js = require('xml2js');
var deferred = require('deferred');
var requestPromise = require('request-promise');
var url = require('url');
var jsonQuery = require('json-query');
var gAPIKey = "AIzaSyAOuStb60CNpbKnrrLV0ePIPOCwOCjdXxA";

var port = process.env.PORT || 3000;

require("console-stamp")(console, '{ pattern : "ddd mmm dd yyyy HH:MM:ss" }');

//e.g https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=37.702152,-121.935791&radius=500&types=train&name=BART&key=AIzaSyAOuStb60CNpbKnrrLV0ePIPOCwOCjdXxA


var bartCMD = { "cmds":[
    {"value":"bsa", "name":"Advisories", "qs": {cmd: "bsa", key: "MW9S-E7SL-26DU-VV8V" }, "uri":"/bsa.aspx"}, 
	{"value":"stns", "name":"Stations", "qs": {cmd: "stns", key: "MW9S-E7SL-26DU-VV8V" }, "uri":"/stn.aspx"},
    {"value":"etd", "name":"Real-Time Estimates", "qs": {cmd: "etd", orig: "", key: "MW9S-E7SL-26DU-VV8V" }, "uri":"/etd.aspx", "findGooglePlace":true}, 
    {"value":"routes","name":"Current Routes", "qs": {cmd: "routes", key: "MW9S-E7SL-26DU-VV8V" }, "uri":"/route.aspx"},
    {"value":"arrive", "name":"QuickPlanner - Arrive", "qs": {cmd: "arrive", orig: "", dest: "", key: "MW9S-E7SL-26DU-VV8V" }, "uri":"/sched.aspx", "findGooglePlace":true}, 
    {"value":"depart", "name":"QuickPlanner - Depart", "qs": {cmd: "depart", orig: "", dest: "", key: "MW9S-E7SL-26DU-VV8V" }, "uri":"/sched.aspx", "findGooglePlace":true},	
]};

function findBARTStationN(inputname){
	//console.log('findBARTStationN:::'+inputname);	
	var barStnObjN = jsonQuery(['station[nameS~/'+inputname+'/i]'], {
		data: bartStnsJSON,
		allowRegexp : true
	});	
	
	console.log('findBARTStationN:::'+JSON.stringify(barStnObjN.value));
	
	return barStnObjN.value;
}

function findBARTStationL(lat, lng){
	
	//console.log('findBARTStationL:::'+lat + lng);
	
	var barStnObjL = jsonQuery(['station[gtfs_latitudeS=? & gtfs_longitudeS = ?]', lat, lng], {
		data: bartStnsJSON
	});	
	
	//console.log('findBARTStationL:::'+JSON.stringify(barStnObjL.value));
	
	return barStnObjL.value;
}


function createObject(queryURI){
	
	var d = deferred();
	
	//console.log('createObject 1 :'+JSON.stringify(queryURI));
	
	var objectCmd = jsonQuery(['cmds[value=?]', queryURI.cmd], {
		data: bartCMD
	});		
	
	if(queryURI.origLat){
		var rp = getGBartStation(queryURI.origLat, queryURI.origLong);
		rp.then(function(data){
			//console.log('getBartStation data::'+data);	
			var gPData = JSON.parse(data);
			console.log('getBartStation data::'+gPData.results[0].name);	
			//console.log('getBartStation data::'+gPData.results[0].vicinity);	
			//console.log('getBartStation data::'+gPData.results[0].geometry.location);	
			var nameS =  gPData.results[0].name;
			//console.log('getBartStation data::'+nameS);	
			nameS = nameS.replace(/ station/gi,""); 			
			console.log('getBartStation data::'+nameS);			
			var bartStation = findBARTStationN(nameS);
			//var bartStation = findBARTStationL(gPData.results[0].geometry.location.lat, gPData.results[0].geometry.location.lng);
			objectCmd.value.qs.orig = bartStation.abbr[0];
			if(queryURI.dest){
				var bartStation = findBARTStationN(queryURI.dest);
				objectCmd.value.qs.dest = bartStation.abbr[0];
			}
			//console.log('createObject 2.1:'+JSON.stringify(objectCmd.value));	
			d.resolve(objectCmd.value);							
		});
	}else if(queryURI.orig){
		var bartStation = findBARTStationN(queryURI.orig);
		objectCmd.value.qs.orig = bartStation.abbr[0];	
		if(queryURI.dest){
			var bartStation = findBARTStationN(queryURI.dest);
			objectCmd.value.qs.dest = bartStation.abbr[0];
		}
		//console.log('createObject 2.2:'+JSON.stringify(objectCmd.value));		
		d.resolve(objectCmd.value);			
	}else{
		//console.log('createObject 2.3:'+JSON.stringify(objectCmd.value));		
		d.resolve(objectCmd.value);			
	}
	
	return d.promise;
	
}
var server = http.createServer(function (req, res) {
	console.log('createServer -->'+req);
	// Send the HTTP header: HTTP Status: 200 : OK , Content Type: text/plain
	//res.writeHead(200, {'Content-Type': 'application/json'});
	res.writeHead(200, {'Content-Type': 'text/plain'});

	try{
		if (req.method === 'GET') {
			//console.log('GET 	:::'+bartStnsJSON);		
			//console.log('GET URL:::'+req.url);
			//console.log('GET URL:::'+JSON.stringify(url.parse(req.url, true)));
			var getURL = url.parse(req.url, true);
			//console.log('query:::'+JSON.stringify(getURL.query));
			//var queryURL = JSON.stringify(getURL.query);
			//console.log('query:::'+JSON.stringify(getURL.query));
			if(getURL.query.cmd){	
				callUsingQuery(getURL.query, res, getURL.query.cmd);		
			}else{
				res.write('{"sucess":"Hello World 3"}');
				res.end();
			}
		}else if(req.method === 'POST'){
			//console.log("POST");
			var body = '';
			req.on('data', function (data) {
				body += data;
				//console.log("Partial body: " + body);
			});
			req.on('end', function () {
				
				console.log("Body: " + body);
				var bodyJSON=JSON.parse(body);
				//console.log("Body value out json: " + bodyJSON.message.text);

				// check if the request is coming with latitude
				if(bodyJSON.location && bodyJSON.location.latitude){
					//console.log("Latitude: "+bodyJSON.location.latitude);
					//console.log("Longitude: "+bodyJSON.location.longitude);
					intentFunctions["shareLocation"](bodyJSON.location, res);
				}
				else{				
				//access message out of json
					var rp = getWitAi(bodyJSON.message.text);
					rp.then(function(data){
						console.log('getWitAi data::'+ data);
						var witData = JSON.parse(data);
						//available intents : shareLocation, getGreeting, planBART, getAlerts, getBART
						if(witData.entities.intent){
							intentFunctions[witData.entities.intent[0].value](witData.entities.location, res);
						}else if(witData.entities.location){
							intentFunctions["getBART"](witData.entities.location, res);
						}					
						else{
							res.write('{"not sucess":"Hello World 4 POST"}');
							res.end();
						}
					//console.log('getWitAi data::'+ witData.entities);							
					}).catch(function(error){
						console.log(error);
						res.write('{"not sucess":"Hello World 5 POST"}');
						res.end();
					});			
				}
			});			
		}else {        
			res.write('{"sucess":"Hello World 3"}');
			res.end();
		} 
	}catch(error){
		console.log(error);
		res.write('{"not sucess":"Hello World 6"}');
		res.end();		
	}
});

var intentFunctions = { }; // better would be to have module create an object
intentFunctions.getGreeting = function(location, res)
{
	res.write('Hello User. I am here to plan your BART trip.');
	res.end();
};
intentFunctions.planBART = function(location, res)
{
    console.log('planBART');
	res.end();
};
intentFunctions.getAlerts = function(location, res)
{
	var query = {
		"cmd":"bsa"
	};
	callUsingQuery(query, res, 'bsa');
};
intentFunctions.getBART = function(location, res)
{
	var query = {
		"cmd":"etd",
		"orig":location[0].value
	};
	callUsingQuery(query, res, 'etd');
};

// share location to work for departure stations
intentFunctions.shareLocation = function(location, res)
{
	var query = {
		"cmd":"etd",
		"origLat":location.latitude,
		"origLong":location.longitude
	};

	//location.latitude coming from fb processor
	callUsingQuery(query, res, 'etd');

};

function callUsingQuery(query, res, cmd){
	var objectCreatedD = createObject(query);		
	objectCreatedD.then(function(objectInput){				
		var rp = getBart(objectInput);
		console.log(" called getBart with location -->");

		rp.then(function(data){
			//console.log("createServer 0 :"+data);
			//console.log("rp.then method -->");
			//res.write('Hello World 1 \n');					
			var promiseJSON = xmlToJSON(data);
			promiseJSON.then(function(result){
				console.log(result);
				var concatStr = '';
				if(cmd === 'bsa'){
					concatStr = 'BART has follwing Alerts:';
					JSON.parse(result).root.bsa.forEach(function(bsaValue){
						concatStr = concatStr +'\n'+bsaValue.description[0]
					});
				}else if(cmd === 'etd'){
					var station = JSON.parse(result).root.station[0];				
					concatStr = 'BART from '+station.name[0]+':';
					station.etd.forEach(function(etdValue){
						concatStr = concatStr+'\nTo: '+etdValue.destination[0]+ ' in ';
						etdValue.estimate.forEach(function(estimateValue){
							concatStr = concatStr+estimateValue.minutes[0]+' mins ';
						});
					});					
				}else{
					concatStr = 'Please send BART station Name.';
				}
				if(concatStr.length > 256){
					concatStr = concatStr.substring(0, 255);
				}
				res.write(concatStr)
				//console.log("done...");
				res.end();	
			}).catch(function(err){
				console.log('Error::'+err);
				res.write('{"sucess":"Hello World 2"}');
				res.end();							
			});						  
		}).catch(function(error){
			console.log('Error::'+error);
			res.write('{"sucess":"Hello World 2"}');
			res.end();				  
		});				
	}).catch(function(error){
		res.write('{"sucess":"Hello World 2"}');
		res.end();
	});
}
// Listen on port 3000, IP defaults to 127.0.0.1
server.listen(port);
// Console will print the message
console.log('Server running at http://127.0.0.1:3000/');

function getBart(objectCMD){

	var options = {
		method : "GET",
		uri : objectCMD.uri,
		baseUrl : "http://api.bart.gov/api/",	
		qs : objectCMD.qs,	 
		headers: { "Accept": "application/xml" } // request headers 
	};
	//console.log('getBart options:'+JSON.stringify(options));
	return requestPromise(options);
	
}

function getBartStations(){
	var objectCMDD = createObject({"cmd":"stns"});
	objectCMDD.then(function(objectCMD){
		var rp = getBart(objectCMD);
		rp.then(function (data){
			//console.log("getBartStations::"+data);
			var promiseJSON = xmlToJSON(data);
			promiseJSON.then(function(result){
				//console.log("getBartStations 0 :"+result);
				bartStnsJSON = (JSON.parse(result)).root.stations[0];	
				bartStnsJSON.station.forEach(function(value){
					//console.log("getBartStations: 2 :"+value);
					//console.log("getBartStations: 2 :"+value.name[0]);
					//console.log("getBartStations: 2 :"+value.abbr[0]);
					value.nameS = value.name[0];//.replace(/\//g,"");				
					value.gtfs_latitudeS = value.gtfs_latitude[0];
					value.gtfs_longitudeS = value.gtfs_longitude[0];	
					//console.log("getBartStations: 2 :"+JSON.stringify(value));				
				});
			});			
		});		
	});
}

getBartStations();

//getWitAi('Show me BART of West Dublin');

function getGBartStation(latitude, longitude){

	var options = {
		method : "GET",
		uri : "/place/nearbysearch/json",
		baseUrl : "https://maps.googleapis.com/maps/api/",	
		qs : {
			//location: "37.702152,-121.935791",
			location : latitude+","+longitude,
			radius : "500",
			types : "transit_station",
			name : "BART",
			key : "AIzaSyAOuStb60CNpbKnrrLV0ePIPOCwOCjdXxA"		
		},
		headers: { "Accept": "application/json" } // request headers 
	};
	//console.log('getGBartStation options:'+JSON.stringify(options));
	return requestPromise(options);
	
}
/**
available intents : shareLocation, getGreeting, planBART, getAlerts, getBART
*/
function getWitAi(query){

	var options = {
		method : "GET",
		uri : "/message",
		baseUrl : "https://api.wit.ai/",	
		qs : {	v: "20160815",
				q: query},	 
		headers: { "Accept": "application/json",
				   "Authorization" :"Bearer PYIAP2SX4J4VEUNKXQDESBUONNAMNM4M"	
				 } // request headers 
	};
	//console.log('getWitAi options:'+JSON.stringify(options));
	var rp = requestPromise(options);
	/**rp.then(function(data){
		//console.log('getWitAi data::'+ data);
		var witData = JSON.parse(data);
		if(witData.entities.location){
			
		}
		if(witData.entities.intent){
			
		}
		//console.log('getWitAi data::'+ witData.entities);							
	});	**/
	return rp;
	
}

function xmlToJSON(varXML){
	var d = deferred();
	var parseString = xml2js.parseString;
	parseString(varXML.toString(), function (err, result) {			
		if(err){
			d.reject(err);
		}else{
			d.resolve(JSON.stringify(result));
		}
	});	
	return d.promise;
}
