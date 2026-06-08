# SPDX-License-Identifier: MIT
#
# luci-app-openvpn-certs — manage OpenVPN client certificates from LuCI
#
# Build inside an OpenWrt/LuCI feed tree (place this dir under feeds/luci/applications/),
# or just copy the files in ./root and ./htdocs onto the router (no compilation needed).

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI app to issue/list/revoke OpenVPN client certificates (easy-rsa)
LUCI_DEPENDS:=+luci-app-openvpn +openvpn-easy-rsa +openssl-util
LUCI_PKGARCH:=all

PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=psyduck

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
