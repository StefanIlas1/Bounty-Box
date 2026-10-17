#!/usr/bin/env python3
"""Local agent task board. Stdlib only; no shell execution or provider secrets."""
import argparse
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / ".coordination"
DEFAULT_PORT = 4317


def connect():
    db = sqlite3.connect(STATE / "board.sqlite3", timeout=10)
    db.row_factory = sqlite3.Row
    return db


def initialize():
    STATE.mkdir(mode=0o700, exist_ok=True)
    token_file = STATE / "token"
    if not token_file.exists():
        fd = os.open(token_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as output:
            output.write(secrets.token_urlsafe(32))
    with connect() as db:
        db.executescript("""
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS agents (
            id TEXT PRIMARY KEY, role TEXT NOT NULL, last_seen REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, instructions TEXT NOT NULL,
            paths TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
            owner TEXT, updated REAL NOT NULL, result TEXT NOT NULL DEFAULT '');
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT, sender TEXT NOT NULL,
            recipient TEXT NOT NULL, body TEXT NOT NULL, created REAL NOT NULL);
        """)


class Handler(BaseHTTPRequestHandler):
    server_version = "BountyCoord/1"

    def log_message(self, *_):
        pass

    def reply(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        expected = "Bearer " + (STATE / "token").read_text().strip()
        return secrets.compare_digest(self.headers.get("Authorization", ""), expected)

    def do_GET(self):
        path = urlsplit(self.path)
        if path.path == "/health":
            return self.reply(200, {"ok": True, "service": "bounty-box-coordination"})
        if not self.authorized():
            return self.reply(401, {"error": "Use the local coordination CLI."})
        query = parse_qs(path.query)
        with connect() as db:
            if path.path in ("/", "/board"):
                return self.reply(200, {
                    "agents": [dict(r) for r in db.execute("SELECT * FROM agents ORDER BY id")],
                    "tasks": [dict(r) for r in db.execute("SELECT * FROM tasks ORDER BY id")],
                    "message_cursor": db.execute("SELECT coalesce(max(id),0) FROM messages").fetchone()[0],
                })
            if path.path == "/messages":
                agent = query.get("agent", [""])[0]
                try:
                    after = max(0, int(query.get("after", ["0"])[0]))
                except ValueError:
                    return self.reply(400, {"error": "after must be an integer"})
                rows = db.execute("SELECT * FROM messages WHERE id > ? AND (recipient = ? OR recipient = '*') ORDER BY id LIMIT 100", (after, agent))
                return self.reply(200, [dict(r) for r in rows])
        self.reply(404, {"error": "Unknown endpoint"})

    def do_POST(self):
        if not self.authorized():
            return self.reply(401, {"error": "Use the local coordination CLI."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > 65536:
                raise ValueError("Request body must be 1–65536 bytes")
            data = json.loads(self.rfile.read(length))
            agent = data.get("agent", "")
            if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,63}", agent):
                raise ValueError("Provide a lowercase agent identifier")
            now = time.time()
            with connect() as db:
                db.execute("BEGIN IMMEDIATE")
                if self.path == "/register":
                    role = str(data.get("role", "contributor"))[:1000]
                    db.execute("INSERT INTO agents VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET role=excluded.role,last_seen=excluded.last_seen", (agent, role, now))
                    return self.reply(200, {"registered": agent})
                if not db.execute("SELECT 1 FROM agents WHERE id=?", (agent,)).fetchone():
                    return self.reply(409, {"error": "Register first"})
                db.execute("UPDATE agents SET last_seen=? WHERE id=?", (now, agent))
                if self.path == "/messages":
                    body = str(data.get("body", "")).strip()
                    if not body:
                        raise ValueError("Message cannot be empty")
                    cursor = db.execute("INSERT INTO messages(sender,recipient,body,created) VALUES(?,?,?,?)", (agent, str(data.get("to", "agent-1")), body, now))
                    return self.reply(201, {"id": cursor.lastrowid})
                if self.path == "/tasks":
                    if agent != "agent-1":
                        return self.reply(403, {"error": "Only the coordinator creates tasks"})
                    db.execute("INSERT INTO tasks(id,title,instructions,paths,updated) VALUES(?,?,?,?,?)", (data["id"], data["title"], data["instructions"], json.dumps(data["paths"]), now))
                    return self.reply(201, {"created": data["id"]})
                match = re.fullmatch(r"/tasks/([a-z0-9_-]+)/(claim|complete|block)", self.path)
                if match:
                    task_id, action = match.groups()
                    task = db.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
                    if not task:
                        return self.reply(404, {"error": "Task not found"})
                    if action == "claim":
                        if task["owner"] == agent and task["status"] == "active":
                            return self.reply(200, dict(task))
                        if task["status"] != "pending":
                            return self.reply(409, {"error": "Task already claimed", "owner": task["owner"]})
                        db.execute("UPDATE tasks SET owner=?,status='active',updated=? WHERE id=?", (agent, now, task_id))
                    else:
                        if task["owner"] != agent or task["status"] not in ("active", "blocked"):
                            return self.reply(409, {"error": "Only the current owner can finish or block a task"})
                        result = str(data.get("result", "")).strip()
                        if not result:
                            raise ValueError("Provide a result or blocker description")
                        status = "done" if action == "complete" else "blocked"
                        db.execute("UPDATE tasks SET status=?,result=?,updated=? WHERE id=?", (status, result, now, task_id))
                        db.execute("INSERT INTO messages(sender,recipient,body,created) VALUES(?,?,?,?)", (agent, "agent-1", f"{task_id}: {status}: {result}", now))
                    return self.reply(200, dict(db.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()))
            self.reply(404, {"error": "Unknown endpoint"})
        except (ValueError, TypeError, KeyError, AttributeError, sqlite3.IntegrityError) as error:
            self.reply(400, {"error": str(error)})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("serve")
    sub.add_parser("status")
    register = sub.add_parser("register")
    register.add_argument("agent")
    register.add_argument("role")
    inbox = sub.add_parser("inbox")
    inbox.add_argument("agent")
    inbox.add_argument("--after", type=int, default=0)
    send = sub.add_parser("send")
    send.add_argument("agent")
    send.add_argument("to")
    send.add_argument("body")
    create = sub.add_parser("create")
    create.add_argument("file", help="JSON task file (id, title, instructions, paths)")
    for command in ("claim", "complete", "block"):
        item = sub.add_parser(command)
        item.add_argument("agent")
        item.add_argument("task")
        if command != "claim":
            item.add_argument("result")
    args = parser.parse_args()
    if args.command == "serve":
        initialize()
        server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
        server.daemon_threads = True
        print(f"Bounty-Box coordination listening at http://127.0.0.1:{args.port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()
        return
    body = None
    if args.command == "status":
        path = "/board"
    elif args.command == "inbox":
        if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,63}", args.agent):
            parser.error("Invalid agent identifier")
        path = f"/messages?agent={args.agent}&after={args.after}"
    elif args.command == "register":
        path, body = "/register", {"agent": args.agent, "role": args.role}
    elif args.command == "send":
        path, body = "/messages", {"agent": args.agent, "to": args.to, "body": args.body}
    elif args.command == "create":
        path, body = "/tasks", {**json.loads(Path(args.file).read_text()), "agent": "agent-1"}
    else:
        path = f"/tasks/{args.task}/{args.command}"
        body = {"agent": args.agent, "result": getattr(args, "result", "")}
    try:
        token = (STATE / "token").read_text().strip()
        request = Request(f"http://127.0.0.1:{args.port}{path}",
                          data=json.dumps(body).encode() if body else None,
                          headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        with urlopen(request, timeout=10) as response:
            print(json.dumps(json.load(response), indent=2))
    except HTTPError as error:
        print(error.read().decode())
        raise SystemExit(1)
    except (OSError, ValueError) as error:
        parser.exit(1, f"Coordination unavailable: {error}\nStart: python3 scripts/coordination.py serve\n")


if __name__ == "__main__":
    main()
