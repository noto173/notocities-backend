const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();
const cors = require("cors");
const development = process.env.NODE_ENV !== "production";
const disk = development ? "./disk" : "/var/data";
app.use(cors(development ? null : {origin: "https://noto173.net"}));
app.use(express.json());
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
    console.log("Recieved upload request");
    const relative = path.relative(`${disk}/templates`, `${disk}/templates/${req.body.name}.html`);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        console.log("Failed");
        res.send(JSON.stringify(-1));
        return;
    }
    writePage(req.body.name, req.body.data);
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
    return fs.readdirSync(`${disk}/templates`).map(dir => dir.substr(0, dir.length - 5));
}

function writePage(name, data) {
    return fs.writeFileSync(`${disk}/templates/${name}.html`, data);
}