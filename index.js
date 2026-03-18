const fs = require('fs');
const path = require('path');
const { createServer } = require('http');
const express = require('express');
const app = express();
const server = createServer(app);
const cors = require("cors");
const development = process.env.NODE_ENV !== "production";
const disk = development ? "./disk" : "/var/data";
app.use(cors(development ? null : {origin: "https://noto173.net"}));
app.use(express.json({"limit":"25mb"}));
app.use(express.urlencoded());
const port = process.env.PORT || 3000;

app.get('/notocities/api/list', (req, res) => {
    console.log("Sending file lists");
    res.send(JSON.stringify(listPages()));
});

app.get('/notocities/view', (req, res) => {
    console.log("Sending a file");
    res.sendFile(`${disk}/templates/${req.query.name}.html`, development ? {root: path.join(__dirname)} : null, (err) => {
        if (err) {
            console.log("Failed");
            res.send(`<!DOCTYPE html><title>whoops!</title><h1>404</h1>the site you are looking for does not exist!`);
        }
    });
});

app.post('/notocities/api/upload', (req, res) => {
    let name = req.body.name.trim();
    console.log("Recieved upload request");
    const relative = path.relative(`${disk}/templates`, `${disk}/templates/${name}.html`);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        console.log("Failed");
        res.send(JSON.stringify(-1));
        return;
    } else if (name == "hello") {
        console.log("Hardcoded site attempted to be overridden");
        res.send(JSON.stringify(-2));
        return;
    } else if (fs.existsSync(`${disk}/templates/${name}.html`) && fs.existsSync(`${disk}/templates/${name}.txt`)) {
        if (fs.readFileSync(`${disk}/templates/${name}.txt`) != req.body.pass) {
            console.log("Tried to edit site; wrong pass");
            res.send(JSON.stringify(-3));
            return;
        }
    } else if (!fs.existsSync(`${disk}/templates/${name}.txt`) && !(req.body.pass === "" || req.body.pass === null)) {
        console.log(fs.existsSync(`${disk}/templates/${name}.html`) ? "Added password to a site" : "Made password-protected site");
        fs.writeFileSync(`${disk}/templates/${name}.txt`, req.body.pass);
    }
    if (!fs.existsSync(`${disk}/templates/${name}.user`) && !(req.body.user === "" || req.body.user === null)) {
        console.log(fs.existsSync(`${disk}/templates/${name}.html`) ? "Added username to a site" : "Made site with username attached");
        fs.writeFileSync(`${disk}/templates/${name}.user`, req.body.user);
    }
    fs.writeFileSync(`${disk}/templates/${name}.html`, req.body.data);
    res.send(JSON.stringify(69));
});

if (!fs.existsSync(`${disk}/templates`)) {
    // the disk has not been set up yet
    console.log("Initial disk setup");
    fs.mkdirSync(`${disk}/templates`);
    fs.writeFileSync(`${disk}/templates/hello.html`, `<!DOCTYPE html><title>hello</title><h1>hello</h1>this is a test site.`);
}

function listPages() {
    const files = fs.readdirSync(`${disk}/templates`)
    let pages = [];
    files.forEach(file => {
        if (file.substring(file.length - 5) === ".html") {
            const fname = file.substring(0, file.length - 5);
            pages.push({name: fname, author: (fs.existsSync(`${disk}/templates/${fname}.user`) ? fs.readFileSync(`${disk}/templates/${fname}.user`).toString('utf-8') : "Unknown")});
        }
    });
    return pages;
}

const WebSocket = require('ws');
const { create } = require('domain');
const { json } = require('stream/consumers');

const wss = new WebSocket.Server({server, path: '/notochat/ws'});

console.log('WebSocket server is running');

let chat_logs = fs.existsSync(`${disk}/chatlog.json`) ? JSON.parse(fs.readFileSync(`${disk}/chatlog.json`)) : [];

let userdb = fs.existsSync(`${disk}/users.json`) ? JSON.parse(fs.readFileSync(`${disk}/users.json`)) : {};

let online = 0;

const view_log_pass_exists = fs.existsSync(`${disk}/logpass.txt`);
const view_log_pass = view_log_pass_exists ? fs.readFileSync(`${disk}/logpass.txt`) : null;

app.get("/notochat/log", (req, res) => {
    if (!(req.query.pass == view_log_pass && view_log_pass_exists)) {
        res.send("you're not a admin you idot");
        return;
    }
    res.send(JSON.stringify(chat_logs));
});

function maxlength(string, max) {
    string = string || "".toString("UTF-8");
    return string.substring(0, Math.min(string.length, max));
}

// Connection event handler
wss.on('connection', (ws, req) => {
	console.log('New client connected');
    ws.id = req.headers["sec-websocket-key"];
    online++;
    ws.send(JSON.stringify({username: "System", message_body: `${online} people are online right now.`, verified: true}));
    wss.clients.forEach(client => {
        if (client.id !== ws.id) {
            client.send(JSON.stringify({username: "System", message_body: `Someone has joined. ${online - 1} people online now.`, verified: true}));
        }
    });

	// Message event handler
	ws.on('message', (message) => {
		console.log(`Received message ${message}`);
        // DO NOT TRUST USER INPUT!!!!!
        message = JSON.parse(message);
        message = {username: maxlength(message.username, 20), password: maxlength(message.password, 20), message_body: maxlength(message.message_body, 400), verified: false};
        if (message.username === "System" && message.password !== "") {
            console.log("Attempted to fake system message!");
            return;
        }
        if (message.username in userdb) {
            if (message.password === "") {
                console.log("Sent message as an unverified user.");
            } else if (message.password !== userdb[message.username]) {
                console.log("Failed to send a message: wrong password.");
                return;
            } else {
                console.log("Verified!");
                message.verified = true;
            }
        } else {
            if (message.username !== "") {
                if (message.password !== "") {
                    userdb[message.username] = message.password;
                    fs.writeFileSync(`${disk}/users.json`, JSON.stringify(userdb));
                    message.verified = true;
                } else {
                    console.log("Sent message as an unverified user.");
                }
            }
        }
        message.password = undefined;
        chat_logs.push(message);
        fs.writeFileSync(`${disk}/chatlog.json`, JSON.stringify(chat_logs));
		// ws.send(message.toString("UTF-8"));
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
	});

	// Close event handler
	ws.on('close', () => {
		console.log('Client disconnected');
        online--;
        wss.clients.forEach(client => {
            client.send(JSON.stringify({username: "System", message_body: `Someone has left. ${online} people online now.`, verified: true}));
        });
	});
}); 

server.listen(port, () => {
    console.log(`App running on port ${port}`);
});