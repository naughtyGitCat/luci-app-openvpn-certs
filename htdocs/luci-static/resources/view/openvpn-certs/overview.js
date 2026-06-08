'use strict';
'require view';
'require rpc';
'require ui';
'require dom';

var callStatus      = rpc.declare({ object: 'ovpncert', method: 'status' });
var callList        = rpc.declare({ object: 'ovpncert', method: 'list' });
var callGetSettings = rpc.declare({ object: 'ovpncert', method: 'get_settings' });
var callSetSettings = rpc.declare({ object: 'ovpncert', method: 'set_settings',
	params: [ 'remote', 'port', 'proto', 'ovpn_instance' ] });
var callInitPki     = rpc.declare({ object: 'ovpncert', method: 'init_pki',
	params: [ 'ca_cn', 'apply_to_instance' ] });
var callIssue       = rpc.declare({ object: 'ovpncert', method: 'issue', params: [ 'name' ] });
var callRevoke      = rpc.declare({ object: 'ovpncert', method: 'revoke', params: [ 'name' ] });
var callOvpn        = rpc.declare({ object: 'ovpncert', method: 'ovpn', params: [ 'name' ] });

function reload() { return location.reload(); }

function fail(res, action) {
	if (res && res.ok) return true;
	ui.addNotification(null, E('p', _('%s failed: %s').format(action, (res && res.error) || _('unknown error'))), 'danger');
	return false;
}

