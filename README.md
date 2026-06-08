# luci-app-openvpn-certs

A LuCI app to manage **OpenVPN client certificates** from the web UI — issue, list,
download `.ovpn`, and revoke — backed by **easy-rsa**.

Adds a page under **LuCI → VPN → OpenVPN Certificates**. It is a companion to
`luci-app-openvpn` (which manages the server instance itself).

> No secrets are bundled. The app reads your CA/PKI and connection settings at
> runtime from the router's `easy-rsa` PKI and UCI config. You set your DDNS /
> public address in the app's settings after install.

## Features

- **Initialize PKI** — create a fresh CA + server certificate (easy-rsa), optionally
  wiring it into a chosen OpenVPN server instance and restarting it.
- **Issue** a new per-device client certificate.
- **List** issued client certificates with status (valid / revoked / expired) and expiry.
- **Download `.ovpn`** — a ready-to-import client profile with the CA + client cert/key
  (and `tls-crypt`/`tls-auth` key if the server uses one) embedded.
- **Revoke** a certificate — adds it to the CRL, enables `crl_verify` on the instance,
  and reloads the server.

## Requirements

- OpenWrt 24.10+ with the modern (JS) LuCI.
- **`luci-app-openvpn`** (hard dependency — the OpenVPN server is configured there).
- `openvpn-easy-rsa` (provides `easyrsa`) and `openssl-util`.

```sh
opkg update
opkg install luci-app-openvpn openvpn-easy-rsa openssl-util
```

## Install

### Option A — manual (no build needed)

Everything here is shell + JS + JSON + config, so you can just copy the files onto the router:

```sh
# from a checkout of this repo, on a machine with ssh access to the router:
scp -O -r root/*    root@ROUTER:/        # /etc, /usr/...
scp -O -r htdocs/*  root@ROUTER:/www/luci-static/   # the view JS
ssh root@ROUTER 'chmod +x /usr/libexec/rpcd/ovpncert /etc/uci-defaults/40_luci-app-openvpn-certs; \
                 sh /etc/uci-defaults/40_luci-app-openvpn-certs; \
                 /etc/init.d/rpcd restart; rm -f /tmp/luci-indexcache'
```
Then hard-refresh LuCI (Ctrl-Shift-R). The page appears under **VPN → OpenVPN Certificates**.

### Option B — build an `.ipk`

Drop this directory into an OpenWrt LuCI feed
(`feeds/luci/applications/luci-app-openvpn-certs`) and:

```sh
./scripts/feeds install luci-app-openvpn-certs
make package/luci-app-openvpn-certs/compile V=s
```

## Usage

1. Open **VPN → OpenVPN Certificates**.
2. **Client config settings** → set **Remote** to your DDNS / public IP (and port/proto
   if not inheriting from the instance). *(This is where your address lives — never in git.)*
3. If the PKI is not initialized, click **Initialize PKI**
   (tick *Apply to instance* to re-key the server in one go).
4. **Issue** a cert per device, then **Download .ovpn** and import it into your client.
5. Lost a device? **Revoke** its cert — it stops working immediately after the reload.

## Configuration (`/etc/config/ovpncert`)

| option | default | meaning |
|---|---|---|
| `pki_dir` | `/etc/easy-rsa/pki` | easy-rsa PKI location |
| `ovpn_instance` | `myvpn` | the `/etc/config/openvpn` section to manage |
| `server_cn` | `server` | server cert CN (hidden from the client list) |
| `remote` | *(empty)* | client connect address; blank → instance's `ddns` option |
| `port` / `proto` | *(empty)* | blank → inherit from the instance |

## Security notes

- Client keys are generated **without a passphrase** (`nopass`) so `.ovpn` files are
  self-contained — treat downloaded `.ovpn` files as secrets.
- One cert per device lets you revoke individually. Avoid sharing a single cert across
  devices unless you also enable `duplicate-cn` on the server.
- The repo contains **no** keys, certs, DDNS names or other site data.

## License

MIT — see [LICENSE](LICENSE).
