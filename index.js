const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();
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

app.listen(port, () => {
    console.log(`App running on port ${port}`);
});

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

const wss = new WebSocket.Server({ port: 8080 });

console.log('WebSocket server is running on ws://localhost:8080');

// Connection event handler
wss.on('connection', (ws) => {
	console.log('New client connected');

	// Message event handler
	ws.on('message', (message) => {
		console.log(`Received message ${message}`);
		ws.send(message.toString("UTF-8"));
	});

	// Close event handler
	ws.on('close', () => {
		console.log('Client disconnected');
	});
}); 