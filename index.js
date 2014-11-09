'use strict'

var Class		= require('class')
  , http		= require('http')
  , url			= require('url')
  , util		= require('util')
  , qs			= require('querystring')

var Request = Class.inherit({

	onCreate: function(req, res, info, opt) {
		
		// console.log('Request.onCreate')

		this.opt = opt || {}
		this.req = req
		this.res = res
		this.info = info
		if(!this.opt.hideRequestMessage) {
			this.time = process.hrtime()
		}		
	},

	writeHead: function(status, headers) {
		this.res.writeHead(status, headers)
	},

	write: function(text) {
		this.res.write(text)
	},

	setHeader: function(key, val) {
		this.res.setHeader(key, val)
	},

	end: function(text) {
		this.res.end(text)
		if(!this.opt.hideRequestMessage) {
			var diff = process.hrtime(this.time)
			console.log('request ' + ((diff[0] * 1e9 + diff[1])/1e9).toFixed(5) + ' ' + this.req.method + ' ' + this.info.pathname)
		}
	},

	onRequest: function() {
	},

	readPost: function() {
		this.postData = ''
		this.req.on('data', function(data) {
			this.postData += data
		}.bind(this)).on('end', function() {			
			var json
			try {
				json = JSON.parse(this.postData)
			}
			catch(e) {
				json = null
			}
			this.onPostReaded(json)
		}.bind(this))
	},

	onPostReaded: function(data) {
	},

})

var _404Request = Request.inherit({

	onRequest: function() {
		var message = '404'
		this.writeHead(404, { 'Content-Type': 'text/html', 'Content-Length': message.length })
		this.end(message)
	}

})

var Phoenix = module.exports = Class.inherit({

	onCreate: function(config) {

		this.sockets = []

		this.middleware = []
		this.routing = {}

		this.extend.apply(this, arguments)

		this.server = http.createServer()

		this.server.on('connection', this.onConnection.bind(this))
		this.server.on('request', this.onRequest.bind(this))

		this.server.listen(config.port, config.ip ? config.ip : null)

		this.requestOpt = { hideRequestMessage: config.hideRequestMessage ? config.hideRequestMessage : false }

		process.on('SIGINT', this.stop.bind(this))
	},

	extend: function() {
		var args = Array.prototype.slice.call(arguments)

		for(var i = 0, l = args.length; i < l; i++) {
			var item = args[i]

			if(item.prototype && item.prototype.route) {
				this.routing[item.prototype.route] = item
			}
/*
			else if(item instanceof Middleware) {
				this.middleware.push(item)
			}
*/

/*
			else {
				console.log('skip item ' + i)
			}
*/
		}
	},

	onConnection: function(socket) {
		var sockets = this.sockets
		sockets.push(socket)
		socket.on('close', function () {
			sockets.splice(sockets.indexOf(socket), 1)
		})
	},
	
	onRequest: function(req, res) {

		var info = url.parse(req.url, true);	

		var requestClass = (info.pathname in this.routing) ? this.routing[info.pathname] : _404Request
		var r = requestClass.create(req, res, info, this.requestOpt)
		/*
		console.log('r')
		console.log(util.inspect(requestClass,{depth:null,showHidden:true}))
		console.log(util.inspect(r,{depth:null,showHidden:true}))
		*/
		r.super('middleware')
		r.onRequest()
	},

	stop: function() {

		var s = this.sockets, i = s.length; while(i--) 
			s[i].destroy()

		this.server.close()
	},

})

Phoenix.Request = Request
