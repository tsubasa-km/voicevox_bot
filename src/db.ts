import { Keyv } from "keyv";
import { KeyvSqlite } from "@keyv/sqlite";

const db = new Keyv(new KeyvSqlite("sqlite://database.sqlite"));

db.on("error", (err: Error) => console.error("Keyv connection error:", err));

export { db };
