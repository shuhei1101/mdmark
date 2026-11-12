"""git http-backend を CGI として呼ぶ最小の smart HTTP サーバー（PoC 用）"""
import os, subprocess, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT, PORT = sys.argv[1], int(sys.argv[2])

class H(BaseHTTPRequestHandler):
    def _run(self):
        path, _, query = self.path.partition("?")
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else b""
        env = dict(os.environ, GIT_PROJECT_ROOT=ROOT, GIT_HTTP_EXPORT_ALL="1",
                   PATH_INFO=path, QUERY_STRING=query, REQUEST_METHOD=self.command,
                   CONTENT_TYPE=self.headers.get("Content-Type", ""), CONTENT_LENGTH=str(len(body)),
                   GIT_PROTOCOL=self.headers.get("Git-Protocol", ""))
        out = subprocess.run(["git", "http-backend"], input=body, env=env, capture_output=True).stdout
        head, _, rest = out.partition(b"\r\n\r\n")
        status = 200
        headers = []
        for line in head.split(b"\r\n"):
            k, _, v = line.decode().partition(":")
            if k.lower() == "status":
                status = int(v.strip().split()[0])
            elif k:
                headers.append((k, v.strip()))
        self.send_response(status)
        for k, v in headers:
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(rest)))
        self.end_headers()
        self.wfile.write(rest)
    do_GET = do_POST = _run
    def log_message(self, *a):
        pass

ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
