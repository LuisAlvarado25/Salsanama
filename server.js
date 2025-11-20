const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const CLIENT_ID = "AQUI_TU_CLIENT_ID";
const CLIENT_SECRET = "AQUI_TU_CLIENT_SECRET";

app.post("/token", async (req, res) => {
  const { code, redirect_uri } = req.body;

  const authString = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authString}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(
      redirect_uri
    )}`,
  });

  const data = await response.json();
  res.json(data);
});

app.listen(3000, () => console.log("Servidor corriendo en http://localhost:3000"));
