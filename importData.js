var fs 			= require('fs');
var http 		= require('http');
var htmlparser 	= require("htmlparser2");
var async 		= require('async');

var htmlAll 		= '';
var tableData 		= {};
var selectOptions 	= {};

var yearsToPull 	= 20;
var currentYear 	= 2016;

tableData.data 		= {};

var outfileName 	= "./data/";

var parser = new htmlparser.Parser({
	onopentag: function(name, attribs){
		if(name === "table" && attribs.id === "statsTable"){
			tableData.open = true;
		}

		if(name === "thead"){
			tableData.header.open = true;
		}

		if(name === "tbody"){
			tableData.body.open = true;
		}

		if(name === "tr" && attribs.id !== undefined){
			tableData.body.row.open = true;
		}

		if(name === "td" && !tableData.header.open && tableData.body.row.open){
			tableData.body.dataTag.open = true;

			if(attribs.class === 'player-name'){
				tableData.player.open = true;
				tableData.player.name = [];
			}
		}

		if(name === "option" && attribs.selected){
			selectOptions.option = true;
		}
	},
	ontext: function(text){
		textOut = text.replace(/\r?\n|\r/g, "").trim();

		/** Write data object to row array */
		if(tableData.body.dataTag.open){
			if(textOut !== null && textOut !== "" && textOut.indexOf("\r\n") < 0 && textOut !== undefined){
				
				var rowKeys = Object.keys(rowData);
				var title = tableData.header.data[rowKeys.length];
				var field = [];

				field[title] = textOut;
				
				if(tableData.player.open){
					tableData.player.name.push(textOut);
				}else{
					rowData[title] = textOut;
				}
			}
		}

		/** Write headers to table data */
		if(tableData.header.open && tableData.header.data.indexOf(textOut.split(" ").join("_")) < 0){
			if(textOut !== null && textOut !== "" && textOut.indexOf("\r\n") < 0){
				textOut = textOut.split(" ").join("_");
				textOut = textOut.split(".").join("");

				tableData.header.data.push(textOut);
			}
		}

		/** Writes the current year to table */
		if(selectOptions.option === true){
			tableData.currentYear 					= textOut;
			tableData.data[tableData.currentYear] 	= [];
		}
	},
	onclosetag: function(tagname){
		if(tagname === "table"){
			tableData.open = false;
		}

		if(tagname === "thead"){
			tableData.header.open = false;
		}

		if(tagname === "tbody"){
			tableData.body.open = false;
		}

		if(tagname === "tr" && tableData.body.row.open){
			tableData.body.row.open = false;
			tableData.data[tableData.currentYear].push(rowData);

			rowData = {};
		}

		if(tagname === "td"){
			tableData.body.dataTag.open = false;

			if(tableData.player.open){
				tableData.player.open = false;
				var playerName = '';

				for (var i = 0; i < tableData.player.name.length; i++) {
					playerName += tableData.player.name[i] + " ";
				}

				var rowKeys = Object.keys(rowData);
				var title = tableData.header.data[rowKeys.length];

				rowData[title] = playerName.trim();
			}
		}

		if(tagname === "option"){
			selectOptions.option = false;
		}
	}
}, {decodeEntities: true});

callback = function(response) {
	var str 	= '';
	htmlAll 	= '';
	rowData 	= {};

	tableData.header 	= {
		"data": []
	};

	tableData.body 		= {
		"dataTag": {},
		"row": {}
	};

	tableData.player = {
		"open": false,
		"name": []
	};

	response.on('data', function (chunk){
		str += chunk;
	});

	response.on('end', function (){
		htmlAll = str;
		parser.write(str);

		var keys = Object.keys(tableData.data);
		
		parser.end();

		if(keys.length >= yearsToPull){
			var outfileData = JSON.stringify(tableData.data, null, 2);

			fs.writeFile(outfileName, outfileData, function(){
				console.log("Done writing file.");
			});
		}
	});
};

function retrieveData(){
	var year 		= currentYear;
	var statNum 	= '101';
	var basePath 	= '/stats/stat.' + statNum + '.';
	var currentPath = '';
	var options 	= {
			host: 'www.pgatour.com',
			path: ''
		};

	outfileName += statNum + '-' + yearsToPull + '.json';

	var count = 0;

	async.whilst(
	    function(){
	    	return count < yearsToPull; 
	    },
	    function(next){
			if(count === 0){
				currentPath = basePath + 'html';
			}else{
				year 		= currentYear - count;
				currentPath = basePath + year + '.html';
			}

			options.path = currentPath;

	        count++;

			var req = http.request(options, callback);
			req.end(function(){
				next();
			});
		},
	    function (err) {
	        if(err){
	        	throw err;
	        }
	    }
	);
}

retrieveData();

