# DNS Tunnel Project - How to Test

  

This walkthrough shows how to validate the client (HTTP proxy) and server (DNS handler) together. Commands assume the repo root.

  

## Prereqs

- Python 3 available on both ends (or same host).

- UDP port 5454 reachable from client to server.

- Outbound DNS/HTTP allowed from the server host (for upstream DNS and real HTTP fetches).

  

## 1) Start the DNS tunnel server

Terminal A:

```bash

python3 server.py --listen 0.0.0.0 --port 5454 --upstream 8.8.8.8

```

Watch for: `[server] listening on ...` and logs like `tunnel query` or `forwarded normal DNS query`.

  

## 2) Start the tunnel client + HTTP proxy

Terminal B (replace SERVER_IP if on different hosts):

```bash

python3 client.py --dns-server SERVER_IP --dns-port 5454 --listen 127.0.0.1 --http-proxy-port 3128

```

Watch for: `[client] HTTP proxy listening on 127.0.0.1:3128`.

  

## 3) Basic HTTP test through the tunnel

Still on Terminal B or a third terminal on the client side:

```bash

curl -v -x http://127.0.0.1:3128 http://ifconfig.io

```

Expected:

- Curl shows a normal HTTP response (public IP text).

- Server logs: `tunnel query ...` and `proxying GET ... -> ifconfig.io:80`, followed by `queued response fragments`.

  

## 4) Normal DNS passthrough sanity check (optional)

From the client side:

```bash

dig @SERVER_IP -p 5454 example.com

```

Expected: A regular DNS answer; server logs `forwarded normal DNS query`.

  

## 5) Troubleshooting tips

- Timeouts: confirm UDP 5454 path and that the server’s upstream DNS (default 8.8.8.8) is reachable. You can switch with `--upstream 1.1.1.1`.

- Nothing returned to curl: watch server logs for reassembly; ensure both processes are running and no firewall is blocking UDP.

- Different hosts: use the server’s LAN IP in `--dns-server` and keep `--listen 0.0.0.0` on the server.

  

## 6) Clean exit

- Ctrl+C in both terminals to stop server and client.