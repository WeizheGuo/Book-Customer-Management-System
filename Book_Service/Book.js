const { Router } = require('express');
const express = require('express')

var bodyParser = require('body-parser')

const app = express()

var mysql = require('mysql')

// Thanks Yizhang Miao for helping me on this regular expression validation
var emailRegexp = new RegExp('^([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6})*$');
var priceRegexp = new RegExp('^[0-9]*\.[0-9]{2}$');

const axios = require('axios');

// AWS RDS
var pool = mysql.createPool({
    connectionLimit: 5,
    host: 'database-1.cbhxyje9ogc4.us-east-2.rds.amazonaws.com',
    user: 'admin',
    port: 3306,
    password: 'guoweizhe123',
    database: 'dataclass', 
});

// setting up the aws elastic search configuration
var AWS = require('aws-sdk');
var region = 'us-east-2';
var domain = 'search-bookservice-3nzcqqewyhirndwbvjqh24upom.us-east-2.es.amazonaws.com';
var index = 'books';
var type = 'book';
//var id = '1';

var credentials = new AWS.EnvironmentCredentials('AWS');
credentials.accessKeyId = 'AKIAWAB6K3FMMY6BXGOO';
credentials.secretAccessKey = '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';


app.dbpool = pool

app.use(bodyParser.json())


app.listen(3002, (err) => {
  //deleterecords()
  if (err) {
    console.log(err)
  } else {
    console.log('Server is running on port 3002.')
  }
})

function deleterecords() {
  console.log("Deleting all the record in es...")
  var endpoint = new AWS.Endpoint(domain);
  var request = new AWS.HttpRequest(endpoint, region);

  request.method = 'DELETE';
  request.path += index;
  //console.log(param)

  //request.body['doc'] = JSON.stringify(json_req_body);
  console.log(request.body)
  request.headers['host'] = domain;
  request.headers['Content-Type'] = 'application/json';
  // Content-Length is only needed for DELETE requests that include a request
  // body, but including it for all requests doesn't seem to hurt anything.
  //request.headers['Content-Length'] = Buffer.byteLength(request.body);

  var signer = new AWS.Signers.V4(request, 'es');
  signer.addAuthorization(credentials, new Date());

  var client = new AWS.HttpClient();
  client.handleRequest(request, null, function(response) {
    console.log(response.statusCode + ' ' + response.statusMessage);
    var responseBody = '';
    response.on('data', function (chunk) {
      responseBody += chunk;
    });
    response.on('end', function (chunk) {
      console.log('Response body: ' + responseBody);
    });
  }, function(error) {
    console.log('Error: ' + error);
  });
}

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
    console.log("adding a book in backend")
    var isbn = req.body.ISBN
    var title = req.body.title
    var author = req.body.Author
    var description = req.body.description
    var genre = req.body.genre
    var price = req.body.price
    var quantity = req.body.quantity

    var url = req.headers.host

    if (title == null || author == null || description == null || genre == null || price == null || quantity == null || isbn == null) {
      res.sendStatus(400)
      return
    }

    if (!priceRegexp.test(price)) {
      res.sendStatus(400)
      return
    }

    var check_sql = "SELECT * FROM Book WHERE isbn = ?"
    var add_sql = "INSERT INTO Book (isbn, title, author, description, genre, price, quantity) VALUES (?,?,?,?,?,?,?)" 
    var data = [isbn, title, author, description, genre, price, quantity]
    //console.log(data)

    await req.app.dbpool.getConnection(function(err, connection) {
      if (err){
        throw err
      }

      connection.query(check_sql, [isbn], function(err, entries) {
        console.log(entries)
        // check if the book already exists in the database
        if (entries.length != 0) {
          //res.sendStatus(422)
          res.status(422).json({"message": 'This ISBN already exists in the system.',})
          connection.release()
          return
        }
        // now do the add work
        else {
          connection.query(add_sql, data, function(err, entries){
            if(err) {
              res.sendStatus(400)
              connection.release()
              //console.log(err)
              return
            }
            else {
              //console.log("I am here")
              esaddbook(req.body, isbn)
              res.setHeader("Location", url+"/books/"+isbn)
              res.status(201).json({"ISBN": isbn, "title": title, "Author": author, "description": description, "genre": genre, "price": price, "quantity": quantity})
              connection.release()
              return
            }
          })
        }
      })

    })
  }
)

