// ----------------------------------------------------
// CONFIGURACIÓN
// ----------------------------------------------------
const CLIENT_ID = "9643b3fc5b11421da0364a8eff9b8545";
const REDIRECT_URI = "https://luisalvarado25.github.io/Salsanama/index.html";
const SCOPES = "playlist-read-private playlist-read-collaborative user-modify-playback-state user-read-playback-state streaming";

// DOM
const loginBtn = document.getElementById("loginBtn");
const playlistsList = document.getElementById("playlists");
const tracksList = document.getElementById("tracks");
const playBtn = document.getElementById("playBtn");
const contador = document.getElementById("contador");
const duracionEl = document.getElementById("duracion");
const seekbar = document.getElementById("seekbar");
const seekbarProgress = document.getElementById("seekbar-progress");
const contadorSegundos = document.getElementById("contadorsegundos");

// Variables del player
let player;
let deviceId;
let isDeviceReady = false;
let accessTokenGlobal = null;
let isPlaying = false;
let updateInterval = null;

// Chicharra 40s
let chicharraAudio = new Audio("chicharra.mp3");
chicharraAudio.preload = "auto";
let contador40s = 0;
let intervalo40s = null;
let lastTrackId = null;
let lastPosition = 0;

// ----------------------------------------------------
// LOGIN
// ----------------------------------------------------
loginBtn.addEventListener("click", login);

async function login() {
    const codeVerifier = generateCodeVerifier(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    localStorage.setItem("code_verifier", codeVerifier);

    const params = new URLSearchParams({
        response_type: "code",
        client_id: CLIENT_ID,
        scope: SCOPES,
        redirect_uri: REDIRECT_URI,
        code_challenge_method: "S256",
        code_challenge: codeChallenge,
    });

    window.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function generateCodeVerifier(length) {
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let value = "";
    for (let i = 0; i < length; i++) value += possible.charAt(Math.floor(Math.random() * possible.length));
    return value;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

// ----------------------------------------------------
// ONLOAD
// ----------------------------------------------------
window.onload = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (!code) return;

    const token = await getAccessToken(code);
    if (token) {
        accessTokenGlobal = token;
        hideLoginButton();
        loadPlaylists(token);
        initWebPlayer(token);
    }
};

function hideLoginButton() { loginBtn.style.display = "none"; }

async function getAccessToken(code) {
    const verifier = localStorage.getItem("code_verifier");
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier
    });
    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });
    const data = await result.json();
    return data.access_token;
}

// ----------------------------------------------------
// LOAD PLAYLISTS
// ----------------------------------------------------
function loadPlaylists(accessToken) {
    fetch("https://api.spotify.com/v1/me/playlists", {
        headers: { Authorization: `Bearer ${accessToken}` }
    })
    .then(res => res.json())
    .then(data => {
        playlistsList.innerHTML = "";
        data.items.forEach(pl => {
            const li = document.createElement("li");
            li.textContent = pl.name;
            li.style.cursor = "pointer";
            li.addEventListener("click", () => loadTracks(accessToken, pl.id));
            playlistsList.appendChild(li);
        });
    });
}

// ----------------------------------------------------
// LOAD TRACKS
// ----------------------------------------------------
async function loadTracks(accessToken, playlistId) {
    const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json();
    tracksList.innerHTML = "";
    data.items.forEach(item => {
        const track = item.track;
        const li = document.createElement("li");
        li.textContent = track.name + " — " + track.artists[0].name;
        li.style.cursor = "pointer";
        li.addEventListener("click", () => playTrack(track.uri));
        tracksList.appendChild(li);
    });
}

// ----------------------------------------------------
// INIT PLAYER
// ----------------------------------------------------
function initWebPlayer(token) {
    player = new Spotify.Player({
        name: 'Mi Web Player',
        getOAuthToken: cb => cb(token),
        volume: 0.5
    });

    player.addListener('ready', ({ device_id }) => {
        deviceId = device_id;
        isDeviceReady = true;
        console.log("Player listo:", deviceId);
    });

    player.addListener('authentication_error', ({ message }) => console.error("Auth error:", message));

    player.addListener("player_state_changed", state => {
        if (!state) return;
        isPlaying = !state.paused;
        playBtn.textContent = isPlaying ? "⏸️" : "▶️";
        updateSeekbar(state);
        start40sCounter(state);
    });

    player.connect();
}

// ----------------------------------------------------
// PLAY TRACK
// ----------------------------------------------------
async function playTrack(uri) {
    if (!isDeviceReady) return;
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method:'PUT',
        headers: {'Authorization': `Bearer ${accessTokenGlobal}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({ uris: [uri] })
    });
}

// ----------------------------------------------------
// BOTÓN PLAY/PAUSA
// ----------------------------------------------------
playBtn.addEventListener("click", async () => {
    if (!isDeviceReady) return;
    if (!isPlaying) { await player.resume(); isPlaying = true; playBtn.textContent="⏸️"; }
    else { await player.pause(); isPlaying = false; playBtn.textContent="▶️"; }
});

// ----------------------------------------------------
// SEEKBAR
// ----------------------------------------------------
function formatTime(ms) {
    const totalSeconds = Math.floor(ms/1000);
    const m = Math.floor(totalSeconds/60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2,"0")}`;
}

function updateSeekbar(state) {
    if (!state) return;
    contador.textContent = formatTime(state.position);
    duracionEl.textContent = formatTime(state.duration);
    seekbarProgress.style.width = `${(state.position/state.duration)*100}%`;
}

seekbar.addEventListener("click", async e => {
    if (!isDeviceReady) return;
    const rect = seekbar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const state = await player.getCurrentState();
    if (!state) return;
    await player.seek((clickX/width) * state.duration);
});

// ----------------------------------------------------
// CONTADOR 40s CHICHARRA
// ----------------------------------------------------
function start40sCounter(state) {
    if (!state) return;
    const trackId = state.track_window.current_track.id;
    const position = state.position;

    // Reiniciar si cambia, pausa o adelanta
    if (lastTrackId !== trackId || state.paused || Math.abs(position-lastPosition)>2000) {
        contador40s = 0;
        lastTrackId = trackId;
        lastPosition = position;
    }

    if (intervalo40s) clearInterval(intervalo40s);

    intervalo40s = setInterval(async () => {
        const s = await player.getCurrentState();
        if (!s || s.paused) return;
        const nowTrack = s.track_window.current_track.id;
        const nowPos = s.position;

        if (nowTrack !== lastTrackId || Math.abs(nowPos - lastPosition)>2000) {
            contador40s = 0;
            lastTrackId = nowTrack;
            lastPosition = nowPos;
        } else {
            contador40s++;
            lastPosition = nowPos;
        }

        contadorSegundos.textContent = `0:${contador40s.toString().padStart(2,"0")}`;

        if (contador40s >= 40) {
            try { await chicharraAudio.play(); } catch {}
            contador40s = 0;
        }
    }, 1000);
}

