const axios = require('axios')
const express = require('express')
const app = express()

const JWT_TOKEN = 'Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJLUkFNRVJTIiwibHVscyI6IktSQU1FUlMiLCJjcmVhdGVkIjoxNjE3MjMwNzUxMzIwLCJyb2xlcyI6W10sImlzcyI6InRjdS5nb3YuYnIiLCJlaW8iOiIxMC4xMDAuMTkyLjUxIiwibnVzIjoiSk9BTyBBTkRPTklPUyBTUFlSSURBS0lTIiwibG90IjoiU2VnZWMiLCJhdWQiOiJPUklHRU1fUkVRVUVTVF9CUk9XU0VSIiwidHVzIjoiVENVIiwiY3VscyI6MjI1LCJjb2QiOjIyNSwiZXhwIjoxNjE3MjczOTUxMzIwLCJudWxzIjoiSk9BTyBBTkRPTklPUyBTUFlSSURBS0lTIn0.qtJ0Sf2Agqd_JmxGKfqiLw8SldOiP9e21OT4pKC8BqdXrJ0plqOWHf0hHbwQWp-foEBZzAUWX0J-QHtLyQ7SRw';

var bodyParser = require('body-parser')
app.use(bodyParser.json())

app.listen(81, (err) => {
    if (err) {
      console.log(err)
    } else {
      console.log('Server is running on port 81.')
    }
  })

//liveness probe
app.route('/status')
.get(
    async (req, res) => {
        res.status(200).send('OK')
    }
)

// add a customer
app.route('/customers')
.post(
    async (req, res) => {
        //console.log(req)
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

        console.log("here")
        console.log('http://customerservice.default.svc.cluster.local:3001' + req.originalUrl)
        axios.post('http://customerservice.default.svc.cluster.local:3001' + req.originalUrl,
        //axios.post('http://host.docker.internal:3001' + req.originalUrl, 
        req.body,
        {
            headers: req.headers
        })
        .then(response => {
            console.log("response for add customer")
            res.status(response.status).send(response.data);
        })
        .catch(error => {
            res.status(error.response.status).send(error.response.data);
        })
    }
)

// retrieve a customer by id
app.route('/customers/:id')
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

        axios.get('http://customerservice.default.svc.cluster.local:3001' + req.originalUrl, 
        req.body,
        {
            headers: req.headers
        })
        .then(response => {
            delete(response.data["address"])
            delete(response.data["address2"])
            delete(response.data["city"])
            delete(response.data["state"])
            delete(response.data["zipcode"])
            console.log("response for retrieving a customer by id")
            res.status(response.status).send(response.data);
        })
        .catch(error => {
            res.status(error.response.status).send(error.response.data);
        })
    }
)

// retrieve a customer by filter userId
app.route('/customers')
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

        axios.get('http://customerservice.default.svc.cluster.local:3001' + req.originalUrl, 
        req.body,
        {
            headers: req.headers
        })
        .then(response => {
            delete(response.data["address"])
            delete(response.data["address2"])
            delete(response.data["city"])
            delete(response.data["state"])
            delete(response.data["zipcode"])
            console.log("response for retrieving a customer by userId")

            res.status(response.status).send(response.data);
        })
        .catch(error => {
            res.status(error.response.status).send(error.response.data);
        })
    }
)

var checkFields = (req) => {
    // check for missing fields
    if (!'user-agent' in req.headers  || req.headers['user-agent'] == undefined) {
        return 400
    }
    if (!'authorization' in req.headers || req.headers['authorization'] == undefined) {
        return 401
    }
    if (req.headers.authorization !== JWT_TOKEN) {
        return 401;
    }
    
    return 200;
}