// update book
app.route('/books/:isbn')
.put(
  async (req, res) => {
    //var url = req.headers.host
    var isbn = req.params.isbn
    var isbn_new = req.body.ISBN
    var title = req.body.title
    var author = req.body.Author
    var description = req.body.description
    var genre = req.body.genre
    var price = req.body.price
    var quantity = req.body.quantity
    var data = [isbn_new, title, author, description, genre, price, quantity, isbn]
    //console.log(data)

    if (title == null || author == null || description == null || genre == null || price == null || quantity == null || isbn == null) {
      res.sendStatus(400)
      return
    }

    if (!priceRegexp.test(price)) {
      res.sendStatus(400)
      console.log(price)
      return
    }

    var check_sql = "SELECT * FROM Book WHERE isbn = ?"
    var update_sql = "UPDATE Book SET isbn = ?, title = ?, author = ?, description = ?, genre = ?, price = ?, quantity = ? WHERE isbn = ?"

    await req.app.dbpool.getConnection(function(err, connection) {
      if (err){
        throw err
      }

      connection.query(check_sql, [isbn], function(err, entries) {
        // check for null
        // if no matches
        if (entries == null || entries.length == 0) {
          res.sendStatus(404)
          connection.release()
          return
        }
        // now we can make update
        else {
          connection.query(update_sql, data, function(err, entries){
            if(err) {
              res.sendStatus(400)
              console.log(err)
              connection.release()
              return
            }
            if(!entries) {
              res.sendStatus(404)
              connection.release()
              return
            }
            else {
              esupdatebook(isbn, title, author, description, genre, price, quantity)
              res.status(200).json({"ISBN": isbn_new, "title": title, "Author": author, "description": description, "genre": genre, "price": price, "quantity": quantity})
              connection.release()
              return
            }
          })
        }
      })
    })
  }
)

//retrieve a book
app.route('/books/isbn/:isbn')
.get(
  async (req, res) => {
    //console.log("i am here")
    var isbn = req.params.isbn
    
    console.log("Get the record in es...")
    var endpoint = new AWS.Endpoint(domain);
    var request = new AWS.HttpRequest(endpoint, region);

    request.method = 'GET';
    request.path += index + '/' + type + '/' + isbn;
    //request.body = JSON.stringify(json_req_body);
    //console.log(request.body)
    request.headers['host'] = domain;
    request.headers['Content-Type'] = 'application/json';

    var signer = new AWS.Signers.V4(request, 'es');
    signer.addAuthorization(credentials, new Date());

    var client = new AWS.HttpClient();
    client.handleRequest(request, null, function(response) {
      console.log(response.statusCode + ' ' + response.statusMessage);
      var responseBody = '';
      response.on('data', function (chunk) {
        responseBody += chunk;
      });
      response.on('end', function (chunk) {
        console.log('Response body: ' + responseBody);
        json_res = JSON.parse(responseBody)
        if (json_res['found'] == false || json_res['_source'] == null || json_res['_source'] == undefined) {
          res.sendStatus(404)
          return
        }
        res.status(200).json(json_res['_source'])
        return
      });
    }, function(error) {
      console.log('Error: ' + error);
      res.sendStatus(404)
    });
  }
)

