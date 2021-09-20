const axios = require('axios');
const express = require('express')
const app = express()

const JWT_TOKEN = 'Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJLUkFNRVJTIiwibHVscyI6IktSQU1FUlMiLCJjcmVhdGVkIjoxNjE3MjMwNzUxMzIwLCJyb2xlcyI6W10sImlzcyI6InRjdS5nb3YuYnIiLCJlaW8iOiIxMC4xMDAuMTkyLjUxIiwibnVzIjoiSk9BTyBBTkRPTklPUyBTUFlSSURBS0lTIiwibG90IjoiU2VnZWMiLCJhdWQiOiJPUklHRU1fUkVRVUVTVF9CUk9XU0VSIiwidHVzIjoiVENVIiwiY3VscyI6MjI1LCJjb2QiOjIyNSwiZXhwIjoxNjE3MjczOTUxMzIwLCJudWxzIjoiSk9BTyBBTkRPTklPUyBTUFlSSURBS0lTIn0.qtJ0Sf2Agqd_JmxGKfqiLw8SldOiP9e21OT4pKC8BqdXrJ0plqOWHf0hHbwQWp-foEBZzAUWX0J-QHtLyQ7SRw';

var bodyParser = require('body-parser')
app.use(bodyParser.json())
var mysql = require('mysql')

// AWS RDS
var pool = mysql.createPool({
    connectionLimit: 5,
    host: 'database-1.cbhxyje9ogc4.us-east-2.rds.amazonaws.com',
    user: 'admin',
    port: 3306,
    password: 'guoweizhe123',
    database: 'dataclass', 
});
app.dbpool = pool

app.listen(82, (err) => {
    if (err) {
      console.log(err)
    } else {
      console.log('Server is running on port 82.')
    }
})

//liveness probe
app.route('/status')
.get(
    async (req, res) => {
        res.status(200).send('OK')
    }
)

// add a book
app.route('/books')
.post(
    async (req, res) => {
        //console.log(req.body.ISBN)
        var checkfields = checkFields(req);

        if (checkfields!= 200) {
            if (checkfields == 400) {
                res.status(checkfields).json({ message : "No user agent" })
            }
            else if (checkfields == 401) {
                res.status(checkfields).json({ message : "Unauthorized" })
            }
            return    
        }

        axios.post('http://bookservice.default.svc.cluster.local:3002' + req.originalUrl, 
        //console.log(req.originalUrl)
        //axios.post('http://localhost:3002' + req.originalUrl, 
        req.body,
        {
            headers: req.headers
        })
        .then(response => {
            console.log("response for post book")
            res.status(response.status).send(response.data);
        })
        .catch(error => {
            console.log("Error occuring")
            res.status(error.response.status).send(error.response.data);
        })
    }
)

// update book
app.route('/books/:isbn')
.put(
    async (req, res) => {
        var checkfields = checkFields(req);

        if (checkfields!= 200) {
            if (checkfields == 400) {
                res.status(checkfields).json({ message : "No user agent" })
            }
            else if (checkfields == 401) {
                res.status(checkfields).json({ message : "Unauthorized" })
            }
            return    
        }

        axios.put('http://bookservice.default.svc.cluster.local:3002' + req.originalUrl, 
        req.body,
        {
            headers: req.headers
        })
        .then(response => {
            console.log("response for updating book")
            res.status(response.status).send(response.data);
        })
        .catch(error => {
            res.status(error.response.status).send(error.response.data);
        })
    }
)

//retrieve a book
app.route('/books/isbn/:isbn')
.get(
    async (req, res) => {
        var checkfields = checkFields(req);

        if (checkfields!= 200) {
            if (checkfields == 400) {
                res.status(checkfields).json({ message : "No user agent" })
            }
            else if (checkfields == 401) {
                res.status(checkfields).json({ message : "Unauthorized" })
            }
            return
        }

        axios.get('http://bookservice.default.svc.cluster.local:3002' + req.originalUrl, 
        //axios.get('http://localhost:3002' + req.originalUrl, 
        req.body,
        {
            headers: req.headers
        })
        .then(response => {
            console.log("response for retrieving book")
            if (response.data.genre == 'non-fiction' && req.headers['user-agent'].includes('Mobile')) {
                response.data.genre = 3;   
            }
            res.status(response.status).send(response.data);
        })
        .catch(error => {
            res.status(error.response.status).send(error.response.data);
        })
    }
)

