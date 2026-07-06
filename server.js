import express from "express";
import { WebSocketServer } from "ws";
import { XMLParser } from "fast-xml-parser";

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

const PLEX_URL = "http://192.168.1.50:32400";
const PLEX_TOKEN = "ZisgLgiJX9erEB8zyg2S";

//const PLEX_URL = process.env.PLEX_URL;
//const PLEX_TOKEN = process.env.PLEX_TOKEN;

if (!PLEX_URL || !PLEX_TOKEN) {
    throw new Error("PLEX_URL y PLEX_TOKEN son obligatorios.");
}

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ""
});

const server = app.listen(3000, () => {
    console.log("Listening on :3000");
});

const wss = new WebSocketServer({ server });

let state = {
    event: "idle",
    title: "Esperando...",
    subtitle: "",
    year: "",
    poster: false,
    backdrop: false
};

let posterBuffer = null;
let posterContentType = "image/jpeg";

let backdropBuffer = null;
let backdropContentType = "image/jpeg";

function broadcast() {

    const json = JSON.stringify(state);

    wss.clients.forEach(client => {

        if (client.readyState === 1) {

            client.send(json);

        }

    });

}

wss.on("connection", ws => {

    ws.send(JSON.stringify(state));

});

async function downloadImage(url){

    const response = await fetch(url);

    if(!response.ok){

        throw new Error("No se pudo descargar la imagen");

    }

    return {

        buffer: Buffer.from(await response.arrayBuffer()),

        contentType:
            response.headers.get("content-type") || "image/jpeg"

    };

}

async function getMetadata(ratingKey){

    const url =
        `${PLEX_URL}/library/metadata/${ratingKey}?X-Plex-Token=${PLEX_TOKEN}`;

    const response = await fetch(url);

    if(!response.ok){

        throw new Error("No se pudo consultar Plex");

    }

    const xml = await response.text();

    const data = parser.parse(xml);

    const video = data.MediaContainer.Video;

    // Poster
    const poster =
        `${PLEX_URL}${video.thumb}?X-Plex-Token=${PLEX_TOKEN}`;

    // Episodios -> usar el thumb como fondo
    // Películas -> usar el art
    const backdropPath =
        video.type === "episode"
            ? video.thumb
            : video.art;

    const backdrop =
        `${PLEX_URL}${backdropPath}?X-Plex-Token=${PLEX_TOKEN}`;

    const posterImage = await downloadImage(poster);

    posterBuffer = posterImage.buffer;
    posterContentType = posterImage.contentType;

    const backdropImage = await downloadImage(backdrop);

    backdropBuffer = backdropImage.buffer;
    backdropContentType = backdropImage.contentType;

    return {

        title: video.title,

        subtitle:
            video.type === "episode"
                ? `${video.grandparentTitle} · S${String(video.parentIndex).padStart(2,"0")}E${String(video.index).padStart(2,"0")}`
                : (video.tagline || ""),

        year: video.year,

        type: video.type,

        ratingKey

    };

}

app.get("/poster",(req,res)=>{

    if(!posterBuffer){

        return res.sendStatus(404);

    }

    res.setHeader("Content-Type",posterContentType);

    res.send(posterBuffer);

});

app.get("/backdrop",(req,res)=>{

    if(!backdropBuffer){

        return res.sendStatus(404);

    }

    res.setHeader("Content-Type",backdropContentType);

    res.send(backdropBuffer);

});

app.post("/webhook", async(req,res)=>{

    try{

        console.log(req.body);

        const metadata =
            await getMetadata(req.body.ratingKey);

state = {

    event:req.body.event,

    title:metadata.title,

    subtitle:metadata.subtitle,

    year:metadata.year,

    type:metadata.type,

    ratingKey:metadata.ratingKey,

    poster:true,

    backdrop:true

};

        broadcast();

        res.sendStatus(200);

    }

    catch(err){

        console.error(err);

        res.sendStatus(500);

    }

});