// the newly added recommendation book function
app.route('/books/:isbn/related-books')
.get(
  async (req, res) => {
    var isbn = req.params.isbn

    console.log("Get the record in es for related books...")
    var endpoint = new AWS.Endpoint(domain);
    var request = new AWS.HttpRequest(endpoint, region);

    request.method = 'GET';
    request.path += index + '/' + type + '/' + isbn;
    //request.body = JSON.stringify(json_req_body);
    //console.log(request.body)
    request.headers['host'] = domain;
    request.headers['Content-Type'] = 'application/json';

    var signer = new AWS.Signers.V4(request, 'es');
    signer.addAuthorization(credentials, new Date());

    var client = new AWS.HttpClient();
    client.handleRequest(request, null, function(response) {
      console.log(response.statusCode + ' ' + response.statusMessage);
      var responseBody = '';
      response.on('data', function (chunk) {
        responseBody += chunk;
      });
      response.on('end', function (chunk) {
        console.log('Response body: ' + responseBody);
        json_res = JSON.parse(responseBody)
        //console.log(json_res['_source']['relatedTitles'])
        // no book founded
        if (json_res['found'] == false || json_res['_source'] == null || json_res['_source'] == undefined) {
          console.log("no book founded")
          res.sendStatus(404)
          return
        }
        // book is found and has relatedTitles data field
        else if (json_res['_source']['relatedTitles'] != null && json_res['_source']['relatedTitles'] != undefined) {
          console.log("book is found and has relatedTitles data field")
          res.status(200).json(json_res['_source']['relatedTitles'])
          return
        }
        // book is found wihtout relatedTitles data field
        else {
          console.log("book is found without relatedTitles data field, connecting with external service")

          var check_sql = "SELECT * FROM CBState WHERE id = 1"
          req.app.dbpool.getConnection(function(err, connection) {
            if (err){
              throw err
            }

            connection.query(check_sql, function(err, entries) {
              // check for null
              if (entries == null || entries.length == 0) {
                res.sendStatus(404)
                connection.release()
                console.log("no CB state found in the database, check database entry")
                return
              }
              else {
                console.log("The CB status is: ", entries[0].status)
                
                curtime = new Date().getTime()
                // if the circuit is close, we proceed
                if (entries[0] == 0) {
                  var get_sql = "SELECT * FROM Book WHERE isbn = ?"

                  connection.query(get_sql, isbn, function(err, entries) {
                    // check for null
                    if (entries == null || entries.length == 0) {
                      connection.release()
                      res.Status(204).send()
                      return
                    }
                    // we found the book by its isbn; connect to external system
                    else {
                      connection.release()

                      console.log("connecting with the external service")
                      axios.get("http://3.131.68.68/recommended-titles/isbn/"+isbn, {timeout: 3000})
                      //axios.get("http://localhost:8080/recommended-titles/isbn/"+isbn, {timeout: 6000})
                      .then(response => {
                        // no recommended book
                        if (response.data == null || response.data.length == 0 || response.status == 204) {
                          res.status(204).send()
                          return
                        }
                        // found recommended books, udpate records in es
                        else {
                          //console.log("I am here")
                          esupdatebook_relatedTitles(isbn, response.data)
                          res.status(response.status).json(response.data)
                          return
                        }
                      })
                      .catch(error => {
                        res.status(504).send(error)
                        return
                      })
                    }
                  })
                }
                // if the circuit is open and within the 60s window
                else if (entries[0].status == 1 && entries[0].time > curtime) {
                  console.log("circuit open and in the 60s window")
                  connection.release()
                  res.status(503).send()
                  return
                }
                // if the circuit is open and out of the 60s window
                else {
                  console.log("circuit open and out of 60s window")
                  console.log(entries[0])
                  connection.release()

                  axios({
                    method: 'get',
                    url: 'http://3.131.68.68/recommended-titles/isbn/'+isbn,
                    timeout: 3000, 
                  })
                  // axios({
                  //   method: 'get',
                  //   url: 'http://localhost:8080/recommended-titles/isbn/'+isbn,
                  //   timeout: 6000, 
                  // })
                  .then(function (response){
                    console.log(response)
                    console.log(isbn)
                    if (response.data == null || response.data.length == 0 || response.status == 204) {
                      res.status(204).send()
                      return
                    }
                    else {
                      esupdatebook_relatedTitles(isbn, response.data)
                      res.status(response.status).json(response.data)
                      return
                    }
                  })
                  .catch(error => {
                    //console.log(error)
                    res.status(504).send(error)
                    return
                  })
                }
              }
            })
          })
        }
      });
    }, function(error) {
      console.log('Error: ' + error);
      res.sendStatus(404)
    });

    console.log("in the book service, get recommended books")
    var isbn = req.params.isbn

    var check_sql = "SELECT * FROM CBState WHERE id = 1"
    await req.app.dbpool.getConnection(function(err, connection) {
      if (err){
        throw err
      }

      connection.query(check_sql, function(err, entries) {
        // check for null
        if (entries == null || entries.length == 0) {
          res.sendStatus(404)
          connection.release()
          console.log("no CB state found in the database, check database entry")
          return
        }
        else {
          console.log("The CB status is: ", entries[0].status)
          
          curtime = new Date().getTime()
          // if the circuit is close, we proceed
          if (entries[0] == 0) {
            var get_sql = "SELECT * FROM Book WHERE isbn = ?"

            connection.query(get_sql, isbn, function(err, entries) {
              // check for null
              if (entries == null || entries.length == 0) {
                connection.release()
                res.Status(204).send()
                return
              }
              // we found the book by its isbn; connect to external system
              else {
                connection.release()

                console.log("connecting with the external service")
                axios.get("http://3.131.68.68/recommended-titles/isbn/"+isbn, {timeout: 3000})
                .then(response => {
                  // no recommended book
                  if (response.data == null || response.data.length == 0 || response.status == 204) {
                    res.status(204).send()
                    return
                  }
                  else {
                    res.status(response.status).json(response.data)
                    return
                  }
                })
                .catch(error => {
                  res.status(504).send(error)
                  return
                })
              }
            })
          }
          // if the circuit is open and within the 60s window
          else if (entries[0].status == 1 && entries[0].time > curtime) {
            console.log("circuit open and in the 60s window")
            connection.release()
            res.status(503).send()
            return
          }
          // if the circuit is open and out of the 60s window
          else {
            console.log("circuit open and out of 60s window")
            console.log(entries[0])
            connection.release()
            //connection.release()
            axios({
              method: 'get',
              url: 'http://3.131.68.68/recommended-titles/isbn/'+isbn,
              timeout: 3000, 
            })
            .then(function (response){
              console.log(response)
              console.log(isbn)
              if (response.data == null || response.data.length == 0 || response.status == 204) {
                res.status(204).send()
              }
              else {
                res.status(response.status).json(response.data)
              }
            })
            .catch(error => {
              //console.log(error)
              res.status(504).send(error)
              return
            })
          }
        }
      })
    })
  }
)

