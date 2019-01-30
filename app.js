// Dum,Dum,Dum... no generator!!
// First, well, this is an Express app. Maybe we should

const fs = require('fs');


// get... Express
const express = require('express');
// Make an express app
let app = express();
// put our helmet on!
const bcrypt = require('bcrypt-nodejs');
const expressSession = require('express-session');
const helmet = require('helmet');
const config = require('./config');
// app.use means, add some middleware!
// middelware = any function that has access to req and res
app.use(helmet());


const multer = require('multer');
const upload = multer({dest: 'public/'})



const sessionOptions ={
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: true
//   cookie: {secure: true}
};


app.use(expressSession(sessionOptions));


// Set up Mysql Connection
const mysql = require('mysql');

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





// define some middleware, if the user is logged in, send the user data over to the view
app.use('*',(req,res,next)=>{
    console.log('middleware is working')
    if(req.session.loggedIn){
        res.locals.name = req.session.name;
        res.locals.id = req.session.id;
        res.locals.email = req.session.email;
        res.locals.loggedIn = true;
    }else{
        res.locals.name = '';
        res.locals.id = '';
        res.locals.email = '';
        res.locals.loggedIn = false;
    }
    next();
})

app.get('/',(req, res, next)=>{

    // check to see if the user is logged in
    if(!req.session.loggedIn){
        res.redirect('/login?msg=mustLogin')
    }else{
        // we want all rows in animals, that don't have an id in the votes table
        // this is a perfect use case for a subquery!
        // subquery is a query inside a query
        // we are going to get a list of all votes this user has
        // then we are going to take that list, and check it against the list of animals
        const animalQuery = `SELECT * FROM animals WHERE id NOT IN(
            SELECT aid FROM votes WHERE uid = ?
        );`;
        connection.query(animalQuery,[req.session.uid],(error,results)=>{
            if(error){throw error}

            // see if there is anything in the query string for msg
            let msg;
            if(req.query.msg == 'regSuccess'){
                msg = 'You have successfully registered';
                console.log(msg);
            }else if(req.query.msg = 'loginSuccess'){
                msg ='<h2 class="text-success">You have successfully logged in!</h2>'
            }

            // resuilts is an array of all rows in animals.
            // grab a random one
            if(results.length == 0){
                // then user has voted on all animals
                res.render('index', {
                    animal: null,
                    msg: 'You have voted on all the animals! Please upload a new one, or check out the <a href="/standings">standings</a>'
                });
            }else{
                const rand = Math.floor(Math.random() * results.length);
                res.render('index',{
                    animal: results[rand],
                    msg
                });
            }
        });
    }
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
    const insertQuery = `INSERT INTO votes (id,aid,value,uid)
        VALUES 
    (DEFAULT,?,?,?);`;
    connection.query(insertQuery,[id,value,req.session.uid],(error,results)=>{
        if (error) {throw error;}
        res.redirect('/');
    })
})

app.get('/register',(req,res)=>{
    let msg;
    if(req.query.msg == 'register'){
        msg = 'This email address is already registered.'
    }
    res.render('register', {msg})
})




app.post('/registerProcess',(req,res,next)=>{
    // res.json(req.body);
    const hashedPass = bcrypt.hashSync(req.body.password);
    // res.json(hashedPass);
    // before we insert a new user into the user's table,
    // we need to make sure this email isn't already in the db
    const checkUserQuery = `SELECT * FROM users WHERE email = ?;`;
    connection.query(checkUserQuery,[req.body.email],(err, results)=>{
        if(err){throw err;};
        if(results.length != 0){
            // our query returned a row, that means this email is already registered
            res.redirect('/register?msg=register');
        }else{
            // this is a new user, insert them
            const insertUserQuery = `INSERT INTO users (name, email, hash)
                VALUES
                (?,?,?);`;
            connection.query(insertUserQuery,[req.body.name,req.body.email,hashedPass],(err2,results2)=>{
                if(err2){throw err2;};
                res.redirect('/?msg=regSuccess');
            })
        };
    })

})


app.get('/login', (req,res,next)=>{
    let msg;
    if(req.query.msg == 'noUser'){
        msg= '<h2 class="text-danger">This email isn\'t registered. Please try again or register.</h2>';
    }else if(req.query.msg == 'badPass'){
        msg = '<h2 class="text-warning">Incorrect Password. Please reenter password.</h2>'
    }else if(req.query.msg == 'loggedOut'){
        msg ='<h2 class="text-success">You have successfully logged out!</h2>'
    }
    res.render('login',{msg})
})


app.post('/loginProcess', (req,res,next)=>{
    // res.json(req.body);
    const email = req.body.email;
    // this is the english version of the password the user submitted
    const password = req.body.password;
    // we now need to get teh hashed version from the db and compare

    const checkPasswordQuery = `SELECT * FROM users WHERE email = ?;`;
    connection.query(checkPasswordQuery, [email], (err,results)=>{
        if(err){throw err}
        // possibilities:
        // 1.no match i.e. the user is not in the db
        if(results.length == 0){
            // we don't care what password they gve us, send them back to /login
            res.redirect('/login?msg=noUser');
        }else{
            // user exists 
            // now we need to check if the password is correct

            const passwordMatch = bcrypt.compareSync(password, results[0].hash)
            // 2.We found the user but password does not match
            if(!passwordMatch){
                // goodbye

                res.redirect('/login?msg=badPass')
            }else{
                // 3. we found the user and the password matches
                // these are the droids we are looking for

                // cookies: Stores data in the browser with a key on the server
                    // every single page request the entire cookie is sent to the server
                // sessions: Stores data on the on the ServiceWorkerRegistration, with a key (cookie) on the browser

                // id is a reserved keyword in session. Don't mess with it, change id --> uid
                req.session.name = results[0].name;
                req.session.email = results[0].email;
                req.session.uid = results[0].id;
                req.session.loggedIn = true;
                res.redirect('/?msg=loginSuccess');
            }

        }

    })

})



app.get('/logout',(req,res,next)=>{
    req.session.destroy();
    res.redirect('/login?msg=loggedOut')
})


app.get('/uploadAnimal', (req,res,next)=>{
    res.render('uploadAnimal', {});
})

app.post('/formSubmit',upload.single('imageToUpload'), (req,res,next)=>{
    // get the animal name from req.body ... ?
    // get the image from ... ?
    // res.json(req.file);


    // the file is in req.file, but it is in binary
    // 1. get the temp path /location of our file on this server
    // 2. set up the new target path / where we actualy want it (i.e. original name might be useful here)
    // 3. we can't read binary, but fs can / have fs read the file
    // 4. once binary is read, write it to target
    // 5. insert the name of the file into the DB
    // 6. redirect home 

    
})

console.log("App is listening on port 8902");
app.listen(8902);