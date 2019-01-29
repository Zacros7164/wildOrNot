// Dum,Dum,Dum... no generator!!
// First, well, this is an Express app. Maybe we should
// get... Express
const express = require('express');
// Make an express app
let app = express();
// put our helmet on!
const helmet = require('helmet');
// app.use means, add some middleware!
// middelware = any function that has access to req and res
app.use(helmet());

// Set up Mysql Connection
const mysql = require('mysql');
const config = require('./config');
let connection = mysql.createConnection(config.db);
// we have a connection, let's connect!
connection.connect();

// add ejs, so we can render!
app.set('views','views');
app.set('view engine','ejs');
// set up our public folder
app.use(express.static('public'));


// we need the body parser and urlencode middleware
// so we can get data from the post requests

const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.get('/',(req, res, next)=>{
    const animalQuery = `SELECT * FROM animals;`;
    connection.query(animalQuery,(error,results)=>{
        if(error){throw error}
        // resuilts is an array of all rows in animals.
        // grab a random one
        const rand = Math.floor(Math.random() * results.length);
        res.render('index',{animal: results[rand]});
    });
});

app.get('/standings',(req,res,next)=>{
    // this is a specific SQL query to only get the data you wans to JS
    const selectQuery = `SELECT SUM(IF(value='domestic', 1, -1)) AS domesticCount, max(animals.species) AS species FROM votes
	INNER JOIN animals ON votes.aid = animals.id
    GROUP BY (animals.species);`
    
    connection.query(selectQuery,(err, results)=>{
        if(err){
            throw err;
        }else{
            res.render('standings', {results});
        }
    })
})

// espn wildcard example:
// http://www.espn.com/nfl/team/_/name/ne/new-england-patriots
// app.get('/nfl/team/_/name/:city/:team',(req, res)=>{
    // query db, get the info from team WHERE team = req.params.city
// })

// add a new route to handle the votes
// /vote/wild/1
// /vote/domestic/3
// /vote/up/ninja
app.get('/vote/:value/:id',(req, res)=>{
    const value = req.params.value;
    const id  = req.params.id;
    const insertQuery = `INSERT INTO votes (id,aid,value)
        VALUES 
    (DEFAULT,?,?);`;
    connection.query(insertQuery,[id,value],(error,results)=>{
        if (error) {throw error;}
        res.redirect('/');
    })
})

app.get('/register',(req,res)=>{
    res.render('register', {})
})

app.post('/registerProcess',(req,res,next)=>{
    res.json(req.body);
})

console.log("App is listening on port 8902");
app.listen(8902);