// retrieve a book by searching keyword
app.route('/books')
.get(
  async (req, res) => {
    var keyword = req.query.keyword

    console.log("Search for the related books record in es by keyword" + keyword)
    if (!/^[a-zA-Z]+$/.test(keyword)){
      res.sendStatus(400)
      return
    }

    var endpoint = new AWS.Endpoint(domain);
    var request = new AWS.HttpRequest(endpoint, region);

    request.method = 'GET';
    request.path += index + '/' + type + '/_search';
    console.log(request.path)

    request.body = JSON.stringify({
      query: {
          "bool":{
              "should":[
                  {"match":{"title": keyword}},
                  {"match":{"Author": keyword}},
                  {"match":{"description": keyword}},
                  {"match":{"genre": keyword}},
                  {"match": {"relatedTitles.authors": keyword}},
                  {"match": {"relatedTitles.title": keyword}}
              ]
          }
      }
    })
    //console.log(param)

    //request.body['doc'] = JSON.stringify(json_req_body);
    console.log(request.body)
    request.headers['host'] = domain;
    request.headers['Content-Type'] = 'application/json';
    // Content-Length is only needed for DELETE requests that include a request
    // body, but including it for all requests doesn't seem to hurt anything.
    request.headers['Content-Length'] = Buffer.byteLength(request.body);

    var signer = new AWS.Signers.V4(request, 'es');
    signer.addAuthorization(credentials, new Date());

    console.log(credentials.secretAccessKey)
    var client = new AWS.HttpClient();
    client.handleRequest(request, null, function(response) {
      console.log(response.statusCode + ' ' + response.statusMessage);
      var responseBody = '';
      response.on('data', function (chunk) {
        responseBody += chunk;
      });
      response.on('end', function (chunk) {
        console.log('Response body: ' + responseBody);
        json_res = JSON.parse(responseBody)
        hits = json_res["hits"]["hits"];

        // no match record found
        if (json_res["hits"]["total"]["value"] == 0){
          res.sendStatus(204);
        }
        else{
          res_buffer = [];
          for (var i=0; i<hits.length; i++){
            source = hits[i]["_source"]
            res_buffer.push(source)
          }
          res.status(200).json(res_buffer)
          return
        }
      });
    }, function(error) {
      console.log('Error: ' + error);
    });
  }
)

