const ws = new WebSocket(`ws://${location.host}`);

const poster = document.getElementById("poster");
const background = document.getElementById("background");

const title = document.getElementById("title");
const subtitle = document.getElementById("subtitle");
const event = document.getElementById("event");

function formatEvent(event){

    switch(event){

        case "play":
        case "resume":

            return "▶ REPRODUCIENDO";

        case "pause":

            return "⏸ PAUSADO";

        case "stop":

            return "■ DETENIDO";

        case "recently_added":

            return "🆕 AÑADIDO";

        default:

            return event.toUpperCase();

    }

}

ws.onmessage = ({data})=>{

    const state = JSON.parse(data);

    title.textContent = state.title;

    subtitle.textContent = state.subtitle;

    event.textContent = formatEvent(state.event);

    poster.src = `/poster?t=${Date.now()}`;

    background.style.backgroundImage =
        `url('/backdrop?t=${Date.now()}')`;

};