// the newly added recommendation book function
app.route('/books/:isbn/related-books')
.get(
  async (req, res) => {

    var checkfields = checkFields(req);

    if (checkfields!= 200) {
        if (checkfields == 400) {
            res.status(checkfields).json({ message : "No user agent" })
        }
        else if (checkfields == 401) {
            res.status(checkfields).json({ message : "Unauthorized" })
        }
        return    
    }

    //axios.get('http://host.docker.internal:3002' + req.originalUrl, 
    axios.get('http://bookservice.default.svc.cluster.local:3002' + req.originalUrl, 
    {headers: req.headers})
        .then(response => {
            //console.log(response.data)
            console.log("updating cbstate status to be 0 and time to 0")
            var updated_sql = "UPDATE CBState SET status = ?, time = ? WHERE id = 1"
            var data = [0, 0]

            // reset the status
            req.app.dbpool.getConnection(function(err, connection) {
                if (err){
                  throw err
                }
          
                connection.query(updated_sql, data, function(err, entries) {
                  // check for null
                  if (entries == null || entries.length == 0) {
                    res.sendStatus(404)
                    connection.release()
                    console.log("no CB state found in the database, check database entry")
                    return
                  }
                  // now we can retrieve the book
                  else {
                    //res.status(200).json(entries)
                    console.log("changing the CB state to be 0")
                    connection.release()
                  }
                  res.status(response.status).send(response.data);
                  return
                })
            })
        })
        .catch(error => {
            console.log(error.code)
            console.log(error.response.status)
            if (error.code === "ECONNABORTED" || error.response.status == 504) {
                // update the circuit status to be open
                var open_sql = "UPDATE CBState SET status = ?, time = ? WHERE id = 1"
                var time = new Date().getTime() + 60000
                var data = [1, time]

                req.app.dbpool.getConnection(function(err, connection) {
                    if (err){
                        throw err
                    }
              
                    connection.query(open_sql, data, function(err, entries) {
                      // check for null
                      if (entries == null || entries.length == 0) {
                        res.sendStatus(404)
                        connection.release()
                        console.log("no CB state found in the database, check database entry")
                        return
                      }
                      // now we can retrieve the book
                      else {
                        console.log("changing the CB state to be 1 and time to be current time")
                        connection.release()
                        res.status(504).send("Time out")
                        return
                      }
                    })
                })
            }
            else {
                // here is the 503 branch
                console.log("503 error, circuit open")
                res.status(error.response.status).send();
                return
            }
        })
    }
)

// search by keywords
app.route('/books')
.get(
    async (req, res) => {
        var checkfields = checkFields(req);

        if (checkfields!= 200) {
            if (checkfields == 400) {
                res.status(checkfields).json({ message : "No user agent" })
            }
            else if (checkfields == 401) {
                res.status(checkfields).json({ message : "Unauthorized" })
            }
            return
        }

        axios.get('http://bookservice.default.svc.cluster.local:3002' + req.originalUrl, 
        //axios.get('http://localhost:3002' + req.originalUrl, 
        req.body,
        {
            headers: req.headers
        })
        .then(response => {
            console.log("response for searching book")
            res.status(response.status).send(response.data);
        })
        .catch(error => {
            res.status(error.response.status).send(error.response.data);
        })
    }
)

var checkFields = (req) => {
    // check for missing fields
    //console.log(req.headers['user-agent'])
    if (!'user-agent' in req.headers  || req.headers['user-agent'] == undefined) {
        return 400
    }
    if (!'authorization' in req.headers  || req.headers['authorization'] === undefined) {
        return 401
    }
    if (req.headers.authorization !== JWT_TOKEN) {
        return 401;
    } 
    return 200;
}