//var elasticsearch = require('elasticsearch');

// var connectionClass = require('http-aws-es');

// var client = new elasticsearch.Client({
//     host: 'https://yourdomainurl.us-east-1.es.amazonaws.com',
//     log: 'debug',
//     connectionClass: connectionClass,
//     amazonES: {
//       credentials: new AWS.EnvironmentCredentials('AWS')
//     }
//   });

function esaddbook (json_req_body, isbn) {
  
  console.log("add a record to es...")
  console.log(isbn)
  var endpoint = new AWS.Endpoint(domain);
  var request = new AWS.HttpRequest(endpoint, region);

  request.method = 'PUT';
  request.path += index + '/' + type + '/' + isbn;
  request.body = JSON.stringify(json_req_body);
  console.log(request.body)
  request.headers['host'] = domain;
  request.headers['Content-Type'] = 'application/json';
  var signer = new AWS.Signers.V4(request, 'es');
  signer.addAuthorization(credentials, new Date());

  var client = new AWS.HttpClient();
  client.handleRequest(request, null, function(response) {
    console.log(response.statusCode + ' ' + response.statusMessage);
    var responseBody = '';
    response.on('data', function (chunk) {
      responseBody += chunk;
    });
    response.on('end', function (chunk) {
      console.log('Response body: ' + responseBody);
    });
  }, function(error) {
    console.log('Error: ' + error);
  });
}


function esupdatebook (isbn, title, author, description, genre, price, quantity) {
  console.log("Update the record in es...")
  var endpoint = new AWS.Endpoint(domain);
  var request = new AWS.HttpRequest(endpoint, region);

  request.method = 'POST';
  request.path += index + '/' + type + '/' + isbn + '/_update';

  request.body = JSON.stringify({
    doc : {
    "ISBN" : isbn,
    "title" : title,
    "Author": author,
    "description": description,
    "genre": genre,
    "price": price,
    "quantity":quantity
    }
  })
  //console.log(param)

  console.log(request.body)
  request.headers['host'] = domain;
  request.headers['Content-Type'] = 'application/json';
  // Content-Length is only needed for DELETE requests that include a request
  // body, but including it for all requests doesn't seem to hurt anything.
  //request.headers['Content-Length'] = Buffer.byteLength(request.body);

  var signer = new AWS.Signers.V4(request, 'es');
  signer.addAuthorization(credentials, new Date());

  var client = new AWS.HttpClient();
  client.handleRequest(request, null, function(response) {
    console.log(response.statusCode + ' ' + response.statusMessage);
    var responseBody = '';
    response.on('data', function (chunk) {
      responseBody += chunk;
    });
    response.on('end', function (chunk) {
      console.log('Response body: ' + responseBody);
    });
  }, function(error) {
    console.log('Error: ' + error);
  });
}

function esupdatebook_relatedTitles(isbn, relatedbooks) {
  console.log("Update the related books record in es...")
  var endpoint = new AWS.Endpoint(domain);
  var request = new AWS.HttpRequest(endpoint, region);

  request.method = 'POST';
  request.path += index + '/' + type + '/' + isbn + '/_update';

  request.body = JSON.stringify({
    doc : {
      "relatedTitles": relatedbooks
    }
  })
  //console.log(param)

  console.log(request.body)
  request.headers['host'] = domain;
  request.headers['Content-Type'] = 'application/json';
  // Content-Length is only needed for DELETE requests that include a request
  // body, but including it for all requests doesn't seem to hurt anything.
  //request.headers['Content-Length'] = Buffer.byteLength(request.body);

  var signer = new AWS.Signers.V4(request, 'es');
  signer.addAuthorization(credentials, new Date());

  var client = new AWS.HttpClient();
  client.handleRequest(request, null, function(response) {
    console.log(response.statusCode + ' ' + response.statusMessage);
    var responseBody = '';
    response.on('data', function (chunk) {
      responseBody += chunk;
    });
    response.on('end', function (chunk) {
      console.log('Response body: ' + responseBody);
    });
  }, function(error) {
    console.log('Error: ' + error);
  });
}

