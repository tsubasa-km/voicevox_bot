const { Keyv } = require("keyv");
const { KeyvSqlite } = require("@keyv/sqlite");

const db = new Keyv(new KeyvSqlite("sqlite://database.sqlite"));

db.on("error", (err) => console.error("Keyv connection error:", err));

module.exports = db;