return view.extend({
	load: function() {
		return Promise.all([ callStatus(), callList(), callGetSettings() ]);
	},

	render: function(data) {
		var st = data[0] || {}, lst = data[1] || {}, set = data[2] || {};
		var certs = (lst && lst.certs) || [];

		var nodes = E('div', {}, [
			E('h2', {}, _('OpenVPN Certificates')),
			E('p', { 'class': 'cbi-section-descr' },
				_('Issue, list and revoke OpenVPN client certificates (easy-rsa). Requires luci-app-openvpn.'))
		]);

		/* ---- easyrsa missing ---- */
		if (!st.easyrsa) {
			nodes.appendChild(E('div', { 'class': 'alert-message warning' },
				_('easy-rsa is not installed. Install it first: opkg install openvpn-easy-rsa')));
			return nodes;
		}

		/* ---- PKI status ---- */
		var pkiBox = E('div', { 'class': 'cbi-section' }, [ E('h3', {}, _('PKI status')) ]);
		if (st.pki_ready) {
			pkiBox.appendChild(E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr' }, [ E('td', { 'class': 'td left', 'width': '33%' }, _('State')),
					E('td', { 'class': 'td left' }, E('span', { 'style': 'color:#2e7d32' }, '✓ ' + _('initialized'))) ]),
				E('tr', { 'class': 'tr' }, [ E('td', { 'class': 'td left' }, _('CA subject')),
					E('td', { 'class': 'td left' }, st.ca_subject || '-') ]),
				E('tr', { 'class': 'tr' }, [ E('td', { 'class': 'td left' }, _('CA expires')),
					E('td', { 'class': 'td left' }, st.ca_expiry || '-') ]),
				E('tr', { 'class': 'tr' }, [ E('td', { 'class': 'td left' }, _('PKI dir')),
					E('td', { 'class': 'td left' }, st.pki_dir) ])
			]));
		} else {
			pkiBox.appendChild(E('div', { 'class': 'alert-message warning' },
				_('PKI is not initialized. Initialize it below to create a fresh CA + server certificate. WARNING: this wipes any existing PKI at %s and (if applied) re-keys the server, invalidating current client configs.').format(st.pki_dir)));
			var caCn = E('input', { 'type': 'text', 'value': 'OpenVPN-CA', 'style': 'width:16em' });
			var apply = E('input', { 'type': 'checkbox', 'checked': 'checked' });
			pkiBox.appendChild(E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('CA name (CN)')),
				E('div', { 'class': 'cbi-value-field' }, caCn) ]));
			pkiBox.appendChild(E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Apply to instance "%s" & restart').format(st.instance)),
				E('div', { 'class': 'cbi-value-field' }, apply) ]));
			pkiBox.appendChild(E('div', { 'class': 'cbi-value' }, [
				E('div', { 'class': 'cbi-value-field' }, E('button', {
					'class': 'btn cbi-button cbi-button-action important',
					'click': ui.createHandlerFn(this, function() {
						if (!confirm(_('Initialize a fresh PKI now? This wipes the existing PKI and may re-key the server.')))
							return;
						return callInitPki(caCn.value || 'OpenVPN-CA', apply.checked ? 1 : 0).then(function(r) {
							if (fail(r, _('Initialize PKI'))) { ui.addNotification(null, E('p', _('PKI initialized.')), 'info'); reload(); }
						});
					})
				}, _('Initialize PKI'))) ]));
		}
		nodes.appendChild(pkiBox);

		/* ---- client settings (no secrets shipped; user fills these) ---- */
		var sRemote = E('input', { 'type': 'text', 'value': set.remote || '', 'placeholder': 'vpn.example.com', 'style': 'width:16em' });
		var sPort   = E('input', { 'type': 'text', 'value': set.port || '', 'placeholder': _('(instance port)'), 'style': 'width:8em' });
		var sProto  = E('input', { 'type': 'text', 'value': set.proto || '', 'placeholder': _('(instance proto)'), 'style': 'width:8em' });
		var setBox = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Client config settings')),
			E('p', { 'class': 'cbi-section-descr' }, _('Used when generating .ovpn files. Leave blank to inherit from the OpenVPN instance. Remote is your DDNS / public IP.')),
			E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Remote (DDNS / IP)')), E('div', { 'class': 'cbi-value-field' }, sRemote) ]),
			E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Port')), E('div', { 'class': 'cbi-value-field' }, sPort) ]),
			E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Protocol')), E('div', { 'class': 'cbi-value-field' }, sProto) ]),
			E('div', { 'class': 'cbi-value' }, [ E('div', { 'class': 'cbi-value-field' }, E('button', {
				'class': 'btn cbi-button cbi-button-save',
				'click': ui.createHandlerFn(this, function() {
					return callSetSettings(sRemote.value, sPort.value, sProto.value, set.ovpn_instance || '').then(function(r) {
						if (fail(r, _('Save settings'))) ui.addNotification(null, E('p', _('Settings saved.')), 'info');
					});
				})
			}, _('Save settings'))) ])
		]);
		nodes.appendChild(setBox);

		/* ---- certificate list ---- */
		var rows = [ E('tr', { 'class': 'tr table-titles' }, [
			E('th', { 'class': 'th' }, _('Client name')),
			E('th', { 'class': 'th' }, _('Status')),
			E('th', { 'class': 'th' }, _('Expires')),
			E('th', { 'class': 'th cbi-section-actions' }, _('Actions')) ]) ];

		if (!certs.length) {
			rows.push(E('tr', { 'class': 'tr' }, [ E('td', { 'class': 'td', 'colspan': 4 },
				E('em', {}, _('No client certificates yet.'))) ]));
		}
		certs.forEach(function(c) {
			var revoked = (c.status === 'revoked');
			rows.push(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, c.name),
				E('td', { 'class': 'td' }, E('span', {
					'style': revoked ? 'color:#c62828' : (c.status === 'expired' ? 'color:#ef6c00' : 'color:#2e7d32')
				}, c.status)),
				E('td', { 'class': 'td' }, c.expiry || '-'),
				E('td', { 'class': 'td cbi-section-actions' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-action',
						'disabled': revoked ? 'disabled' : null,
						'click': ui.createHandlerFn(this, function() {
							return callOvpn(c.name).then(function(r) {
								if (!fail(r, _('Generate .ovpn'))) return;
								var blob = new Blob([ r.config ], { type: 'application/x-openvpn-profile' });
								var a = E('a', { 'href': URL.createObjectURL(blob), 'download': c.name + '.ovpn' });
								document.body.appendChild(a); a.click(); document.body.removeChild(a);
							});
						})
					}, _('Download .ovpn')),
					' ',
					E('button', {
						'class': 'btn cbi-button cbi-button-remove',
						'disabled': revoked ? 'disabled' : null,
						'click': ui.createHandlerFn(this, function() {
							if (!confirm(_('Revoke certificate "%s"? It will be added to the CRL and the server reloaded.').format(c.name)))
								return;
							return callRevoke(c.name).then(function(r) {
								if (fail(r, _('Revoke'))) reload();
							});
						})
					}, _('Revoke'))
				])
			]));
		});

		var newName = E('input', { 'type': 'text', 'placeholder': _('e.g. laptop, phone'), 'style': 'width:14em' });
		var listBox = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Client certificates')),
			E('div', { 'class': 'table cbi-section-table' }, rows),
			E('div', { 'class': 'cbi-value', 'style': 'margin-top:1em' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Issue new')),
				E('div', { 'class': 'cbi-value-field' }, [ newName, ' ', E('button', {
					'class': 'btn cbi-button cbi-button-add',
					'click': ui.createHandlerFn(this, function() {
						var n = (newName.value || '').trim();
						if (!n) { ui.addNotification(null, E('p', _('Enter a name.')), 'warning'); return; }
						return callIssue(n).then(function(r) {
							if (fail(r, _('Issue'))) { ui.addNotification(null, E('p', _('Issued "%s".').format(n)), 'info'); reload(); }
						});
					})
				}, _('Issue certificate')) ]) ])
		]);
		nodes.appendChild(listBox);

		return nodes;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
