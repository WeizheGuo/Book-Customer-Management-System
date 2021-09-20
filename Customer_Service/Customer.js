const { Router } = require('express');
const express = require('express')

var bodyParser = require('body-parser')

const app = express()

var mysql = require('mysql')

// Thanks Yizhang Miao for helping me on this regular expression validation
var emailRegexp = new RegExp('^([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6})*$');
var priceRegexp = new RegExp('^[0-9]*\.[0-9]{2}$');

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

app.use(bodyParser.json())

app.listen(3001, (err) => {
  if (err) {
    console.log(err)
  } else {
    console.log('Server is running on port 3001.')
  }
})

//liveness probe
app.route('/status')
.get(
    async (req, res) => {
        res.status(200).send('OK')
    }
)

// retrieve a customer
app.route('/customers/:id')
.get(
  async (req, res) => {
    var id = req.params.id

    if (!parseInt(id)) {
      //console.log("here")
      res.sendStatus(400)
      return
    }

    var check_sql = "SELECT * FROM Customer WHERE id = ?"

    //console.log(data)

    await req.app.dbpool.getConnection(function(err, connection) {
      if (err){
        throw err
      }

      connection.query(check_sql, [id], function(err, entries) {
        // check for no matches
        if (entries == null || entries.length == 0) {
          res.sendStatus(404)
          connection.release()
          return
        }
        // now we can retrieve the customer
        else {
          //res.status(200).json(entries)
          var id = entries[0].id
          var userId = entries[0].userId
          var name = entries[0].name
          var phone = entries[0].phone
          var address = entries[0].address
          var address2 = entries[0].address2
          var city = entries[0].city
          var state = entries[0].state
          var zipcode = entries[0].zipcode
          res.status(200).json({"id": id, "userId": userId, "name": name, "phone": phone, "address": address, "address2": address2, "city": city, "state": state, "zipcode": zipcode})
          connection.release()
          return
        }
      })
    })
  }
)

// add a customer
app.route('/customers')
.post(
  async (req, res) => {
    var url = req.headers.host
    var userId = req.body.userId
    var name = req.body.name
    var phone = req.body.phone
    var address = req.body.address
    var address2 = req.body.address2
    var city = req.body.city
    var state = req.body.state
    var zipcode = req.body.zipcode

    if (userId == null || name == null || phone == null || address == null || city == null || state == null || zipcode == null) {
      res.sendStatus(400)
      return
    }

    if (!emailRegexp.test(userId)) {
      res.sendStatus(400)
      return
    }

    if (!ValidState(state)) {
      res.sendStatus(400)
      return
    }

    var check_sql = "SELECT * FROM Customer WHERE userId = ?"
    var add_sql = "INSERT INTO Customer (userId, name, phone, address, address2, city, state, zipcode) VALUES (?,?,?,?,?,?,?,?)"

    var data = [userId, name, phone, address, address2, city, state, zipcode]
    //console.log(data)

    await req.app.dbpool.getConnection(function(err, connection) {
      if (err){
        throw err
      }

      connection.query(check_sql, [userId], function(err, entries) {
        // check if the book already exists in the database
        if (entries.length != 0) {
          //res.sendStatus(422)
          res.status(422).json({"message": 'This user ID already exists in the system.'})
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
              connection.query(check_sql, data, function(err, entries){
                if(err) {
                  res.sendStatus(400)
                  connection.release()
                  //console.log(err)
                  return
                }
                res.setHeader("Location", url+"/customers/"+entries[0].id)
                res.status(201).json({"id": entries[0].id, "userId": userId, "name": name, "phone": phone, "address": address, "address2": address2, "city": city, "state": state, "zipcode": zipcode})
                sendmsg(entries[0].id, userId, name, phone, address, address2, city, state, zipcode)
                connection.release()
                return
              })
            }
          })
        }
      })
    })
  }
)


// retrieve a customer by filter userId
app.route('/customers')
.get(
  async (req, res) => {
    var userId = req.query.userId
    console.log(userId)

    if (!emailRegexp.test(userId)) {
      //console.log("here")
      res.sendStatus(400)
      return
    }

    var check_sql = "SELECT * FROM Customer WHERE userId = ?"

    //console.log(data)

    await req.app.dbpool.getConnection(function(err, connection) {
      if (err){
        throw err
      }

      connection.query(check_sql, [userId], function(err, entries) {
        // check for no matches
        if (entries == null || entries.length == 0) {
          res.sendStatus(404)
          connection.release()
          return
        }
        // now we can retrieve the customer
        else {
          //res.status(200).json(entries)
          var id = entries[0].id
          var userId = entries[0].userId
          var name = entries[0].name
          var phone = entries[0].phone
          var address = entries[0].address
          var address2 = entries[0].address2
          var city = entries[0].city
          var state = entries[0].state
          var zipcode = entries[0].zipcode
          res.status(200).json({"id": id, "userId": userId, "name": name, "phone": phone, "address": address, "address2": address2, "city": city, "state": state, "zipcode": zipcode})
          connection.release()
          return
        }
      })
    })
  }
)

// helper function to validate a state
// from http://codingtips.blogspot.com/2004/07/javascript-function-to-validate-us.html

function ValidState(sstate) {

	sstates = "wa|or|ca|ak|nv|id|ut|az|hi|mt|wy" +

				"co|nm|nd|sd|ne|ks|ok|tx|mn|ia|mo" +

				"ar|la|wi|il|ms|mi|in|ky|tn|al|fl" +

				"ga|sc|nc|oh|wv|va|pa|ny|vt|me|nh" +

				"ma|ri|ct|nj|de|md|dc";
	if (sstates.indexOf(sstate.toLowerCase() + "|") > -1) {
		return true;
		}
	return false;
}


function sendmsg (id, userId, name, phone, address, address2, city, state, zipcode) {
  // Load the AWS SDK for Node.js
  var AWS = require('aws-sdk');

  AWS.config.update({
    region: 'REGION',
    accessKeyId: 'AKIAWQWWY3WMYPBIYUZE',
    secretAccessKey: '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'
  });

  // Create an SQS service object
  var sqs = new AWS.SQS({apiVersion: '2012-11-05'});

  var params = {
    MessageAttributes: {
      "id": {
        DataType: "Number",
        StringValue: id.toString()
      },
      "userId": {
        DataType: "String",
        StringValue: userId
      },
      "name": {
        DataType: "String",
        StringValue: name
      },
      "phone": {
        DataType: "String",
        StringValue: phone
      },
      "address": {
        DataType: "String",
        StringValue: address
      },
      "address2": {
        DataType: "String",
        StringValue: address2
      },
      "city": {
        DataType: "String",
        StringValue: city
      },
      "state": {
        DataType: "String",
        StringValue: state
      },
      "zipcode": {
        DataType: "String",
        StringValue: zipcode
      },
    },
    MessageBody: "Customer is created successfully.",
    // MessageDeduplicationId: "TheWhistler",  // Required for FIFO queues
    // MessageGroupId: "Group1",  // Required for FIFO queues
    QueueUrl: "https://sqs.us-east-1.amazonaws.com/448200760729/customers"
  };

  sqs.sendMessage(params, function(err, data) {
    if (err) {
      console.log("Error", err);
    } else {
      console.log("Success", data.MessageId);
    }
  });
}