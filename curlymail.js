'use strict';

var hogan = require('hogan.js'),
	emailjs = require('emailjs'),
	html2text = require('./html2text.js');

// archives
var accounts = {},
	templates = {};

var isObject = function (obj) {
	if (typeof obj !== 'object' || obj === null) {
		return false;
	}
	return obj.length === undefined;
};

// compile templates in a object
var getCompiledObj = function (obj) {
	var fns = {},
		i;
	for (i in obj) {
		fns[i] = hogan.compile( obj[i] );
	}
	return fns;
};

// compile templates in objects in an array
var getCompiledArr = function (arr) {
	return arr.map( function (el) {
		return getCompiledObj( el );
	});
};

// message template
var Template = function (template) {
	if (template.attachments) {
		this.attachments = getCompiledArr( template.attachments );
	} else {
		this.attachments = [];
	}
	delete template.attachments;
	this.src = template;
	this.compiled = getCompiledObj( this.src );
};

/*!
 * [render description]
 * @param  {[type]} data     [description]
 * @param  {[type]} remitent [description]
 * @return {[type]}          [description]
 */
Template.prototype.render = function (data, remitent) {
	var msg = {}, i;

	// render regular fields
	for (i in this.src) {
		msg[i] = this.compiled[i].render( data );
	}

	// add email to remitent
	if (msg.from) {
		msg.from = '"' + msg.from + '" <' + remitent + '>';
	}
	msg.attachment = [];
	// render templates from attachments
	this.attachments.forEach( function (att) {
		var rendered = {}, i;
		for (i in att) {
			rendered[i] = att[i].render( data );
		}
		msg.attachment.push( rendered );
	});

	// attach html message
	if (msg.html) {
		msg.attachment.push({
			data: msg.html,
			alternative: true
		});
		// add plain text message if not exists
		if (!msg.text) {
			msg.text = html2text( msg.html );
		}
		delete msg.html;
	}
	// add attachments from data _attachments
	data._attachments.forEach( function (att) {
		msg.attachment.push( att );
	});
	return msg;
};

var curlymail = {};


/**
 * Add or overwrite a message template.
 * Curlymail use Hogan.js for template rendering.
 *
 * Example:
 * ```js
 * curlymail.addTemplate( 'welcomeMail', {
 *     from: "{{appname}}",
 *     to: "{{username}} <{{email}}>",
 *     cc: "aperson@domain.com, otherperson@domain.com",
 *     bcc: "hideperson@domain.com",
 *     subject: "testing emailjs",
 *     html:    "<html>You have <strong>{{messages.length}} messages</strong></html>",
 *     text:    "You have {{messages.length}} messages",
 *     attachments: [
 *         {path:"./file.zip", name:"renamed.zip"}
 *     ]
 * });
 * ```
 *
 * @param {String} key      template keyname
 * @param {Object} template mail template
 */
curlymail.addTemplate = function (key, template) {
	templates[key] = new Template( template );
};



/**
 * Add an email account and connect it to its SMTP server
 *
 * Connection options:
 *
 * - user: username for logging into smtp
 * - password: password for logging into smtp
 * - host: smtp host
 * - port: smtp port (if null a standard port number will be used)
 * - ssl: boolean or object {key, ca, cert} (if true or object, ssl connection will be made)
 * - tls: boolean or object (if true or object, starttls will be initiated)
 * - timeout: max number of milliseconds to wait for smtp responses (defaults to 5000)
 * - domain: domain to greet smtp with (defaults to os.hostname)
 *
 * Example:
 * ```js
 * curlymail.addAccount( 'main', {
 *     user: 'username@domain.com',
 *     password: 'PA55W0RD',
 *     host: 'smtp.gmail.com',
 *     ssl: true
 * });
 * ```
 * @param {String} key  keyname
 * @param {Object} data account credentials
 */
curlymail.addAccount = function (key, data) {
	accounts[key] = {
		src: data,
		server: emailjs.server.connect( data )
	};
};


/**
 * Send message from a mail account
 *
 * Example:
 * ```js
 * curlymail.send( 'mainAccount', 'welcomeMail', {}, function (err) {
 *     console.log( err || msg );
 * });
 * ```
 *
 * Note: `_attachments` field in data object will be added to message
 *
 * @param  {String}   account  account key
 * @param  {String|Object}   template template key or template object
 * @param  {Object}   data     data for template rendering
 * @param  {Function} callback Signature: err, message
 */
curlymail.send = function (account, template, data, callback) {
	callback = callback || function () {};
	if (!account || typeof account !== 'string' || !accounts[account]) {
		return callback( 'invalid account' );
	}
	account = accounts[account];
	if (!template) {
		return callback( 'invalid template' );
	}
	if (typeof template === 'string') {
		template = templates[template];
	} else if (!isObject( template )) {
		return callback( 'invalid template' );
	} else {
		template = new Template( template );
	}

	account.server.send( template.render( data || {}, account.src.user ), callback );
};


module.exports = curlymail;
