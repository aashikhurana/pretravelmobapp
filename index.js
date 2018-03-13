var path = require('path');
var express = require('express');
var app = express();
console.log("express created");
app.use(express.static(path.join(__dirname, 'web')));
console.log("getting index.html);

app.get('/', function(req, res){
	console.log("rendering index.html");
    res.render('index.html');
});

app.listen(process.env.PORT || 3000);
console.log('Server running on port 3000');
